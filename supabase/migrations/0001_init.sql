-- Gate G-A foundation schema for the AI Employee control plane.
-- Generated on 2025-10-07.

-- Extensions -----------------------------------------------------------------
create extension if not exists "pgcrypto" with schema public;
create extension if not exists "vector" with schema public;

-- Utility function to keep updated_at current ---------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- Tenant scaffolding ----------------------------------------------------------
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger tenants_updated_at
before update on public.tenants
for each row execute function public.set_updated_at();

create table if not exists public.tenant_members (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default timezone('utc', now()),
  primary key (tenant_id, user_id)
);

-- Mission objectives ----------------------------------------------------------
create table if not exists public.objectives (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  owner_id uuid references auth.users(id),
  goal text not null,
  audience text,
  timeframe text,
  guardrails text,
  status text not null default 'draft',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger objectives_updated_at
before update on public.objectives
for each row execute function public.set_updated_at();

-- Plays proposed/executed for an objective -----------------------------------
create table if not exists public.plays (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  objective_id uuid not null references public.objectives(id) on delete cascade,
  mode text not null default 'dry_run',
  plan_json jsonb not null default '[]'::jsonb,
  impact_estimate jsonb,
  risk_profile jsonb,
  undo_plan jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger plays_updated_at
before update on public.plays
for each row execute function public.set_updated_at();

-- Tool calls + telemetry ------------------------------------------------------
create table if not exists public.tool_calls (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  play_id uuid not null references public.plays(id) on delete cascade,
  provider text,
  toolkit text,
  tool_name text,
  args_json jsonb not null default '{}'::jsonb,
  result_ref text,
  latency_ms integer,
  cost_cents integer,
  quiet_hour_override boolean not null default false,
  status text not null default 'pending',
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_tool_calls_play_id on public.tool_calls(play_id);

-- Approvals -------------------------------------------------------------------
create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  tool_call_id uuid not null references public.tool_calls(id) on delete cascade,
  approver_id uuid references auth.users(id),
  decision text not null,
  rationale text,
  undo_available boolean not null default false,
  undo_status text not null default 'pending',
  validator_checkpoint text,
  decision_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_approvals_tool_call on public.approvals(tool_call_id);

-- Artifacts produced during plays --------------------------------------------
create table if not exists public.artifacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  play_id uuid not null references public.plays(id) on delete cascade,
  type text not null,
  title text not null,
  content_ref text,
  reviewer_edits jsonb,
  stored_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_artifacts_play on public.artifacts(play_id);

-- OAuth tokens ----------------------------------------------------------------
create table if not exists public.oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null,
  scopes text[] not null default '{}',
  encrypted_token text not null,
  refreshed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

-- Library entries / pgvector embeddings ---------------------------------------
create table if not exists public.library_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  objective_id uuid references public.objectives(id) on delete set null,
  embedding vector(1536) not null,
  metadata_json jsonb not null default '{}'::jsonb,
  success_score numeric,
  reuse_count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_library_entries_tenant on public.library_entries(tenant_id);

-- Guardrail policies + status beacons ----------------------------------------
create table if not exists public.guardrail_policies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  version text not null,
  policy_json jsonb not null,
  effective_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.status_beacons (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  bundle_id text not null,
  gate_target text not null,
  payload jsonb not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.gate_validation_failures (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  gate_id text not null,
  artifact_path text not null,
  reason text not null,
  created_at timestamptz not null default timezone('utc', now())
);

-- Helper function for RLS -----------------------------------------------------
create or replace function public.tenant_membership_ok(target_tenant uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = target_tenant
      and tm.user_id = auth.uid()
  );
$$;

grant execute on function public.tenant_membership_ok(uuid) to authenticated, service_role;

-- RLS configuration -----------------------------------------------------------
alter table public.tenants enable row level security;
alter table public.tenant_members enable row level security;
alter table public.objectives enable row level security;
alter table public.plays enable row level security;
alter table public.tool_calls enable row level security;
alter table public.approvals enable row level security;
alter table public.artifacts enable row level security;
alter table public.oauth_tokens enable row level security;
alter table public.library_entries enable row level security;
alter table public.guardrail_policies enable row level security;
alter table public.status_beacons enable row level security;
alter table public.gate_validation_failures enable row level security;

-- Tenants & membership policies: management handled by service role only.
create policy tenants_select on public.tenants
for select using (public.tenant_membership_ok(id));

create policy tenant_members_select on public.tenant_members
for select using (auth.uid() = user_id);

-- Objectives policies ---------------------------------------------------------
create policy objectives_select on public.objectives
for select using (public.tenant_membership_ok(tenant_id));

create policy objectives_insert on public.objectives
for insert with check (public.tenant_membership_ok(tenant_id));

create policy objectives_update on public.objectives
for update using (public.tenant_membership_ok(tenant_id));

create policy objectives_delete on public.objectives
for delete using (public.tenant_membership_ok(tenant_id));

-- Plays -----------------------------------------------------------------------
create policy plays_select on public.plays
for select using (public.tenant_membership_ok(tenant_id));

create policy plays_insert on public.plays
for insert with check (public.tenant_membership_ok(tenant_id));

create policy plays_update on public.plays
for update using (public.tenant_membership_ok(tenant_id));

create policy plays_delete on public.plays
for delete using (public.tenant_membership_ok(tenant_id));

-- Tool calls ------------------------------------------------------------------
create policy tool_calls_select on public.tool_calls
for select using (public.tenant_membership_ok(tenant_id));

create policy tool_calls_insert on public.tool_calls
for insert with check (public.tenant_membership_ok(tenant_id));

create policy tool_calls_update on public.tool_calls
for update using (public.tenant_membership_ok(tenant_id));

-- Approvals -------------------------------------------------------------------
create policy approvals_select on public.approvals
for select using (public.tenant_membership_ok(tenant_id));

create policy approvals_insert on public.approvals
for insert with check (public.tenant_membership_ok(tenant_id));

create policy approvals_update on public.approvals
for update using (public.tenant_membership_ok(tenant_id));

-- Artifacts -------------------------------------------------------------------
create policy artifacts_select on public.artifacts
for select using (public.tenant_membership_ok(tenant_id));

create policy artifacts_insert on public.artifacts
for insert with check (public.tenant_membership_ok(tenant_id));

create policy artifacts_update on public.artifacts
for update using (public.tenant_membership_ok(tenant_id));

-- OAuth tokens ----------------------------------------------------------------
create policy oauth_tokens_select on public.oauth_tokens
for select using (public.tenant_membership_ok(tenant_id));

create policy oauth_tokens_insert on public.oauth_tokens
for insert with check (public.tenant_membership_ok(tenant_id));

create policy oauth_tokens_update on public.oauth_tokens
for update using (public.tenant_membership_ok(tenant_id));

-- Library entries -------------------------------------------------------------
create policy library_entries_select on public.library_entries
for select using (public.tenant_membership_ok(tenant_id));

create policy library_entries_insert on public.library_entries
for insert with check (public.tenant_membership_ok(tenant_id));

create policy library_entries_update on public.library_entries
for update using (public.tenant_membership_ok(tenant_id));

-- Guardrail policies ----------------------------------------------------------
create policy guardrail_policies_select on public.guardrail_policies
for select using (public.tenant_membership_ok(tenant_id));

create policy guardrail_policies_insert on public.guardrail_policies
for insert with check (public.tenant_membership_ok(tenant_id));

-- Status beacons --------------------------------------------------------------
create policy status_beacons_select on public.status_beacons
for select using (public.tenant_membership_ok(tenant_id));

create policy status_beacons_insert on public.status_beacons
for insert with check (public.tenant_membership_ok(tenant_id));

-- Gate validation failures ----------------------------------------------------
create policy gate_validation_failures_select on public.gate_validation_failures
for select using (public.tenant_membership_ok(tenant_id));

create policy gate_validation_failures_insert on public.gate_validation_failures
for insert with check (public.tenant_membership_ok(tenant_id));

