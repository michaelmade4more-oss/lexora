CREATE TABLE IF NOT EXISTS recovery_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id),
  recovery_token_id UUID NOT NULL REFERENCES credential_recovery_tokens(id),
  correlation_id UUID NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','submitted','delivered','failed','bounced','complaint')),
  provider_message_id TEXT,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error TEXT,
  next_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS recovery_deliveries_status_idx ON recovery_deliveries(status, next_attempt_at);
CREATE UNIQUE INDEX IF NOT EXISTS recovery_deliveries_provider_message_idx ON recovery_deliveries(provider, provider_message_id) WHERE provider_message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS recovery_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  event_key TEXT NOT NULL,
  message_id TEXT NOT NULL,
  record_type TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  UNIQUE(provider, event_key)
);
CREATE INDEX IF NOT EXISTS recovery_webhook_message_idx ON recovery_webhook_events(provider, message_id);

CREATE TABLE IF NOT EXISTS recovery_suppressions (
  email TEXT PRIMARY KEY,
  reason TEXT NOT NULL CHECK (reason IN ('bounce','complaint','manual')),
  provider TEXT NOT NULL,
  provider_event_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
