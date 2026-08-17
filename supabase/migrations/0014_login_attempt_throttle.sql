-- Login throttling for the legacy-login Edge Function.
--
-- legacy-login is deliberately public (verify_jwt = false) because it is the
-- endpoint that establishes a session. Until now it had no attempt counter, so
-- passwords could be guessed at request speed. Supabase Auth's own rate limits
-- do not cover this path.
--
-- Rows are written by the function with the service role key only. No client
-- ever reads or writes this table, so RLS is enabled with no policy: that
-- denies every anon/authenticated request while leaving the service role
-- (which bypasses RLS) free to use it.

create table if not exists public.auth_login_attempts (
  id bigserial primary key,
  email text not null,
  attempted_at timestamptz not null default now(),
  succeeded boolean not null default false
);

create index if not exists auth_login_attempts_email_time_idx
  on public.auth_login_attempts (email, attempted_at desc);

alter table public.auth_login_attempts enable row level security;

revoke all on public.auth_login_attempts from anon, authenticated;

-- Housekeeping: the table only needs a short window to do its job.
create or replace function public.prune_login_attempts()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.auth_login_attempts
  where attempted_at < now() - interval '7 days';
$$;

revoke all on function public.prune_login_attempts() from anon, authenticated;
