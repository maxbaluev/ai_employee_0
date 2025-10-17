-- AI Employee Control Plane — consolidated Supabase schema
-- Generated on 2025-10-16

SET search_path = public;

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ---------------------------------------------------------------------------
-- Enumerated Types
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'mission_stage'
  ) THEN
    CREATE TYPE mission_stage AS ENUM (
      'Home', 'Define', 'Prepare', 'Plan', 'Approve', 'Execute', 'Reflect'
    );
  END IF;
END;$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'mission_status'
  ) THEN
    CREATE TYPE mission_status AS ENUM (
      'draft', 'in_progress', 'ready', 'blocked', 'completed', 'archived'
    );
  END IF;
END;$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'readiness_state'
  ) THEN
    CREATE TYPE readiness_state AS ENUM (
      'unknown', 'needs_auth', 'needs_data', 'blocked', 'degraded', 'ready'
    );
  END IF;
END;$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'approval_status'
  ) THEN
    CREATE TYPE approval_status AS ENUM (
      'requested', 'delegated', 'approved', 'rejected', 'expired'
    );
  END IF;
END;$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'undo_event_type'
  ) THEN
    CREATE TYPE undo_event_type AS ENUM (
      'planned', 'available', 'requested', 'executed', 'failed'
    );
  END IF;
END;$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'stage_progress_state'
  ) THEN
    CREATE TYPE stage_progress_state AS ENUM (
      'pending', 'in_progress', 'ready', 'blocked', 'completed'
    );
  END IF;
END;$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'safeguard_severity'
  ) THEN
    CREATE TYPE safeguard_severity AS ENUM ('low', 'medium', 'high', 'critical');
  END IF;
END;$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'connection_status'
  ) THEN
    CREATE TYPE connection_status AS ENUM ('initiated', 'approved', 'expired', 'revoked', 'failed');
  END IF;
END;$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'inspection_outcome'
  ) THEN
    CREATE TYPE inspection_outcome AS ENUM ('pass', 'warn', 'fail');
  END IF;
END;$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'undo_plan_state'
  ) THEN
    CREATE TYPE undo_plan_state AS ENUM ('draft', 'ready', 'executed', 'expired');
  END IF;
END;$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'session_state'
  ) THEN
    CREATE TYPE session_state AS ENUM ('active', 'idle', 'terminated');
  END IF;
END;$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'followup_state'
  ) THEN
    CREATE TYPE followup_state AS ENUM ('open', 'in_progress', 'done', 'deferred', 'cancelled');
  END IF;
END;$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'telemetry_level'
  ) THEN
    CREATE TYPE telemetry_level AS ENUM ('info', 'success', 'warning', 'error');
  END IF;
END;$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'redaction_state'
  ) THEN
    CREATE TYPE redaction_state AS ENUM ('not_required', 'applied', 'pending_review');
  END IF;
END;$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'undo_status'
  ) THEN
    CREATE TYPE undo_status AS ENUM ('pending', 'in_progress', 'completed', 'failed');
  END IF;
END;$$;

-- ---------------------------------------------------------------------------
-- Helper Functions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_claims()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims_text text;
BEGIN
  claims_text := current_setting('request.jwt.claims', true);
  IF claims_text IS NULL OR claims_text = '' THEN
    RETURN '{}'::jsonb;
  END IF;
  BEGIN
    RETURN claims_text::jsonb;
  EXCEPTION WHEN others THEN
    RETURN '{}'::jsonb;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(public.current_claims() ->> 'tenant_id', '')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(public.current_claims() ->> 'sub', '')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.current_roles()
RETURNS text[]
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(ARRAY(
    SELECT jsonb_array_elements_text(
      COALESCE(public.current_claims() -> 'roles', '[]'::jsonb)
    )
  ), ARRAY[]::text[]);
$$;

CREATE OR REPLACE FUNCTION public.has_role(target_role text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT target_role = ANY(public.current_roles());
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Core Reference Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Mission Lifecycle Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  external_ref text,
  title text NOT NULL CHECK (title <> ''),
  description text,
  owner_id uuid,
  owner_role text,
  status mission_status NOT NULL DEFAULT 'draft',
  current_stage mission_stage NOT NULL DEFAULT 'Home',
  readiness readiness_state NOT NULL DEFAULT 'unknown',
  priority text,
  intent jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  brief_locked_at timestamptz,
  ready_at timestamptz,
  completed_at timestamptz,
  archived_at timestamptz,
  CONSTRAINT missions_owner_stage_check CHECK (current_stage IN (
    'Home','Define','Prepare','Plan','Approve','Execute','Reflect'
  ))
);

CREATE TABLE IF NOT EXISTS mission_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  metadata_key text NOT NULL CHECK (metadata_key <> ''),
  metadata_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_stage mission_stage,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mission_id, metadata_key)
);

CREATE TABLE IF NOT EXISTS mission_stage_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  stage mission_stage NOT NULL,
  status stage_progress_state NOT NULL DEFAULT 'pending',
  readiness_state readiness_state NOT NULL DEFAULT 'unknown',
  coverage_percent numeric(5,2) CHECK (coverage_percent IS NULL OR (coverage_percent >= 0 AND coverage_percent <= 100)),
  blocking_reason text,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mission_id, stage)
);

CREATE TABLE IF NOT EXISTS mission_safeguards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  category text NOT NULL,
  description text,
  severity safeguard_severity NOT NULL DEFAULT 'medium',
  added_by uuid,
  added_role text,
  enforced boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolution_note text
);

CREATE TABLE IF NOT EXISTS toolkit_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  toolkit_slug text NOT NULL,
  toolkit_name text,
  stage mission_stage NOT NULL DEFAULT 'Prepare',
  selection_reason text,
  recommended boolean NOT NULL DEFAULT false,
  rank integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mission_id, toolkit_slug)
);

CREATE TABLE IF NOT EXISTS mission_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  toolkit_slug text NOT NULL,
  connect_link_id text,
  requested_scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  granted_scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  status connection_status NOT NULL DEFAULT 'initiated',
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  expires_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS data_inspection_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  toolkit_slug text,
  inspector_id uuid,
  coverage_percent numeric(5,2),
  sample_count integer,
  pii_flags jsonb,
  outcome inspection_outcome NOT NULL DEFAULT 'pass',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mission_undo_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  plan_label text NOT NULL,
  impact_summary text,
  risk_assessment text,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  status undo_plan_state NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mission_plays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  play_identifier text,
  title text NOT NULL CHECK (title <> ''),
  description text,
  confidence numeric(5,2),
  ranking integer,
  selected boolean NOT NULL DEFAULT false,
  undo_plan_id uuid,
  generated_by text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mission_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  mission_play_id uuid REFERENCES mission_plays(id) ON DELETE SET NULL,
  approver_id uuid,
  approver_role text NOT NULL,
  status approval_status NOT NULL DEFAULT 'requested',
  rationale text,
  due_at timestamptz,
  decision_at timestamptz,
  undo_plan_id uuid REFERENCES mission_undo_plans(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mission_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_key text UNIQUE NOT NULL,
  mission_id uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  agent_name text NOT NULL,
  app_name text NOT NULL,
  user_id text,
  state_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  lag_ms integer,
  token_usage integer,
  state_size_bytes integer,
  status session_state NOT NULL DEFAULT 'active',
  last_heartbeat_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mission_id, agent_name)
);

CREATE TABLE IF NOT EXISTS mission_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  artifact_type text NOT NULL,
  name text,
  description text,
  source_stage mission_stage,
  storage_path text,
  storage_provider text,
  hash text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mission_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  artifact_id uuid REFERENCES mission_artifacts(id) ON DELETE CASCADE,
  display_message text,
  source_stage mission_stage,
  redaction_status redaction_state NOT NULL DEFAULT 'pending_review',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mission_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  user_id uuid,
  rating integer CHECK (rating BETWEEN 1 AND 5),
  effort_saved_hours numeric(6,2),
  blockers text,
  qualitative_notes text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS mission_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  task_type text NOT NULL,
  owner_role text,
  owner_id uuid,
  due_at timestamptz,
  status followup_state NOT NULL DEFAULT 'open',
  bd_issue text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS mission_retrospectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  impact_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  safeguard_compliance jsonb NOT NULL DEFAULT '{}'::jsonb,
  next_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.mission_accessible(mid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM missions m
    WHERE m.id = mid
      AND (
        m.tenant_id = public.current_tenant_id()
        OR public.has_role('governance')
        OR public.has_role('service')
        OR (public.has_role('analytics') AND m.status <> 'draft')
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Telemetry & Audit Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS telemetry_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid REFERENCES missions(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
  user_id uuid,
  agent_name text,
  stage mission_stage,
  event_type text NOT NULL,
  status telemetry_level NOT NULL DEFAULT 'info',
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload_sha text,
  correlation_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_stream_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid REFERENCES missions(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
  session_id text NOT NULL,
  stage mission_stage,
  sampling_mode text,
  telemetry_disabled boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  connected_at timestamptz NOT NULL DEFAULT now(),
  disconnected_at timestamptz
);

CREATE TABLE IF NOT EXISTS composio_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid REFERENCES missions(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
  toolkit text,
  action text,
  status text,
  outcome jsonb NOT NULL DEFAULT '{}'::jsonb,
  latency_ms integer,
  error_code text,
  retries integer NOT NULL DEFAULT 0,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS undo_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid REFERENCES missions(id) ON DELETE CASCADE,
  undo_plan_id uuid REFERENCES mission_undo_plans(id) ON DELETE CASCADE,
  event_type undo_event_type NOT NULL,
  status undo_status NOT NULL DEFAULT 'pending',
  initiated_by uuid,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Feedback & Library Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS library_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (title <> ''),
  description text,
  category text,
  tags text[] DEFAULT ARRAY[]::text[],
  playbook jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_mission_id uuid REFERENCES missions(id) ON DELETE SET NULL,
  source_artifact_id uuid REFERENCES mission_artifacts(id) ON DELETE SET NULL,
  reuse_count integer NOT NULL DEFAULT 0,
  average_rating numeric(4,2),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, title)
);

CREATE TABLE IF NOT EXISTS library_embeddings (
  entry_id uuid PRIMARY KEY REFERENCES library_entries(id) ON DELETE CASCADE,
  embedding vector(1536) NOT NULL,
  embedding_provider text,
  embedding_model text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Analytics Views & Materialized Views
-- ---------------------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS executive_summary_mv AS
SELECT
  m.tenant_id,
  date_trunc('week', m.created_at) AS week,
  count(*) FILTER (WHERE m.status = 'completed') AS completed_missions,
  count(*) FILTER (WHERE m.status IN ('in_progress','ready')) AS active_missions,
  avg(EXTRACT(EPOCH FROM (m.completed_at - m.created_at)) / 3600.0) FILTER (WHERE m.completed_at IS NOT NULL) AS avg_time_to_complete_hours
FROM missions m
GROUP BY 1, 2;

CREATE MATERIALIZED VIEW IF NOT EXISTS governance_insights_mv AS
SELECT
  m.tenant_id,
  date_trunc('day', ms.updated_at) AS day,
  count(*) FILTER (WHERE ms.status = 'blocked') AS blocked_stages,
  count(*) FILTER (WHERE ms.status = 'ready') AS ready_stages,
  count(*) FILTER (WHERE ma.status = 'approved') AS approvals_granted,
  count(*) FILTER (WHERE ma.status = 'rejected') AS approvals_rejected,
  count(DISTINCT me.id) AS evidence_items
FROM missions m
LEFT JOIN mission_stage_status ms ON ms.mission_id = m.id
LEFT JOIN mission_approvals ma ON ma.mission_id = m.id
LEFT JOIN mission_evidence me ON me.mission_id = m.id
GROUP BY 1, 2;

CREATE MATERIALIZED VIEW IF NOT EXISTS operations_health_mv AS
SELECT
  COALESCE(t.telemetry_tenant, s.session_tenant, c.audit_tenant) AS tenant_id,
  date_trunc('hour', COALESCE(t.event_time, s.session_time, c.audit_time)) AS hour,
  count(*) FILTER (WHERE t.status = 'error') AS error_events,
  count(*) FILTER (WHERE t.event_type = 'session_heartbeat') AS heartbeat_events,
  avg(
    CASE
      WHEN (t.context ->> 'lag_ms') ~ '^[0-9]+(\\.[0-9]+)?$'
        THEN (t.context ->> 'lag_ms')::numeric
      ELSE NULL
    END
  ) AS avg_heartbeat_lag_ms,
  count(DISTINCT s.session_id) AS active_streams,
  count(*) FILTER (WHERE c.status = 'failed') AS tool_failures
FROM (
  SELECT mission_id, tenant_id AS telemetry_tenant, created_at AS event_time, status, event_type, context
  FROM telemetry_events
) t
FULL OUTER JOIN (
  SELECT mission_id, tenant_id AS session_tenant, connected_at AS session_time, session_id
  FROM workspace_stream_sessions
) s ON s.mission_id = t.mission_id
FULL OUTER JOIN (
  SELECT mission_id, tenant_id AS audit_tenant, occurred_at AS audit_time, status
  FROM composio_audit_events
) c ON c.mission_id = COALESCE(t.mission_id, s.mission_id)
GROUP BY 1, 2;

CREATE MATERIALIZED VIEW IF NOT EXISTS adoption_funnel_mv AS
SELECT
  m.tenant_id,
  date_trunc('week', m.created_at) AS week,
  count(*) AS missions_created,
  count(*) FILTER (WHERE m.brief_locked_at IS NOT NULL) AS briefs_locked,
  count(*) FILTER (WHERE m.ready_at IS NOT NULL) AS readiness_achieved,
  count(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM mission_approvals ma
    WHERE ma.mission_id = m.id AND ma.status = 'approved'
  )) AS approvals_completed,
  count(*) FILTER (WHERE m.completed_at IS NOT NULL) AS missions_completed
FROM missions m
GROUP BY 1, 2;

CREATE MATERIALIZED VIEW IF NOT EXISTS agent_performance_mv AS
SELECT
  ms.mission_id,
  m.tenant_id,
  ms.agent_name,
  avg(ms.lag_ms) AS avg_lag_ms,
  avg(ms.token_usage) AS avg_token_usage,
  avg(ms.state_size_bytes) AS avg_state_size,
  count(*) FILTER (WHERE ms.status = 'terminated') AS terminated_sessions,
  count(*) FILTER (WHERE ms.status = 'active') AS active_sessions
FROM mission_sessions ms
JOIN missions m ON m.id = ms.mission_id
GROUP BY 1, 2, 3;

DROP VIEW IF EXISTS executive_summary;
CREATE VIEW executive_summary WITH (security_barrier = true) AS
SELECT *
FROM executive_summary_mv
WHERE tenant_id IS NULL
   OR tenant_id = public.current_tenant_id()
   OR public.has_role('analytics')
   OR public.has_role('governance')
   OR public.has_role('service');

DROP VIEW IF EXISTS governance_insights;
CREATE VIEW governance_insights WITH (security_barrier = true) AS
SELECT *
FROM governance_insights_mv
WHERE tenant_id IS NULL
   OR tenant_id = public.current_tenant_id()
   OR public.has_role('governance')
   OR public.has_role('service');

DROP VIEW IF EXISTS operations_health;
CREATE VIEW operations_health WITH (security_barrier = true) AS
SELECT *
FROM operations_health_mv
WHERE tenant_id IS NULL
   OR tenant_id = public.current_tenant_id()
   OR public.has_role('analytics')
   OR public.has_role('service');

DROP VIEW IF EXISTS adoption_funnel;
CREATE VIEW adoption_funnel WITH (security_barrier = true) AS
SELECT *
FROM adoption_funnel_mv
WHERE tenant_id IS NULL
   OR tenant_id = public.current_tenant_id()
   OR public.has_role('analytics')
   OR public.has_role('service');

DROP VIEW IF EXISTS agent_performance;
CREATE VIEW agent_performance WITH (security_barrier = true) AS
SELECT *
FROM agent_performance_mv
WHERE public.mission_accessible(mission_id)
   OR public.has_role('analytics')
   OR public.has_role('service');

CREATE OR REPLACE VIEW mission_readiness AS
SELECT
  m.id AS mission_id,
  m.tenant_id,
  m.current_stage,
  COALESCE(prep.readiness_state, m.readiness) AS readiness_state,
  prep.coverage_percent,
  prep.blocking_reason,
  prep.updated_at AS readiness_updated_at
FROM missions m
LEFT JOIN mission_stage_status prep
  ON prep.mission_id = m.id AND prep.stage = 'Prepare';

-- ---------------------------------------------------------------------------
-- Analytics Refresh & Utility Functions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_analytics_views()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW executive_summary_mv;
  REFRESH MATERIALIZED VIEW governance_insights_mv;
  REFRESH MATERIALIZED VIEW operations_health_mv;
  REFRESH MATERIALIZED VIEW adoption_funnel_mv;
  REFRESH MATERIALIZED VIEW agent_performance_mv;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_telemetry_events()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM telemetry_events WHERE created_at < now() - interval '180 days';
  DELETE FROM composio_audit_events WHERE occurred_at < now() - interval '180 days';
  DELETE FROM workspace_stream_sessions WHERE disconnected_at IS NOT NULL AND disconnected_at < now() - interval '90 days';
  DELETE FROM undo_events WHERE occurred_at < now() - interval '365 days';
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_mission_sessions()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM mission_sessions
  WHERE status <> 'active'
    AND updated_at < now() - interval '90 days';
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_library_embeddings()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE library_embeddings
  SET updated_at = now()
  WHERE updated_at < now() - interval '7 days';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_mission_stage_durations(mid uuid)
RETURNS TABLE(stage mission_stage, duration_seconds numeric)
LANGUAGE sql
AS $$
  SELECT
    ms.stage,
    EXTRACT(EPOCH FROM (COALESCE(ms.completed_at, now()) - COALESCE(ms.started_at, ms.updated_at)))
  FROM mission_stage_status ms
  WHERE ms.mission_id = mid
  ORDER BY ms.stage;
$$;

CREATE OR REPLACE FUNCTION public.get_mission_readiness(mid uuid)
RETURNS readiness_state
LANGUAGE sql
AS $$
  SELECT COALESCE((
    SELECT readiness_state
    FROM mission_stage_status
    WHERE mission_id = mid AND stage = 'Prepare'
  ), (
    SELECT readiness
    FROM missions
    WHERE id = mid
  ), 'unknown');
$$;

CREATE OR REPLACE FUNCTION public.search_library_entries(
  query_embedding vector(1536),
  similarity_threshold double precision DEFAULT 0.25,
  limit_results integer DEFAULT 20
)
RETURNS TABLE(entry_id uuid, score double precision)
LANGUAGE sql
STABLE
AS $$
  SELECT
    le.id,
    1 - (lemb.embedding <=> query_embedding) AS score
  FROM library_embeddings lemb
  JOIN library_entries le ON le.id = lemb.entry_id
  WHERE (lemb.embedding <=> query_embedding) <= (
    1 - LEAST(GREATEST(similarity_threshold, 0.0), 1.0)
  )
  ORDER BY lemb.embedding <=> query_embedding
  LIMIT GREATEST(limit_results, 1);
$$;

-- ---------------------------------------------------------------------------
-- Constraints & Indexes
-- ---------------------------------------------------------------------------
ALTER TABLE mission_plays
  ADD CONSTRAINT mission_plays_undo_plan_id_fkey
    FOREIGN KEY (undo_plan_id) REFERENCES mission_undo_plans(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_missions_tenant_status ON missions (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_missions_stage ON missions (current_stage);
CREATE INDEX IF NOT EXISTS idx_missions_owner ON missions (owner_id);
CREATE INDEX IF NOT EXISTS idx_mission_metadata_key ON mission_metadata (mission_id, metadata_key);
CREATE INDEX IF NOT EXISTS idx_mission_stage_status_stage ON mission_stage_status (mission_id, stage);
CREATE INDEX IF NOT EXISTS idx_mission_safeguards_mission ON mission_safeguards (mission_id);
CREATE INDEX IF NOT EXISTS idx_toolkit_selections_mission ON toolkit_selections (mission_id);
CREATE INDEX IF NOT EXISTS idx_mission_connections_toolkit ON mission_connections (mission_id, toolkit_slug);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mission_connections_link ON mission_connections (mission_id, toolkit_slug, COALESCE(connect_link_id, ''::text));
CREATE INDEX IF NOT EXISTS idx_data_checks_mission ON data_inspection_checks (mission_id);
CREATE INDEX IF NOT EXISTS idx_mission_plays_mission ON mission_plays (mission_id);
CREATE INDEX IF NOT EXISTS idx_mission_approvals_status ON mission_approvals (mission_id, status);
CREATE INDEX IF NOT EXISTS idx_mission_sessions_mission ON mission_sessions (mission_id, agent_name);
CREATE INDEX IF NOT EXISTS idx_mission_artifacts_mission ON mission_artifacts (mission_id, source_stage);
CREATE INDEX IF NOT EXISTS idx_mission_evidence_mission ON mission_evidence (mission_id);
CREATE INDEX IF NOT EXISTS idx_mission_feedback_mission ON mission_feedback (mission_id);
CREATE INDEX IF NOT EXISTS idx_mission_followups_mission ON mission_followups (mission_id, status);
CREATE INDEX IF NOT EXISTS idx_mission_retrospectives_mission ON mission_retrospectives (mission_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_mission ON telemetry_events (mission_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_stage ON telemetry_events (stage, event_type);
CREATE INDEX IF NOT EXISTS idx_telemetry_correlation ON telemetry_events (correlation_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_context ON telemetry_events USING gin (context);
CREATE INDEX IF NOT EXISTS idx_stream_sessions_session ON workspace_stream_sessions (session_id);
CREATE INDEX IF NOT EXISTS idx_composio_audit_mission ON composio_audit_events (mission_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_composio_audit_toolkit ON composio_audit_events (toolkit);
CREATE INDEX IF NOT EXISTS idx_composio_audit_outcome ON composio_audit_events USING gin (outcome);
CREATE INDEX IF NOT EXISTS idx_undo_events_plan ON undo_events (undo_plan_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_library_entries_tags ON library_entries USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_library_entries_category ON library_entries (category);
CREATE INDEX IF NOT EXISTS idx_library_entries_tenant ON library_entries (tenant_id);
CREATE INDEX IF NOT EXISTS idx_library_embeddings_embedding ON library_embeddings USING hnsw (embedding vector_cosine_ops);
CREATE UNIQUE INDEX IF NOT EXISTS executive_summary_pk ON executive_summary_mv (tenant_id, week);
CREATE UNIQUE INDEX IF NOT EXISTS governance_insights_pk ON governance_insights_mv (tenant_id, day);
CREATE UNIQUE INDEX IF NOT EXISTS operations_health_pk ON operations_health_mv (tenant_id, hour);
CREATE UNIQUE INDEX IF NOT EXISTS adoption_funnel_pk ON adoption_funnel_mv (tenant_id, week);
CREATE UNIQUE INDEX IF NOT EXISTS agent_performance_pk ON agent_performance_mv (mission_id, agent_name);

-- ---------------------------------------------------------------------------
-- Trigger Wiring
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_tenants_updated_at ON tenants;
CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_missions_updated_at ON missions;
CREATE TRIGGER trg_missions_updated_at
  BEFORE UPDATE ON missions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_mission_metadata_updated_at ON mission_metadata;
CREATE TRIGGER trg_mission_metadata_updated_at
  BEFORE UPDATE ON mission_metadata
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_mission_stage_status_updated_at ON mission_stage_status;
CREATE TRIGGER trg_mission_stage_status_updated_at
  BEFORE UPDATE ON mission_stage_status
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_mission_safeguards_updated_at ON mission_safeguards;
CREATE TRIGGER trg_mission_safeguards_updated_at
  BEFORE UPDATE ON mission_safeguards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_mission_connections_updated_at ON mission_connections;
CREATE TRIGGER trg_mission_connections_updated_at
  BEFORE UPDATE ON mission_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_mission_undo_plans_updated_at ON mission_undo_plans;
CREATE TRIGGER trg_mission_undo_plans_updated_at
  BEFORE UPDATE ON mission_undo_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_mission_plays_updated_at ON mission_plays;
CREATE TRIGGER trg_mission_plays_updated_at
  BEFORE UPDATE ON mission_plays
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_mission_approvals_updated_at ON mission_approvals;
CREATE TRIGGER trg_mission_approvals_updated_at
  BEFORE UPDATE ON mission_approvals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_mission_sessions_updated_at ON mission_sessions;
CREATE TRIGGER trg_mission_sessions_updated_at
  BEFORE UPDATE ON mission_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_mission_artifacts_updated_at ON mission_artifacts;
CREATE TRIGGER trg_mission_artifacts_updated_at
  BEFORE UPDATE ON mission_artifacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_mission_retrospectives_updated_at ON mission_retrospectives;
CREATE TRIGGER trg_mission_retrospectives_updated_at
  BEFORE UPDATE ON mission_retrospectives
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_library_entries_updated_at ON library_entries;
CREATE TRIGGER trg_library_entries_updated_at
  BEFORE UPDATE ON library_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_library_embeddings_updated_at ON library_embeddings;
CREATE TRIGGER trg_library_embeddings_updated_at
  BEFORE UPDATE ON library_embeddings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row-Level Security Policies
-- ---------------------------------------------------------------------------
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_stage_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_safeguards ENABLE ROW LEVEL SECURITY;
ALTER TABLE toolkit_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_inspection_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_undo_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_plays ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_retrospectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemetry_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_stream_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE composio_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE undo_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_embeddings ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenants_service_read ON tenants
  FOR SELECT
  USING (public.has_role('service'));

CREATE POLICY missions_tenant_read ON missions
  FOR SELECT
  USING (
    tenant_id = public.current_tenant_id()
    OR public.has_role('governance')
    OR public.has_role('analytics')
    OR public.has_role('service')
  );

CREATE POLICY missions_tenant_write ON missions
  FOR ALL
  USING (tenant_id = public.current_tenant_id() OR public.has_role('service'))
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.has_role('service'));

CREATE POLICY mission_children_read ON mission_metadata
  FOR SELECT
  USING (public.mission_accessible(mission_id));

CREATE POLICY mission_children_write ON mission_metadata
  FOR ALL
  USING (public.mission_accessible(mission_id) OR public.has_role('service'))
  WITH CHECK (public.mission_accessible(mission_id) OR public.has_role('service'));

CREATE POLICY mission_status_read ON mission_stage_status
  FOR SELECT USING (public.mission_accessible(mission_id));
CREATE POLICY mission_status_write ON mission_stage_status
  FOR ALL USING (public.mission_accessible(mission_id) OR public.has_role('service'))
  WITH CHECK (public.mission_accessible(mission_id) OR public.has_role('service'));

CREATE POLICY mission_related_read ON mission_safeguards
  FOR SELECT USING (public.mission_accessible(mission_id));
CREATE POLICY mission_related_write ON mission_safeguards
  FOR ALL USING (public.mission_accessible(mission_id) OR public.has_role('service'))
  WITH CHECK (public.mission_accessible(mission_id) OR public.has_role('service'));

CREATE POLICY mission_connections_read ON mission_connections
  FOR SELECT USING (public.mission_accessible(mission_id));
CREATE POLICY mission_connections_write ON mission_connections
  FOR ALL USING (public.mission_accessible(mission_id) OR public.has_role('service'))
  WITH CHECK (public.mission_accessible(mission_id) OR public.has_role('service'));

CREATE POLICY mission_sessions_read ON mission_sessions
  FOR SELECT USING (public.mission_accessible(mission_id));
CREATE POLICY mission_sessions_write ON mission_sessions
  FOR ALL USING (public.mission_accessible(mission_id) OR public.has_role('service'))
  WITH CHECK (public.mission_accessible(mission_id) OR public.has_role('service'));

CREATE POLICY mission_artifacts_read ON mission_artifacts
  FOR SELECT USING (public.mission_accessible(mission_id) OR public.has_role('governance'));
CREATE POLICY mission_artifacts_write ON mission_artifacts
  FOR ALL USING (public.mission_accessible(mission_id) OR public.has_role('service'))
  WITH CHECK (public.mission_accessible(mission_id) OR public.has_role('service'));

CREATE POLICY mission_evidence_read ON mission_evidence
  FOR SELECT USING (public.mission_accessible(mission_id) OR public.has_role('governance'));
CREATE POLICY mission_evidence_write ON mission_evidence
  FOR ALL USING (public.mission_accessible(mission_id) OR public.has_role('service'))
  WITH CHECK (public.mission_accessible(mission_id) OR public.has_role('service'));

CREATE POLICY mission_toolkits_read ON toolkit_selections
  FOR SELECT USING (public.mission_accessible(mission_id));
CREATE POLICY mission_toolkits_write ON toolkit_selections
  FOR ALL USING (public.mission_accessible(mission_id) OR public.has_role('service'))
  WITH CHECK (public.mission_accessible(mission_id) OR public.has_role('service'));

CREATE POLICY mission_inspections_read ON data_inspection_checks
  FOR SELECT USING (public.mission_accessible(mission_id));
CREATE POLICY mission_inspections_write ON data_inspection_checks
  FOR ALL USING (public.mission_accessible(mission_id) OR public.has_role('service'))
  WITH CHECK (public.mission_accessible(mission_id) OR public.has_role('service'));

CREATE POLICY mission_undo_plans_read ON mission_undo_plans
  FOR SELECT USING (public.mission_accessible(mission_id));
CREATE POLICY mission_undo_plans_write ON mission_undo_plans
  FOR ALL USING (public.mission_accessible(mission_id) OR public.has_role('service'))
  WITH CHECK (public.mission_accessible(mission_id) OR public.has_role('service'));

CREATE POLICY mission_plays_read ON mission_plays
  FOR SELECT USING (public.mission_accessible(mission_id));
CREATE POLICY mission_plays_write ON mission_plays
  FOR ALL USING (public.mission_accessible(mission_id) OR public.has_role('service'))
  WITH CHECK (public.mission_accessible(mission_id) OR public.has_role('service'));

CREATE POLICY mission_approvals_read ON mission_approvals
  FOR SELECT USING (public.mission_accessible(mission_id) OR public.has_role('governance'));
CREATE POLICY mission_approvals_write ON mission_approvals
  FOR ALL USING (public.mission_accessible(mission_id) OR public.has_role('service'))
  WITH CHECK (public.mission_accessible(mission_id) OR public.has_role('service'));

CREATE POLICY mission_followups_read ON mission_followups
  FOR SELECT USING (public.mission_accessible(mission_id));
CREATE POLICY mission_followups_write ON mission_followups
  FOR ALL USING (public.mission_accessible(mission_id) OR public.has_role('service'))
  WITH CHECK (public.mission_accessible(mission_id) OR public.has_role('service'));

CREATE POLICY mission_streams_read ON workspace_stream_sessions
  FOR SELECT USING (public.mission_accessible(mission_id));
CREATE POLICY mission_streams_write ON workspace_stream_sessions
  FOR ALL USING (public.mission_accessible(mission_id) OR public.has_role('service'))
  WITH CHECK (public.mission_accessible(mission_id) OR public.has_role('service'));

CREATE POLICY mission_audit_read ON composio_audit_events
  FOR SELECT USING (public.mission_accessible(mission_id) OR public.has_role('governance') OR public.has_role('analytics'));
CREATE POLICY mission_audit_write ON composio_audit_events
  FOR ALL USING (public.mission_accessible(mission_id) OR public.has_role('service'))
  WITH CHECK (public.mission_accessible(mission_id) OR public.has_role('service'));

CREATE POLICY mission_undo_events_read ON undo_events
  FOR SELECT USING (public.mission_accessible(mission_id) OR public.has_role('governance'));
CREATE POLICY mission_undo_events_write ON undo_events
  FOR ALL USING (public.mission_accessible(mission_id) OR public.has_role('service'))
  WITH CHECK (public.mission_accessible(mission_id) OR public.has_role('service'));

CREATE POLICY mission_feedback_read ON mission_feedback
  FOR SELECT USING (public.mission_accessible(mission_id) OR public.has_role('analytics'));
CREATE POLICY mission_feedback_write ON mission_feedback
  FOR ALL USING (public.mission_accessible(mission_id) OR public.has_role('service'))
  WITH CHECK (public.mission_accessible(mission_id) OR public.has_role('service'));

CREATE POLICY mission_retrospectives_read ON mission_retrospectives
  FOR SELECT USING (public.mission_accessible(mission_id) OR public.has_role('governance'));
CREATE POLICY mission_retrospectives_write ON mission_retrospectives
  FOR ALL USING (public.mission_accessible(mission_id) OR public.has_role('service'))
  WITH CHECK (public.mission_accessible(mission_id) OR public.has_role('service'));

CREATE POLICY telemetry_read ON telemetry_events
  FOR SELECT
  USING (
    mission_id IS NULL
    OR public.mission_accessible(mission_id)
    OR public.has_role('analytics')
    OR public.has_role('governance')
  );

CREATE POLICY telemetry_write ON telemetry_events
  FOR INSERT
  WITH CHECK (public.has_role('service') OR public.mission_accessible(mission_id));

CREATE POLICY telemetry_update ON telemetry_events
  FOR UPDATE USING (public.has_role('service'))
  WITH CHECK (public.has_role('service'));

CREATE POLICY library_entries_read ON library_entries
  FOR SELECT
  USING (
    tenant_id IS NULL
    OR tenant_id = public.current_tenant_id()
    OR public.has_role('governance')
    OR public.has_role('analytics')
    OR public.has_role('service')
  );

CREATE POLICY library_entries_write ON library_entries
  FOR ALL
  USING (tenant_id = public.current_tenant_id() OR public.has_role('service'))
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.has_role('service') OR tenant_id IS NULL);

CREATE POLICY library_embeddings_read ON library_embeddings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM library_entries le
      WHERE le.id = library_embeddings.entry_id
        AND (
          le.tenant_id IS NULL
          OR le.tenant_id = public.current_tenant_id()
          OR public.has_role('governance')
          OR public.has_role('analytics')
          OR public.has_role('service')
        )
    )
  );

CREATE POLICY library_embeddings_write ON library_embeddings
  FOR ALL USING (public.has_role('service')) WITH CHECK (public.has_role('service'));

-- ---------------------------------------------------------------------------
-- Mission Computation Helpers
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS mission_stage_progress;
CREATE VIEW mission_stage_progress AS
SELECT
  m.id AS mission_id,
  m.tenant_id,
  ms.stage,
  ms.status,
  ms.readiness_state,
  ms.coverage_percent,
  ms.updated_at
FROM missions m
JOIN mission_stage_status ms ON ms.mission_id = m.id;

-- ---------------------------------------------------------------------------
-- Scheduled Jobs
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'refresh_analytics_views'
  ) THEN
    PERFORM cron.schedule(
      'refresh_analytics_views',
      '0 2 * * *',
      'SELECT public.refresh_analytics_views()'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'cleanup_telemetry_events'
  ) THEN
    PERFORM cron.schedule(
      'cleanup_telemetry_events',
      '0 * * * *',
      'SELECT public.cleanup_telemetry_events()'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'cleanup_mission_sessions'
  ) THEN
    PERFORM cron.schedule(
      'cleanup_mission_sessions',
      '30 3 * * *',
      'SELECT public.cleanup_mission_sessions()'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'refresh_library_embeddings'
  ) THEN
    PERFORM cron.schedule(
      'refresh_library_embeddings',
      '0 6 * * 1',
      'SELECT public.refresh_library_embeddings()'
    );
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------
COMMENT ON FUNCTION public.refresh_analytics_views() IS 'Refreshes all analytics materialized views for dashboards.';
COMMENT ON FUNCTION public.cleanup_telemetry_events() IS 'Prunes telemetry, audit, and stream session tables to maintain retention windows.';
COMMENT ON FUNCTION public.cleanup_mission_sessions() IS 'Removes inactive mission sessions older than retention threshold.';
COMMENT ON FUNCTION public.refresh_library_embeddings() IS 'Marks vector embeddings for weekly refresh to trigger downstream jobs.';
COMMENT ON FUNCTION public.search_library_entries(vector, double precision, integer) IS 'Semantic search helper returning library entries ordered by cosine similarity.';
COMMENT ON VIEW mission_readiness IS 'Provides the latest readiness badge snapshot used by the Home dashboard.';
COMMENT ON VIEW mission_stage_progress IS 'Flattens mission stage progression for analytics and evaluation workflows.';

-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- Default Tenant Placeholder (ensures local development works out-of-the-box)
-- ---------------------------------------------------------------------------
INSERT INTO tenants (id, slug, name)
VALUES
  (gen_random_uuid(), 'demo', 'Demo Workspace')
ON CONFLICT (slug) DO NOTHING;
