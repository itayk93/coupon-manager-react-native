-- Recreate the legacy-login throttle, and schedule the pruning it was given.
--
-- 0014_login_attempt_throttle is recorded in schema_migrations, but in
-- production neither public.auth_login_attempts nor public.prune_login_attempts
-- exists, and no migration drops them. The effect was silent: both helpers in
-- the legacy-login function are written to fail open, so every login sent two
-- requests that 404'd, logged "relation does not exist" in Postgres, and left
-- the endpoint that establishes a session with no attempt counter at all.
--
-- Everything below is the content of 0014, re-run idempotently, plus the one
-- piece 0014 was missing: prune_login_attempts() was created and never called
-- by anything, so the table it prunes would have grown without bound. It is
-- scheduled here next to the other purges (03:00, the free slot).

create table if not exists public.auth_login_attempts (
  id bigserial primary key,
  email text not null,
  attempted_at timestamptz not null default now(),
  succeeded boolean not null default false
);

create index if not exists auth_login_attempts_email_time_idx
  on public.auth_login_attempts (email, attempted_at desc);

-- Rows are written by the Edge Function with the service role key only. No
-- client ever reads or writes this table, so RLS is enabled with no policy:
-- that denies every anon/authenticated request while leaving the service role
-- (which bypasses RLS) free to use it.
alter table public.auth_login_attempts enable row level security;

revoke all on public.auth_login_attempts from anon, authenticated;

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

do $$
begin
  if exists (select 1 from cron.job where jobname = 'login-attempts-purge') then
    perform cron.unschedule('login-attempts-purge');
  end if;
end
$$;

select cron.schedule('login-attempts-purge', '0 3 * * *', $$select public.prune_login_attempts();$$);
