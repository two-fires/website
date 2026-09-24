-- Rollback for 20260924000000_contact_enquiry_revoke_anon_insert.sql
-- Restores the anon INSERT grant exactly as 20260616000000 created it. Run this
-- if the server-side form path fails and the browser path has to come back.

grant insert on public.tf_contact_enquiries to anon;
