-- AI Employee Control Plane — Gate G-A baseline schema
-- Generated October 8, 2025

-- ------------------------------------------------------------------
-- Extensions
-- ------------------------------------------------------------------
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;
create extension if not exists vector;

-- ------------------------------------------------------------------
-- Helper defaults
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
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

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
  guardrail_snapshot jsonb,
  latency_ms integer,
  quiet_hour_override boolean not null default false,
  executed_at timestamptz not null default timezone('utc', now())
);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references auth.users(id),
  tool_call_id uuid not null references public.tool_calls(id) on delete cascade,
  reviewer_id uuid references auth.users(id),
  decision text not null,
  decision_at timestamptz not null default timezone('utc', now()),
  justification text,
  guardrail_violation jsonb,
  metadata jsonb not null default '{}'::jsonb
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
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

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
  created_at timestamptz not null default timezone('utc', now())
);

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

-- ------------------------------------------------------------------
-- Default privileges for service role tasks
-- ------------------------------------------------------------------

grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
