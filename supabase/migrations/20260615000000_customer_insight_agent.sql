-- Two Fires — Customer Insight Agent
-- Lead capture + usage limiting + session logging for the free /insight tool.
--
-- Three tables, all service-role only (the Vercel serverless functions use the
-- service key; RLS is enabled with no policies so anon/authenticated get nothing):
--   tf_leads     -- one row per email that registers for the insight tool
--   tf_usage     -- one row per lead, tracks run_count against the 3-free limit
--   tf_sessions  -- one row per analysis run (tokens, cost, result, status)
--
-- Run this against project ssgjsktotbmpyylgegur before the tool goes live.

-- Leads --------------------------------------------------------------------
create table if not exists public.tf_leads (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text not null,
  company    text not null,
  created_at timestamptz default now()
);

alter table public.tf_leads drop constraint if exists tf_leads_email_key;
alter table public.tf_leads add  constraint tf_leads_email_key unique (email);

-- Usage --------------------------------------------------------------------
-- One row per lead. run_count is checked against the free limit (3) in the API.
create table if not exists public.tf_usage (
  lead_id     uuid primary key references public.tf_leads(id) on delete cascade,
  run_count   integer not null default 0,
  last_run_at timestamptz,
  created_at  timestamptz default now()
);

-- Sessions -----------------------------------------------------------------
-- One row per analysis run. Logs token usage, estimated cost, and the result.
create table if not exists public.tf_sessions (
  id                 uuid primary key default gen_random_uuid(),
  lead_id            uuid references public.tf_leads(id) on delete cascade,
  evidence_chars     integer,
  tokens_in          integer,
  tokens_out         integer,
  estimated_cost_usd numeric(10,6),
  result             jsonb,
  status             text not null default 'processing',  -- processing | complete | error
  created_at         timestamptz default now(),
  completed_at       timestamptz
);

create index if not exists tf_sessions_lead_id_idx on public.tf_sessions (lead_id);

-- Lock down ----------------------------------------------------------------
-- Enable RLS with no policies. The serverless functions use the service-role
-- key (which bypasses RLS); anon/authenticated clients get no access.
alter table public.tf_leads    enable row level security;
alter table public.tf_usage    enable row level security;
alter table public.tf_sessions enable row level security;
