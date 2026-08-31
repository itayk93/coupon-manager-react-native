-- Buyer identity collapses to a single optional full-name field, and no buyer
-- detail is mandatory any more: a seller may record a sale without saying who
-- bought it. Only the sale itself (price snapshot) is kept.

alter table public.coupon_sales add column if not exists buyer_name text;
update public.coupon_sales
  set buyer_name = nullif(btrim(coalesce(buyer_first_name, '') || ' ' || coalesce(buyer_last_name, '')), '')
  where buyer_name is null;
alter table public.coupon_sales drop column if exists buyer_first_name;
alter table public.coupon_sales drop column if exists buyer_last_name;
alter table public.coupon_sales alter column buyer_phone drop not null;

drop function if exists public.record_manual_coupon_sale(integer,double precision,text,text,text,text,timestamptz);

create function public.record_manual_coupon_sale(
  p_coupon_id integer, p_sale_price double precision default 0,
  p_buyer_name text default null, p_buyer_phone text default null,
  p_buyer_email text default null, p_sold_at timestamptz default now()
)
returns bigint language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user integer; v_coupon public.coupon%rowtype; v_sale_id bigint; v_price double precision;
begin
  v_user := public.app_user_id();
  if v_user is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  v_price := coalesce(p_sale_price, 0);
  if v_price < 0 or v_price = 'NaN'::double precision then
    raise exception 'INVALID_SALE_INPUT' using errcode = '22023';
  end if;
  if nullif(lower(btrim(coalesce(p_buyer_email, ''))), '') is not null
    and lower(btrim(p_buyer_email)) !~* '^\S+@\S+\.\S+$' then
    raise exception 'INVALID_SALE_INPUT' using errcode = '22023';
  end if;
  select * into v_coupon from public.coupon
    where id = p_coupon_id and user_id = v_user and deleted_at is null for update;
  if not found or v_coupon.status = 'נמכר' then raise exception 'COUPON_NOT_FOUND' using errcode = '42501'; end if;
  insert into public.coupon_sales(
    coupon_id,seller_user_id,sale_type,status,buyer_name,buyer_phone,buyer_email,
    sale_price,coupon_value_snapshot,coupon_cost_snapshot,coupon_used_value_snapshot,
    company_snapshot,description_snapshot,expiration_snapshot,sold_at
  ) values (
    v_coupon.id,v_user,'manual','completed',
    nullif(btrim(coalesce(p_buyer_name,'')),''),nullif(btrim(coalesce(p_buyer_phone,'')),''),
    nullif(lower(btrim(coalesce(p_buyer_email,''))),''),v_price,v_coupon.value,v_coupon.cost,v_coupon.used_value,
    v_coupon.company,v_coupon.description,v_coupon.expiration,p_sold_at
  ) returning id into v_sale_id;
  update public.coupon set status = 'נמכר', sale_id = v_sale_id,
    show_in_widget = false, widget_display_order = null, auto_update = false
    where id = v_coupon.id;
  update public.coupon_shares set status = 'revoked', revoked_at = now()
    where coupon_id = v_coupon.id and status in ('pending','accepted');
  return v_sale_id;
end $$;
revoke all on function public.record_manual_coupon_sale(integer,double precision,text,text,text,timestamptz) from public, anon;
grant execute on function public.record_manual_coupon_sale(integer,double precision,text,text,text,timestamptz) to authenticated;
