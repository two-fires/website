-- supabase/migrations/20260925000000_email_subscribers_revoke_anon_insert.sql
-- Two Fires: close the anonymous write path into tf_email_subscribers, and
-- clear leftover table privileges on the two website-form tables.
--
-- 1. The blog and podcast subscribe forms used to insert into
--    tf_email_subscribers from the browser with the anon key, which is public in
--    page source. They now post to the Insight API
--    (POST insight.two-fires.com/submit/subscribe), which validates,
--    rate-limits and inserts with the service role. This removes anon INSERT.
--    The "Allow anonymous inserts" policy, RLS, the tf_subscriber_capture
--    trigger and every other grant are untouched; with the grant gone the
--    policy simply has nothing to admit.
--
-- 2. Cleanup, not an incident: TRUNCATE, REFERENCES and TRIGGER are not
--    reachable through PostgREST, but anon and authenticated have no business
--    holding them on either table. Nothing else on either table, and no other
--    table, is changed.
--
-- Rollback: 20260925000000_email_subscribers_revoke_anon_insert.down.sql

revoke insert on public.tf_email_subscribers from anon;

revoke truncate, references, trigger
  on public.tf_contact_enquiries, public.tf_email_subscribers
  from anon, authenticated;
