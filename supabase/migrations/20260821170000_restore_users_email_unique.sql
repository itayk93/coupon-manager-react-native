-- Required by handle_auth_user_created() ON CONFLICT (email).
-- Existing data was checked for duplicate normalized addresses before rollout.
create unique index if not exists users_email_key on public.users (email);
