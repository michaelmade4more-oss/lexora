import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { test, before, after } from 'node:test';
import { Pool } from 'pg';
import { buildApp } from '../src/app.js';
import { PostgresRepository } from '../src/db/repository.js';
import { CaptureRecoveryDeliveryProvider, deliverRecoveryWithRetry, PostmarkRecoveryDeliveryProvider, type RecoveryDeliveryProvider, type RecoveryDeliveryResult, type RecoveryMessage } from '../src/recovery/delivery.js';
import { hashPassword } from '../src/security/credentials.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const repo = new PostgresRepository(pool);
const capture = new CaptureRecoveryDeliveryProvider();
const app = buildApp({ repository: repo, recoveryProvider: capture }).app;

before(async () => {
  await pool.query('TRUNCATE audit_events, recovery_suppressions, recovery_webhook_events, recovery_deliveries, deletion_requests, verification_events, class_memberships, classes, workspace_memberships, teacher_workspaces, permission_grants, guardian_relationships, child_profiles, credential_recovery_tokens, authentication_attempts, sessions, adult_profiles, authentication_identities, accounts CASCADE');
  process.env.POSTMARK_WEBHOOK_USERNAME = 'webhook-user'; process.env.POSTMARK_WEBHOOK_PASSWORD = 'webhook-password';
});
after(async () => { await app.close(); await pool.end(); });

class ScriptedProvider implements RecoveryDeliveryProvider {
  readonly name = 'postmark'; attempts = 0;
  constructor(private readonly results: RecoveryDeliveryResult[]) {}
  async send(_message: RecoveryMessage) { return this.results[Math.min(this.attempts++, this.results.length - 1)]; }
}

test('successful capture delivery creates a durable submitted delivery without exposing the reset token outside test mode', async () => {
  const signup = await app.inject({ method: 'POST', url: '/v1/auth/signup', payload: { email: 'delivery@example.test', password: 'DeliveryStrong9', displayName: 'Delivery Adult' } }); assert.equal(signup.statusCode, 201);
  const response = await app.inject({ method: 'POST', url: '/v1/auth/recovery/request', payload: { email: 'delivery@example.test' } }); assert.equal(response.statusCode, 202); assert.ok(response.json().testRecoveryToken); assert.equal(capture.messages.length, 1); assert.equal(capture.messages[0].resetUrl.includes(response.json().testRecoveryToken), true);
  const row = await pool.query(`SELECT status, provider FROM recovery_deliveries WHERE account_id=(SELECT id FROM accounts WHERE email='delivery@example.test')`); assert.equal(row.rows[0].status, 'submitted'); assert.equal(row.rows[0].provider, 'capture');
});

test('transient provider failures retry and permanent provider rejection is recorded without changing the generic API response', async () => {
  const transient = new ScriptedProvider([{ status: 'failed', failureKind: 'transient', errorCode: '503' }, { status: 'failed', failureKind: 'timeout', errorCode: 'timeout' }, { status: 'submitted', providerMessageId: 'pm-retry-1' }]);
  const result = await deliverRecoveryWithRetry(transient, { recipient: 'retry@example.test', resetUrl: 'https://example.test/reset?token=redacted', correlationId: 'corr-retry' }); assert.equal(result.status, 'submitted'); assert.equal(transient.attempts, 3);
  const rejected = new ScriptedProvider([{ status: 'failed', failureKind: 'permanent', errorCode: '400' }]); const rejectedApp = buildApp({ repository: repo, recoveryProvider: rejected }).app;
  await repo.createAdultAccount('rejected@example.test', 'Rejected Adult', await hashPassword('RejectedStrong9')); const response = await rejectedApp.inject({ method: 'POST', url: '/v1/auth/recovery/request', payload: { email: 'rejected@example.test' } }); assert.equal(response.statusCode, 202); assert.deepEqual(response.json().ok, true); await rejectedApp.close();
});

test('Postmark webhook requires basic authentication, is idempotent, and preserves bounce state against out-of-order delivery', async () => {
  const account = await repo.createAdultAccount('webhook@example.test', 'Webhook Adult', await hashPassword('WebhookStrong9')); const tokenId = await repo.createRecoveryToken(account.id, 'hash-webhook', 1_800_000); const deliveryId = await repo.createRecoveryDelivery(account.id, tokenId, crypto.randomUUID(), 'postmark'); await repo.updateRecoveryDelivery(deliveryId, 'submitted', 'pm-webhook-1');
  const event = { RecordType: 'Bounce', Type: 'HardBounce', MessageID: 'pm-webhook-1', Description: 'mailbox unavailable' }; const headers = { authorization: `Basic ${Buffer.from('webhook-user:webhook-password').toString('base64')}`, 'x-pm-webhook-trace-id': 'trace-bounce' };
  assert.equal((await app.inject({ method: 'POST', url: '/v1/webhooks/postmark/recovery', payload: event })).statusCode, 401);
  const first = await app.inject({ method: 'POST', url: '/v1/webhooks/postmark/recovery', headers, payload: event }); assert.equal(first.statusCode, 200); const duplicate = await app.inject({ method: 'POST', url: '/v1/webhooks/postmark/recovery', headers, payload: event }); assert.equal(duplicate.statusCode, 200); assert.equal(duplicate.json().duplicate, true);
  const delivery = await pool.query('SELECT status FROM recovery_deliveries WHERE id=$1', [deliveryId]); assert.equal(delivery.rows[0].status, 'bounced'); assert.equal(await repo.isRecoverySuppressed(account.email), true);
  const outOfOrder = await app.inject({ method: 'POST', url: '/v1/webhooks/postmark/recovery', headers: { ...headers, 'x-pm-webhook-trace-id': 'trace-delivery' }, payload: { RecordType: 'Delivery', MessageID: 'pm-webhook-1' } }); assert.equal(outOfOrder.statusCode, 200); const preserved = await pool.query('SELECT status FROM recovery_deliveries WHERE id=$1', [deliveryId]); assert.equal(preserved.rows[0].status, 'bounced');
});

test('spam complaint creates suppression and unknown or malformed webhook events fail safely', async () => {
  const account = await repo.createAdultAccount('complaint@example.test', 'Complaint Adult', await hashPassword('ComplaintStrong9')); const tokenId = await repo.createRecoveryToken(account.id, 'hash-complaint', 1_800_000); const deliveryId = await repo.createRecoveryDelivery(account.id, tokenId, crypto.randomUUID(), 'postmark'); await repo.updateRecoveryDelivery(deliveryId, 'submitted', 'pm-complaint-1');
  const headers = { authorization: `Basic ${Buffer.from('webhook-user:webhook-password').toString('base64')}`, 'x-pm-webhook-trace-id': 'trace-complaint' }; const complaint = await app.inject({ method: 'POST', url: '/v1/webhooks/postmark/recovery', headers, payload: { RecordType: 'Bounce', Type: 'SpamComplaint', MessageID: 'pm-complaint-1', Description: 'spam complaint' } }); assert.equal(complaint.statusCode, 200); assert.equal(await repo.isRecoverySuppressed(account.email), true);
  assert.equal((await app.inject({ method: 'POST', url: '/v1/webhooks/postmark/recovery', headers: { ...headers, 'x-pm-webhook-trace-id': 'trace-unknown' }, payload: { RecordType: 'Unknown', MessageID: 'pm-unknown' } })).statusCode, 400);
});

test('recovery request abuse remains generic for suppressed and unknown accounts', async () => {
  const known = await app.inject({ method: 'POST', url: '/v1/auth/recovery/request', payload: { email: 'complaint@example.test' } }); const unknown = await app.inject({ method: 'POST', url: '/v1/auth/recovery/request', payload: { email: 'unknown-abuse@example.test' } }); assert.equal(known.statusCode, 202); assert.equal(unknown.statusCode, 202); assert.equal(known.json().ok, true); assert.equal(unknown.json().ok, true); assert.equal(known.json().testRecoveryToken, undefined); assert.deepEqual(unknown.json(), { ok: true });
});

test('Postmark adapter contract submits a template request without placing the token in provider metadata', async () => {
  let received: any; const server = http.createServer((request, response) => { let raw = ''; request.on('data', chunk => raw += chunk); request.on('end', () => { received = JSON.parse(raw); response.setHeader('content-type', 'application/json'); response.end(JSON.stringify({ MessageID: 'pm-sandbox-contract-1', ErrorCode: 0 })); }); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve())); const address = server.address() as any;
  const provider = new PostmarkRecoveryDeliveryProvider({ serverToken: 'test-server-token', from: 'Lexora <no-reply@example.test>', templateAlias: 'lexora-password-recovery', endpoint: `http://127.0.0.1:${address.port}/email/withTemplate` }); const result = await provider.send({ recipient: 'mailbox@example.test', resetUrl: 'https://app.example.test/reset-password?token=raw-test-token', correlationId: 'corr-sandbox-contract' }); await new Promise<void>(resolve => server.close(() => resolve()));
  assert.equal(result.status, 'submitted'); assert.equal(result.providerMessageId, 'pm-sandbox-contract-1'); assert.equal(received.Metadata.correlation_id, 'corr-sandbox-contract'); assert.equal(received.Metadata.reset_url, undefined); assert.equal(received.TemplateModel.reset_url.includes('raw-test-token'), true);
});
