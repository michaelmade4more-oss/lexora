import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test, before, after } from 'node:test';
import { Pool } from 'pg';
import { buildApp } from '../src/app.js';
import { PostgresRepository } from '../src/db/repository.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for PostgreSQL integration tests');
const pool = new Pool({ connectionString: databaseUrl });
let repo: PostgresRepository;
let app1: ReturnType<typeof buildApp>['app'];
let app2: ReturnType<typeof buildApp>['app'];
let guardian: string; let unrelated: string; let delegated: string; let teacher: string; let child: string; let workspace: string; let group: string; let classMembership: string;

before(async () => {
  await pool.query('TRUNCATE audit_events, deletion_requests, verification_events, class_memberships, classes, workspace_memberships, teacher_workspaces, permission_grants, guardian_relationships, child_profiles, sessions, adult_profiles, authentication_identities, accounts CASCADE');
  repo = new PostgresRepository(pool);
  guardian = randomUUID(); unrelated = randomUUID(); delegated = randomUUID(); teacher = randomUUID(); child = randomUUID(); workspace = randomUUID(); group = randomUUID(); classMembership = randomUUID();
  await pool.query(`INSERT INTO accounts(id,kind,email) VALUES ($1,'adult','pg-guardian@test'),($2,'adult','pg-unrelated@test'),($3,'adult','pg-delegated@test'),($4,'teacher','pg-teacher@test')`, [guardian, unrelated, delegated, teacher]);
  await pool.query(`INSERT INTO adult_profiles(account_id,display_name) VALUES ($1,'Guardian')`, [guardian]);
  await pool.query(`INSERT INTO child_profiles(id,primary_guardian_account_id,display_name,learning_level,avatar) VALUES ($1,$2,'PG Child','Early Learner','early-learner-01')`, [child, guardian]);
  await pool.query(`INSERT INTO teacher_workspaces(id,name) VALUES ($1,'PG Workspace')`, [workspace]);
  await pool.query(`INSERT INTO workspace_memberships(workspace_id,account_id,role,status) VALUES ($1,$2,'teacher','active')`, [workspace, teacher]);
  await pool.query(`INSERT INTO classes(id,workspace_id,name) VALUES ($1,$2,'PG Class')`, [group, workspace]);
  await pool.query(`INSERT INTO class_memberships(id,class_id,child_profile_id,status) VALUES ($1,$2,$3,'active')`, [classMembership, group, child]);
  const relationship = randomUUID();
  await pool.query(`INSERT INTO guardian_relationships(id,delegated_adult_account_id,child_profile_id,status) VALUES ($1,$2,$3,'active')`, [relationship, delegated, child]);
  await pool.query(`INSERT INTO permission_grants(guardian_relationship_id,capability,status) VALUES ($1,'child:read','active')`, [relationship]);
  app1 = buildApp({ repository: repo, testAuth: true }).app;
  app2 = buildApp({ repository: repo, testAuth: true }).app;
});

after(async () => { await app1.close(); await app2.close(); await pool.end(); });

async function login(app: typeof app1, accountId: string) { const r = await app.inject({ method: 'POST', url: '/v1/auth/test-login', payload: { accountId } }); assert.equal(r.statusCode, 200); return String(r.headers['set-cookie']).split(';')[0]; }
async function get(app: typeof app1, cookie: string, url: string) { return app.inject({ method: 'GET', url, headers: { cookie } }); }

test('PostgreSQL-backed sessions survive application instance replacement and logout revokes them', async () => {
  const cookie = await login(app1, guardian);
  assert.equal((await get(app2, cookie, '/v1/me')).statusCode, 200);
  assert.equal((await app2.inject({ method: 'POST', url: '/v1/auth/logout', headers: { cookie } })).statusCode, 200);
  assert.equal((await get(app1, cookie, '/v1/me')).statusCode, 401);
});

test('PostgreSQL authorization isolates guardian, delegated, teacher, and unrelated scopes', async () => {
  const guardianCookie = await login(app1, guardian); const unrelatedCookie = await login(app1, unrelated); const delegatedCookie = await login(app1, delegated); const teacherCookie = await login(app1, teacher);
  assert.equal((await get(app1, guardianCookie, `/v1/child-profiles/${child}`)).statusCode, 200);
  assert.equal((await get(app1, unrelatedCookie, `/v1/child-profiles/${child}`)).statusCode, 403);
  assert.equal((await get(app1, delegatedCookie, `/v1/child-profiles/${child}`)).statusCode, 200);
  const teacherView = await get(app1, teacherCookie, `/v1/child-profiles/${child}`); assert.equal(teacherView.statusCode, 200); assert.equal(teacherView.json().childProfile.primaryGuardianAccountId, undefined);
  await pool.query(`UPDATE class_memberships SET status='removed' WHERE id=$1`, [classMembership]);
  assert.equal((await get(app1, teacherCookie, `/v1/child-profiles/${child}`)).statusCode, 403);
});

test('PostgreSQL deletion requests and audit records persist together', async () => {
  const cookie = await login(app1, guardian); const verification = await app1.inject({ method: 'POST', url: '/v1/step-up/complete', headers: { cookie }, payload: { targetId: child, action: 'child_profile:delete', proof: 'test-approved-proof' } }); assert.equal(verification.statusCode, 201);
  const result = await app1.inject({ method: 'POST', url: `/v1/child-profiles/${child}/deletion-requests`, headers: { cookie }, payload: { verificationEventId: verification.json().verificationEventId } }); assert.equal(result.statusCode, 202);
  const persisted = await pool.query(`SELECT d.id, d.status AS request_status, c.status AS child_status, a.event_type FROM deletion_requests d JOIN child_profiles c ON c.id=d.target_id JOIN audit_events a ON a.target_id=d.target_id AND a.event_type='child_deletion_requested' WHERE d.target_id=$1`, [child]); assert.equal(persisted.rowCount, 1); assert.equal(persisted.rows[0].request_status, 'requested'); assert.equal(persisted.rows[0].child_status, 'deletion_requested'); assert.equal(persisted.rows[0].event_type, 'child_deletion_requested');
});

test('PostgreSQL transaction rolls back mutation when audit insertion fails', async () => {
  const otherChild = randomUUID(); const otherClass = randomUUID(); await pool.query(`INSERT INTO child_profiles(id,primary_guardian_account_id,display_name,learning_level,avatar) VALUES ($1,$2,'Rollback Child','Early Learner','x')`, [otherChild, guardian]); await pool.query(`INSERT INTO classes(id,workspace_id,name) VALUES ($1,$2,'Rollback Class')`, [otherClass, workspace]);
  await assert.rejects(() => repo.withTransaction(async tx => { await tx.createClassMembership(otherClass, otherChild); await tx.createAudit({ actorAccountId: guardian, eventType: 'rollback', targetType: 'child_profile', targetId: 'not-a-uuid', result: 'success' } as any); }));
  const rows = await pool.query(`SELECT 1 FROM class_memberships WHERE class_id=$1 AND child_profile_id=$2`, [otherClass, otherChild]); assert.equal(rows.rowCount, 0);
});

test('PostgreSQL uniqueness and verification replay remain fail-closed under concurrency', async () => {
  const concurrentChild = randomUUID(); await pool.query(`INSERT INTO child_profiles(id,primary_guardian_account_id,display_name,learning_level,avatar) VALUES ($1,$2,'Concurrent Child','Early Learner','x')`, [concurrentChild, guardian]);
  const attempts = await Promise.allSettled([repo.createGuardian(delegated, concurrentChild), repo.createGuardian(delegated, concurrentChild)]); assert.equal(attempts.filter(x => x.status === 'fulfilled').length, 1); assert.equal(attempts.filter(x => x.status === 'rejected').length, 1);
  const verification = await repo.createVerification(guardian, concurrentChild, 'child_profile:delete'); const consumed = await Promise.all([repo.consumeVerification(verification.id, guardian, concurrentChild, 'child_profile:delete'), repo.consumeVerification(verification.id, guardian, concurrentChild, 'child_profile:delete')]); assert.deepEqual(consumed.sort(), [false, true]);
});
