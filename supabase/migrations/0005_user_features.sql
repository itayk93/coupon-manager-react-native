do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'feature_access_feature_name_key'
  ) and not exists (
    select 1 from pg_class where relname = 'feature_access_feature_name_key'
  ) then
    alter table public.feature_access
      add constraint feature_access_feature_name_key unique (feature_name);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_tour_progress_user_id_key'
  ) and not exists (
    select 1 from pg_class where relname = 'user_tour_progress_user_id_key'
  ) then
    alter table public.user_tour_progress
      add constraint user_tour_progress_user_id_key unique (user_id);
  end if;
end
$$;

create table if not exists public.user_feature_overrides (
  id bigserial primary key,
  user_id integer not null references public.users(id) on delete cascade,
  feature_key text not null,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, feature_key)
);

create index if not exists user_feature_overrides_user_id_idx
  on public.user_feature_overrides (user_id);

create index if not exists user_feature_overrides_feature_key_idx
  on public.user_feature_overrides (feature_key);
