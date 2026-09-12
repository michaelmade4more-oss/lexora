import type { FoundationRepository } from '../db/repository.js';

export type ChildReadDecision =
  | { allowed: true; scope: 'family' | 'teaching' }
  | { allowed: false; reason: 'not_found' | 'forbidden' };

export async function authorizeChildRead(repo: FoundationRepository, actorId: string, childId: string): Promise<ChildReadDecision> {
  const child = await repo.findChild(childId);
  if (!child || child.status !== 'active') return { allowed: false, reason: 'not_found' };
  const account = await repo.findAccount(actorId);
  if (!account || account.status !== 'active') return { allowed: false, reason: 'forbidden' };
  if (child.primaryGuardianAccountId === actorId) return { allowed: true, scope: 'family' };
  if (account.kind === 'adult' && await repo.hasGrant(actorId, childId, 'child:read')) return { allowed: true, scope: 'family' };
  if (account.kind === 'teacher' && await repo.canTeachChild(actorId, childId)) return { allowed: true, scope: 'teaching' };
  return { allowed: false, reason: 'forbidden' };
}

export async function isPrimaryGuardian(repo: FoundationRepository, actorId: string, childId: string): Promise<boolean> {
  return (await repo.findChild(childId))?.primaryGuardianAccountId === actorId;
}

export async function canRevokeGuardian(repo: FoundationRepository, actorId: string, relationshipId: string): Promise<boolean> {
  const relationship = await repo.findGuardian(relationshipId);
  return !!relationship && await isPrimaryGuardian(repo, actorId, relationship.childProfileId);
}

export async function canCreateClass(repo: FoundationRepository, actorId: string, workspaceId: string): Promise<boolean> {
  const account = await repo.findAccount(actorId); const workspace = await repo.findWorkspace(workspaceId);
  return !!account && account.kind === 'teacher' && account.status === 'active' && !!workspace && workspace.status === 'active' && await repo.hasWorkspaceMembership(workspaceId, actorId);
}

export async function canRemoveClassMembership(repo: FoundationRepository, actorId: string, membershipId: string): Promise<boolean> {
  const account = await repo.findAccount(actorId); const membership = await repo.findClassMembership(membershipId); const group = membership && await repo.findClass(membership.classId);
  return !!account && account.kind === 'teacher' && account.status === 'active' && !!membership && !!group && group.status === 'active' && await repo.hasWorkspaceMembership(group.workspaceId, actorId);
}

export async function canDeleteChild(repo: FoundationRepository, actorId: string, childId: string): Promise<boolean> {
  const account = await repo.findAccount(actorId);
  return !!account && account.kind === 'adult' && account.status === 'active' && await isPrimaryGuardian(repo, actorId, childId);
}
