-- A public page where users apply to become referral partners.
-- Applications land in a table; the admin gets an email and decides.

create table if not exists public.referral_applications (
  id          bigserial primary key,
  user_id     integer     references public.users (id) on delete set null,
  full_name   text        not null,
  email       text        not null,
  phone       text,
  reason      text,
  status      text        not null default 'pending'
              check (status in ('pending', 'approved', 'rejected')),
  reviewed_by integer     references public.users (id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at  timestamptz not null default now()
);

alter table public.referral_applications enable row level security;

create policy "admins see all applications"
  on public.referral_applications for select
  using (public.is_app_admin());

create policy "users see own applications"
  on public.referral_applications for select
  using (user_id = public.app_user_id());

create policy "authenticated can insert"
  on public.referral_applications for insert
  with check (true);

grant select, insert on public.referral_applications to authenticated;
grant usage on sequence public.referral_applications_id_seq to authenticated;

-- Submit an application. One pending per user.
create or replace function public.referral_apply(
  p_full_name text,
  p_email     text,
  p_phone     text default null,
  p_reason    text default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid    integer;
  app_id bigint;
begin
  uid := public.app_user_id();
  if uid is null then raise exception 'not authenticated'; end if;

  if coalesce(trim(p_full_name), '') = '' then raise exception 'name required'; end if;
  if coalesce(trim(p_email), '') = '' then raise exception 'email required'; end if;

  -- Already a partner?
  if exists (
    select 1 from public.referral_campaigns c
    where c.partner_user_id = uid and c.active
  ) then
    raise exception 'already a partner';
  end if;

  -- Already has a pending application?
  if exists (
    select 1 from public.referral_applications a
    where a.user_id = uid and a.status = 'pending'
  ) then
    raise exception 'application already pending';
  end if;

  insert into public.referral_applications (user_id, full_name, email, phone, reason)
  values (uid, trim(p_full_name), trim(p_email), nullif(trim(coalesce(p_phone, '')), ''), nullif(trim(coalesce(p_reason, '')), ''))
  returning id into app_id;

  return app_id;
end;
$$;

grant execute on function public.referral_apply(text, text, text, text) to authenticated;

-- Admin reviews an application
create or replace function public.referral_review_application(
  p_application_id bigint,
  p_status         text,
  p_note           text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_app_admin() then raise exception 'FORBIDDEN'; end if;
  if p_status not in ('approved', 'rejected') then raise exception 'invalid status'; end if;

  update public.referral_applications
  set status      = p_status,
      reviewed_by = public.app_user_id(),
      reviewed_at = now(),
      review_note = nullif(trim(coalesce(p_note, '')), '')
  where id = p_application_id and status = 'pending';
end;
$$;

grant execute on function public.referral_review_application(bigint, text, text) to authenticated;
