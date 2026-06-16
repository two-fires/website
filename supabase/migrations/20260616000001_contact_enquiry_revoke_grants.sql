-- supabase/migrations/20260616000001_contact_enquiry_revoke_grants.sql
-- Two Fires — contact enquiry: defense-in-depth grant tightening
--
-- tf_contact_enquiries already runs with RLS enabled and only an anon INSERT
-- policy, so reads/updates/deletes are blocked at the policy layer. However the
-- table still carries Supabase's default table-level SELECT/UPDATE/DELETE grants
-- to anon and authenticated. Those are neutralised by RLS, but we revoke them
-- explicitly as belt-and-suspenders. INSERT for anon is intentionally retained so
-- the public contact form keeps working.

revoke select, update, delete on public.tf_contact_enquiries from anon, authenticated;
