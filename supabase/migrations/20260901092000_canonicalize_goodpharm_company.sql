-- Keep one canonical company identity for GoodPharm in existing and future coupons.
create or replace function public.canonicalize_coupon_company()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_key text;
begin
  v_key := lower(regexp_replace(btrim(coalesce(new.company, '')), '[^a-zA-Zא-ת0-9]+', '', 'g'));
  if v_key in ('goodpharm', 'גודפארם') then
    new.company := 'GoodPharm';
  end if;
  return new;
end;
$$;

drop trigger if exists canonicalize_coupon_company_trigger on public.coupon;
create trigger canonicalize_coupon_company_trigger
before insert or update of company on public.coupon
for each row execute function public.canonicalize_coupon_company();

update public.coupon
set company = 'GoodPharm'
where lower(regexp_replace(btrim(coalesce(company, '')), '[^a-zA-Zא-ת0-9]+', '', 'g'))
  in ('goodpharm', 'גודפארם')
  and company is distinct from 'GoodPharm';
