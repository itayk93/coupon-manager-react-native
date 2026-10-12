-- Keys are stored as SHA-256 digests. Only the admin endpoint can manage them.
create table public.instinct_api_keys (
 id uuid primary key default gen_random_uuid(),
 user_id integer not null references public.users(id) on delete cascade,
 created_by integer not null references public.users(id) on delete cascade,
 consented_at timestamptz not null default now(),
 consent_version text not null check (consent_version = 'instinct-decrypted-v1'),
 constraint instinct_self_only check (user_id = 1 and created_by = 1),
 label text not null check (length(label) between 1 and 100),
 key_hash text not null unique,
 key_prefix text not null,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 revoked_at timestamptz,
 last_used_at timestamptz,
 request_window timestamptz not null default now(),
 request_count integer not null default 0
);
alter table public.instinct_api_keys enable row level security;
revoke all on public.instinct_api_keys from anon, authenticated;
grant all on public.instinct_api_keys to service_role;
create schema if not exists instinct_private;
revoke all on schema instinct_private from public, anon, authenticated;
grant usage on schema instinct_private to service_role;
create view instinct_private.coupon as select distinct c.user_id as scope_user_id,c.id,c.public_id,c.company,c.code,c.description,c.cvv,c.card_exp,c.buyme_coupon_url,c.strauss_coupon_url,c.xgiftcard_coupon_url,c.xtra_coupon_url,c.value,c.cost,c.used_value,(c.value-c.used_value) as remaining_value,c.status,c.expiration,c.date_added,c.is_one_time,c.purpose,c.source,c.auto_update,c.last_scraped from public.coupon c where c.deleted_at is null;
create view instinct_private.coupon_usage as select distinct c.user_id as scope_user_id,t.id,t.coupon_id,t.action,t.details,t.timestamp,t.used_amount,t.place_name,t.place_address from public.coupon_usage t join public.coupon c on c.id=t.coupon_id where c.deleted_at is null and not public.is_hidden_ledger_row(coalesce(nullif(t.details,''),nullif(t.action,''),''));
create view instinct_private.coupon_transaction as select distinct c.user_id as scope_user_id,t.id,t.coupon_id,t.location,t.recharge_amount,t.reference_number,t.source,t.transaction_date,t.usage_amount from public.coupon_transaction t join public.coupon c on c.id=t.coupon_id where c.deleted_at is null and not public.is_hidden_ledger_row(coalesce(nullif(t.location,''),nullif(t.source,''),''));
create view instinct_private.coupon_tags as select distinct c.user_id as scope_user_id,t.coupon_id,t.tag_id,g.name from public.coupon_tags t join public.coupon c on c.id=t.coupon_id join public.tag g on g.id=t.tag_id where c.deleted_at is null;
create view instinct_private.users as select distinct u.id as scope_user_id,u.id,u.public_id,u.email,u.first_name,u.last_name,u.created_at,u.slots,u.slots_automatic_coupons from public.users u where not coalesce(u.is_deleted,false);
create view instinct_private.coupon_alerts as select distinct t.user_id as scope_user_id,t.id,t.coupon_id,t.channel,t.sent_at,t.status,t.window_days from public.coupon_alerts t where true;
create view instinct_private.notification_preferences as select distinct t.user_id as scope_user_id,t.email,t.in_app,t.push,t.quiet_until,t.timezone,t.type_channels,t.windows,t.updated_at from public.notification_preferences t where true;
create view instinct_private.companies as select distinct c.user_id as scope_user_id,t.id,t.name,t.image_path from public.coupon c join public.companies t on t.name=c.company where c.deleted_at is null;
grant select on all tables in schema instinct_private to service_role;

-- Invoker is service_role only. Fixed private views omit credentials and enforce
-- ownership before filters, projections, aggregates, or pagination are applied.
create function public.instinct_read(p_hash text, p_table text, p_select text[] default null,
 p_filters jsonb default '[]', p_order jsonb default '[]', p_limit integer default 50, p_offset integer default 0)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public
set statement_timeout = '8s'
as $$
declare
 k public.instinct_api_keys; cols text[]; selected text; predicates text := 'scope_user_id = $1';
 sorting text := ''; f jsonb; col text; op text; val text; direction text;
 result jsonb; total bigint; schema_result jsonb;
 tables constant text[] := array['coupon','coupon_usage','coupon_transaction','coupon_tags','users','coupon_alerts','notification_preferences','companies'];
begin
 select a.* into k from public.instinct_api_keys a join public.users u on u.id=a.user_id
 where a.key_hash=p_hash and a.revoked_at is null and a.expires_at>now() and not coalesce(u.is_deleted,false)
 and u.id=1 and u.is_admin and a.created_by=1 and a.consent_version='instinct-decrypted-v1'
 for update of a;
 if not found then raise exception 'INVALID_KEY' using errcode='28000'; end if;
 if k.request_window > now()-interval '1 minute' and k.request_count >= 120 then
  return jsonb_build_object('error','RATE_LIMITED');
 end if;
 update public.instinct_api_keys set last_used_at=now(),
 request_count=case when request_window<=now()-interval '1 minute' then 1 else request_count+1 end,
 request_window=case when request_window<=now()-interval '1 minute' then now() else request_window end where id=k.id;
 if p_table='schema' then
  select jsonb_agg(jsonb_build_object('name',v.table_name,'columns',v.columns) order by v.table_name) into schema_result
  from (select table_name,jsonb_agg(jsonb_build_object('name',column_name,'type',data_type) order by ordinal_position) as columns
   from information_schema.columns where table_schema='instinct_private' and column_name<>'scope_user_id'
   group by table_name) v;
  return jsonb_build_object('tables',schema_result,'read_only',true,'user_id',k.user_id,'max_limit',200,
   'summary_endpoint','/summary','operators',array['eq','neq','gt','gte','lt','lte','like','ilike','in','is']);
 end if;
 if p_table='summary' then
  select jsonb_build_object('coupon_count',count(*),'value',coalesce(sum(value),0),
    'cost',coalesce(sum(cost),0),'used_value',coalesce(sum(used_value),0),
    'remaining_value',coalesce(sum(remaining_value),0),'expired_count',count(*) filter(where expiration ~ '^\d{4}-\d{2}-\d{2}$' and expiration<current_date::text))
   into result from instinct_private.coupon where scope_user_id=k.user_id;
  return result;
 end if;
 if not p_table=any(tables) then raise exception 'UNKNOWN_TABLE' using errcode='22023'; end if;
 if p_limit not between 1 and 200 or p_offset not between 0 and 1000000 or p_limit is null or p_offset is null
 or jsonb_typeof(p_filters)<>'array' or jsonb_typeof(p_order)<>'array'
 or jsonb_array_length(p_filters)>20 or jsonb_array_length(p_order)>5 then
  raise exception 'INVALID_QUERY' using errcode='22023';
 end if;
 select array_agg(column_name::text order by ordinal_position) into cols from information_schema.columns
 where table_schema='instinct_private' and table_name=p_table and column_name<>'scope_user_id';
 if p_select is null then p_select:=cols; end if;
 if cardinality(p_select)=0 or not p_select <@ cols then raise exception 'INVALID_COLUMN' using errcode='22023'; end if;
 select string_agg(format('%I',x),',') into selected from unnest(p_select) x;
 for f in select * from jsonb_array_elements(p_filters) loop
  col:=f->>'column'; op:=f->>'op'; val:=f->>'value';
  if col is null or not col=any(cols) or op is null or val is null then raise exception 'INVALID_FILTER' using errcode='22023'; end if;
  if p_table='coupon' and col=any(array['code','description','cvv','card_exp','buyme_coupon_url','strauss_coupon_url','xgiftcard_coupon_url','xtra_coupon_url']) then
   raise exception 'ENCRYPTED_COLUMN_FILTER' using errcode='22023';
  end if;
  if op in ('eq','neq','gt','gte','lt','lte') then
   predicates:=predicates||format(' and %I %s %L',col,case op when 'eq' then '=' when 'neq' then '<>' when 'gt' then '>' when 'gte' then '>=' when 'lt' then '<' else '<=' end,val);
  elsif op in ('like','ilike') then
   predicates:=predicates||format(' and %I::text %s %L',col,op,replace(val,'*','%'));
  elsif op='is' and val in ('null','notnull','true','false') then
   predicates:=predicates||format(' and %I is %s',col,case val when 'notnull' then 'not null' else val end);
  elsif op='in' then
   if length(val)>4000 then raise exception 'INVALID_FILTER' using errcode='22023'; end if;
   predicates:=predicates||format(' and %I::text = any(%L::text[])',col,string_to_array(trim(both '()' from val),','));
  else raise exception 'INVALID_OPERATOR' using errcode='22023'; end if;
 end loop;
 for f in select * from jsonb_array_elements(p_order) loop
  col:=f->>'column'; direction:=f->>'direction';
  if col is null or not col=any(cols) or direction is null or direction not in ('asc','desc') then raise exception 'INVALID_ORDER' using errcode='22023'; end if;
  if p_table='coupon' and col=any(array['code','description','cvv','card_exp','buyme_coupon_url','strauss_coupon_url','xgiftcard_coupon_url','xtra_coupon_url']) then
   raise exception 'ENCRYPTED_COLUMN_ORDER' using errcode='22023';
  end if;
  sorting:=sorting||case when sorting='' then '' else ',' end||format('%I %s nulls last',col,direction);
 end loop;
 -- Add all projected-view columns as tie breakers for stable paging.
 select sorting||case when sorting='' then '' else ',' end||string_agg(format('%I',x),',') into sorting from unnest(cols) x;
 execute format('select count(*) from instinct_private.%I where %s',p_table,predicates) into total using k.user_id;
 execute format('select coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) from (select %s from instinct_private.%I where %s order by %s limit $2 offset $3) r',selected,p_table,predicates,sorting)
 into result using k.user_id,p_limit,p_offset;
 return jsonb_build_object('table',p_table,'rows',result,'count',jsonb_array_length(result),'total',total,'limit',p_limit,'offset',p_offset);
end;
$$;
revoke all on function public.instinct_read(text,text,text[],jsonb,jsonb,integer,integer) from public,anon,authenticated;
grant execute on function public.instinct_read(text,text,text[],jsonb,jsonb,integer,integer) to service_role;

-- A logged-out or deleted session must not mint new durable API credentials.
create function public.instinct_admin_session_valid(p_session uuid, p_auth uuid)
returns boolean language sql security invoker set search_path=pg_catalog,public
as $$ select exists(select 1 from auth.sessions s join public.users u on u.auth_user_id=s.user_id
 where s.id=p_session and s.user_id=p_auth and u.id=1 and u.is_admin and not coalesce(u.is_deleted,false)
 and (s.not_after is null or s.not_after>now())); $$;
revoke all on function public.instinct_admin_session_valid(uuid,uuid) from public,anon,authenticated;
grant execute on function public.instinct_admin_session_valid(uuid,uuid) to service_role;
