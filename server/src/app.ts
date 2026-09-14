import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { MemoryStore } from './domain/store.js';
import { MemoryRepository, type FoundationRepository } from './db/repository.js';
import { authorizeChildRead, canCreateClass, canDeleteChild, canRemoveClassMembership, canRevokeGuardian } from './policies/authorization.js';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { createRecoveryToken, hashRecoveryToken, hashPassword, normalizeEmail, validatePasswordPolicy, verifyPassword } from './security/credentials.js';
import { createRecoveryDeliveryProvider, deliverRecoveryWithRetry, type RecoveryDeliveryProvider } from './recovery/delivery.js';
import { createGoogleAuthorizationUrl, exchangeAndVerifyGoogleCode, createOAuthState, googleConfig, randomOAuthNonce, verifyOAuthState } from './security/google.js';

export interface AppOptions { store?: MemoryStore; repository?: FoundationRepository; testAuth?: boolean; recoveryProvider?: RecoveryDeliveryProvider; }
type Body = Record<string, unknown>; type Params = Record<string, string>;

export function buildApp(options: AppOptions = {}): { app: FastifyInstance; store: MemoryStore; repository: FoundationRepository } {
  const store = options.store ?? new MemoryStore();
  const repo = options.repository ?? new MemoryRepository(store);
  const recoveryProvider = options.recoveryProvider ?? (String(process.env.NODE_ENV) === 'test' ? createRecoveryDeliveryProvider() : null);
  const app = Fastify({ logger: false, bodyLimit: 64 * 1024 });
  app.register(cookie);
  app.register(cors, { origin: process.env.LEXORA_ALLOWED_ORIGIN || false, credentials: true });
  app.register(rateLimit, { max: 120, timeWindow: '1 minute', errorResponseBuilder: () => ({ error: 'rate_limited' }) });
  app.setErrorHandler((error, _request, reply) => {
    if ((error as any).validation || (error as any).statusCode === 400 || (error as any).code === 'FST_ERR_CTP_INVALID_JSON_BODY') return reply.code(400).send({ error: 'invalid_request' });
    return reply.code(500).send({ error: 'internal_error' });
  });
  app.addHook('onRequest', async (request, reply) => {
    const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
    if (mutation && request.cookies.lexora_session && String(process.env.NODE_ENV) === 'production') {
      const origin = request.headers.origin;
      if (!process.env.LEXORA_ALLOWED_ORIGIN || origin !== process.env.LEXORA_ALLOWED_ORIGIN) return reply.code(403).send({ error: 'csrf_rejected' });
    }
  });

  async function auth(request: FastifyRequest) {
    const token = request.cookies.lexora_session; if (!token) return null;
    const session = await repo.findSession(token); if (!session) return null;
    const account = await repo.findAccount(session.accountId); if (!account || account.status !== 'active') return null;
    return { account, session };
  }
  async function deny(ctx: any, eventType: string, targetType: string, targetId: string) {
    await repo.createAudit({ actorAccountId: ctx?.account.id ?? null, eventType, targetType, targetId, result: 'denied' });
    return { error: 'forbidden' };
  }
  async function unauthorized(reply: any) { return reply.code(401).send({ error: 'unauthorized' }); }
  function bodySchema(properties: Record<string, unknown>) { return { type: 'object', properties, additionalProperties: false }; }
  function ipHash(request: FastifyRequest) { return hashRecoveryToken(request.ip || 'unknown'); }
  function authCookie(reply: any, session: { id: string }) { reply.setCookie('lexora_session', session.id, { httpOnly: true, sameSite: 'lax', path: '/', secure: String(process.env.NODE_ENV) === 'production' }); }
  const frontendOrigin = () => process.env.LEXORA_ALLOWED_ORIGIN || 'https://lexora-15qy.onrender.com';
  function googleErrorRedirect(code: string) { return `${frontendOrigin()}/auth.html?oauth_error=${encodeURIComponent(code)}`; }
  function webhookAuthorized(request: FastifyRequest) { const header = String(request.headers.authorization || ''); if (!header.startsWith('Basic ') || !process.env.POSTMARK_WEBHOOK_USERNAME || !process.env.POSTMARK_WEBHOOK_PASSWORD) return false; const expected = Buffer.from(`${process.env.POSTMARK_WEBHOOK_USERNAME}:${process.env.POSTMARK_WEBHOOK_PASSWORD}`).toString('base64'); const actual = Buffer.from(header.slice(6)); const wanted = Buffer.from(expected); return actual.length === wanted.length && timingSafeEqual(actual, wanted); }

  app.get('/health', async () => ({ status: 'ok', service: 'lexora-foundation-api' }));
  app.get('/v1/auth/google', async (_request, reply) => {
    try {
      googleConfig();
      const nonce = randomOAuthNonce();
      const state = createOAuthState(nonce);
      const url = await createGoogleAuthorizationUrl(state, nonce);
      reply.setCookie('lexora_oauth_state', state, { httpOnly: true, sameSite: 'lax', path: '/v1/auth/google', secure: String(process.env.NODE_ENV) === 'production', maxAge: 600 });
      return reply.redirect(url);
    } catch { return reply.redirect(googleErrorRedirect('google_unavailable')); }
  });
  app.get('/v1/auth/google/callback', async (request, reply) => {
    const query = request.query as { code?: string; state?: string; error?: string };
    const stateCookie = request.cookies.lexora_oauth_state;
    reply.clearCookie('lexora_oauth_state', { path: '/v1/auth/google' });
    const state = stateCookie && query.state && stateCookie === query.state ? verifyOAuthState(query.state) : null;
    if (!state || !query.code || query.error) return reply.redirect(googleErrorRedirect(query.error === 'access_denied' ? 'google_cancelled' : 'google_failed'));
    try {
      const identity = await exchangeAndVerifyGoogleCode(query.code, state.nonce);
      let account = await repo.findAccountByIdentity('google', identity.subject);
      if (!account) {
        const existing = await repo.findAccountByEmail(identity.email);
        if (existing) {
          await repo.createAudit({ actorAccountId: existing.id, eventType: 'google_authentication_rejected_existing_password_account', targetType: 'adult_account', targetId: existing.id, result: 'failure', scope: 'google' });
          return reply.redirect(googleErrorRedirect('google_email_exists'));
        }
        account = await repo.withTransaction(async tx => {
          const created = await tx.createGoogleAccount(identity.email, identity.displayName, identity.subject);
          await tx.createAudit({ actorAccountId: created.id, eventType: 'google_account_created', targetType: 'adult_account', targetId: created.id, result: 'success', scope: 'google' });
          return created;
        });
      }
      if (account.status !== 'active') {
        await repo.createAudit({ actorAccountId: account.id, eventType: 'google_authentication_failed', targetType: 'adult_account', targetId: account.id, result: 'failure', scope: 'google' });
        return reply.redirect(googleErrorRedirect('google_account_unavailable'));
      }
      const existingSession = await auth(request);
      const session = existingSession ? await repo.rotateSession(existingSession.session.id, account.id, Number(process.env.SESSION_TTL_SECONDS || 28800) * 1000) : await repo.createSession(account.id, Number(process.env.SESSION_TTL_SECONDS || 28800) * 1000);
      authCookie(reply, session);
      await repo.createAudit({ actorAccountId: account.id, eventType: 'google_authentication_succeeded', targetType: 'adult_account', targetId: account.id, result: 'success', scope: 'google' });
      return reply.redirect(`${frontendOrigin()}/profile-picker.html`);
    } catch {
      return reply.redirect(googleErrorRedirect('google_failed'));
    }
  });
  app.post('/v1/auth/signup', { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } }, schema: { body: bodySchema({ email: { type: 'string', minLength: 3, maxLength: 320 }, password: { type: 'string', minLength: 12, maxLength: 128 }, displayName: { type: 'string', minLength: 1, maxLength: 120 } }) } }, async (request, reply) => {
    const body = request.body as Body; const email = normalizeEmail(String(body.email || '')); const password = String(body.password || ''); const displayName = String(body.displayName || '').trim();
    if (!email.includes('@') || validatePasswordPolicy(password) || !displayName) return reply.code(400).send({ error: 'invalid_request' });
    if (await repo.findAccountByEmail(email)) return reply.code(409).send({ error: 'account_unavailable' });
    try { const account = await repo.withTransaction(async tx => { const created = await tx.createAdultAccount(email, displayName, await hashPassword(password)); await tx.createAudit({ actorAccountId: created.id, eventType: 'adult_account_created', targetType: 'adult_account', targetId: created.id, result: 'success' }); return created; }); const session = await repo.createSession(account.id, Number(process.env.SESSION_TTL_SECONDS || 28800) * 1000); authCookie(reply, session); return reply.code(201).send({ account: { id: account.id, kind: account.kind, email: account.email, status: account.status } }); } catch { return reply.code(409).send({ error: 'account_unavailable' }); }
  });
  app.post('/v1/auth/login', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } }, schema: { body: bodySchema({ email: { type: 'string', minLength: 3, maxLength: 320 }, password: { type: 'string', minLength: 1, maxLength: 128 } }) } }, async (request, reply) => {
    const body = request.body as Body; const email = normalizeEmail(String(body.email || '')); const password = String(body.password || ''); const sourceIp = ipHash(request); const failures = await repo.countRecentAuthenticationFailures(email, sourceIp, 15 * 60 * 1000);
    if (failures >= 10) return reply.code(429).send({ error: 'authentication_unavailable' });
    const account = await repo.findAccountByEmail(email); const hash = account ? await repo.getPasswordHash(account.id) : null; const valid = !!account && !!hash && account.status === 'active' && await verifyPassword(password, hash);
    await repo.recordAuthenticationAttempt(email, sourceIp, valid);
    if (!valid) { if (account) await repo.createAudit({ actorAccountId: account.id, eventType: 'authentication_failed', targetType: 'adult_account', targetId: account.id, result: 'failure' }); return reply.code(401).send({ error: 'invalid_credentials' }); }
    const existing = await auth(request); const session = existing ? await repo.rotateSession(existing.session.id, account!.id, Number(process.env.SESSION_TTL_SECONDS || 28800) * 1000) : await repo.createSession(account!.id, Number(process.env.SESSION_TTL_SECONDS || 28800) * 1000); authCookie(reply, session); await repo.createAudit({ actorAccountId: account!.id, eventType: 'authentication_succeeded', targetType: 'adult_account', targetId: account!.id, result: 'success' }); return { account: { id: account!.id, kind: account!.kind, email: account!.email, status: account!.status } };
  });
  app.post('/v1/auth/recovery/request', { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } }, schema: { body: bodySchema({ email: { type: 'string', minLength: 3, maxLength: 320 } }) } }, async (request, reply) => {
    await repo.recordRecoveryMetric('recovery_request'); const email = normalizeEmail(String((request.body as Body).email || '')); const account = await repo.findAccountByEmail(email); let token: string | undefined;
    if (account && account.status === 'active' && !(await repo.isRecoverySuppressed(email))) { const created = createRecoveryToken(); token = created.token; const tokenId = await repo.createRecoveryToken(account.id, created.hash, 30 * 60 * 1000); const correlationId = randomUUID(); const deliveryId = await repo.createRecoveryDelivery(account.id, tokenId, correlationId, recoveryProvider?.name || 'disabled'); await repo.createAudit({ actorAccountId: account.id, eventType: 'credential_recovery_requested', targetType: 'adult_account', targetId: account.id, result: 'success' }); if (recoveryProvider) { const origin = process.env.RECOVERY_APP_ORIGIN || (String(process.env.NODE_ENV) === 'test' ? 'http://localhost:4173' : ''); const result = origin ? await deliverRecoveryWithRetry(recoveryProvider, { recipient: email, resetUrl: `${origin}/reset-password?token=${encodeURIComponent(token)}`, correlationId }) : { status: 'failed' as const, failureKind: 'permanent' as const, errorCode: 'missing_recovery_origin' }; await repo.updateRecoveryDelivery(deliveryId, result.status, result.providerMessageId, result.errorCode, result.failureKind === 'transient' || result.failureKind === 'rate_limited' || result.failureKind === 'timeout' ? new Date(Date.now() + 60_000) : undefined); await repo.recordRecoveryMetric(result.status === 'submitted' ? 'recovery_delivery_submitted' : 'recovery_delivery_failed'); await repo.createAudit({ actorAccountId: account.id, eventType: result.status === 'submitted' ? 'credential_recovery_delivery_submitted' : 'credential_recovery_delivery_failed', targetType: 'adult_account', targetId: account.id, result: result.status === 'submitted' ? 'success' : 'failure' }); } else { await repo.updateRecoveryDelivery(deliveryId, 'failed', undefined, 'delivery_disabled'); await repo.recordRecoveryMetric('recovery_delivery_failed'); await repo.createAudit({ actorAccountId: account.id, eventType: 'credential_recovery_delivery_failed', targetType: 'adult_account', targetId: account.id, result: 'failure' }); } }
    const response: Body = { ok: true }; if (String(process.env.NODE_ENV) === 'test' && token) response.testRecoveryToken = token; return reply.code(202).send(response);
  });
  app.post('/v1/auth/recovery/reset', { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } }, schema: { body: bodySchema({ token: { type: 'string', minLength: 20, maxLength: 128 }, password: { type: 'string', minLength: 12, maxLength: 128 } }) } }, async (request, reply) => {
    const body = request.body as Body; const password = String(body.password || ''); if (validatePasswordPolicy(password)) return reply.code(400).send({ error: 'invalid_request' });
    try { const account = await repo.withTransaction(async tx => { const recovered = await tx.consumeRecoveryToken(hashRecoveryToken(String(body.token || ''))); if (!recovered) throw new Error('invalid_recovery'); await tx.updatePassword(recovered.accountId, await hashPassword(password)); await tx.setAccountStatus(recovered.accountId, 'active'); await tx.createAudit({ actorAccountId: recovered.accountId, eventType: 'credential_recovery_completed', targetType: 'adult_account', targetId: recovered.accountId, result: 'success' }); return tx.findAccount(recovered.accountId); }); if (!account) throw new Error('invalid_recovery'); await repo.recordRecoveryMetric('recovery_completed'); return { ok: true }; } catch { return reply.code(400).send({ error: 'invalid_recovery' }); }
  });
  app.post('/v1/webhooks/postmark/recovery', async (request, reply) => {
    if (!webhookAuthorized(request)) return reply.code(401).send({ error: 'unauthorized' });
    const event = request.body as any; const messageId = String(event?.MessageID || ''); const recordType = String(event?.RecordType || ''); const eventKey = String(request.headers['x-pm-webhook-trace-id'] || `${messageId}:${recordType}`); if (!messageId || !['Delivery','Bounce'].includes(recordType)) return reply.code(400).send({ error: 'invalid_webhook' });
    const payloadHash = createHash('sha256').update(JSON.stringify(event)).digest('hex'); const fresh = await repo.recordRecoveryWebhook('postmark', eventKey, messageId, recordType, payloadHash); if (!fresh) { await repo.recordRecoveryMetric('recovery_webhook_duplicate'); return reply.code(200).send({ ok: true, duplicate: true }); }
    const delivery = await repo.findRecoveryDeliveryByProviderMessage('postmark', messageId); if (!delivery) return reply.code(200).send({ ok: true, ignored: true });
    if (recordType === 'Delivery') { await repo.recordRecoveryMetric('recovery_delivery_delivered'); await repo.updateRecoveryDelivery(delivery.id, 'delivered', messageId); } else { const complaint = String(event.Type || '').toLowerCase().includes('spam'); const status = complaint ? 'complaint' : 'bounced'; await repo.recordRecoveryMetric(complaint ? 'recovery_complaint' : 'recovery_bounce'); await repo.updateRecoveryDelivery(delivery.id, status, messageId, String(event.Description || 'provider_bounce')); const account = await repo.findAccount(delivery.accountId); if (account) { await repo.addRecoverySuppression(account.email, complaint ? 'complaint' : 'bounce', 'postmark', messageId); await repo.createAudit({ actorAccountId: account.id, eventType: complaint ? 'credential_recovery_delivery_complaint' : 'credential_recovery_delivery_bounced', targetType: 'adult_account', targetId: account.id, result: 'failure' }); } }
    return reply.code(200).send({ ok: true });
  });
  app.post('/v1/auth/test-login', { schema: { body: bodySchema({ accountId: { type: 'string', minLength: 1 } }) } }, async (request, reply) => {
    if (!options.testAuth || process.env.NODE_ENV !== 'test') return reply.code(404).send({ error: 'not_found' });
    const account = await repo.findAccount(String((request.body as Body).accountId));
    if (!account || account.status !== 'active') return reply.code(401).send({ error: 'invalid_account' });
    const session = await repo.createSession(account.id); reply.setCookie('lexora_session', session.id, { httpOnly: true, sameSite: 'lax', path: '/', secure: String(process.env.NODE_ENV) === 'production' });
    return { accountId: account.id };
  });
  app.post('/v1/auth/logout', async (request, reply) => { const ctx = await auth(request); if (ctx) await repo.revokeSession(ctx.session.id); reply.clearCookie('lexora_session', { path: '/' }); return { ok: true }; });
  app.get('/v1/me', async (request, reply) => { const ctx = await auth(request); if (!ctx) return unauthorized(reply); return { account: ctx.account }; });

  app.post('/v1/step-up/complete', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } }, schema: { body: bodySchema({ targetId: { type: 'string', minLength: 1 }, action: { type: 'string', minLength: 1 }, proof: { type: 'string' }, password: { type: 'string', minLength: 1, maxLength: 128 } }) } }, async (request, reply) => {
    const ctx = await auth(request); if (!ctx) return unauthorized(reply);
    const body = request.body as Body; const action = String(body.action || ''); const allowedActions = new Set(['guardian_relationship:revoke', 'child_profile:delete', 'adult_account:delete']); if (!allowedActions.has(action)) return reply.code(403).send({ error: 'verification_required' }); const approved = String(process.env.NODE_ENV) === 'test' && options.testAuth && body.proof === 'test-approved-proof'; const passwordHash = approved ? null : await repo.getPasswordHash(ctx.account.id); const passwordApproved = !!passwordHash && await verifyPassword(String(body.password || ''), passwordHash); if (!approved && !passwordApproved) { await repo.createAudit({ actorAccountId: ctx.account.id, eventType: 'step_up_failed', targetType: 'action', targetId: String(body.targetId), result: 'failure', scope: action }); return reply.code(403).send({ error: 'verification_required' }); }
    const event = await repo.createVerification(ctx.account.id, String(body.targetId), action, 60_000, ctx.session.id);
    await repo.createAudit({ actorAccountId: ctx.account.id, eventType: 'verification_completed', targetType: 'action', targetId: String(body.targetId), result: 'success', scope: action });
    return reply.code(201).send({ verificationEventId: event.id });
  });

  app.post('/v1/child-profiles', { schema: { body: bodySchema({ displayName: { type: 'string', minLength: 1 }, learningLevel: { type: 'string' }, avatar: { type: 'string' } }) } }, async (request, reply) => {
    const ctx = await auth(request); if (!ctx) return unauthorized(reply); if (ctx.account.kind !== 'adult') return reply.code(403).send(await deny(ctx, 'child_created', 'child_profile', 'new'));
    const body = request.body as Body; const child = await repo.createChild(ctx.account.id, String(body.displayName).trim(), String(body.learningLevel || 'Early Learner'), String(body.avatar || ''));
    await repo.createAudit({ actorAccountId: ctx.account.id, eventType: 'child_created', targetType: 'child_profile', targetId: child.id, result: 'success' }); return reply.code(201).send({ childProfile: child });
  });

  app.get('/v1/child-profiles/:childId', async (request: FastifyRequest<{ Params: Params }>, reply) => {
    const ctx = await auth(request); if (!ctx) return unauthorized(reply); const id = request.params.childId; const decision = await authorizeChildRead(repo, ctx.account.id, id);
    if (!decision.allowed) return reply.code(403).send(await deny(ctx, 'child_read', 'child_profile', id)); const child = await repo.findChild(id); if (!child) return reply.code(403).send(await deny(ctx, 'child_read', 'child_profile', id));
    return { childProfile: decision.scope === 'teaching' ? { id: child!.id, displayName: child!.displayName, learningLevel: child!.learningLevel } : child, scope: decision.scope };
  });

  app.post('/v1/guardian-relationships/:relationshipId/permission-grants', async (request: FastifyRequest<{ Params: Params }>, reply) => { const ctx = await auth(request); if (!ctx) return unauthorized(reply); return reply.code(403).send(await deny(ctx, 'permission_grant_created', 'guardian_relationship', request.params.relationshipId)); });

  app.post('/v1/guardian-relationships/:relationshipId/revoke', { schema: { body: bodySchema({ verificationEventId: { type: 'string', minLength: 1 } }) } }, async (request: FastifyRequest<{ Params: Params }>, reply) => {
    const ctx = await auth(request); if (!ctx) return unauthorized(reply); const id = request.params.relationshipId; const relationship = await repo.findGuardian(id); const body = request.body as Body;
    if (!relationship || !(await canRevokeGuardian(repo, ctx.account.id, id))) return reply.code(403).send(await deny(ctx, 'guardian_relationship_revoked', 'guardian_relationship', id));
    try { await repo.withTransaction(async tx => { if (!(await tx.consumeVerification(String(body.verificationEventId), ctx.account.id, id, 'guardian_relationship:revoke', ctx.session.id))) throw new Error('verification_failed'); await tx.revokeGuardian(id); await tx.createAudit({ actorAccountId: ctx.account.id, eventType: 'guardian_relationship_revoked', targetType: 'guardian_relationship', targetId: id, result: 'success' }); }); } catch { return reply.code(403).send(await deny(ctx, 'guardian_relationship_revoked', 'guardian_relationship', id)); } return { relationship: { ...relationship, status: 'revoked' } };
  });

  app.post('/v1/teacher-workspaces/:workspaceId/classes', async (request: FastifyRequest<{ Params: Params }>, reply) => { const ctx = await auth(request); if (!ctx) return unauthorized(reply); const id = request.params.workspaceId; if (!(await canCreateClass(repo, ctx.account.id, id))) return reply.code(403).send(await deny(ctx, 'class_created', 'workspace', id)); const group = await repo.createClass(id, String((request.body as Body)?.name || 'Class')); await repo.createAudit({ actorAccountId: ctx.account.id, eventType: 'class_created', targetType: 'class', targetId: group.id, result: 'success' }); return reply.code(201).send({ classGroup: group }); });

  app.post('/v1/classes/:classId/memberships', async (request: FastifyRequest<{ Params: Params }>, reply) => { const ctx = await auth(request); if (!ctx) return unauthorized(reply); return reply.code(403).send(await deny(ctx, 'class_membership_added', 'class', request.params.classId)); });

  app.post('/v1/class-memberships/:membershipId/remove', async (request: FastifyRequest<{ Params: Params }>, reply) => { const ctx = await auth(request); if (!ctx) return unauthorized(reply); const id = request.params.membershipId; if (!(await canRemoveClassMembership(repo, ctx.account.id, id))) return reply.code(403).send(await deny(ctx, 'class_membership_removed', 'class_membership', id)); const membership = await repo.findClassMembership(id)!; await repo.withTransaction(async tx => { await tx.removeClassMembership(id); await tx.createAudit({ actorAccountId: ctx.account.id, eventType: 'class_membership_removed', targetType: 'class_membership', targetId: id, result: 'success' }); }); return { classMembership: { ...membership, status: 'removed' } }; });

  app.post('/v1/child-profiles/:childId/deletion-requests', { schema: { body: bodySchema({ verificationEventId: { type: 'string', minLength: 1 } }) } }, async (request: FastifyRequest<{ Params: Params }>, reply) => {
    const ctx = await auth(request); if (!ctx) return unauthorized(reply); const id = request.params.childId; const child = await repo.findChild(id); const body = request.body as Body;
    if (!child || !(await canDeleteChild(repo, ctx.account.id, id))) return reply.code(403).send(await deny(ctx, 'child_deletion_requested', 'child_profile', id));
    try { const result = await repo.withTransaction(async tx => { if (!(await tx.consumeVerification(String(body.verificationEventId), ctx.account.id, id, 'child_profile:delete', ctx.session.id))) throw new Error('verification_failed'); await tx.markChildDeletionRequested(id); const deletion = await tx.createDeletion(ctx.account.id, id, String(body.verificationEventId)); await tx.createAudit({ actorAccountId: ctx.account.id, eventType: 'child_deletion_requested', targetType: 'child_profile', targetId: id, result: 'success' }); return deletion; }); return reply.code(202).send({ deletionRequest: result }); } catch (error) { if (error instanceof Error && error.message === 'verification_failed') return reply.code(403).send(await deny(ctx, 'child_deletion_requested', 'child_profile', id)); return reply.code(500).send({ error: 'mutation_failed' }); }
  });

  return { app, store, repository: repo };
}
