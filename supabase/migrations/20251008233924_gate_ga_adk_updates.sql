-- Gate G-A Gemini ADK orchestration upgrades

-- ------------------------------------------------------------------
-- plays: confidence column
-- ------------------------------------------------------------------
alter table public.plays
  add column if not exists confidence numeric check (confidence >= 0 and confidence <= 1);

-- ------------------------------------------------------------------
-- artifacts: hash column for deduplication
-- ------------------------------------------------------------------
alter table public.artifacts
  add column if not exists hash text;

-- ------------------------------------------------------------------
-- mission_events: rename event_data -> event_payload
-- ------------------------------------------------------------------
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'mission_events'
      and column_name = 'event_data'
  ) then
    alter table public.mission_events
      rename column event_data to event_payload;
  end if;
end
$$;

alter table public.mission_events
  alter column event_payload set default '{}'::jsonb;

-- ------------------------------------------------------------------
-- safeguard_events audit log
-- ------------------------------------------------------------------
create table if not exists public.safeguard_events (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid references public.objectives(id) on delete cascade,
  tenant_id uuid not null references auth.users(id),
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.safeguard_events enable row level security;

create index if not exists safeguard_events_mission_id_idx on public.safeguard_events(mission_id);
create index if not exists safeguard_events_tenant_idx on public.safeguard_events(tenant_id);
create index if not exists safeguard_events_type_idx on public.safeguard_events(event_type);
create index if not exists safeguard_events_created_at_idx on public.safeguard_events(created_at desc);

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'safeguard_events'
      and policyname = 'Tenant scoped read'
  ) then
    execute 'create policy "Tenant scoped read" on public.safeguard_events
      for select using (tenant_id = auth.uid())';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'safeguard_events'
      and policyname = 'Tenant scoped insert'
  ) then
    execute 'create policy "Tenant scoped insert" on public.safeguard_events
      for insert with check (tenant_id = auth.uid())';
  end if;
end
$$;
