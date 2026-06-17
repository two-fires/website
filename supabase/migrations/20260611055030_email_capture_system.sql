-- Two Fires: email capture system
-- Reproduces the tf_email_subscribers schema, the new-vs-existing routing trigger,
-- and the secret-reader RPC used by the notify-subscriber edge function.
--
-- Architecture
-- ------------
-- The marketing pages POST directly to PostgREST (/rest/v1/tf_email_subscribers)
-- with the anon key. Because `email` is UNIQUE, a duplicate insert would 409 before
-- any AFTER trigger could run. So new-vs-existing detection lives in a BEFORE INSERT
-- trigger (tf_subscriber_capture):
--   * brand-new email  -> populate `sources`, let the insert proceed, fire the edge
--                         function in "new" mode (James alert + subscriber confirmation)
--   * existing email   -> fire the edge function in "update" mode (append the new
--                         source, James-only alert) and RETURN NULL to cancel the
--                         duplicate insert (no 409, no duplicate row)
-- The edge function (supabase/functions/notify-subscriber) sends the emails via Resend
-- and performs the sources-array append for the update case.
--
-- Secrets (NOT stored in this repo)
-- ---------------------------------
-- The trigger and edge function read two secrets from Supabase Vault:
--   RESEND_API_KEY  -- Resend API key (used by the edge function)
--   WEBHOOK_SECRET  -- shared secret authenticating trigger -> edge function calls
-- Set them out-of-band (values never committed), e.g. via the SQL editor:
--   select vault.create_secret('<resend key>', 'RESEND_API_KEY');
--   select vault.create_secret('<random secret>', 'WEBHOOK_SECRET');
-- The edge function deployment must use the SAME WEBHOOK_SECRET and verify_jwt = false.

-- Extensions ---------------------------------------------------------------
create extension if not exists pg_net;            -- async HTTP from the trigger (net schema)
create extension if not exists supabase_vault;    -- encrypted secret storage (vault schema)

-- Table --------------------------------------------------------------------
create table if not exists public.tf_email_subscribers (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  source     text,                                -- original/first source (kept for back-compat)
  sources    text[] default '{}'::text[],         -- all interests this email subscribed to
  created_at timestamptz default now()
);

-- One row per email; the trigger relies on this to detect existing subscribers.
alter table public.tf_email_subscribers drop constraint if exists tf_email_subscribers_email_key;
alter table public.tf_email_subscribers add  constraint tf_email_subscribers_email_key unique (email);

-- Backfill sources from source for any legacy rows.
update public.tf_email_subscribers
   set sources = array[source]
 where source is not null and (sources is null or array_length(sources, 1) is null);

-- Secret-reader RPC --------------------------------------------------------
-- The edge function calls this with its built-in service-role key to fetch the
-- secrets it needs. SECURITY DEFINER so it can read the vault schema; restricted
-- to service_role only.
create or replace function public.get_app_secrets()
returns jsonb
language sql
security definer
set search_path to ''
as $$
  select jsonb_object_agg(name, decrypted_secret)
  from vault.decrypted_secrets
  where name in ('RESEND_API_KEY', 'WEBHOOK_SECRET');
$$;

revoke all on function public.get_app_secrets() from public;
revoke all on function public.get_app_secrets() from anon;
revoke all on function public.get_app_secrets() from authenticated;
grant execute on function public.get_app_secrets() to service_role;

-- Routing trigger ----------------------------------------------------------
create or replace function public.tf_subscriber_capture()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  ws text;
  existing_id uuid;
  fn_url text := 'https://ssgjsktotbmpyylgegur.supabase.co/functions/v1/notify-subscriber';
begin
  select decrypted_secret into ws from vault.decrypted_secrets where name = 'WEBHOOK_SECRET' limit 1;
  select id into existing_id from public.tf_email_subscribers where email = NEW.email;

  if existing_id is not null then
    -- Existing subscriber: edge function appends the source + notifies James only. Cancel the insert.
    perform net.http_post(
      url := fn_url,
      headers := jsonb_build_object('Content-Type','application/json','x-webhook-secret', ws),
      body := jsonb_build_object('type','update','email', NEW.email, 'source', NEW.source)
    );
    return null;
  else
    -- New subscriber: ensure sources is populated, then send both emails.
    if NEW.sources is null or array_length(NEW.sources,1) is null then
      NEW.sources := array[NEW.source];
    end if;
    perform net.http_post(
      url := fn_url,
      headers := jsonb_build_object('Content-Type','application/json','x-webhook-secret', ws),
      body := jsonb_build_object('type','new','record', to_jsonb(NEW))
    );
    return NEW;
  end if;
end;
$$;

drop trigger if exists tf_email_subscribers_notify  on public.tf_email_subscribers;  -- legacy AFTER trigger, if present
drop trigger if exists tf_email_subscribers_capture on public.tf_email_subscribers;
create trigger tf_email_subscribers_capture
before insert on public.tf_email_subscribers
for each row execute function public.tf_subscriber_capture();
