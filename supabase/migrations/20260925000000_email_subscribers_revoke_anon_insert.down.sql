-- Rollback for 20260925000000_email_subscribers_revoke_anon_insert.sql
--
-- If the subscribe forms break, the first statement alone brings the browser
-- path back: it restores anon INSERT on tf_email_subscribers exactly as the
-- table had it. The second restores the TRUNCATE/REFERENCES/TRIGGER grants
-- the cleanup removed, to the same roles on the same two tables.

grant insert on public.tf_email_subscribers to anon;

grant truncate, references, trigger
  on public.tf_contact_enquiries, public.tf_email_subscribers
  to anon, authenticated;
