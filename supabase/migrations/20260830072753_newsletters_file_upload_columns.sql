-- Newsletters move from pasted HTML to an uploaded design bundle.
--   bundle_path    - Storage key of the hosted entry HTML
--   web_url        - public URL of the hosted full-design page
--   email_subject  - subject line (auto-extracted from <title>/<h1>, editable)
--   hero_image_url - absolute URL of the first image (hero of the teaser email)
--   preview_text   - short teaser paragraph (auto-extracted from first <p>, editable)
-- content / custom_html / main_title / image_path are replaced by the bundle
-- plus the teaser template (newsletterTeaserEmailHtml).
begin;

alter table public.newsletters
  add column bundle_path    text,
  add column web_url        text,
  add column email_subject  text,
  add column hero_image_url text,
  add column preview_text    text;

alter table public.newsletters
  drop column if exists content,
  drop column if exists custom_html,
  drop column if exists main_title,
  drop column if exists image_path;

delete from public.newsletters where id = 24;  -- "מה חדש בקופון מאסטר" session test row

commit;
