-- Referral chains.
--
-- A partner (the pilot is one person) gets a code. Anyone who registers
-- through it is attributed to that partner's campaign, and so is anyone who
-- later registers through *their* code — the chain keeps rolling up to the
-- same campaign, however deep it goes.
--
-- Two rules shape every table below.
--
-- 1. Attribution is written once and never again. A row that can be re-pointed
--    later is a row that can move a paying user from one partner to another
--    after the fact, so the columns that decide who gets paid are frozen by a
--    trigger and the client cannot write to these tables at all.
-- 2. Nothing here counts as proof of activity on its own. Qualification reads
--    `user_activities`, which only the log-activity function can write, and
--    `coupon`, which the user owns. This table records the verdict, not the
--    evidence.

-- ---------------------------------------------------------------- campaigns

create table if not exists public.referral_campaigns (
  id              bigserial primary key,
  name            text        not null,
  partner_name    text        not null,
  partner_user_id integer     references public.users (id) on delete set null,
  code            text        not null,
  active          boolean     not null default true,
  starts_at       timestamptz not null default now(),
  ends_at         timestamptz,
  notes           text,
  created_at      timestamptz not null default now()
);

-- Codes are typed by hand off a WhatsApp message, so they match case-insensitively.
create unique index if not exists referral_campaigns_code_key
  on public.referral_campaigns (lower(code));

-- ------------------------------------------------------------------- codes

-- One personal code per user. Separate from `users` so a code can be issued
-- and revoked without touching the row every screen in the app reads.
create table if not exists public.referral_codes (
  id          bigserial primary key,
  user_id     integer     not null unique references public.users (id) on delete cascade,
  code        text        not null,
  campaign_id bigint      references public.referral_campaigns (id) on delete set null,
  created_at  timestamptz not null default now(),
  revoked_at  timestamptz
);

create unique index if not exists referral_codes_code_key
  on public.referral_codes (lower(code));

-- --------------------------------------------------------------- referrals

create table if not exists public.referrals (
  id                      bigserial primary key,

  -- Unique is the attribution lock: a person belongs to one chain, forever,
  -- and the second claim fails on the constraint rather than on a check some
  -- future caller might forget to run.
  referred_user_id        integer     not null unique references public.users (id) on delete cascade,
  direct_referrer_user_id integer     references public.users (id) on delete set null,
  campaign_id             bigint      not null references public.referral_campaigns (id) on delete cascade,

  -- Depth is stored, not derived. Recursion over a chain is the kind of query
  -- that is fine at 30 rows and a problem at 30,000; "everyone in Elior's
  -- chain" stays `where campaign_id = ?` at any depth.
  depth                   integer     not null default 1 check (depth between 1 and 20),
  referral_code           text        not null,

  -- sha256(install id + pepper). The raw id never reaches the database: it is
  -- a fraud signal, not something worth being able to read back.
  install_hash            text,

  registered_at           timestamptz not null,
  first_coupon_at         timestamptz,
  activated_at            timestamptz,
  retained_at             timestamptz,

  -- Recomputed by refresh_referral_progress so the admin table is one join
  -- rather than three correlated subqueries per row.
  coupon_count            integer     not null default 0,
  active_days_first_30    integer     not null default 0,
  active_days_31_60       integer     not null default 0,
  progress_checked_at     timestamptz,

  status                  text        not null default 'registered'
                          check (status in ('registered', 'activated', 'retained')),
  fraud_status            text        not null default 'normal'
                          check (fraud_status in ('normal', 'review', 'rejected')),
  fraud_reasons           text[]      not null default '{}',
  reviewed_by             integer     references public.users (id) on delete set null,
  reviewed_at             timestamptz,
  review_note             text,

  created_at              timestamptz not null default now(),

  -- A chain that loops pays its own author.
  constraint referrals_no_self check (referred_user_id is distinct from direct_referrer_user_id)
);

create index if not exists referrals_campaign_status_idx on public.referrals (campaign_id, status);
create index if not exists referrals_direct_referrer_idx on public.referrals (direct_referrer_user_id);
create index if not exists referrals_install_hash_idx on public.referrals (install_hash) where install_hash is not null;
create index if not exists referrals_open_idx on public.referrals (campaign_id) where retained_at is null;

-- ----------------------------------------------------------------- rewards

create table if not exists public.referral_rewards (
  id           bigserial primary key,
  campaign_id  bigint      not null references public.referral_campaigns (id) on delete cascade,
  label        text        not null,
  metric       text        not null check (metric in ('activated', 'retained')),
  threshold    integer     not null check (threshold > 0),
  reward_type  text        not null check (reward_type in ('dream_card', 'cash')),
  reward_value numeric(10, 2) not null,
  earned_at    timestamptz,
  paid_at      timestamptz,
  paid_by      integer     references public.users (id) on delete set null,
  paid_note    text,
  created_at   timestamptz not null default now(),
  unique (campaign_id, metric, threshold)
);

-- --------------------------------------------------- attribution is frozen

create or replace function public.guard_referral_attribution()
returns trigger
language plpgsql
as $$
begin
  -- Everything an admin legitimately changes (fraud verdict, review note) and
  -- everything the progress job legitimately changes (dates, counters) is
  -- absent from this list on purpose. What is here decides who gets paid.
  if new.referred_user_id        is distinct from old.referred_user_id
     or new.direct_referrer_user_id is distinct from old.direct_referrer_user_id
     or new.campaign_id          is distinct from old.campaign_id
     or new.depth                is distinct from old.depth
     or new.referral_code        is distinct from old.referral_code
     or new.registered_at        is distinct from old.registered_at then
    raise exception 'referral attribution is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists referrals_attribution_immutable on public.referrals;
create trigger referrals_attribution_immutable
  before update on public.referrals
  for each row execute function public.guard_referral_attribution();
