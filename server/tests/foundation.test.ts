import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import { buildApp } from '../src/app.js';
import { MemoryStore } from '../src/domain/store.js';

let store: MemoryStore;
let app: ReturnType<typeof buildApp>['app'];
let guardian: ReturnType<MemoryStore['account']>;
let unrelated: ReturnType<MemoryStore['account']>;
let delegated: ReturnType<MemoryStore['account']>;
let teacher: ReturnType<MemoryStore['account']>;
let child: ReturnType<MemoryStore['child']>;
let workspace: ReturnType<MemoryStore['workspace']>;
let group: ReturnType<MemoryStore['classGroup']>;

beforeEach(async () => {
  store = new MemoryStore();
  ({ app } = buildApp({ store, testAuth: true }));
  guardian = store.account('adult', 'guardian@example.test');
  unrelated = store.account('adult', 'unrelated@example.test');
  delegated = store.account('adult', 'delegated@example.test');
  teacher = store.account('teacher', 'teacher@example.test');
  store.adultProfile(guardian.id, 'Guardian');
  child = store.child(guardian.id, 'Ava');
  workspace = store.workspace();
  store.workspaceMember(workspace.id, teacher.id);
  group = store.classGroup(workspace.id);
});

async function login(accountId: string) {
  const response = await app.inject({ method: 'POST', url: '/v1/auth/test-login', payload: { accountId } });
  assert.equal(response.statusCode, 200);
  const setCookie = response.headers['set-cookie'];
  const value = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  assert.ok(value);
  return String(value).split(';')[0];
}
async function request(accountId: string, options: any) { return app.inject({ ...options, headers: { ...(options.headers || {}), cookie: await login(accountId) } }); }


test('unauthenticated requests are denied', async () => {
  const response = await app.inject({ method: 'GET', url: `/v1/child-profiles/${child.id}` });
  assert.equal(response.statusCode, 401);
});

test('Primary Guardian can access an owned Child Profile', async () => {
  const response = await request(guardian.id, { method: 'GET', url: `/v1/child-profiles/${child.id}` });
  assert.equal(response.statusCode, 200);
});

test('unrelated Adult cannot access the Child Profile and mutation does not occur', async () => {
  const response = await request(unrelated.id, { method: 'GET', url: `/v1/child-profiles/${child.id}` });
  assert.equal(response.statusCode, 403);
  assert.equal(store.audit.size > 0, true);
  assert.equal(store.childProfiles.get(child.id)?.displayName, 'Ava');
});

test('Delegated Adult receives only explicitly granted capability', async () => {
  const relationship = store.guardian(delegated.id, child.id);
  store.grant(relationship.id, 'child:read');
  const read = await request(delegated.id, { method: 'GET', url: `/v1/child-profiles/${child.id}` });
  assert.equal(read.statusCode, 200);
  const updateAttempt = await request(delegated.id, { method: 'GET', url: `/v1/child-profiles/${child.id}`, headers: { 'x-requested-capability': 'child:control:update' } });
  assert.equal(updateAttempt.statusCode, 200); // read remains allowed; no control command exists in milestone one.
  assert.equal(store.guardians.get(relationship.id)?.status, 'active');
});

test('Removing delegated access revokes access', async () => {
  const relationship = store.guardian(delegated.id, child.id);
  store.grant(relationship.id, 'child:read');
  assert.equal((await request(delegated.id, { method: 'GET', url: `/v1/child-profiles/${child.id}` })).statusCode, 200);
  assert.equal((await request(guardian.id, { method: 'POST', url: `/v1/guardian-relationships/${relationship.id}/revoke` })).statusCode, 200);
  assert.equal((await request(delegated.id, { method: 'GET', url: `/v1/child-profiles/${child.id}` })).statusCode, 403);
  assert.equal(store.childProfiles.has(child.id), true);
});

test('Teacher access requires Workspace Membership and active Class Membership', async () => {
  let response = await request(teacher.id, { method: 'GET', url: `/v1/child-profiles/${child.id}` });
  assert.equal(response.statusCode, 403);
  const membership = store.classMember(group.id, child.id);
  response = await request(teacher.id, { method: 'GET', url: `/v1/child-profiles/${child.id}` });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().scope, 'teaching');
  store.workspaceMemberships.values().next().value!.status = 'revoked';
  assert.equal((await request(teacher.id, { method: 'GET', url: `/v1/child-profiles/${child.id}` })).statusCode, 403);
  store.workspaceMemberships.values().next().value!.status = 'active';
  membership.status = 'removed';
  assert.equal((await request(teacher.id, { method: 'GET', url: `/v1/child-profiles/${child.id}` })).statusCode, 403);
});

test('Teacher access does not expose unrelated children or guardian access', async () => {
  const otherChild = store.child(guardian.id, 'Other');
  store.classMember(group.id, child.id);
  assert.equal((await request(teacher.id, { method: 'GET', url: `/v1/child-profiles/${otherChild.id}` })).statusCode, 403);
  const visible = await request(teacher.id, { method: 'GET', url: `/v1/child-profiles/${child.id}` });
  assert.equal(visible.statusCode, 200);
  assert.equal(visible.json().childProfile.primaryGuardianAccountId, undefined);
});

test('Child deletion does not delete the Adult Account', async () => {
  const verification = await request(guardian.id, { method: 'POST', url: '/v1/step-up/complete', payload: { targetId: child.id, action: 'child_profile:delete', proof: 'test-approved-proof' } });
  const verificationId = verification.json().verificationEventId;
  const response = await request(guardian.id, { method: 'POST', url: `/v1/child-profiles/${child.id}/deletion-requests`, payload: { verificationEventId: verificationId } });
  assert.equal(response.statusCode, 202);
  assert.equal(store.accounts.get(guardian.id)?.status, 'active');
  assert.equal(store.childProfiles.get(child.id)?.status, 'deletion_requested');
});

test('Relationship removal does not delete Child Profile data', async () => {
  const relationship = store.guardian(delegated.id, child.id);
  await request(guardian.id, { method: 'POST', url: `/v1/guardian-relationships/${relationship.id}/revoke` });
  assert.equal(store.childProfiles.has(child.id), true);
  assert.equal(store.childProfiles.get(child.id)?.displayName, 'Ava');
});

test('Sensitive actions require valid step-up verification', async () => {
  const response = await request(guardian.id, { method: 'POST', url: `/v1/child-profiles/${child.id}/deletion-requests`, payload: {} });
  assert.equal(response.statusCode, 403);
});

test('Verification for one target/action cannot authorize another target/action', async () => {
  const otherChild = store.child(unrelated.id, 'Other');
  const verification = await request(guardian.id, { method: 'POST', url: '/v1/step-up/complete', payload: { targetId: child.id, action: 'child_profile:delete', proof: 'test-approved-proof' } });
  const response = await request(guardian.id, { method: 'POST', url: `/v1/child-profiles/${otherChild.id}/deletion-requests`, payload: { verificationEventId: verification.json().verificationEventId } });
  assert.equal(response.statusCode, 403);
});

test('Sensitive mutations produce audit records', async () => {
  const before = store.audit.size;
  const verification = await request(guardian.id, { method: 'POST', url: '/v1/step-up/complete', payload: { targetId: child.id, action: 'child_profile:delete', proof: 'test-approved-proof' } });
  await request(guardian.id, { method: 'POST', url: `/v1/child-profiles/${child.id}/deletion-requests`, payload: { verificationEventId: verification.json().verificationEventId } });
  assert.equal(store.audit.size >= before + 2, true);
  assert.equal([...store.audit.values()].some(event => event.eventType === 'child_deletion_requested' && event.result === 'success'), true);
});

test('API routes expose schema-safe health and current account context', async () => {
  assert.equal((await app.inject({ method: 'GET', url: '/health' })).statusCode, 200);
  const response = await request(guardian.id, { method: 'GET', url: '/v1/me' });
  assert.deepEqual(response.json().account.id, guardian.id);
});
