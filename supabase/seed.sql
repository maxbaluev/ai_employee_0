-- AI Employee Control Plane — Local development seed data
-- Safe to re-run: all inserts use ON CONFLICT to avoid duplication.

-- ------------------------------------------------------------------
-- Tenant & user scaffolding
-- ------------------------------------------------------------------

insert into auth.users (id, email, encrypted_password, email_confirmed_at)
values (
  '00000000-0000-0000-0000-000000000000',
  'dev-tenant@example.com',
  crypt('dev-password', gen_salt('bf')),
  timezone('utc', now())
)
on conflict (id)
  do update set email_confirmed_at = excluded.email_confirmed_at;

insert into auth.identities (
  id,
  provider,
  provider_id,
  user_id,
  identity_data
)
values (
  '77777777-7777-7777-7777-777777777777',
  'email',
  'dev-tenant@example.com',
  '00000000-0000-0000-0000-000000000000',
  jsonb_build_object('sub', 'dev-tenant@example.com', 'email', 'dev-tenant@example.com')
)
on conflict (id)
  do update set identity_data = excluded.identity_data;

-- ------------------------------------------------------------------
-- Gate G-B: Guardrail profiles removed (embedded in objectives.guardrails)
-- ------------------------------------------------------------------

-- ------------------------------------------------------------------
-- Sample mission & metadata chips
-- ------------------------------------------------------------------

insert into public.objectives (
  id,
  tenant_id,
  created_by,
  goal,
  audience,
  timeframe,
  guardrails,
  status,
  metadata
)
values (
  '22222222-2222-2222-2222-222222222222',
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000',
  'Revive dormant SMB customers with follow-up campaign',
  'Dormant SMB accounts in North America',
  'Q4 2025',
  jsonb_build_object(
    'tone', 'warm-professional',
    'quiet_hours', '20:00-07:00 tenant local'
  ),
  'draft',
  jsonb_build_object('source', 'seed')
)
on conflict (id)
  do update set goal = excluded.goal;

insert into public.mission_metadata (
  mission_id,
  tenant_id,
  field,
  value,
  confidence,
  source,
  regeneration_count,
  accepted_at
)
values
  (
    '22222222-2222-2222-2222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'objective',
    jsonb_build_object('summary', 'Re-engage 100 dormant accounts with tailored offers'),
    0.87,
    'generated',
    0,
    timezone('utc', now())
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'audience',
    jsonb_build_object('segments', jsonb_build_array('SMB', 'inactive >90 days')),
    0.82,
    'generated',
    1,
    timezone('utc', now())
  )
on conflict (mission_id, field)
  do update set
    value = excluded.value,
    confidence = excluded.confidence,
    regeneration_count = excluded.regeneration_count,
    accepted_at = excluded.accepted_at;

insert into public.mission_safeguards (
  id,
  mission_id,
  tenant_id,
  hint_type,
  suggested_value,
  confidence,
  status,
  source,
  generation_count,
  accepted_at
)
values
  (
    '33333333-3333-3333-3333-333333333333',
    '22222222-2222-2222-2222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'tone',
    jsonb_build_object('guidance', 'Keep tone warm-professional; avoid urgency'),
    0.8,
    'accepted',
    'seed',
    0,
    timezone('utc', now())
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    '22222222-2222-2222-2222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'quiet_window',
    jsonb_build_object('start', '20:00', 'end', '07:00', 'timezone', 'America/Los_Angeles'),
    0.76,
    'suggested',
    'seed',
    0,
    null
  )
on conflict (id)
  do update set
    suggested_value = excluded.suggested_value,
    status = excluded.status,
    accepted_at = excluded.accepted_at;

-- ------------------------------------------------------------------
-- CopilotKit session placeholder (for persistence sanity checks)
-- ------------------------------------------------------------------

insert into public.copilot_sessions (
  id,
  tenant_id,
  agent_id,
  session_identifier,
  state,
  expires_at
)
values (
  '55555555-5555-5555-5555-555555555555',
  '00000000-0000-0000-0000-000000000000',
  'control_plane_foundation',
  'seed-session',
  jsonb_build_object('chips', jsonb_build_array('objective', 'audience')),
  timezone('utc', now()) + interval '7 days'
)
on conflict (tenant_id, agent_id, session_identifier)
  do update set
    state = excluded.state,
    expires_at = excluded.expires_at;

