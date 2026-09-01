insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'company-logos',
  'company-logos',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/svg+xml']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

insert into public.companies (name, image_path, company_count)
values
  ('Babka', 'https://dugjsiyenazpsoiyduuz.supabase.co/storage/v1/object/public/company-logos/babka.svg', 0),
  ('Base44', 'https://dugjsiyenazpsoiyduuz.supabase.co/storage/v1/object/public/company-logos/base44.png', 0),
  ('Food Style', 'https://dugjsiyenazpsoiyduuz.supabase.co/storage/v1/object/public/company-logos/food-style.png', 0),
  ('Spa Zone', 'https://dugjsiyenazpsoiyduuz.supabase.co/storage/v1/object/public/company-logos/spa-zone.png', 0),
  ('אגאדיר', 'https://dugjsiyenazpsoiyduuz.supabase.co/storage/v1/object/public/company-logos/agadir.png', 0),
  ('בורגרסבר', 'https://dugjsiyenazpsoiyduuz.supabase.co/storage/v1/object/public/company-logos/burgersbar.jpg', 0),
  ('גודי', 'https://dugjsiyenazpsoiyduuz.supabase.co/storage/v1/object/public/company-logos/goodi.png', 0),
  ('גולף אנד קו', 'https://dugjsiyenazpsoiyduuz.supabase.co/storage/v1/object/public/company-logos/golf-and-co.jpg', 0),
  ('לה פרינה', 'https://dugjsiyenazpsoiyduuz.supabase.co/storage/v1/object/public/company-logos/la-farina.png', 0),
  ('נונו ומימי', 'https://dugjsiyenazpsoiyduuz.supabase.co/storage/v1/object/public/company-logos/nono-mimi.png', 0),
  ('תו הזהב', 'https://dugjsiyenazpsoiyduuz.supabase.co/storage/v1/object/public/company-logos/tav-hazahav.png', 0),
  ('תן ביס', 'https://dugjsiyenazpsoiyduuz.supabase.co/storage/v1/object/public/company-logos/tenbis.png', 0)
on conflict (name) do update
set image_path = excluded.image_path;
