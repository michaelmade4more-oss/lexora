CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('adult','teacher')),
  email TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','deletion_requested','deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE adult_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL UNIQUE REFERENCES accounts(id),
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE authentication_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id),
  provider TEXT NOT NULL,
  provider_subject TEXT NOT NULL,
  credential_state TEXT NOT NULL DEFAULT 'active',
  UNIQUE(provider, provider_subject)
);
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE child_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_guardian_account_id UUID NOT NULL REFERENCES accounts(id),
  display_name TEXT NOT NULL,
  learning_level TEXT NOT NULL,
  avatar TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','deletion_requested','deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE guardian_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delegated_adult_account_id UUID NOT NULL REFERENCES accounts(id),
  child_profile_id UUID NOT NULL REFERENCES child_profiles(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','suspended','revoked','expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(delegated_adult_account_id, child_profile_id)
);
CREATE TABLE permission_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_relationship_id UUID NOT NULL REFERENCES guardian_relationships(id),
  capability TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE teacher_workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE workspace_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES teacher_workspaces(id),
  account_id UUID NOT NULL REFERENCES accounts(id),
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','suspended','revoked','expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, account_id)
);
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES teacher_workspaces(id),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE class_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id),
  child_profile_id UUID NOT NULL REFERENCES child_profiles(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','suspended','removed','expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(class_id, child_profile_id)
);
CREATE TABLE verification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_account_id UUID NOT NULL REFERENCES accounts(id),
  target_id UUID NOT NULL,
  action TEXT NOT NULL,
  method_category TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  result TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_account_id UUID REFERENCES accounts(id),
  event_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  scope TEXT,
  result TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_account_id UUID NOT NULL REFERENCES accounts(id),
  target_type TEXT NOT NULL CHECK (target_type IN ('child_profile','adult_account')),
  target_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested',
  verification_event_id UUID NOT NULL REFERENCES verification_events(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
