-- Encrypted coupon fields no longer fit in varchar(255).
--
-- coupon-vault stores these columns as Fernet tokens: 73 bytes of overhead,
-- the plaintext padded to 16, then base64 — roughly 2.2x the original size.
-- Any value over ~112 bytes (a Hebrew description of ~56 characters, a long
-- redemption URL) overflowed the column, Postgres answered "value too long for
-- type character varying(255)", and the vault surfaced it as a bare 500, so
-- the app only said "Edge Function returned a non-2xx status code".
--
-- varchar -> text is a metadata-only change and keeps every existing row.

alter table public.coupon
  alter column code type text,
  alter column cvv type text,
  alter column card_exp type text,
  alter column buyme_coupon_url type text,
  alter column strauss_coupon_url type text,
  alter column xgiftcard_coupon_url type text,
  alter column xtra_coupon_url type text;
