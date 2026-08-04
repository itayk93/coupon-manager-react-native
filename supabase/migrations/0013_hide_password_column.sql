-- 0013: Actually prevent clients from selecting users.password.
--
-- 0011 issued `revoke select (password) ... `, which is a no-op: a column-level
-- revoke cannot carve a hole out of a table-level SELECT grant. Postgres
-- accepts it silently and the column stays readable.
--
-- The working form is to drop the table-level grant and re-grant SELECT on
-- every column except password. RLS still limits which rows are visible; this
-- limits which columns are, so not even a user's own hash comes back.
do $$
declare
  cols text;
begin
  select string_agg(quote_ident(attname), ', ')
    into cols
  from pg_attribute
  where attrelid = 'public.users'::regclass
    and attnum > 0
    and not attisdropped
    and attname <> 'password';

  revoke select on public.users from anon, authenticated;
  execute format('grant select (%s) on public.users to authenticated', cols);
end;
$$;
