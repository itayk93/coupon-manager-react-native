-- Make user_activities ready to be written by the app.
--
-- The table has been filled by the old web app since 2024 and never touched by
-- the mobile app. Now the app logs to it too, through the log-activity edge
-- function, which runs as the service role.
--
-- 1. Writes come from that function, so the client has no business inserting
--    directly. A row the client can author is a row that says whatever the
--    client wants — including a user_id that is not theirs, since the policy
--    is checked against a value the client supplies.
-- 2. Reading your own history stays.

revoke insert, update, delete, truncate, references, trigger
  on public.user_activities from authenticated;
revoke all on public.user_activities from anon;

-- Every RLS check on this table is `user_id = app_user_id()`, and every
-- question anyone asks of it is "what did this person do, most recent first".
-- On 30k rows a sequential scan is survivable; this table is about to start
-- growing with every screen every user opens.
create index if not exists user_activities_user_time_idx
  on public.user_activities (user_id, timestamp desc);

-- The other question: how many people did X, and when.
create index if not exists user_activities_action_time_idx
  on public.user_activities (action, timestamp desc);
