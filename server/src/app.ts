import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { MemoryStore } from './domain/store.js';
import { MemoryRepository, type FoundationRepository } from './db/repository.js';
import { authorizeChildRead, canCreateClass, canDeleteChild, canRemoveClassMembership, canRevokeGuardian } from './policies/authorization.js';

export interface AppOptions { store?: MemoryStore; repository?: FoundationRepository; testAuth?: boolean; }
type Body = Record<string, unknown>; type Params = Record<string, string>;

export function buildApp(options: AppOptions = {}): { app: FastifyInstance; store: MemoryStore; repository: FoundationRepository } {
  const store = options.store ?? new MemoryStore();
  const repo = options.repository ?? new MemoryRepository(store);
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

  app.get('/health', async () => ({ status: 'ok', service: 'lexora-foundation-api' }));
  app.post('/v1/auth/test-login', { schema: { body: bodySchema({ accountId: { type: 'string', minLength: 1 } }) } }, async (request, reply) => {
    if (!options.testAuth || process.env.NODE_ENV !== 'test') return reply.code(404).send({ error: 'not_found' });
    const account = await repo.findAccount(String((request.body as Body).accountId));
    if (!account || account.status !== 'active') return reply.code(401).send({ error: 'invalid_account' });
    const session = await repo.createSession(account.id); reply.setCookie('lexora_session', session.id, { httpOnly: true, sameSite: 'lax', path: '/', secure: String(process.env.NODE_ENV) === 'production' });
    return { accountId: account.id };
  });
  app.post('/v1/auth/logout', async (request, reply) => { const ctx = await auth(request); if (ctx) await repo.revokeSession(ctx.session.id); reply.clearCookie('lexora_session', { path: '/' }); return { ok: true }; });
  app.get('/v1/me', async (request, reply) => { const ctx = await auth(request); if (!ctx) return unauthorized(reply); return { account: ctx.account }; });

  app.post('/v1/step-up/complete', { schema: { body: bodySchema({ targetId: { type: 'string', minLength: 1 }, action: { type: 'string', minLength: 1 }, proof: { type: 'string' } }) } }, async (request, reply) => {
    const ctx = await auth(request); if (!ctx) return unauthorized(reply);
    const body = request.body as Body; if (!options.testAuth || process.env.NODE_ENV !== 'test' || body.proof !== 'test-approved-proof') return reply.code(403).send({ error: 'verification_required' });
    const event = await repo.createVerification(ctx.account.id, String(body.targetId), String(body.action));
    await repo.createAudit({ actorAccountId: ctx.account.id, eventType: 'verification_completed', targetType: 'action', targetId: String(body.targetId), result: 'success', scope: String(body.action) });
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
    try { await repo.withTransaction(async tx => { if (!(await tx.consumeVerification(String(body.verificationEventId), ctx.account.id, id, 'guardian_relationship:revoke'))) throw new Error('verification_failed'); await tx.revokeGuardian(id); await tx.createAudit({ actorAccountId: ctx.account.id, eventType: 'guardian_relationship_revoked', targetType: 'guardian_relationship', targetId: id, result: 'success' }); }); } catch { return reply.code(403).send(await deny(ctx, 'guardian_relationship_revoked', 'guardian_relationship', id)); } return { relationship: { ...relationship, status: 'revoked' } };
  });

  app.post('/v1/teacher-workspaces/:workspaceId/classes', async (request: FastifyRequest<{ Params: Params }>, reply) => { const ctx = await auth(request); if (!ctx) return unauthorized(reply); const id = request.params.workspaceId; if (!(await canCreateClass(repo, ctx.account.id, id))) return reply.code(403).send(await deny(ctx, 'class_created', 'workspace', id)); const group = await repo.createClass(id, String((request.body as Body)?.name || 'Class')); await repo.createAudit({ actorAccountId: ctx.account.id, eventType: 'class_created', targetType: 'class', targetId: group.id, result: 'success' }); return reply.code(201).send({ classGroup: group }); });

  app.post('/v1/classes/:classId/memberships', async (request: FastifyRequest<{ Params: Params }>, reply) => { const ctx = await auth(request); if (!ctx) return unauthorized(reply); return reply.code(403).send(await deny(ctx, 'class_membership_added', 'class', request.params.classId)); });

  app.post('/v1/class-memberships/:membershipId/remove', async (request: FastifyRequest<{ Params: Params }>, reply) => { const ctx = await auth(request); if (!ctx) return unauthorized(reply); const id = request.params.membershipId; if (!(await canRemoveClassMembership(repo, ctx.account.id, id))) return reply.code(403).send(await deny(ctx, 'class_membership_removed', 'class_membership', id)); const membership = await repo.findClassMembership(id)!; await repo.withTransaction(async tx => { await tx.removeClassMembership(id); await tx.createAudit({ actorAccountId: ctx.account.id, eventType: 'class_membership_removed', targetType: 'class_membership', targetId: id, result: 'success' }); }); return { classMembership: { ...membership, status: 'removed' } }; });

  app.post('/v1/child-profiles/:childId/deletion-requests', { schema: { body: bodySchema({ verificationEventId: { type: 'string', minLength: 1 } }) } }, async (request: FastifyRequest<{ Params: Params }>, reply) => {
    const ctx = await auth(request); if (!ctx) return unauthorized(reply); const id = request.params.childId; const child = await repo.findChild(id); const body = request.body as Body;
    if (!child || !(await canDeleteChild(repo, ctx.account.id, id))) return reply.code(403).send(await deny(ctx, 'child_deletion_requested', 'child_profile', id));
    try { const result = await repo.withTransaction(async tx => { if (!(await tx.consumeVerification(String(body.verificationEventId), ctx.account.id, id, 'child_profile:delete'))) throw new Error('verification_failed'); await tx.markChildDeletionRequested(id); const deletion = await tx.createDeletion(ctx.account.id, id, String(body.verificationEventId)); await tx.createAudit({ actorAccountId: ctx.account.id, eventType: 'child_deletion_requested', targetType: 'child_profile', targetId: id, result: 'success' }); return deletion; }); return reply.code(202).send({ deletionRequest: result }); } catch (error) { if (error instanceof Error && error.message === 'verification_failed') return reply.code(403).send(await deny(ctx, 'child_deletion_requested', 'child_profile', id)); return reply.code(500).send({ error: 'mutation_failed' }); }
  });

  return { app, store, repository: repo };
}
