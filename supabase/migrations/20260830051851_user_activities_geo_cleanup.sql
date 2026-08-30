-- user_activities keeps city/region (stamped per-row by enrich-ip-geo, kept
-- forever) and ip_address (PII, nulled after 90 days). The rest of the old
-- Python geo enrichment is dead:
--   duration  - always 0, never written
--   browser   - RN log-activity does not write it
--   country   - duplicate of country_code
--   lat       - lon was already dropped; no map (YAGNI)
--   timezone  - unused, never written
-- The ip_address index is needed for the referral fraud self-join and for
-- ip_geo_pending() regardless of this feature.
begin;

create index if not exists idx_user_activities_ip
  on public.user_activities (ip_address) where ip_address is not null;

alter table public.user_activities
  drop column if exists duration,
  drop column if exists browser,
  drop column if exists country,
  drop column if exists lat,
  drop column if exists timezone;

commit;
