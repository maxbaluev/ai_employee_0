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
    jsonb_build_object(
      'text', 'Re-engage 100 dormant accounts with tailored offers',
      'summary', 'Re-engage 100 dormant accounts with tailored offers'
    ),
    0.87,
    'generated',
    0,
    timezone('utc', now())
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'audience',
    jsonb_build_object(
      'text', 'Dormant SMB accounts in North America with inactive status > 90 days',
      'segments', jsonb_build_array('SMB', 'inactive >90 days')
    ),
    0.82,
    'generated',
    1,
    timezone('utc', now())
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'kpis',
    jsonb_build_object(
      'items', jsonb_build_array(
        jsonb_build_object('label', 'Reactivated accounts', 'target', '100'),
        jsonb_build_object('label', 'Open rate improvement', 'target', '15%')
      )
    ),
    0.79,
    'generated',
    2,
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

-- ------------------------------------------------------------------
-- Planner dry-run + toolkit persistence samples
-- ------------------------------------------------------------------

insert into public.plays (
  id,
  tenant_id,
  objective_id,
  mode,
  plan_json,
  impact_estimate,
  risk_profile,
  undo_plan,
  confidence,
  telemetry,
  latency_ms,
  success_score,
  tool_count,
  evidence_hash
)
values (
  '88888888-8888-8888-8888-888888888888',
  '00000000-0000-0000-0000-000000000000',
  '22222222-2222-2222-2222-222222222222',
  'dry_run',
  jsonb_build_object(
    'steps', jsonb_build_array(
      jsonb_build_object('title', 'Analyse dormant cohorts', 'type', 'analysis'),
      jsonb_build_object('title', 'Trigger CRM nurture', 'type', 'execution')
    )
  ),
  'Expected to lift reactivation by 12%',
  'Low',
  'Use CRM revert automation to undo nurture campaign',
  0.78,
  jsonb_build_object('source', 'seed', 'reason', 'Initial dry-run seeding'),
  1185,
  0.92,
  2,
  'seed-evidence-hash-001'
)
on conflict (id)
  do update set
    plan_json = excluded.plan_json,
    impact_estimate = excluded.impact_estimate,
    risk_profile = excluded.risk_profile,
    undo_plan = excluded.undo_plan,
    confidence = excluded.confidence,
    telemetry = excluded.telemetry,
    latency_ms = excluded.latency_ms,
    success_score = excluded.success_score,
    tool_count = excluded.tool_count,
    evidence_hash = excluded.evidence_hash,
    updated_at = timezone('utc', now());

insert into public.planner_runs (
  id,
  tenant_id,
  mission_id,
  latency_ms,
  candidate_count,
  embedding_similarity_avg,
  primary_toolkits,
  mode,
  reason_markdown,
  impact_score,
  pinned_at,
  metadata
)
values (
  'aaaa1111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  '22222222-2222-2222-2222-222222222222',
  980,
  3,
  0.81,
  array['crm-pro', 'slack'],
  'dry_run',
  '## Why this plan works\n- dormant accounts receive refreshed offer\n- CRM audit confirms safeguards',
  0.64,
  timezone('utc', now()),
  jsonb_build_object('objective', 'Re-engage dormant SMB accounts', 'source', 'seed')
)
on conflict (id)
  do update set
    latency_ms = excluded.latency_ms,
    candidate_count = excluded.candidate_count,
    embedding_similarity_avg = excluded.embedding_similarity_avg,
    primary_toolkits = excluded.primary_toolkits,
    reason_markdown = excluded.reason_markdown,
    impact_score = excluded.impact_score,
    pinned_at = excluded.pinned_at,
    metadata = excluded.metadata,
    updated_at = timezone('utc', now());

insert into public.tool_calls (
  id,
  tenant_id,
  play_id,
  toolkit,
  tool_name,
  arguments,
  arguments_hash,
  result_ref,
  outcome,
  undo_plan,
  undo_plan_json,
  guardrail_snapshot,
  validator_summary,
  latency_ms,
  quiet_hour_override,
  executed_at
)
values (
  'bbbb2222-2222-2222-2222-222222222222',
  '00000000-0000-0000-0000-000000000000',
  '88888888-8888-8888-8888-888888888888',
  'crm-pro',
  'sync_campaign',
  jsonb_build_object('mission_id', '22222222-2222-2222-2222-222222222222'),
  'hash-seed-001',
  'seed://artifact/email-draft',
  jsonb_build_object('status', 'success'),
  'Use undo token to revert CRM campaign status',
  jsonb_build_object('steps', jsonb_build_array('Disable workflow', 'Restore account flags')),
  jsonb_build_object('tone', 'warm-professional'),
  jsonb_build_object('approved', true, 'risk_score', 0.12),
  845,
  false,
  timezone('utc', now())
)
on conflict (id)
  do update set
    outcome = excluded.outcome,
    undo_plan = excluded.undo_plan,
    undo_plan_json = excluded.undo_plan_json,
    guardrail_snapshot = excluded.guardrail_snapshot,
    validator_summary = excluded.validator_summary,
    latency_ms = excluded.latency_ms,
    quiet_hour_override = excluded.quiet_hour_override,
    executed_at = excluded.executed_at;

insert into public.toolkit_selections (
  id,
  tenant_id,
  mission_id,
  toolkit_id,
  auth_mode,
  connection_status,
  undo_token,
  metadata,
  rationale,
  created_by
)
values (
  'cccc3333-3333-3333-3333-333333333333',
  '00000000-0000-0000-0000-000000000000',
  '22222222-2222-2222-2222-222222222222',
  'crm-pro',
  'oauth',
  'linked',
  'undo-toolkit-seed',
  jsonb_build_object(
    'name', 'CRM Pro Toolkit',
    'category', 'crm',
    'logo', null,
    'noAuth', false,
    'authType', 'oauth'
  ),
  'Primary CRM integration required for nurture campaign',
  '00000000-0000-0000-0000-000000000000'
)
on conflict (id)
  do update set
    auth_mode = excluded.auth_mode,
    connection_status = excluded.connection_status,
    undo_token = excluded.undo_token,
    metadata = excluded.metadata,
    rationale = excluded.rationale,
    updated_at = timezone('utc', now());

insert into public.toolkit_connections (
  tenant_id,
  mission_id,
  toolkit,
  connection_id,
  status,
  auth_mode,
  metadata
)
values (
  '00000000-0000-0000-0000-000000000000',
  '22222222-2222-2222-2222-222222222222',
  'crm-pro',
  'conn-crm-pro-seed',
  'linked',
  'oauth',
  jsonb_build_object('scopes', jsonb_build_array('crm.contacts.write', 'crm.deals.write'))
)
on conflict (tenant_id, mission_id, toolkit)
  do update set
    connection_id = excluded.connection_id,
    status = excluded.status,
    auth_mode = excluded.auth_mode,
    metadata = excluded.metadata,
    updated_at = timezone('utc', now());

-- ------------------------------------------------------------------
-- Inspection & verification seeds
-- ------------------------------------------------------------------

insert into public.inspection_requests (
  id,
  tenant_id,
  mission_id,
  request_payload,
  response_payload,
  status,
  latency_ms,
  created_at,
  completed_at
)
values (
  'eeee5555-5555-5555-5555-555555555555',
  '00000000-0000-0000-0000-000000000000',
  '22222222-2222-2222-2222-222222222222',
  jsonb_build_object('selected_toolkits', jsonb_build_array('crm-pro', 'slack')),
  jsonb_build_object('coverage', 92, 'issues', jsonb_build_array()),
  'completed',
  640,
  timezone('utc', now()) - interval '5 minutes',
  timezone('utc', now()) - interval '4 minutes'
)
on conflict (id)
  do update set
    response_payload = excluded.response_payload,
    status = excluded.status,
    latency_ms = excluded.latency_ms,
    completed_at = excluded.completed_at;

insert into public.inspection_findings (
  id,
  tenant_id,
  mission_id,
  finding_type,
  payload,
  readiness
)
values (
  'ffff6666-6666-6666-6666-666666666666',
  '00000000-0000-0000-0000-000000000000',
  '22222222-2222-2222-2222-222222222222',
  'coverage_preview',
  jsonb_build_object(
    'summary', 'Toolkit coverage verified for dry-run execution',
    'gate', jsonb_build_object('threshold', 85, 'canProceed', true),
    'categories', jsonb_build_array(
      jsonb_build_object('id', 'objectives', 'coverage', 96, 'threshold', 85, 'status', 'pass'),
      jsonb_build_object('id', 'safeguards', 'coverage', 88, 'threshold', 80, 'status', 'pass'),
      jsonb_build_object('id', 'plays', 'coverage', 92, 'threshold', 80, 'status', 'pass'),
      jsonb_build_object('id', 'datasets', 'coverage', 78, 'threshold', 70, 'status', 'warn')
    )
  ),
  90
)
on conflict (id)
  do update set
    payload = excluded.payload,
    readiness = excluded.readiness;

insert into public.undo_events (
  id,
  tenant_id,
  mission_id,
  tool_call_id,
  undo_token,
  status,
  reason,
  metadata
)
values (
  'aaaa2222-7777-7777-7777-777777777777',
  '00000000-0000-0000-0000-000000000000',
  '22222222-2222-2222-2222-222222222222',
  'bbbb2222-2222-2222-2222-222222222222',
  'undo-token-seed',
  'pending',
  'Seed undo event for evidence workflow',
  jsonb_build_object('requested_by', 'seed')
)
on conflict (id)
  do update set
    status = excluded.status,
    reason = excluded.reason,
    metadata = excluded.metadata;

insert into public.simulated_results (
  id,
  tenant_id,
  mission_id,
  tool_call_id,
  simulated_output,
  execution_mode,
  evidence_hash
)
values (
  'bbbb3333-8888-8888-8888-888888888888',
  '00000000-0000-0000-0000-000000000000',
  '22222222-2222-2222-2222-222222222222',
  'bbbb2222-2222-2222-2222-222222222222',
  jsonb_build_object('preview', 'Generated outbound sequence preview'),
  'simulation',
  'seed-simulated-hash-001'
)
on conflict (id)
  do update set
    simulated_output = excluded.simulated_output,
    evidence_hash = excluded.evidence_hash;
