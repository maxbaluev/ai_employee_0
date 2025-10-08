# Gate G-A — Supabase Migration Log

This log captures the command output used to apply the Gate G-A baseline schema.
Update the command transcript after running the migration locally or in CI.

```
$ supabase db push --file supabase/migrations/0001_init.sql
# TODO: paste supabase CLI output here (migration hash, statements applied)
```

> Verification checklist
>
> - [ ] `pgvector` extension enabled
> - [ ] All tables created successfully (`
>   select table_name from information_schema.tables
>   where table_schema = 'public' and table_name in (
>     'objectives','plays','tool_calls','approvals','artifacts',
>     'library_entries','guardrail_profiles','mission_guardrails',
>     'copilot_sessions','copilot_messages');`)
> - [ ] RLS policies confirmed via `
>   select tablename, policyname from pg_policies
>   where schemaname = 'public';`

