import { MemoryStore, canAccessChild, canTeachChild } from '../domain/store.js';

export type ChildReadDecision =
  | { allowed: true; scope: 'family' | 'teaching' }
  | { allowed: false; reason: 'not_found' | 'forbidden' };

export function authorizeChildRead(store: MemoryStore, actorId: string, childId: string): ChildReadDecision {
  const child = store.childProfiles.get(childId);
  if (!child || child.status !== 'active') return { allowed: false, reason: 'not_found' };
  if (canAccessChild(store, actorId, childId, 'child:read')) return { allowed: true, scope: 'family' };
  if (canTeachChild(store, actorId, childId)) return { allowed: true, scope: 'teaching' };
  return { allowed: false, reason: 'forbidden' };
}

export function isPrimaryGuardian(store: MemoryStore, actorId: string, childId: string): boolean {
  return store.childProfiles.get(childId)?.primaryGuardianAccountId === actorId;
}
