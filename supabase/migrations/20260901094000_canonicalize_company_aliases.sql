-- Merge duplicate company aliases and keep future coupon imports canonical.
create or replace function public.canonicalize_coupon_company()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_key text;
begin
  v_key := lower(regexp_replace(btrim(coalesce(new.company, '')), '[^a-zA-Zא-ת0-9]+', '', 'g'));

  case
    when v_key in ('goodpharm', 'גודפארם') then
      new.company := 'GoodPharm';
    when v_key in ('xtra', 'אקסטרה') then
      new.company := 'XTRA';
    when v_key in ('משלוחה', 'משלוחהארצי') then
      new.company := 'משלוחה';
    else
      null;
  end case;

  return new;
end;
$$;

update public.coupon
set company = 'XTRA'
where lower(regexp_replace(btrim(coalesce(company, '')), '[^a-zA-Zא-ת0-9]+', '', 'g'))
  in ('xtra', 'אקסטרה')
  and company is distinct from 'XTRA';

update public.coupon
set company = 'משלוחה'
where lower(regexp_replace(btrim(coalesce(company, '')), '[^a-zA-Zא-ת0-9]+', '', 'g'))
  in ('משלוחה', 'משלוחהארצי')
  and company is distinct from 'משלוחה';

delete from public.coupon
where company = 'E2E Vault';

delete from public.companies
where name in ('אקסטרה', 'משלוחה-ארצי', 'E2E Vault');
