import assert from 'node:assert/strict';
import test from 'node:test';
import { buildApp } from '../src/app.js';
import { createGoogleLinkToken } from '../src/security/google.js';

process.env.NODE_ENV = 'test';
process.env.OAUTH_STATE_SECRET = 'test-oauth-state-secret';

test('Google linking requires the existing password and creates a session', async () => {
  const { app, repository } = buildApp({ testAuth: true });
  const signup = await app.inject({ method: 'POST', url: '/v1/auth/signup', payload: { email: 'link@example.test', password: 'LinkStrong99', displayName: 'Link Adult' } });
  assert.equal(signup.statusCode, 201);
  const account = await repository.findAccountByEmail('link@example.test');
  assert.ok(account);
  const token = createGoogleLinkToken({ subject: 'google-subject-1', email: 'link@example.test', displayName: 'Link Adult' });
  const response = await app.inject({ method: 'POST', url: '/v1/auth/google/link', headers: { cookie: `lexora_google_link=${token}` }, payload: { password: 'LinkStrong99' } });
  assert.equal(response.statusCode, 200);
  assert.match(String(response.headers['set-cookie'] || ''), /lexora_session=/);
  assert.equal((await repository.findAccountByIdentity('google', 'google-subject-1'))?.id, account.id);
  await app.close();
});

test('Google linking rejects an incorrect password without linking the identity', async () => {
  const { app, repository } = buildApp({ testAuth: true });
  const signup = await app.inject({ method: 'POST', url: '/v1/auth/signup', payload: { email: 'link-fail@example.test', password: 'LinkStrong99', displayName: 'Link Fail' } });
  assert.equal(signup.statusCode, 201);
  const token = createGoogleLinkToken({ subject: 'google-subject-2', email: 'link-fail@example.test', displayName: 'Link Fail' });
  const response = await app.inject({ method: 'POST', url: '/v1/auth/google/link', headers: { cookie: `lexora_google_link=${token}` }, payload: { password: 'WrongStrong9' } });
  assert.equal(response.statusCode, 401);
  assert.equal(await repository.findAccountByIdentity('google', 'google-subject-2'), null);
  await app.close();
});
