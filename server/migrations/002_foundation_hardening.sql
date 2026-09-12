ALTER TABLE guardian_relationships DROP CONSTRAINT IF EXISTS guardian_relationships_delegated_adult_account_id_child_profile_id_key;
ALTER TABLE class_memberships DROP CONSTRAINT IF EXISTS class_memberships_class_id_child_profile_id_key;

CREATE UNIQUE INDEX guardian_relationships_one_active_per_pair
  ON guardian_relationships(delegated_adult_account_id, child_profile_id)
  WHERE status IN ('pending','active','suspended');

CREATE UNIQUE INDEX permission_grants_one_active_capability
  ON permission_grants(guardian_relationship_id, capability)
  WHERE status = 'active';

CREATE UNIQUE INDEX class_memberships_one_active_per_pair
  ON class_memberships(class_id, child_profile_id)
  WHERE status IN ('pending','active','suspended');

CREATE INDEX sessions_active_account_idx ON sessions(account_id) WHERE revoked_at IS NULL;
CREATE INDEX child_profiles_guardian_idx ON child_profiles(primary_guardian_account_id) WHERE status <> 'deleted';
CREATE INDEX guardian_relationships_child_idx ON guardian_relationships(child_profile_id, status);
CREATE INDEX class_memberships_child_idx ON class_memberships(child_profile_id, status);
CREATE INDEX audit_events_target_idx ON audit_events(target_type, target_id, created_at);

CREATE OR REPLACE FUNCTION lexora_validate_child_guardian() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM accounts WHERE id = NEW.primary_guardian_account_id AND kind = 'adult' AND status <> 'deleted') THEN
    RAISE EXCEPTION 'primary guardian must reference an active adult account';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS child_profiles_guardian_kind ON child_profiles;
CREATE TRIGGER child_profiles_guardian_kind BEFORE INSERT OR UPDATE OF primary_guardian_account_id ON child_profiles FOR EACH ROW EXECUTE FUNCTION lexora_validate_child_guardian();

CREATE OR REPLACE FUNCTION lexora_validate_guardian_relationship() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM accounts WHERE id = NEW.delegated_adult_account_id AND kind = 'adult' AND status <> 'deleted') THEN
    RAISE EXCEPTION 'delegated guardian must reference an adult account';
  END IF;
  SELECT primary_guardian_account_id INTO owner_id FROM child_profiles WHERE id = NEW.child_profile_id;
  IF owner_id IS NULL THEN RAISE EXCEPTION 'child profile does not exist'; END IF;
  IF owner_id = NEW.delegated_adult_account_id THEN RAISE EXCEPTION 'primary guardian cannot be delegated guardian'; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guardian_relationship_account_kinds ON guardian_relationships;
CREATE TRIGGER guardian_relationship_account_kinds BEFORE INSERT OR UPDATE OF delegated_adult_account_id, child_profile_id ON guardian_relationships FOR EACH ROW EXECUTE FUNCTION lexora_validate_guardian_relationship();

CREATE OR REPLACE FUNCTION lexora_validate_workspace_member() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM accounts WHERE id = NEW.account_id AND kind = 'teacher' AND status <> 'deleted') THEN
    RAISE EXCEPTION 'workspace membership must reference a teacher account';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS workspace_membership_account_kind ON workspace_memberships;
CREATE TRIGGER workspace_membership_account_kind BEFORE INSERT OR UPDATE OF account_id ON workspace_memberships FOR EACH ROW EXECUTE FUNCTION lexora_validate_workspace_member();
