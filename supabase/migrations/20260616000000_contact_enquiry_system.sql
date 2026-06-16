-- supabase/migrations/20260616000000_contact_enquiry_system.sql
-- Two Fires — contact enquiry capture
-- Same architecture as the email capture system (20260611055030): the marketing
-- page POSTs to PostgREST with the anon key; an INSERT trigger fires the
-- notify-enquiry edge function via pg_net, authenticated with WEBHOOK_SECRET.
--
-- Difference vs tf_email_subscribers: there is no new-vs-existing dedup here, so
-- this uses a plain AFTER INSERT trigger (the row is always kept). RLS is ENABLED
-- with an insert-only policy so the anon key can submit enquiries but cannot read
-- or delete them (enquiries hold names + message bodies and must not be publicly
-- readable). The edge function uses the service role and bypasses RLS.
--
-- Reuses existing vault secrets RESEND_API_KEY and WEBHOOK_SECRET and the
-- get_app_secrets() RPC from the email capture migration. No new secrets.

create extension if not exists pg_net;          -- async HTTP from the trigger
create extension if not exists supabase_vault;  -- encrypted secret storage

-- Table --------------------------------------------------------------------
create table if not exists public.tf_contact_enquiries (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text not null,
  company    text,
  message    text not null,
  created_at timestamptz default now()
);

-- Access -------------------------------------------------------------------
-- RLS on, anon may INSERT only. No select/update/delete policy => anon cannot
-- read or change enquiries. service_role bypasses RLS for the edge function.
alter table public.tf_contact_enquiries enable row level security;

drop policy if exists tf_contact_enquiries_anon_insert on public.tf_contact_enquiries;
create policy tf_contact_enquiries_anon_insert
  on public.tf_contact_enquiries
  for insert
  to anon
  with check (true);

grant insert on public.tf_contact_enquiries to anon;

-- Routing trigger ----------------------------------------------------------
create or replace function public.tf_contact_enquiry_capture()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  ws text;
  fn_url text := 'https://ssgjsktotbmpyylgegur.supabase.co/functions/v1/notify-enquiry';
begin
  select decrypted_secret into ws from vault.decrypted_secrets where name = 'WEBHOOK_SECRET' limit 1;
  perform net.http_post(
    url := fn_url,
    headers := jsonb_build_object('Content-Type','application/json','x-webhook-secret', ws),
    body := jsonb_build_object('type','new_enquiry','record', to_jsonb(NEW))
  );
  return NEW;
end;
$$;

drop trigger if exists tf_contact_enquiries_capture on public.tf_contact_enquiries;
create trigger tf_contact_enquiries_capture
after insert on public.tf_contact_enquiries
for each row execute function public.tf_contact_enquiry_capture();
