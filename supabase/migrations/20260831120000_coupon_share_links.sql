-- Open share links: a coupon_shares row that belongs to whoever holds the token,
-- rather than to an address chosen up front. This is what lets someone hand a
-- coupon to a friend over AirDrop or a QR code without knowing their email.
--
-- The link is a bearer credential, so it is deliberately weaker than the email
-- invitation in every dimension that matters: one open link per coupon, 24 hours
-- instead of 30 days, and it dies the moment somebody claims it.

alter table public.coupon_shares
  alter column shared_with_user_id drop not null;

-- One unclaimed link per coupon. Without this, tapping the share button twice
-- leaves two live bearer tokens and revoking one means nothing.
create unique index if not exists coupon_shares_one_open_link
  on public.coupon_shares (coupon_id)
  where status = 'pending' and shared_with_user_id is null;

-- Claiming looks the row up by token alone, so the token must identify one row.
create unique index if not exists coupon_shares_share_token_key
  on public.coupon_shares (share_token)
  where share_token is not null;

-- The recipient of an open link is unknown until the claim, so the invitation
-- cannot carry an address. Existing rows keep theirs.
alter table public.coupon_shares
  alter column recipient_email drop not null;
