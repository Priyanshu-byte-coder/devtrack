-- Refactor local coding sessions sync to use a database transaction function
-- This prevents partial failures and cardinality violation errors on duplicate date entries

create or replace function batch_upsert_sessions(sessions jsonb)
returns void as $$
declare
  session_record jsonb;
begin
  for session_record in select * from jsonb_array_elements(sessions) loop
    insert into local_coding_sessions (user_id, date, total_seconds, file_count, project_count)
    values (
      (session_record->>'user_id'),
      (session_record->>'date')::date,
      (session_record->>'total_seconds')::integer,
      coalesce((session_record->>'file_count')::integer, 0),
      coalesce((session_record->>'project_count')::integer, 0)
    )
    on conflict (user_id, date) do update set
      total_seconds = excluded.total_seconds,
      file_count = excluded.file_count,
      project_count = excluded.project_count,
      updated_at = now();
  end loop;
end;
$$ language plpgsql security definer;
