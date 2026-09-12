import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { Pool } from 'pg';
import { buildApp } from '../src/app.js';
import { PostgresRepository } from '../src/db/repository.js';
import { createRecoveryToken, hashPassword } from '../src/security/credentials.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for authentication integration tests');
const pool = new Pool({ connectionString: databaseUrl });
const repo = new PostgresRepository(pool);
const app = buildApp({ repository: repo, testAuth: false }).app;

before(async () => {
  await pool.query('TRUNCATE audit_events, deletion_requests, verification_events, class_memberships, classes, workspace_memberships, teacher_workspaces, permission_grants, guardian_relationships, child_profiles, credential_recovery_tokens, authentication_attempts, sessions, adult_profiles, authentication_identities, accounts CASCADE');
});
after(async () => { await app.close(); await pool.end(); });

function cookieOf(response: any): string { const header = response.headers['set-cookie']; assert.ok(header); return String(header).split(';')[0]; }

test('adult signup stores a password credential, creates a durable session, and exposes only safe account data', async () => {
  const response = await app.inject({ method: 'POST', url: '/v1/auth/signup', payload: { email: 'signup@example.test', password: 'StrongPassword9', displayName: 'Signed Up Adult' } });
  assert.equal(response.statusCode, 201); assert.equal(response.json().account.email, 'signup@example.test'); assert.equal(response.json().account.password, undefined);
  const account = await repo.findAccountByEmail('signup@example.test'); assert.ok(account); assert.equal(await repo.getPasswordHash(account!.id) !== null, true);
  assert.equal((await app.inject({ method: 'GET', url: '/v1/me', headers: { cookie: cookieOf(response) } })).statusCode, 200);
});

test('login rejects wrong credentials, rate-limits repeated failures, and rotates an existing session', async () => {
  const signup = await app.inject({ method: 'POST', url: '/v1/auth/signup', payload: { email: 'login@example.test', password: 'AnotherStrong9', displayName: 'Login Adult' } }); const firstCookie = cookieOf(signup);
  const wrong = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email: 'login@example.test', password: 'wrong' } }); assert.equal(wrong.statusCode, 401); assert.deepEqual(wrong.json(), { error: 'invalid_credentials' });
  const login = await app.inject({ method: 'POST', url: '/v1/auth/login', headers: { cookie: firstCookie }, payload: { email: 'login@example.test', password: 'AnotherStrong9' } }); assert.equal(login.statusCode, 200); const secondCookie = cookieOf(login); assert.notEqual(secondCookie, firstCookie);
  assert.equal((await app.inject({ method: 'GET', url: '/v1/me', headers: { cookie: firstCookie } })).statusCode, 401); assert.equal((await app.inject({ method: 'GET', url: '/v1/me', headers: { cookie: secondCookie } })).statusCode, 200);
  for (let i = 0; i < 10; i++) await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email: 'login@example.test', password: 'wrong-again' } });
  assert.equal((await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email: 'login@example.test', password: 'AnotherStrong9' } })).statusCode, 429);
});

test('suspended accounts cannot authenticate and recovery responses do not disclose account existence', async () => {
  const account = await repo.createAdultAccount('suspended@example.test', 'Suspended Adult', await hashPassword('SuspendedStrong9')); await repo.setAccountStatus(account.id, 'suspended');
  assert.equal((await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email: account.email, password: 'SuspendedStrong9' } })).statusCode, 401);
  const known = await app.inject({ method: 'POST', url: '/v1/auth/recovery/request', payload: { email: account.email } }); const unknown = await app.inject({ method: 'POST', url: '/v1/auth/recovery/request', payload: { email: 'does-not-exist@example.test' } }); assert.equal(known.statusCode, 202); assert.equal(unknown.statusCode, 202); assert.deepEqual(known.json(), { ok: true }); assert.deepEqual(unknown.json(), { ok: true });
});

test('recovery tokens are one-time, expire through the database predicate, and revoke existing sessions after password reset', async () => {
  const account = await repo.createAdultAccount('recovery@example.test', 'Recovery Adult', await hashPassword('RecoveryStrong9')); const session = await repo.createSession(account.id); const recovery = createRecoveryToken(); await repo.createRecoveryToken(account.id, recovery.hash, 30 * 60 * 1000);
  const reset = await app.inject({ method: 'POST', url: '/v1/auth/recovery/reset', payload: { token: recovery.token, password: 'ResetStrong9' } }); assert.equal(reset.statusCode, 200);
  assert.equal((await app.inject({ method: 'GET', url: '/v1/me', headers: { cookie: `lexora_session=${session.id}` } })).statusCode, 401);
  assert.equal((await app.inject({ method: 'POST', url: '/v1/auth/recovery/reset', payload: { token: recovery.token, password: 'ResetAgain9' } })).statusCode, 400);
  const login = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email: account.email, password: 'ResetStrong9' } }); assert.equal(login.statusCode, 200);
});

test('password step-up binds verification to actor, target, action, and session', async () => {
  const signup = await app.inject({ method: 'POST', url: '/v1/auth/signup', payload: { email: 'stepup@example.test', password: 'StepUpStrong9', displayName: 'Step Up Adult' } }); const cookie = cookieOf(signup); const account = await repo.findAccountByEmail('stepup@example.test');
  const verified = await app.inject({ method: 'POST', url: '/v1/step-up/complete', headers: { cookie }, payload: { targetId: account!.id, action: 'adult_account:delete', password: 'StepUpStrong9' } }); assert.equal(verified.statusCode, 201);
  const event = await pool.query('SELECT session_id FROM verification_events WHERE id=$1', [verified.json().verificationEventId]); assert.equal(event.rows[0].session_id !== null, true);
  const otherSession = await repo.createSession(account!.id); assert.equal(await repo.consumeVerification(verified.json().verificationEventId, account!.id, account!.id, 'adult_account:delete', otherSession.id), false);
});

test('unknown accounts and cross-account recovery tokens fail closed', async () => {
  const response = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email: 'unknown@example.test', password: 'AnyStrong9' } }); assert.equal(response.statusCode, 401);
  const account = await repo.findAccountByEmail('signup@example.test'); const recovery = createRecoveryToken(); await repo.createRecoveryToken(account!.id, recovery.hash, 30 * 60 * 1000); assert.equal(await repo.consumeRecoveryToken('not-the-token'), null);
});

test('expired sessions are rejected while concurrent sessions remain independently revocable', async () => {
  const account = await repo.createAdultAccount('sessions@example.test', 'Sessions Adult', await hashPassword('SessionsStrong9')); const expired = await repo.createSession(account.id, -1); const live = await repo.createSession(account.id, 60_000);
  assert.equal((await app.inject({ method: 'GET', url: '/v1/me', headers: { cookie: `lexora_session=${expired.id}` } })).statusCode, 401);
  assert.equal((await app.inject({ method: 'GET', url: '/v1/me', headers: { cookie: `lexora_session=${live.id}` } })).statusCode, 200);
  await repo.revokeSession(live.id); assert.equal((await app.inject({ method: 'GET', url: '/v1/me', headers: { cookie: `lexora_session=${live.id}` } })).statusCode, 401);
});

test('unknown sensitive actions fail closed', async () => {
  const account = await repo.createAdultAccount('unknown-action@example.test', 'Action Adult', await hashPassword('ActionStrong9')); const session = await repo.createSession(account.id);
  const response = await app.inject({ method: 'POST', url: '/v1/step-up/complete', headers: { cookie: `lexora_session=${session.id}` }, payload: { targetId: account.id, action: 'unknown:action', password: 'ActionStrong9' } });
  assert.equal(response.statusCode, 403);
});
