-- Seed ip_geo from activity rows the retired Python backend already geo-tagged.
-- Those rows keep their own city/region; this just primes the cache for free.
insert into public.ip_geo (ip_address, city, region, country_code, source, resolved_at)
select distinct on (ip_address)
       ip_address, city, region, country_code, 'legacy', now()
from public.user_activities
where ip_address is not null and city is not null
order by ip_address, "timestamp" desc
on conflict (ip_address) do nothing;
