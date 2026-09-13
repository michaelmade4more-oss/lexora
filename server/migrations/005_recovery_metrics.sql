CREATE TABLE IF NOT EXISTS recovery_operational_metrics (
  metric_key TEXT NOT NULL,
  bucket_start TIMESTAMPTZ NOT NULL,
  count BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(metric_key, bucket_start)
);
