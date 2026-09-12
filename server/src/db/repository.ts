import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient, QueryResultRow } from 'pg';
import type { Account, AdultProfile, AuditEvent, ChildProfile, ClassGroup, ClassMembership, DeletionRequest, GuardianRelationship, PermissionGrant, Session, TeacherWorkspace, VerificationEvent, WorkspaceMembership, Capability, AccountKind, RelationshipStatus } from '../domain/store.js';
import { MemoryStore } from '../domain/store.js';

export interface FoundationRepository {
  findAccount(id: string): Promise<Account | null>;
  createSession(accountId: string, ttlMs?: number): Promise<Session>;
  findSession(id: string): Promise<Session | null>;
  revokeSession(id: string): Promise<void>;
  createChild(accountId: string, displayName: string, learningLevel: string, avatar: string): Promise<ChildProfile>;
  findChild(id: string): Promise<ChildProfile | null>;
  createGuardian(delegatedAdultAccountId: string, childProfileId: string): Promise<GuardianRelationship>;
  findGuardian(id: string): Promise<GuardianRelationship | null>;
  hasGrant(actorId: string, childId: string, capability: Capability): Promise<boolean>;
  revokeGuardian(id: string): Promise<void>;
  createVerification(actorId: string, targetId: string, action: string, ttlMs?: number): Promise<VerificationEvent>;
  consumeVerification(id: string, actorId: string, targetId: string, action: string): Promise<boolean>;
  createAudit(event: Omit<AuditEvent, 'id'>): Promise<AuditEvent>;
  createDeletion(requesterAccountId: string, childId: string, verificationEventId: string): Promise<DeletionRequest>;
  markChildDeletionRequested(id: string): Promise<void>;
  findWorkspace(id: string): Promise<TeacherWorkspace | null>;
  hasWorkspaceMembership(workspaceId: string, accountId: string): Promise<boolean>;
  createClass(workspaceId: string, name: string): Promise<ClassGroup>;
  findClass(id: string): Promise<ClassGroup | null>;
  createClassMembership(classId: string, childProfileId: string): Promise<ClassMembership>;
  findClassMembership(id: string): Promise<ClassMembership | null>;
  removeClassMembership(id: string): Promise<void>;
  canTeachChild(accountId: string, childId: string): Promise<boolean>;
  withTransaction<T>(fn: (repo: FoundationRepository) => Promise<T>): Promise<T>;
}

export class MemoryRepository implements FoundationRepository {
  constructor(public store: MemoryStore) {}
  async findAccount(id: string) { return this.store.accounts.get(id) ?? null; }
  async createSession(accountId: string, ttlMs = 60 * 60 * 1000) { return this.store.session(accountId, ttlMs); }
  async findSession(id: string) { const s = this.store.sessions.get(id); return s && !s.revoked && s.expiresAt > Date.now() ? s : null; }
  async revokeSession(id: string) { const s = this.store.sessions.get(id); if (s) s.revoked = true; }
  async createChild(accountId: string, displayName: string, learningLevel: string, avatar: string) { return this.store.child(accountId, displayName, learningLevel, avatar); }
  async findChild(id: string) { return this.store.childProfiles.get(id) ?? null; }
  async createGuardian(a: string, c: string) { return this.store.guardian(a, c); }
  async findGuardian(id: string) { return this.store.guardians.get(id) ?? null; }
  async hasGrant(actorId: string, childId: string, capability: Capability) { for (const r of this.store.guardians.values()) if (r.delegatedAdultAccountId === actorId && r.childProfileId === childId && r.status === 'active') for (const g of this.store.grants.values()) if (g.guardianRelationshipId === r.id && g.capability === capability && g.status === 'active') return true; return false; }
  async revokeGuardian(id: string) { const r = this.store.guardians.get(id); if (r) r.status = 'revoked'; for (const g of this.store.grants.values()) if (g.guardianRelationshipId === id) g.status = 'revoked'; }
  async createVerification(a: string, t: string, action: string, ttlMs = 60_000) { return this.store.verification(a, t, action, ttlMs); }
  async consumeVerification(id: string, actorId: string, targetId: string, action: string) { const v = this.store.verifications.get(id); if (!v || v.actorAccountId !== actorId || v.targetId !== targetId || v.action !== action || v.consumed || v.expiresAt <= Date.now()) return false; v.consumed = true; return true; }
  async createAudit(e: Omit<AuditEvent, 'id'>) { return this.store.auditEvent(e); }
  async createDeletion(a: string, c: string, v: string) { const d: DeletionRequest = { id: randomUUID(), requesterAccountId: a, targetType: 'child_profile', targetId: c, status: 'requested', verificationEventId: v }; this.store.deletions.set(d.id, d); return d; }
  async markChildDeletionRequested(id: string) { const c = this.store.childProfiles.get(id); if (c) c.status = 'deletion_requested'; }
  async findWorkspace(id: string) { return this.store.workspaces.get(id) ?? null; }
  async hasWorkspaceMembership(w: string, a: string) { return [...this.store.workspaceMemberships.values()].some(m => m.workspaceId === w && m.accountId === a && m.status === 'active'); }
  async createClass(w: string, name: string) { return this.store.classGroup(w, name); }
  async findClass(id: string) { return this.store.classes.get(id) ?? null; }
  async createClassMembership(c: string, child: string) { return this.store.classMember(c, child); }
  async findClassMembership(id: string) { return this.store.classMemberships.get(id) ?? null; }
  async removeClassMembership(id: string) { const m = this.store.classMemberships.get(id); if (m) m.status = 'removed'; }
  async canTeachChild(a: string, child: string) { const account = this.store.accounts.get(a); if (!account || account.kind !== 'teacher' || account.status !== 'active') return false; for (const m of this.store.classMemberships.values()) if (m.childProfileId === child && m.status === 'active') { const c = this.store.classes.get(m.classId); if (c && c.status === 'active' && await this.hasWorkspaceMembership(c.workspaceId, a)) return true; } return false; }
  async withTransaction<T>(fn: (repo: FoundationRepository) => Promise<T>): Promise<T> { return fn(this); }
}

export class PostgresRepository implements FoundationRepository {
  constructor(private pool: Pool, private client?: PoolClient) {}
  private async query<T extends QueryResultRow = any>(text: string, values: unknown[] = []) { return (this.client ?? this.pool).query<T>(text, values); }
  async findAccount(id: string) { const r = await this.query<Account>('SELECT id, kind, email, status FROM accounts WHERE id=$1', [id]); return r.rows[0] ?? null; }
  async createSession(accountId: string, ttlMs = 60 * 60 * 1000) { const id = randomUUID(); const r = await this.query<Session>(`INSERT INTO sessions(id,account_id,expires_at) VALUES($1,$2,now()+($3::bigint * interval '1 millisecond')) RETURNING id, account_id as "accountId", extract(epoch from expires_at)*1000 as "expiresAt", (revoked_at IS NOT NULL) as revoked`, [id, accountId, ttlMs]); return r.rows[0]; }
  async findSession(id: string) { const r = await this.query<Session>(`SELECT id, account_id as "accountId", extract(epoch from expires_at)*1000 as "expiresAt", (revoked_at IS NOT NULL) as revoked FROM sessions WHERE id=$1 AND revoked_at IS NULL AND expires_at>now()`, [id]); return r.rows[0] ?? null; }
  async revokeSession(id: string) { await this.query('UPDATE sessions SET revoked_at=now() WHERE id=$1', [id]); }
  async createChild(a: string, n: string, l: string, avatar: string) { const r = await this.query<ChildProfile>(`INSERT INTO child_profiles(primary_guardian_account_id,display_name,learning_level,avatar) VALUES($1,$2,$3,$4) RETURNING id, primary_guardian_account_id as "primaryGuardianAccountId", display_name as "displayName", learning_level as "learningLevel", avatar, status`, [a,n,l,avatar]); return r.rows[0]; }
  async findChild(id: string) { const r = await this.query<ChildProfile>(`SELECT id, primary_guardian_account_id as "primaryGuardianAccountId", display_name as "displayName", learning_level as "learningLevel", avatar, status FROM child_profiles WHERE id=$1`, [id]); return r.rows[0] ?? null; }
  async createGuardian(a: string, c: string) { const r = await this.query<GuardianRelationship>(`INSERT INTO guardian_relationships(id,delegated_adult_account_id,child_profile_id,status) VALUES($1,$2,$3,'active') RETURNING id, delegated_adult_account_id as "delegatedAdultAccountId", child_profile_id as "childProfileId", status`, [randomUUID(),a,c]); return r.rows[0]; }
  async findGuardian(id: string) { const r = await this.query<GuardianRelationship>(`SELECT id, delegated_adult_account_id as "delegatedAdultAccountId", child_profile_id as "childProfileId", status FROM guardian_relationships WHERE id=$1`, [id]); return r.rows[0] ?? null; }
  async hasGrant(a: string, c: string, cap: Capability) { const r = await this.query<{ok:boolean}>(`SELECT true as ok FROM guardian_relationships r JOIN permission_grants g ON g.guardian_relationship_id=r.id WHERE r.delegated_adult_account_id=$1 AND r.child_profile_id=$2 AND r.status='active' AND g.capability=$3 AND g.status='active' LIMIT 1`, [a,c,cap]); return !!r.rows[0]; }
  async revokeGuardian(id: string) { await this.query('UPDATE guardian_relationships SET status=\'revoked\' WHERE id=$1; UPDATE permission_grants SET status=\'revoked\' WHERE guardian_relationship_id=$1', [id]); }
  async createVerification(a: string,t: string,action: string,ttlMs=60_000) { const r=await this.query<VerificationEvent>(`INSERT INTO verification_events(actor_account_id,target_id,action,method_category,expires_at,result) VALUES($1,$2,$3,'configured-provider',now()+($4::bigint * interval '1 millisecond'),'success') RETURNING id, actor_account_id as "actorAccountId", target_id as "targetId", action, extract(epoch from expires_at)*1000 as "expiresAt", false as consumed`,[a,t,action,ttlMs]); return r.rows[0]; }
  async consumeVerification(id: string,a: string,t: string,action: string) { const r=await this.query(`UPDATE verification_events SET consumed_at=now() WHERE id=$1 AND actor_account_id=$2 AND target_id=$3 AND action=$4 AND consumed_at IS NULL AND expires_at>now() RETURNING id`,[id,a,t,action]); return r.rowCount === 1; }
  async createAudit(e: Omit<AuditEvent,'id'>) { const r=await this.query<AuditEvent>(`INSERT INTO audit_events(id,actor_account_id,event_type,target_type,target_id,scope,result) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id, actor_account_id as "actorAccountId", event_type as "eventType", target_type as "targetType", target_id as "targetId", scope, result`,[randomUUID(),e.actorAccountId,e.eventType,e.targetType,e.targetId,e.scope ?? null,e.result]); return r.rows[0]; }
  async createDeletion(a:string,c:string,v:string) { const r=await this.query<DeletionRequest>(`INSERT INTO deletion_requests(id,requester_account_id,target_type,target_id,status,verification_event_id) VALUES($1,$2,'child_profile',$3,'requested',$4) RETURNING id, requester_account_id as "requesterAccountId", target_type as "targetType", target_id as "targetId", status, verification_event_id as "verificationEventId"`,[randomUUID(),a,c,v]); return r.rows[0]; }
  async markChildDeletionRequested(id:string) { await this.query(`UPDATE child_profiles SET status='deletion_requested',updated_at=now() WHERE id=$1`,[id]); }
  async findWorkspace(id:string) { const r=await this.query<TeacherWorkspace>('SELECT id,name,status FROM teacher_workspaces WHERE id=$1',[id]); return r.rows[0]??null; }
  async hasWorkspaceMembership(w:string,a:string) { const r=await this.query('SELECT 1 FROM workspace_memberships WHERE workspace_id=$1 AND account_id=$2 AND status=\'active\'',[w,a]); return !!r.rowCount; }
  async createClass(w:string,n:string) { const r=await this.query<ClassGroup>(`INSERT INTO classes(id,workspace_id,name,status) VALUES($1,$2,$3,'active') RETURNING id,workspace_id as "workspaceId",name,status`,[randomUUID(),w,n]); return r.rows[0]; }
  async findClass(id:string) { const r=await this.query<ClassGroup>('SELECT id,workspace_id as "workspaceId",name,status FROM classes WHERE id=$1',[id]); return r.rows[0]??null; }
  async createClassMembership(c:string,child:string) { const r=await this.query<ClassMembership>(`INSERT INTO class_memberships(id,class_id,child_profile_id,status) VALUES($1,$2,$3,'active') RETURNING id,class_id as "classId",child_profile_id as "childProfileId",status`,[randomUUID(),c,child]); return r.rows[0]; }
  async findClassMembership(id:string) { const r=await this.query<ClassMembership>('SELECT id,class_id as "classId",child_profile_id as "childProfileId",status FROM class_memberships WHERE id=$1',[id]); return r.rows[0]??null; }
  async removeClassMembership(id:string) { await this.query(`UPDATE class_memberships SET status='removed' WHERE id=$1`,[id]); }
  async canTeachChild(a:string,child:string) { const r=await this.query(`SELECT 1 FROM class_memberships cm JOIN classes c ON c.id=cm.class_id JOIN workspace_memberships wm ON wm.workspace_id=c.workspace_id WHERE cm.child_profile_id=$1 AND cm.status='active' AND c.status='active' AND wm.account_id=$2 AND wm.status='active'`,[child,a]); return !!r.rowCount; }
  async withTransaction<T>(fn:(repo:FoundationRepository)=>Promise<T>) { const client=await this.pool.connect(); try { await client.query('BEGIN'); const result=await fn(new PostgresRepository(this.pool,client)); await client.query('COMMIT'); return result; } catch(e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); } }
}
