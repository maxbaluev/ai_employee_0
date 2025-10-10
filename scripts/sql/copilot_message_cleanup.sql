-- Purge CopilotKit timeline messages older than 7 days
delete from public.copilot_messages
where created_at < now() - interval '7 days';

-- Optional: trim sessions with no messages inside the retention window
delete from public.copilot_sessions
where id in (
  select s.id
  from public.copilot_sessions s
  left join public.copilot_messages m on m.session_id = s.id
    and m.created_at >= now() - interval '7 days'
  where m.id is null
);
