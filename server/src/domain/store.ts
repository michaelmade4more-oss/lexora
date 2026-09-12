import { randomUUID } from 'node:crypto';

export type AccountKind = 'adult' | 'teacher';
export type AccountStatus = 'active' | 'suspended' | 'deletion_requested' | 'deleted';
export type RelationshipStatus = 'pending' | 'active' | 'suspended' | 'revoked' | 'expired';
export type Capability = 'child:read' | 'child:update' | 'child:delete' | 'child:progress:read' | 'child:control:update';

export interface Account { id: string; kind: AccountKind; email: string; status: AccountStatus; }
export interface AdultProfile { id: string; accountId: string; displayName: string; }
export interface ChildProfile { id: string; primaryGuardianAccountId: string; displayName: string; learningLevel: string; avatar: string; status: 'active' | 'deletion_requested' | 'deleted'; }
export interface GuardianRelationship { id: string; delegatedAdultAccountId: string; childProfileId: string; status: RelationshipStatus; }
export interface PermissionGrant { id: string; guardianRelationshipId: string; capability: Capability; status: 'active' | 'revoked'; }
export interface TeacherWorkspace { id: string; name: string; status: 'active' | 'suspended'; }
export interface WorkspaceMembership { id: string; workspaceId: string; accountId: string; status: RelationshipStatus; role: string; }
export interface ClassGroup { id: string; workspaceId: string; name: string; status: 'active' | 'archived'; }
export interface ClassMembership { id: string; classId: string; childProfileId: string; status: RelationshipStatus | 'removed'; }
export interface Session { id: string; accountId: string; expiresAt: number; revoked: boolean; }
export interface VerificationEvent { id: string; actorAccountId: string; targetId: string; action: string; expiresAt: number; consumed: boolean; }
export interface AuditEvent { id: string; actorAccountId: string | null; eventType: string; targetType: string; targetId: string; result: 'success' | 'denied' | 'failure'; scope?: string; }
export interface DeletionRequest { id: string; requesterAccountId: string; targetType: 'child_profile' | 'adult_account'; targetId: string; status: 'requested' | 'cancelled' | 'completed'; verificationEventId: string; }

export class MemoryStore {
  accounts = new Map<string, Account>();
  adultProfiles = new Map<string, AdultProfile>();
  childProfiles = new Map<string, ChildProfile>();
  guardians = new Map<string, GuardianRelationship>();
  grants = new Map<string, PermissionGrant>();
  workspaces = new Map<string, TeacherWorkspace>();
  workspaceMemberships = new Map<string, WorkspaceMembership>();
  classes = new Map<string, ClassGroup>();
  classMemberships = new Map<string, ClassMembership>();
  sessions = new Map<string, Session>();
  verifications = new Map<string, VerificationEvent>();
  audit = new Map<string, AuditEvent>();
  deletions = new Map<string, DeletionRequest>();

  account(kind: AccountKind, email = `${kind}-${randomUUID()}@example.test`) { const value = { id: randomUUID(), kind, email, status: 'active' as const }; this.accounts.set(value.id, value); return value; }
  adultProfile(accountId: string, displayName = 'Adult') { const value = { id: randomUUID(), accountId, displayName }; this.adultProfiles.set(value.id, value); return value; }
  child(primaryGuardianAccountId: string, displayName = 'Child', learningLevel = 'Early Learner', avatar = 'early-learner-01') { const value = { id: randomUUID(), primaryGuardianAccountId, displayName, learningLevel, avatar, status: 'active' as const }; this.childProfiles.set(value.id, value); return value; }
  guardian(delegatedAdultAccountId: string, childProfileId: string) { const value = { id: randomUUID(), delegatedAdultAccountId, childProfileId, status: 'active' as const }; this.guardians.set(value.id, value); return value; }
  grant(guardianRelationshipId: string, capability: Capability) { const value = { id: randomUUID(), guardianRelationshipId, capability, status: 'active' as const }; this.grants.set(value.id, value); return value; }
  workspace(name = 'Test Workspace') { const value = { id: randomUUID(), name, status: 'active' as const }; this.workspaces.set(value.id, value); return value; }
  workspaceMember(workspaceId: string, accountId: string, role = 'teacher'): WorkspaceMembership { const value: WorkspaceMembership = { id: randomUUID(), workspaceId, accountId, role, status: 'active' }; this.workspaceMemberships.set(value.id, value); return value; }
  classGroup(workspaceId: string, name = 'Test Class') { const value = { id: randomUUID(), workspaceId, name, status: 'active' as const }; this.classes.set(value.id, value); return value; }
  classMember(classId: string, childProfileId: string): ClassMembership { const value: ClassMembership = { id: randomUUID(), classId, childProfileId, status: 'active' }; this.classMemberships.set(value.id, value); return value; }
  session(accountId: string, ttlMs = 60 * 60 * 1000) { const value = { id: randomUUID(), accountId, expiresAt: Date.now() + ttlMs, revoked: false }; this.sessions.set(value.id, value); return value; }
  auditEvent(event: Omit<AuditEvent, 'id'>) { const value = { id: randomUUID(), ...event }; this.audit.set(value.id, value); return value; }
  verification(actorAccountId: string, targetId: string, action: string, ttlMs = 60_000) { const value = { id: randomUUID(), actorAccountId, targetId, action, expiresAt: Date.now() + ttlMs, consumed: false }; this.verifications.set(value.id, value); return value; }
}

export type AuthContext = { account: Account; session: Session };

export function hasGuardianCapability(store: MemoryStore, actorId: string, childId: string, capability: Capability) {
  for (const relationship of store.guardians.values()) {
    if (relationship.delegatedAdultAccountId !== actorId || relationship.childProfileId !== childId || relationship.status !== 'active') continue;
    for (const grant of store.grants.values()) if (grant.guardianRelationshipId === relationship.id && grant.capability === capability && grant.status === 'active') return true;
  }
  return false;
}

export function canAccessChild(store: MemoryStore, actorId: string, childId: string, capability: Capability) {
  const child = store.childProfiles.get(childId);
  if (!child || child.status !== 'active') return false;
  if (child.primaryGuardianAccountId === actorId) return true;
  return hasGuardianCapability(store, actorId, childId, capability);
}

export function canTeachChild(store: MemoryStore, actorId: string, childId: string) {
  const teacher = store.accounts.get(actorId);
  if (!teacher || teacher.kind !== 'teacher' || teacher.status !== 'active') return false;
  for (const membership of store.classMemberships.values()) {
    if (membership.childProfileId !== childId || membership.status !== 'active') continue;
    const group = store.classes.get(membership.classId); if (!group || group.status !== 'active') continue;
    for (const wm of store.workspaceMemberships.values()) if (wm.workspaceId === group.workspaceId && wm.accountId === actorId && wm.status === 'active') return true;
  }
  return false;
}
