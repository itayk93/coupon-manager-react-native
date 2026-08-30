-- Remove the newsletter "Telegram button" toggle. The teaser email template is
-- fixed and never rendered this flag; the RN admin screen no longer shows it.
-- Verified 2026-08-30: not read in any edge function, DB function, view, or trigger.

begin;

alter table public.newsletters
  drop column if exists show_telegram_button;

commit;
