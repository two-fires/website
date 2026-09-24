-- supabase/migrations/20260924000000_contact_enquiry_revoke_anon_insert.sql
-- Two Fires contact enquiry: close the anonymous write path.
--
-- The website's Snapshot form used to insert into tf_contact_enquiries from the
-- browser with the anon key, which is public in page source, so anyone could
-- write unlimited rows. The form now posts to the Insight API
-- (POST insight.two-fires.com/submit/enquiry), which validates, rate-limits and
-- inserts with the service role. This removes the anon INSERT grant and nothing
-- else: the anon insert policy, RLS, the capture trigger and every other grant
-- are untouched. Rollback: 20260924000000_contact_enquiry_revoke_anon_insert.down.sql

revoke insert on public.tf_contact_enquiries from anon;
