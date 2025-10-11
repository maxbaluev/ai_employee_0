-- AI Employee Control Plane — Consolidated schema (Gate G-A + Gate G-B)
-- Generated October 10, 2025

-- ------------------------------------------------------------------
-- Extensions
-- ------------------------------------------------------------------
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;
create extension if not exists vector;

-- ------------------------------------------------------------------
-- Helper functions
-- ------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- Message retention function for Gate G-B
create or replace function public.cleanup_copilot_messages(retention_days integer default 7)
returns integer
language plpgsql
security definer
as $$
declare
  deleted_count integer;
  cutoff_timestamp timestamptz;
begin
  -- Calculate cutoff timestamp
  cutoff_timestamp := timezone('utc', now()) - (retention_days || ' days')::interval;

  -- Soft delete messages older than retention period
  update public.copilot_messages
  set soft_deleted_at = timezone('utc', now())
  where created_at < cutoff_timestamp
    and soft_deleted_at is null;

  get diagnostics deleted_count = row_count;

  -- Hard delete messages soft-deleted more than 30 days ago
  delete from public.copilot_messages
  where soft_deleted_at < (timezone('utc', now()) - '30 days'::interval);

  return deleted_count;
end;
$$;

comment on function public.cleanup_copilot_messages is 'Soft-delete copilot messages older than retention period (default 7 days)';

-- ------------------------------------------------------------------
-- Core mission tables
-- ------------------------------------------------------------------

create table public.objectives (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references auth.users(id),
  created_by uuid references auth.users(id),
  goal text not null,
  audience text not null,
  timeframe text,
  guardrails jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger trg_objectives_updated_at
before update on public.objectives
for each row execute function public.touch_updated_at();

create table public.plays (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references auth.users(id),
  objective_id uuid not null references public.objectives(id) on delete cascade,
  mode text not null default 'dry_run',
  plan_json jsonb not null default '{}'::jsonb,
  impact_estimate text,
  risk_profile text,
  undo_plan text,
  confidence numeric,
  telemetry jsonb not null default '{}'::jsonb,
  -- Gate G-B telemetry fields
  latency_ms integer,
  success_score numeric,
  tool_count integer,
  evidence_hash text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on column public.plays.latency_ms is 'Planner execution latency in milliseconds';
comment on column public.plays.success_score is 'Historical success score from library matching';
comment on column public.plays.tool_count is 'Number of toolkit references in play';
comment on column public.plays.evidence_hash is 'SHA-256 hash of evidence bundle for tamper detection';

create trigger trg_plays_updated_at
before update on public.plays
for each row execute function public.touch_updated_at();

create table public.tool_calls (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references auth.users(id),
  play_id uuid not null references public.plays(id) on delete cascade,
  toolkit text not null,
  tool_name text not null,
  arguments jsonb not null default '{}'::jsonb,
  arguments_hash text not null,
  result_ref text,
  outcome jsonb,
  undo_plan text,
  undo_plan_json jsonb,  -- Gate G-B structured undo plan
  guardrail_snapshot jsonb,
  latency_ms integer,
  quiet_hour_override boolean not null default false,
  executed_at timestamptz not null default timezone('utc', now())
);

comment on column public.tool_calls.undo_plan_json is 'Structured undo plan for evidence service execution';

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references auth.users(id),
  tool_call_id uuid not null references public.tool_calls(id) on delete cascade,
  reviewer_id uuid references auth.users(id),
  decision text not null,
  decision_at timestamptz not null default timezone('utc', now()),
  justification text,
  guardrail_violation jsonb,
  metadata jsonb not null default '{}'::jsonb,
  -- Gate G-B concurrency guard
  constraint approvals_tool_call_unique unique (tool_call_id)
);

create table public.artifacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references auth.users(id),
  play_id uuid references public.plays(id) on delete cascade,
  type text not null,
  title text not null,
  content_ref text,
  content jsonb,
  status text not null default 'draft',
  hash text,
  checksum text,
  -- Gate G-B proof pack enhancements
  size_bytes bigint,
  reviewer_edits jsonb default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on column public.artifacts.size_bytes is 'Artifact payload size in bytes';
comment on column public.artifacts.reviewer_edits is 'Reviewer-applied edits to artifact content';

create trigger trg_artifacts_updated_at
before update on public.artifacts
for each row execute function public.touch_updated_at();

create table public.library_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references auth.users(id),
  title text not null,
  description text,
  persona text,
  embedding vector(1536) not null,
  success_score numeric,
  reuse_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger trg_library_entries_updated_at
before update on public.library_entries
for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------------
-- Guardrail configuration
-- ------------------------------------------------------------------

create table public.guardrail_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references auth.users(id),
  label text not null,
  tone_policy jsonb not null default '{"forbidden": [], "required": ["professional"]}'::jsonb,
  quiet_hours jsonb not null default '{"start": 20, "end": 7, "timezone": "UTC"}'::jsonb,
  rate_limit jsonb not null default '{"per_hour": 30, "burst": 10}'::jsonb,
  budget_cap jsonb not null default '{"currency": "USD", "max_cents": 5000, "period": "daily"}'::jsonb,
  undo_required boolean not null default true,
  escalation_contacts jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger trg_guardrail_profiles_updated_at
before update on public.guardrail_profiles
for each row execute function public.touch_updated_at();

create table public.mission_guardrails (
  mission_id uuid not null references public.objectives(id) on delete cascade,
  guardrail_profile_id uuid not null references public.guardrail_profiles(id) on delete cascade,
  custom_overrides jsonb,
  effective_at timestamptz not null default timezone('utc', now()),
  primary key (mission_id, guardrail_profile_id)
);

-- ------------------------------------------------------------------
-- Mission metadata & safeguard hints (Generative intake)
-- ------------------------------------------------------------------

create table public.mission_metadata (
  mission_id uuid not null references public.objectives(id) on delete cascade,
  tenant_id uuid not null references auth.users(id),
  field text not null,
  value jsonb not null default '{}'::jsonb,
  confidence numeric check (confidence >= 0 and confidence <= 1),
  source text not null default 'generated',
  regeneration_count integer not null default 0,
  accepted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (mission_id, field)
);

create trigger trg_mission_metadata_updated_at
before update on public.mission_metadata
for each row execute function public.touch_updated_at();

create table public.mission_safeguards (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.objectives(id) on delete cascade,
  tenant_id uuid not null references auth.users(id),
  hint_type text not null,
  suggested_value jsonb not null default '{}'::jsonb,
  confidence numeric check (confidence >= 0 and confidence <= 1),
  status text not null default 'suggested',
  source text not null default 'generated',
  generation_count integer not null default 0,
  accepted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger trg_mission_safeguards_updated_at
before update on public.mission_safeguards
for each row execute function public.touch_updated_at();

create table public.mission_events (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid references public.objectives(id) on delete cascade,
  tenant_id uuid not null references auth.users(id),
  event_name text not null,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.safeguard_events (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid references public.objectives(id) on delete cascade,
  tenant_id uuid not null references auth.users(id),
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

-- ------------------------------------------------------------------
-- Mission feedback (Gate G-B)
-- ------------------------------------------------------------------

create table public.mission_feedback (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.objectives(id) on delete cascade,
  tenant_id uuid not null references auth.users(id),
  artifact_id uuid references public.artifacts(id) on delete set null,
  reviewer_id uuid references auth.users(id),
  rating integer check (rating >= 1 and rating <= 5),
  feedback_text text,
  learning_signals jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.mission_feedback is 'User feedback and ratings for mission outcomes with learning signals';
comment on column public.mission_feedback.rating is 'User rating from 1 (poor) to 5 (excellent)';
comment on column public.mission_feedback.feedback_text is 'Free-form textual feedback from user';
comment on column public.mission_feedback.learning_signals is 'Structured signals for model fine-tuning and improvement';

create trigger trg_mission_feedback_updated_at
before update on public.mission_feedback
for each row execute function public.touch_updated_at();

create index mission_feedback_mission_id_idx on public.mission_feedback(mission_id);
create index mission_feedback_tenant_idx on public.mission_feedback(tenant_id);
create index mission_feedback_artifact_idx on public.mission_feedback(artifact_id);
create index mission_feedback_rating_idx on public.mission_feedback(rating);
create index mission_feedback_created_at_idx on public.mission_feedback(created_at desc);

alter table public.mission_feedback enable row level security;

create policy "Tenant scoped read" on public.mission_feedback
  for select using (tenant_id = auth.uid());

create policy "Tenant scoped write" on public.mission_feedback
  for insert with check (tenant_id = auth.uid());

create policy "Tenant scoped update" on public.mission_feedback
  for update using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());

create policy "Tenant scoped delete" on public.mission_feedback
  for delete using (tenant_id = auth.uid());

-- ------------------------------------------------------------------
-- Toolkit selections (Stage 3 persistence)
-- ------------------------------------------------------------------

create table public.toolkit_selections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references auth.users(id),
  mission_id uuid not null references public.objectives(id) on delete cascade,
  selected_tools jsonb not null default '[]'::jsonb,
  rationale text,
  created_at timestamptz not null default timezone('utc', now())
);

comment on table public.toolkit_selections is 'Mission-level toolkit selections and rationale for recommended palette';
comment on column public.toolkit_selections.selected_tools is 'Array of selected toolkit identifiers and metadata';

create index toolkit_selections_mission_created_idx
  on public.toolkit_selections (mission_id, created_at desc);

create index toolkit_selections_tenant_created_idx
  on public.toolkit_selections (tenant_id, created_at);

alter table public.toolkit_selections enable row level security;

create policy "Tenant select toolkit selections"
  on public.toolkit_selections
  for select
  using (tenant_id = auth.uid());

create policy "Tenant insert toolkit selections"
  on public.toolkit_selections
  for insert
  with check (tenant_id = auth.uid());

-- TODO: Regenerate Supabase types after adding toolkit_selections table

-- ------------------------------------------------------------------
-- Inspection findings (Stage 4 readiness)
-- ------------------------------------------------------------------

create table public.inspection_findings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references auth.users(id),
  mission_id uuid not null references public.objectives(id) on delete cascade,
  finding_type text,
  payload jsonb not null default '{}'::jsonb,
  readiness integer check (readiness >= 0 and readiness <= 100),
  created_at timestamptz not null default timezone('utc', now())
);

comment on table public.inspection_findings is 'Inspection previews and readiness findings generated prior to execution';
comment on column public.inspection_findings.finding_type is 'Classifier for inspection finding (coverage_gap, freshness, authorization, etc.)';
comment on column public.inspection_findings.payload is 'Structured inspection payload (counts, evidence references, gaps)';

create index inspection_findings_mission_created_idx
  on public.inspection_findings (mission_id, created_at desc);

create index inspection_findings_tenant_created_idx
  on public.inspection_findings (tenant_id, created_at);

alter table public.inspection_findings enable row level security;

create policy "Tenant select inspection findings"
  on public.inspection_findings
  for select
  using (tenant_id = auth.uid());

create policy "Tenant insert inspection findings"
  on public.inspection_findings
  for insert
  with check (tenant_id = auth.uid());

-- TODO: Regenerate Supabase types after adding inspection_findings table

-- ------------------------------------------------------------------
-- CopilotKit persistence
-- ------------------------------------------------------------------

create table public.copilot_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references auth.users(id),
  agent_id text not null,
  session_identifier text not null,
  state jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, agent_id, session_identifier)
);

create trigger trg_copilot_sessions_updated_at
before update on public.copilot_sessions
for each row execute function public.touch_updated_at();

create table public.copilot_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references auth.users(id),
  session_id uuid not null references public.copilot_sessions(id) on delete cascade,
  role text not null,
  content jsonb not null,
  metadata jsonb not null default '{}'::jsonb,
  -- Gate G-B telemetry fields
  mission_id uuid references public.objectives(id) on delete cascade,
  payload_type text default 'text',
  latency_ms integer,
  telemetry_event_ids text[] default array[]::text[],
  soft_deleted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

comment on column public.copilot_messages.mission_id is 'Optional mission pointer for playback filtering';
comment on column public.copilot_messages.payload_type is 'Message payload classification (text, stage_update, attachment, etc.)';
comment on column public.copilot_messages.latency_ms is 'Latency between agent emission and persistence in milliseconds';
comment on column public.copilot_messages.telemetry_event_ids is 'Linked telemetry events for quick reconciliation';
comment on column public.copilot_messages.soft_deleted_at is 'Soft delete timestamp for retention job';

-- ------------------------------------------------------------------
-- OAuth credential vault (Stage 3 integrations)
-- ------------------------------------------------------------------

create table public.oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references auth.users(id),
  provider text not null,
  connection_id text not null,
  access_token_ciphertext text not null,
  refresh_token_ciphertext text,
  token_fingerprint text not null,
  expires_at timestamptz,
  scope text[] not null default array[]::text[],
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.oauth_tokens is 'Encrypted OAuth tokens scoped per tenant and provider.';
comment on column public.oauth_tokens.access_token_ciphertext is 'AES-GCM encrypted access token stored as base64 url-safe text.';
comment on column public.oauth_tokens.refresh_token_ciphertext is 'AES-GCM encrypted refresh token stored as base64 url-safe text.';
comment on column public.oauth_tokens.token_fingerprint is 'SHA-256 fingerprint of the decrypted access token for rotation tracking.';

create trigger trg_oauth_tokens_updated_at
before update on public.oauth_tokens
for each row execute function public.touch_updated_at();

create unique index oauth_tokens_tenant_provider_connection_uq
  on public.oauth_tokens (tenant_id, provider, connection_id);

create index oauth_tokens_provider_idx on public.oauth_tokens(provider);
create index oauth_tokens_tenant_idx on public.oauth_tokens(tenant_id);
create index oauth_tokens_expiry_idx on public.oauth_tokens(expires_at);

alter table public.oauth_tokens enable row level security;

create policy "Tenant scoped read" on public.oauth_tokens
  for select using (tenant_id = auth.uid());

create policy "Tenant scoped write" on public.oauth_tokens
  for insert with check (tenant_id = auth.uid());

create policy "Tenant scoped update" on public.oauth_tokens
  for update using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());

create policy "Tenant scoped delete" on public.oauth_tokens
  for delete using (tenant_id = auth.uid());

-- TODO: Regenerate Supabase types after applying OAuth credential changes

-- ------------------------------------------------------------------
-- Planner runs telemetry (Gate G-B)
-- ------------------------------------------------------------------

create table public.planner_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references auth.users(id),
  mission_id uuid not null references public.objectives(id) on delete cascade,
  latency_ms integer not null,
  candidate_count integer not null,
  embedding_similarity_avg numeric,
  primary_toolkits text[] default array[]::text[],
  mode text not null default 'dry_run',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

comment on table public.planner_runs is 'Planner execution telemetry for Gate G-B analytics';

-- ------------------------------------------------------------------
-- Vector helpers
-- ------------------------------------------------------------------

create or replace function public.match_library_entries(
  query_embedding vector(1536),
  match_count int
)
returns table (
  id uuid,
  similarity float
)
language sql
stable
as $$
  select le.id,
         1 - (le.embedding <=> query_embedding) as similarity
  from public.library_entries le
  order by le.embedding <=> query_embedding
  limit match_count;
$$;

-- ------------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------------

create index objectives_tenant_id_idx on public.objectives(tenant_id);
create index objectives_status_idx on public.objectives(status);

create index plays_objective_id_idx on public.plays(objective_id);
create index plays_tenant_id_idx on public.plays(tenant_id);

create index tool_calls_play_id_idx on public.tool_calls(play_id);
create index tool_calls_tenant_id_idx on public.tool_calls(tenant_id);

create index approvals_tool_call_id_idx on public.approvals(tool_call_id);
create index approvals_tenant_id_idx on public.approvals(tenant_id);

create index artifacts_play_id_idx on public.artifacts(play_id);
create index artifacts_tenant_id_idx on public.artifacts(tenant_id);

create index library_entries_tenant_id_idx on public.library_entries(tenant_id);
create index library_entries_persona_idx on public.library_entries(persona);
create index library_entries_embedding_idx
  on public.library_entries using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index guardrail_profiles_tenant_id_idx on public.guardrail_profiles(tenant_id);

create index mission_guardrails_mission_id_idx on public.mission_guardrails(mission_id);

create index mission_metadata_mission_id_idx on public.mission_metadata(mission_id);
create index mission_metadata_tenant_idx on public.mission_metadata(tenant_id);
create index mission_metadata_field_idx on public.mission_metadata(field);

create index mission_safeguards_mission_id_idx on public.mission_safeguards(mission_id);
create index mission_safeguards_tenant_idx on public.mission_safeguards(tenant_id);
create index mission_safeguards_status_idx on public.mission_safeguards(status);
create index mission_safeguards_type_idx on public.mission_safeguards(hint_type);

create index mission_events_mission_id_idx on public.mission_events(mission_id);
create index mission_events_tenant_idx on public.mission_events(tenant_id);
create index mission_events_name_idx on public.mission_events(event_name);
create index mission_events_created_at_idx on public.mission_events(created_at desc);

create index safeguard_events_mission_id_idx on public.safeguard_events(mission_id);
create index safeguard_events_tenant_idx on public.safeguard_events(tenant_id);
create index safeguard_events_type_idx on public.safeguard_events(event_type);
create index safeguard_events_created_at_idx on public.safeguard_events(created_at desc);

create index copilot_sessions_tenant_agent_idx on public.copilot_sessions(tenant_id, agent_id);
create index copilot_messages_session_idx on public.copilot_messages(session_id);

-- Gate G-B indexes
create index idx_copilot_messages_session_created on public.copilot_messages(session_id, created_at desc);
create index idx_copilot_messages_mission_created on public.copilot_messages(mission_id, created_at desc);
create index idx_copilot_messages_soft_deleted on public.copilot_messages(soft_deleted_at) where soft_deleted_at is not null;

create index idx_planner_runs_mission on public.planner_runs(mission_id, created_at desc);
create index idx_planner_runs_latency on public.planner_runs(latency_ms);

-- ------------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------------

alter table public.objectives enable row level security;
alter table public.plays enable row level security;
alter table public.tool_calls enable row level security;
alter table public.approvals enable row level security;
alter table public.artifacts enable row level security;
alter table public.library_entries enable row level security;
alter table public.guardrail_profiles enable row level security;
alter table public.mission_guardrails enable row level security;
alter table public.copilot_sessions enable row level security;
alter table public.copilot_messages enable row level security;
alter table public.mission_metadata enable row level security;
alter table public.mission_safeguards enable row level security;
alter table public.mission_events enable row level security;
alter table public.safeguard_events enable row level security;
alter table public.planner_runs enable row level security;

create policy "Tenant scoped read" on public.objectives
  for select using (tenant_id = auth.uid());
create policy "Tenant scoped write" on public.objectives
  for insert with check (tenant_id = auth.uid());
create policy "Tenant scoped update" on public.objectives
  for update using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());

create policy "Tenant scoped read" on public.plays
  for select using (tenant_id = auth.uid());
create policy "Tenant scoped write" on public.plays
  for insert with check (tenant_id = auth.uid());
create policy "Tenant scoped update" on public.plays
  for update using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());

create policy "Tenant scoped read" on public.tool_calls
  for select using (tenant_id = auth.uid());
create policy "Tenant scoped insert" on public.tool_calls
  for insert with check (tenant_id = auth.uid());
create policy "Tenant scoped update" on public.tool_calls
  for update using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());

create policy "Tenant scoped read" on public.approvals
  for select using (tenant_id = auth.uid());
create policy "Tenant scoped write" on public.approvals
  for insert with check (tenant_id = auth.uid());
create policy "Tenant scoped update" on public.approvals
  for update using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());

create policy "Tenant scoped read" on public.artifacts
  for select using (tenant_id = auth.uid());
create policy "Tenant scoped write" on public.artifacts
  for insert with check (tenant_id = auth.uid());
create policy "Tenant scoped update" on public.artifacts
  for update using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());

create policy "Tenant scoped read" on public.library_entries
  for select using (tenant_id = auth.uid());
create policy "Tenant scoped write" on public.library_entries
  for insert with check (tenant_id = auth.uid());
create policy "Tenant scoped update" on public.library_entries
  for update using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());

create policy "Tenant scoped read" on public.guardrail_profiles
  for select using (tenant_id = auth.uid());
create policy "Tenant scoped write" on public.guardrail_profiles
  for insert with check (tenant_id = auth.uid());
create policy "Tenant scoped update" on public.guardrail_profiles
  for update using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());

create policy "Tenant scoped read" on public.mission_guardrails
  for select using (
    exists (
      select 1 from public.objectives obj
      where obj.id = mission_guardrails.mission_id
        and obj.tenant_id = auth.uid()
    )
  );
create policy "Tenant scoped write" on public.mission_guardrails
  for insert with check (
    exists (
      select 1 from public.objectives obj
      where obj.id = mission_guardrails.mission_id
        and obj.tenant_id = auth.uid()
    )
  );
create policy "Tenant scoped update" on public.mission_guardrails
  for update using (
    exists (
      select 1 from public.objectives obj
      where obj.id = mission_guardrails.mission_id
        and obj.tenant_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.objectives obj
      where obj.id = mission_guardrails.mission_id
        and obj.tenant_id = auth.uid()
    )
  );

create policy "Tenant scoped read" on public.mission_metadata
  for select using (tenant_id = auth.uid());
create policy "Tenant scoped write" on public.mission_metadata
  for insert with check (tenant_id = auth.uid());
create policy "Tenant scoped update" on public.mission_metadata
  for update using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());

create policy "Tenant scoped read" on public.mission_safeguards
  for select using (tenant_id = auth.uid());
create policy "Tenant scoped insert" on public.mission_safeguards
  for insert with check (tenant_id = auth.uid());
create policy "Tenant scoped update" on public.mission_safeguards
  for update using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());

create policy "Tenant scoped read" on public.mission_events
  for select using (tenant_id = auth.uid());
create policy "Tenant scoped insert" on public.mission_events
  for insert with check (tenant_id = auth.uid());

create policy "Tenant scoped read" on public.safeguard_events
  for select using (tenant_id = auth.uid());
create policy "Tenant scoped insert" on public.safeguard_events
  for insert with check (tenant_id = auth.uid());

create policy "Tenant scoped read" on public.copilot_sessions
  for select using (tenant_id = auth.uid());
create policy "Tenant scoped write" on public.copilot_sessions
  for insert with check (tenant_id = auth.uid());
create policy "Tenant scoped update" on public.copilot_sessions
  for update using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());

create policy "Tenant scoped read" on public.copilot_messages
  for select using (tenant_id = auth.uid());
create policy "Tenant scoped write" on public.copilot_messages
  for insert with check (tenant_id = auth.uid());

-- Gate G-B policies
create policy copilot_messages_tenant_access on public.copilot_messages
  for all
  using (auth.uid() = tenant_id);

create policy planner_runs_tenant_access on public.planner_runs
  for all
  using (auth.uid() = tenant_id);

-- ------------------------------------------------------------------
-- Analytics views (Gate G-B)
-- ------------------------------------------------------------------

-- Planner performance metrics
create or replace view public.analytics_planner_performance as
select
  tenant_id,
  mode,
  count(*) as total_runs,
  round(avg(latency_ms)::numeric, 2) as avg_latency_ms,
  percentile_cont(0.95) within group (order by latency_ms) as p95_latency_ms,
  round(avg(candidate_count)::numeric, 2) as avg_candidates,
  round(avg(embedding_similarity_avg)::numeric, 3) as avg_similarity
from public.planner_runs
where created_at >= timezone('utc', now()) - '30 days'::interval
group by tenant_id, mode;

comment on view public.analytics_planner_performance is 'Planner performance metrics for Gate G-B validation';

-- Generative acceptance metrics
create or replace view public.analytics_generative_acceptance as
select
  tenant_id,
  field,
  count(*) as total_generated,
  sum(case when source = 'accepted' then 1 else 0 end) as accepted_count,
  sum(case when source = 'edited' then 1 else 0 end) as edited_count,
  round(avg(confidence)::numeric, 3) as avg_confidence,
  round(
    sum(case when source = 'accepted' then 1 else 0 end)::numeric /
    nullif(count(*), 0),
    3
  ) as acceptance_rate,
  avg(regeneration_count) as avg_regenerations
from public.mission_metadata
where created_at >= timezone('utc', now()) - '30 days'::interval
group by tenant_id, field;

comment on view public.analytics_generative_acceptance is 'Generative quality metrics for Gate G-B compliance';

-- Connection adoption metrics
create or replace view public.analytics_connection_adoption as
select
  tenant_id,
  hint_type,
  count(*) as total_hints,
  sum(case when status = 'accepted' then 1 else 0 end) as accepted_count,
  sum(case when status = 'edited' then 1 else 0 end) as edited_count,
  sum(case when status = 'rejected' then 1 else 0 end) as rejected_count,
  round(avg(confidence)::numeric, 3) as avg_confidence,
  round(
    (sum(case when status in ('accepted', 'edited') then 1 else 0 end)::numeric) /
    nullif(count(*), 0),
    3
  ) as adoption_rate
from public.mission_safeguards
where updated_at >= timezone('utc', now()) - '30 days'::interval
group by tenant_id, hint_type;

comment on view public.analytics_connection_adoption is 'Safeguard and connection plan adoption metrics for Gate G-B';

-- Undo success metrics
create or replace view public.analytics_undo_success as
select
  tenant_id,
  toolkit,
  count(*) as total_tool_calls,
  sum(case when undo_plan is not null and undo_plan != '' then 1 else 0 end) as undo_plan_present,
  round(
    sum(case when undo_plan is not null and undo_plan != '' then 1 else 0 end)::numeric /
    nullif(count(*), 0),
    3
  ) as undo_coverage_rate
from public.tool_calls
where executed_at >= timezone('utc', now()) - '30 days'::interval
group by tenant_id, toolkit;

comment on view public.analytics_undo_success is 'Undo plan coverage metrics for Gate G-B validation';

-- ------------------------------------------------------------------
-- Default privileges for service role tasks
-- ------------------------------------------------------------------

grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- Gate G-B view grants
grant select on public.analytics_planner_performance to authenticated;
grant select on public.analytics_generative_acceptance to authenticated;
grant select on public.analytics_connection_adoption to authenticated;
grant select on public.analytics_undo_success to authenticated;
