import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import { MemoryStore, type AuthContext, type Capability, canAccessChild, canTeachChild } from './domain/store.js';

export interface AppOptions { store?: MemoryStore; testAuth?: boolean; }

type Body = Record<string, unknown>;
type Params = Record<string, string>;

export function buildApp(options: AppOptions = {}): { app: FastifyInstance; store: MemoryStore } {
  const store = options.store ?? new MemoryStore();
  const app = Fastify({ logger: false });
  app.register(cookie);

  function auth(request: FastifyRequest): AuthContext | null {
    const token = request.cookies.lexora_session;
    if (!token) return null;
    const session = store.sessions.get(token);
    if (!session || session.revoked || session.expiresAt <= Date.now()) return null;
    const account = store.accounts.get(session.accountId);
    if (!account || account.status !== 'active') return null;
    return { account, session };
  }
  function deny(ctx: AuthContext | null, eventType: string, targetType: string, targetId: string) {
    store.auditEvent({ actorAccountId: ctx?.account.id ?? null, eventType, targetType, targetId, result: 'denied' });
    return { error: 'forbidden' };
  }
  function verified(ctx: AuthContext, targetId: string, action: string, verificationId?: string) {
    if (!verificationId) return false;
    const event = store.verifications.get(verificationId);
    if (!event || event.actorAccountId !== ctx.account.id || event.targetId !== targetId || event.action !== action || event.consumed || event.expiresAt <= Date.now()) return false;
    event.consumed = true;
    return true;
  }
  function sendUnauthorized(reply: any) { return reply.code(401).send({ error: 'unauthorized' }); }

  app.get('/health', async () => ({ status: 'ok', service: 'lexora-foundation-api' }));

  app.post('/v1/auth/test-login', async (request, reply) => {
    if (!options.testAuth) return reply.code(404).send({ error: 'not_found' });
    const accountId = String((request.body as Body)?.accountId || '');
    const account = store.accounts.get(accountId);
    if (!account || account.status !== 'active') return reply.code(401).send({ error: 'invalid_account' });
    const session = store.session(account.id);
    reply.setCookie('lexora_session', session.id, { httpOnly: true, sameSite: 'lax', path: '/', secure: false });
    return { accountId: account.id, sessionId: session.id };
  });

  app.post('/v1/auth/logout', async (request, reply) => { const ctx = auth(request); if (ctx) ctx.session.revoked = true; reply.clearCookie('lexora_session', { path: '/' }); return { ok: true }; });
  app.get('/v1/me', async (request, reply) => { const ctx = auth(request); if (!ctx) return sendUnauthorized(reply); return { account: ctx.account }; });

  app.post('/v1/step-up/complete', async (request, reply) => {
    const ctx = auth(request); if (!ctx) return sendUnauthorized(reply);
    const body = request.body as Body; const targetId = String(body.targetId || ''); const action = String(body.action || '');
    if (!options.testAuth || body.proof !== 'test-approved-proof') return reply.code(403).send({ error: 'verification_required' });
    const event = store.verification(ctx.account.id, targetId, action);
    store.auditEvent({ actorAccountId: ctx.account.id, eventType: 'verification_completed', targetType: 'action', targetId, result: 'success', scope: action });
    return reply.code(201).send({ verificationEventId: event.id });
  });

  app.post('/v1/child-profiles', async (request, reply) => {
    const ctx = auth(request); if (!ctx) return sendUnauthorized(reply);
    if (ctx.account.kind !== 'adult') return reply.code(403).send(deny(ctx, 'child_created', 'child_profile', 'new'));
    const body = request.body as Body;
    const child = store.child(ctx.account.id, String(body.displayName || ''), String(body.learningLevel || 'Early Learner'), String(body.avatar || ''));
    if (!child.displayName) return reply.code(400).send({ error: 'displayName_required' });
    store.auditEvent({ actorAccountId: ctx.account.id, eventType: 'child_created', targetType: 'child_profile', targetId: child.id, result: 'success' });
    return reply.code(201).send({ childProfile: child });
  });

  app.get('/v1/child-profiles/:childId', async (request: FastifyRequest<{ Params: Params }>, reply) => {
    const ctx = auth(request); if (!ctx) return sendUnauthorized(reply);
    const id = request.params.childId; const child = store.childProfiles.get(id);
    if (!child || (!canAccessChild(store, ctx.account.id, id, 'child:read') && !canTeachChild(store, ctx.account.id, id))) return reply.code(403).send(deny(ctx, 'child_read', 'child_profile', id));
    const teaching = canTeachChild(store, ctx.account.id, id);
    return { childProfile: teaching ? { id: child.id, displayName: child.displayName, learningLevel: child.learningLevel } : child, scope: teaching ? 'teaching' : 'family' };
  });

  app.post('/v1/guardian-relationships/:relationshipId/permission-grants', async (request: FastifyRequest<{ Params: Params }>, reply) => {
    const ctx = auth(request); if (!ctx) return sendUnauthorized(reply);
    const relationship = store.guardians.get(request.params.relationshipId);
    if (!relationship || relationship.status !== 'active' || relationship.childProfileId === '' || relationship.delegatedAdultAccountId === ctx.account.id) return reply.code(403).send(deny(ctx, 'permission_grant_created', 'guardian_relationship', request.params.relationshipId));
    const child = store.childProfiles.get(relationship.childProfileId);
    if (!child || child.primaryGuardianAccountId !== ctx.account.id) return reply.code(403).send(deny(ctx, 'permission_grant_created', 'guardian_relationship', request.params.relationshipId));
    const capability = String((request.body as Body)?.capability || '') as Capability;
    const allowed: Capability[] = ['child:read', 'child:update', 'child:progress:read'];
    if (!allowed.includes(capability)) return reply.code(400).send({ error: 'capability_requires_product_policy' });
    const grant = store.grant(relationship.id, capability);
    store.auditEvent({ actorAccountId: ctx.account.id, eventType: 'delegated_permission_granted', targetType: 'permission_grant', targetId: grant.id, result: 'success', scope: capability });
    return reply.code(201).send({ permissionGrant: grant });
  });

  app.post('/v1/guardian-relationships/:relationshipId/revoke', async (request: FastifyRequest<{ Params: Params }>, reply) => {
    const ctx = auth(request); if (!ctx) return sendUnauthorized(reply);
    const relationship = store.guardians.get(request.params.relationshipId); const child = relationship && store.childProfiles.get(relationship.childProfileId);
    if (!relationship || !child || child.primaryGuardianAccountId !== ctx.account.id) return reply.code(403).send(deny(ctx, 'guardian_relationship_revoked', 'guardian_relationship', request.params.relationshipId));
    relationship.status = 'revoked';
    for (const grant of store.grants.values()) if (grant.guardianRelationshipId === relationship.id) grant.status = 'revoked';
    store.auditEvent({ actorAccountId: ctx.account.id, eventType: 'guardian_relationship_revoked', targetType: 'guardian_relationship', targetId: relationship.id, result: 'success' });
    return { relationship };
  });

  app.post('/v1/teacher-workspaces/:workspaceId/classes', async (request: FastifyRequest<{ Params: Params }>, reply) => {
    const ctx = auth(request); if (!ctx) return sendUnauthorized(reply);
    const workspace = store.workspaces.get(request.params.workspaceId); const member = [...store.workspaceMemberships.values()].find(x => x.workspaceId === request.params.workspaceId && x.accountId === ctx.account.id && x.status === 'active');
    if (!workspace || !member || ctx.account.kind !== 'teacher') return reply.code(403).send(deny(ctx, 'class_created', 'workspace', request.params.workspaceId));
    const group = store.classGroup(workspace.id, String((request.body as Body)?.name || 'Class'));
    store.auditEvent({ actorAccountId: ctx.account.id, eventType: 'class_created', targetType: 'class', targetId: group.id, result: 'success' });
    return reply.code(201).send({ classGroup: group });
  });

  app.post('/v1/classes/:classId/memberships', async (request: FastifyRequest<{ Params: Params }>, reply) => {
    const ctx = auth(request); if (!ctx) return sendUnauthorized(reply);
    const group = store.classes.get(request.params.classId); const member = group && [...store.workspaceMemberships.values()].find(x => x.workspaceId === group.workspaceId && x.accountId === ctx.account.id && x.status === 'active');
    const childId = String((request.body as Body)?.childProfileId || '');
    if (!group || !member || ctx.account.kind !== 'teacher' || !store.childProfiles.has(childId)) return reply.code(403).send(deny(ctx, 'class_membership_added', 'class', request.params.classId));
    const cm = store.classMember(group.id, childId);
    store.auditEvent({ actorAccountId: ctx.account.id, eventType: 'class_membership_added', targetType: 'class_membership', targetId: cm.id, result: 'success' });
    return reply.code(201).send({ classMembership: cm });
  });

  app.post('/v1/class-memberships/:membershipId/remove', async (request: FastifyRequest<{ Params: Params }>, reply) => {
    const ctx = auth(request); if (!ctx) return sendUnauthorized(reply);
    const cm = store.classMemberships.get(request.params.membershipId); const group = cm && store.classes.get(cm.classId); const member = group && [...store.workspaceMemberships.values()].find(x => x.workspaceId === group.workspaceId && x.accountId === ctx.account.id && x.status === 'active');
    if (!cm || !member) return reply.code(403).send(deny(ctx, 'class_membership_removed', 'class_membership', request.params.membershipId));
    cm.status = 'removed';
    store.auditEvent({ actorAccountId: ctx.account.id, eventType: 'class_membership_removed', targetType: 'class_membership', targetId: cm.id, result: 'success' });
    return { classMembership: cm };
  });

  app.post('/v1/child-profiles/:childId/deletion-requests', async (request: FastifyRequest<{ Params: Params }>, reply) => {
    const ctx = auth(request); if (!ctx) return sendUnauthorized(reply);
    const id = request.params.childId; const child = store.childProfiles.get(id); const verificationId = String((request.body as Body)?.verificationEventId || '');
    if (!child || child.primaryGuardianAccountId !== ctx.account.id || !verified(ctx, id, 'child_profile:delete', verificationId)) return reply.code(403).send(deny(ctx, 'child_deletion_requested', 'child_profile', id));
    child.status = 'deletion_requested';
    const requestRecord: any = { id: randomUUID(), requesterAccountId: ctx.account.id, targetType: 'child_profile', targetId: id, status: 'requested', verificationEventId: verificationId };
    store.deletions.set(requestRecord.id, requestRecord);
    store.auditEvent({ actorAccountId: ctx.account.id, eventType: 'child_deletion_requested', targetType: 'child_profile', targetId: id, result: 'success' });
    return reply.code(202).send({ deletionRequest: requestRecord });
  });

  return { app, store };
}
