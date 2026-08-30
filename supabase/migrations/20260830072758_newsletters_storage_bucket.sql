-- Public bucket for the hosted newsletter design bundles. The page and its
-- assets load without auth (a newsletter is meant to be shared). Writes go only
-- through the newsletter-upload edge function (service role).
insert into storage.buckets (id, name, public)
values ('newsletters', 'newsletters', true)
on conflict (id) do nothing;

create policy "newsletters bundle public read"
  on storage.objects for select
  using (bucket_id = 'newsletters');

create policy "newsletters bundle service write"
  on storage.objects for all to service_role
  using (bucket_id = 'newsletters')
  with check (bucket_id = 'newsletters');
