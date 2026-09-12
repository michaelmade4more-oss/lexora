# Lexora Foundation API Boundaries

This document describes the first-milestone command/query boundaries. It is not a public API commitment until the technical review is complete.

## Authentication

- `POST /v1/auth/signup` — creates an Adult Account with a password credential and durable session.
- `POST /v1/auth/login` — verifies credentials, applies abuse controls, and creates or rotates a durable session.
- `POST /v1/auth/recovery/request` — creates a time-limited one-time recovery token without disclosing account existence.
- `POST /v1/auth/recovery/reset` — consumes a recovery token, updates the password, and revokes existing sessions.
- `POST /v1/auth/test-login` — test-only account session bootstrap; unavailable in normal runtime.
- `POST /v1/auth/logout` — revokes the current server-side session.
- `GET /v1/me` — returns the authenticated account context.
- `POST /v1/step-up/complete` — creates an action-bound Verification Event through password re-authentication; unknown actions fail closed.

The current production verification mechanism is password re-authentication. No external verification provider or delivery technology is selected by this milestone.

## Child profiles

- `GET /v1/child-profiles` — lists profiles visible to the authenticated actor.
- `POST /v1/child-profiles` — Primary Guardian child-profile creation command.
- `GET /v1/child-profiles/{childProfileId}` — family-scoped or teaching-scoped read.
- `PATCH /v1/child-profiles/{childProfileId}` — authorized profile update boundary.
- `POST /v1/child-profiles/{childProfileId}/deletion-requests` — verified child deletion request.

## Guardian relationships and grants

- `POST /v1/child-profiles/{childProfileId}/guardian-invitations`
- `GET /v1/child-profiles/{childProfileId}/guardian-relationships`
- `POST /v1/guardian-relationships/{relationshipId}/permission-grants` — currently fail-closed until the product capability catalogue and step-up policy are configured.
- `POST /v1/guardian-relationships/{relationshipId}/revoke`
- `POST /v1/permission-grants/{grantId}/revoke`

Capability names and delegation scope remain policy/configuration boundaries until product approval.

## Teacher workspace and class membership

- `POST /v1/teacher-workspaces`
- `GET /v1/teacher-workspaces`
- `POST /v1/teacher-workspaces/{workspaceId}/classes`
- `POST /v1/classes/{classId}/memberships` — currently fail-closed until the teacher class-membership approver policy is configured.
- `POST /v1/class-memberships/{membershipId}/remove`
- `GET /v1/child-profiles/{childProfileId}` — teaching projection only when Workspace Membership and active Class Membership both authorize it.

There is no initial Teacher-Learner endpoint or entity. Class Membership is canonical.

## Security and lifecycle

- `GET /v1/audit-events` — restricted security/support query boundary.
- `GET /v1/deletion-requests/{requestId}` — requester-scoped deletion status.
- `POST /v1/deletion-requests` — generic future deletion command boundary.

All protected commands use immutable resource IDs, server-side authorization, default deny, and audit outcomes for sensitive mutations.
