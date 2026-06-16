# Two Fires - Operational Context

> Reference document for AI assistants working on the Two Fires codebase and stack.
> Written to be read cold. No assumed context.
>
> **Repo:** `git@github.com:two-fires/website.git` (the marketing site).
> **Last verified:** 2026-06-16, against the live codebase, the live Supabase project, and live DNS (`dig`).
> Items that could not be verified from inside the repo are marked **UNKNOWN** or **NEEDS VERIFICATION**.

---

## 1. The firm

**Two Fires** is a marketing firm that pairs senior brand strategy with AI execution.

| | |
|---|---|
| Positioning / `<title>` | World-class marketing. Supercharged with AI. |
| Hero headline | "World-class marketing." (white line) / "Supercharged with AI." (purple line) - split across two lines via `<br><em>` |
| Meta description | "World-class marketing. Supercharged with AI. Thirty years of brand work at McDonald's, Mars, Unilever and Burger King, applied to your business and multiplied by AI." |
| Closing line | "Two fires. Your business. Let's begin." |
| Public contact | `lightmyfuse@two-fires.com` |

**The two fires (the two principals):**

- **Brand Fire - Paul Tredinnick.** "Thirty years of marketing leadership at McDonald's, Mars, Unilever, Burger King and Primo Foods. Brand strategy, positioning, customer insight and integrated marketing across the world's most competitive categories. Author of *Marketing Executive's AI Authority*."
- **Engine Fire - James Whitehill.** "Fifteen years in advertising production for international multi-million-dollar businesses. Four years deploying AI tools and execution systems across SMEs in operation, and now leading our agent architecture." James operates as the **Chief Connector**: strategic decisions and architecture, not hands-on execution (see §9).

**Commercial model:**

- **Six-client cap.** "We work with no more than six client engagements at any time."
- **No-go list** (automatic no, regardless of fee): no gambling, no adult content, no predatory lending, no MLM or pyramid, no "wealth coaching", no speculative crypto, no tobacco or vape. Framed as: "We're not for everyone. And that's on purpose." / "Everyone else, we're listening."
- **Risk-reversal close.** "Every engagement starts with one conversation. Forty-five minutes of your time, a full day of ours in preparation. You leave with a clearer view of what's actually broken, whether you work with us or not." CTA: "Bring us your hardest growth problem."

**Voice and brand rules:**

- **No em-dashes anywhere in copy.** Use periods (occasionally commas) for hard stops. This is enforced in all hand-written copy, emails, and UI text. (Note: AI-generated tool output, e.g. the Customer Insight Agent JSON, is not strictly scrubbed for em-dashes.)
- **Headline pattern:** a white phrase and a purple phrase, on separate lines. The purple phrase is wrapped in `<em>` and coloured with the accent, not italicised in the usual sense.
- **Neon purple palette** (from `index.html` `:root`):

  | Token | Hex |
  |---|---|
  | `--purple` (primary accent) | `#A855F7` |
  | `--purple-deep` | `#6B21A8` |
  | `--purple-bright` | `#C4A8FF` |
  | `--bg` (near-black) | `#050508` (the portal/agent use `#05050A`) |
  | purple glow | `rgba(168,85,247,0.55)` |

- **Fonts - two systems are in play (flag for consistency work):**
  - **Marketing site + tools** (`index.html`, `blog.html`, `podcast.html`, `insight/`, `ladder/`, `case-study-wellness.html`, `coming-soon.html`): **DM Sans** (display + body) + **Geist Mono** (labels/mono).
  - **Portal + agent** (`portal.html`, `agent.html`): **Instrument Serif** (italic headers) + **Manrope** (body) + **Geist Mono**.
  - The "Instrument Serif / Manrope / Geist Mono" brand system applies to the portal/agent surfaces; the public marketing site is on DM Sans. Treat both as current.

---

## 2. Domain and DNS

- **Domain:** `two-fires.com`
- **Registrar:** Crazy Domains (per James; not verifiable via `dig`).
- **Authoritative DNS:** Cloudflare - verified. NS records: `virginia.ns.cloudflare.com`, `garret.ns.cloudflare.com`.

**Live records (verified via `dig`, 2026-06-16):**

| Type | Name | Value | Serves |
|---|---|---|---|
| NS | `two-fires.com` | `virginia.ns.cloudflare.com`, `garret.ns.cloudflare.com` | Cloudflare authoritative DNS |
| A | `two-fires.com` | `76.76.21.21` | Vercel (marketing site) |
| CNAME | `www` | `cname.vercel-dns.com` | Vercel |
| MX | `two-fires.com` | `1 smtp.google.com` | Google Workspace (inbound mail) |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:james@two-fires.com` | DMARC (monitor only, `p=none`) |
| TXT | `resend._domainkey` | `p=MIGf…` (present) | Resend DKIM |
| MX | `send` | `10 feedback-smtp.ap-northeast-1.amazonses.com` | Resend return-path (via AWS SES, Tokyo region) |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | Resend/SES SPF for the bounce subdomain |
| A | `insight` | `66.179.136.128` | VPS (tf-insight-api) |
| A | `agent` | `66.179.136.128` | VPS (agent backend, same box) |

**Flags:**
- **No root `TXT` / SPF record** was returned for `two-fires.com` itself. Google Workspace outbound normally wants `v=spf1 include:_spf.google.com ~all` at the root. **NEEDS VERIFICATION** - this may be a real gap.
- `google._domainkey` returned empty. Google DKIM may use a different selector or be unconfigured. **NEEDS VERIFICATION.**

**Subdomains in use:**

| Subdomain | Serves |
|---|---|
| `two-fires.com`, `www` | Vercel - the static marketing site (this repo) |
| `insight.two-fires.com` | VPS `66.179.136.128` - `tf-insight-api` (Caddy reverse proxy → port 3113) |
| `agent.two-fires.com` | VPS `66.179.136.128` - agent chat backend (**not in this repo; internals UNKNOWN**) |
| `send.two-fires.com` | Resend/SES email return-path only (no web content) |

> `app.`, `crm.`, `signup.`, `audit.two-fires.com` returned **no records**. Those names belong to the separate Vero / VerusLink project, not Two Fires. Do not assume they exist here.

---

## 3. Frontend

Static HTML, no build step. Each page is a self-contained file with inline `<style>` and `<script>`.

| File | Purpose | Form(s) and where they POST |
|---|---|---|
| `index.html` | Marketing homepage | **Contact form** → `POST https://…supabase.co/rest/v1/tf_contact_enquiries` (anon JWT). Fields: `name`, `email`, `company`, `message`. (Was a `mailto:` until 2026-06-16; now the email-capture pattern.) |
| `blog.html` | Blog listing + post placeholders | **Notify form** → `POST …/rest/v1/tf_email_subscribers`, body `{ email, source: 'blog' }` |
| `podcast.html` | Podcast placeholder | **Notify form** → same endpoint, `source: 'podcast'` |
| `portal.html` | Client portal (tool launcher) | **Login** - client-side credential check only (`twofires` / `TwoFires1!`), sets `sessionStorage.tf_auth='true'`. No server call. Tool cards link to `agent.html` and `ladder/index.html`. |
| `agent.html` | Customer Intelligence chat UI | `POST https://agent.two-fires.com/agent` (JSON; 120s timeout). Backend not in repo. |
| `insight/index.html` | Customer Insight Agent (free tool) | Gate form → `POST https://insight.two-fires.com/register`; brief form → `POST https://insight.two-fires.com/analyse` (SSE). Exec-summary layer + PDF export (html2pdf.js CDN). |
| `ladder/index.html` | Brand Benefit Ladder (portal tool) | Client-details form → `POST https://insight.two-fires.com/ladder/start`; chat → `POST …/ladder/chat` (SSE). **Auth: reuses portal's `sessionStorage.tf_auth`; redirects to `/portal.html` if absent.** |
| `case-study-wellness.html` | Wellness case study | No form |
| `coming-soon.html` | Generic placeholder | No form |

**Deploy path:** GitHub `two-fires/website` → **Vercel auto-deploy on push to `main`**. Confirmed live: root A record `76.76.21.21`, response header `server: Vercel`. No CI config in repo; Vercel watches the branch directly.

**Vercel project / team / env vars:** **NEEDS VERIFICATION.** There is no `.vercel/` directory in the repo (`.gitignore` excludes it). The site is fully static, so it needs no build-time env vars. The only credential embedded client-side is the **Supabase anon JWT** (public by design - it is the `anon` key, hardcoded in `blog.html`, `podcast.html`, `index.html`, `insight/index.html`).

---

## 4. Backend services

### Supabase
- **Project ID:** `ssgjsktotbmpyylgegur`
- **Live tables** (verified against `information_schema`, 2026-06-16):

| Table | Columns (live) | Purpose |
|---|---|---|
| `tf_email_subscribers` | `id uuid, email text, source text, sources text[], created_at` | Blog/podcast email captures. `email` is UNIQUE; `sources[]` accumulates all interests. |
| `tf_contact_enquiries` | `id uuid, name text, email text, company text, message text, created_at` | Homepage contact-form submissions. |
| `tf_leads` | `id uuid, email text, name text, company text, created_at` | One row per email that registers for the Customer Insight tool. `email` UNIQUE. |
| `tf_usage` | `id uuid, lead_id uuid, run_count int, last_run_at` | Usage limiting for the insight tool (free-run cap). One row per lead. |
| `tf_sessions` | `id uuid, lead_id uuid, input_chars int, tokens_in int, tokens_out int, estimated_cost_usd numeric, status text, result jsonb, created_at` | One row per insight analysis run. **Note: `input_chars`, and NO `completed_at`** - the migration file is wrong here (see §8). |
| `tf_ladder_sessions` | `id uuid, client_name text, client_email text, company text, messages jsonb, current_stage text, ladder_output jsonb, status text, created_at, updated_at` | One row per Brand Benefit Ladder conversation. `status` ∈ active/complete/abandoned. |

- **Secret-reader RPC:** `public.get_app_secrets()` - `SECURITY DEFINER`, `service_role`-only, returns the Vault secrets `RESEND_API_KEY` and `WEBHOOK_SECRET` as JSON. Both edge functions call it.
- **Secrets storage:** Supabase Vault (`vault.decrypted_secrets`). Secrets: `RESEND_API_KEY`, `WEBHOOK_SECRET`. Never committed to the repo.

### Edge functions (`supabase/functions/`)

| Function | Trigger | What it does | Secrets | `verify_jwt` |
|---|---|---|---|---|
| `notify-subscriber` | `tf_email_subscribers` **BEFORE INSERT** trigger `tf_subscriber_capture` (uses `pg_net` to POST with `x-webhook-secret`) | New email → notify James + send branded confirmation. Existing email → append `source` to `sources[]`, notify James only, cancel the duplicate insert. | `RESEND_API_KEY`, `WEBHOOK_SECRET` via `get_app_secrets()` | `false` |
| `notify-enquiry` | `tf_contact_enquiries` **AFTER INSERT** trigger `tf_contact_enquiry_capture` | Sends James an alert (subject `Enquiry from {name} at {company}`, `reply_to` = enquirer) + sends the enquirer a "We've got it." confirmation. | same | `false` |

Both verify the inbound `x-webhook-secret` header against the Vault `WEBHOOK_SECRET` and use the built-in `SUPABASE_SERVICE_ROLE_KEY` for any DB access.

### Resend (transactional email)
- **Sending domain:** `two-fires.com`. **From address:** `Two Fires <hello@two-fires.com>` (constant `FROM` in both functions). **Alerts to:** `james@two-fires.com` (`NOTIFY_TO`).
- **Return-path / bounce subdomain:** `send.two-fires.com` (AWS SES under the hood - Resend's infrastructure). **DKIM:** `resend._domainkey`.
- **API key:** Supabase Vault `RESEND_API_KEY`, read at runtime via `get_app_secrets()`.

### VPS-hosted services

| Service | URL | Location / ownership | Notes |
|---|---|---|---|
| `tf-insight-api` | `https://insight.two-fires.com` | `/home/james/tf-insight-api/` on VPS `66.179.136.128`. systemd unit `tf-insight-api.service` (`User=james`, `ExecStart=/usr/bin/node server.js`), port **3113**, Caddy reverse proxy. | Node/Express. Endpoints: `/health`, `/register`, `/analyse` (Customer Insight Agent - Anthropic `claude-sonnet-4-6` + `web_search`, SSE), `/ladder/start`, `/ladder/chat` (Brand Benefit Ladder, SSE). Uses the Anthropic SDK and the Supabase **service key**. `.env`: `PORT`, `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `DAILY_SPEND_CAP_USD`. This is a **separate codebase** from this repo. |
| agent backend | `https://agent.two-fires.com/agent` | Same VPS IP `66.179.136.128`. | **Internals UNKNOWN - not in this repo and not inspectable from here.** Called by `agent.html`. Likely another service on the same box. **NEEDS VERIFICATION.** |

> The `tf-insight-api` service is owned/run by James on the VPS. Its source is at `/home/james/tf-insight-api/`. Whether that directory is under its own git remote is **UNKNOWN** (it has a local `.gitignore`).

---

## 5. Data flow patterns

### The email-capture pattern (the unifying pattern)

Used by blog, podcast, and the contact form. One shape:

```
Browser form
  → fetch POST (Supabase anon JWT) to PostgREST  /rest/v1/<table>
    → Postgres INSERT trigger (pg_net http_post, authenticated with WEBHOOK_SECRET)
      → Supabase Edge Function
        → Resend  (sends the email[s])
```

- **blog.html / podcast.html** → `tf_email_subscribers` → trigger `tf_subscriber_capture` (**BEFORE INSERT**, handles new-vs-existing dedup) → `notify-subscriber`.
- **index.html contact form** → `tf_contact_enquiries` → trigger `tf_contact_enquiry_capture` (**AFTER INSERT**, always keeps the row) → `notify-enquiry`.

The only structural difference between the two is BEFORE vs AFTER INSERT, because subscribers dedupe on a unique email and enquiries never do.

### Patterns that do NOT follow this

- **Customer Insight Agent** (`insight/index.html`): talks directly to the VPS service `insight.two-fires.com` over HTTPS (`/register` JSON, `/analyse` SSE). The VPS backend uses the Anthropic API and writes to `tf_leads` / `tf_usage` / `tf_sessions` with the **service-role** key. No PostgREST, no trigger, no Resend.
- **Brand Benefit Ladder** (`ladder/index.html`): same VPS service, `/ladder/start` + `/ladder/chat` (SSE), writes `tf_ladder_sessions`. Portal-gated.
- **agent.html**: posts to `agent.two-fires.com/agent` (separate, out-of-repo backend).

### Auth model (verified live, 2026-06-16)

- **Public inserts:** the browser carries the Supabase **anon JWT** (public by design). RLS is the real gate, not the key.
- **RLS + policies - current live state:**

| Table | RLS | Policy | Effect |
|---|---|---|---|
| `tf_email_subscribers` | on | `"Allow anonymous inserts"` - INSERT, `anon`, `WITH CHECK true` | anon can INSERT only; cannot read/update/delete |
| `tf_contact_enquiries` | on | `tf_contact_enquiries_anon_insert` - INSERT, `anon`, `WITH CHECK true` | anon INSERT only; default SELECT/UPDATE/DELETE grants were also revoked from anon/authenticated (migration `…0001`) |
| `tf_leads` | on | `service_role_bypass` - ALL, `USING auth.role()='service_role'` | service role only |
| `tf_usage` | on | `service_role_bypass` | service role only |
| `tf_sessions` | on | `service_role_bypass` | service role only |
| `tf_ladder_sessions` | on | `service_role_bypass` | service role only |

- **Service role** (edge functions via built-in `SUPABASE_SERVICE_ROLE_KEY`; VPS service via `.env SUPABASE_SERVICE_KEY`) bypasses RLS for all reads/writes.
- **Portal auth** (`portal.html`): hardcoded client-side credentials `twofires` / `TwoFires1!`. On success sets `sessionStorage.tf_auth='true'` and `tf_user`. `ladder/index.html` reuses that key and redirects to `/portal.html` if it is missing. This is a soft gate, not real security - the credentials are in the page source.

---

## 6. Email infrastructure

Two distinct sending paths under one domain:

1. **Human mail - Google Workspace.** `james@two-fires.com` is a Workspace mailbox. Inbound mail: `MX 1 smtp.google.com`. This is where replies and day-to-day email live.
2. **Transactional mail - Resend.** Automated confirmations and alerts send from `hello@two-fires.com` via Resend, with the `send.two-fires.com` SES return-path and `resend._domainkey` DKIM. Triggered by the edge functions.

**Addresses / aliases:**

| Address | Role | Routing |
|---|---|---|
| `james@two-fires.com` | Primary Workspace mailbox; receives all automated alerts (`NOTIFY_TO`); DMARC `rua`. | Google Workspace |
| `hello@two-fires.com` | Resend **From** address for outbound transactional email. | Sends via Resend. Whether it also *receives* into Workspace is **NEEDS VERIFICATION**. |
| `lightmyfuse@two-fires.com` | Public contact address (every `mailto:` on the site, and the human fallback in error states). | Almost certainly an alias/route to `james@`, but **NEEDS VERIFICATION**. |

- **Send-as configuration** (e.g. James sending as `lightmyfuse@` or `hello@` from Gmail): **NEEDS VERIFICATION** - lives in the Workspace admin/Gmail settings, not inspectable here.
- **Paul's email:** the codebase references `paul@brandvaluebuilders.com` (his own company domain) and `treddersmkg@gmail.com` (the address he registered with, present in `tf_leads` and on the insight-tool unlimited allowlist). **No `paul@two-fires.com` appears anywhere.** Whether Paul has a Two Fires Workspace seat or just a forwarder is **UNKNOWN / NEEDS VERIFICATION**.
- **Known gaps (from DNS):** no root SPF TXT found; `google._domainkey` empty (see §2).

---

## 7. Conventions and rules

- **Migration naming:** `supabase/migrations/<YYYYMMDDHHMMSS>_<snake_case_name>.sql` (UTC timestamp prefix). Current files: `20260611055030_email_capture_system.sql`, `20260615000000_customer_insight_agent.sql`, `20260616000000_contact_enquiry_system.sql`, `20260616000001_contact_enquiry_revoke_grants.sql`.
- **Table naming:** `tf_` prefix (Two Fires) on every application table.
- **Branches / commits:** work happens on `main`. Commit subjects are short and imperative ("Wire contact form to Supabase + Resend autoresponder"). Author identity in this repo is `James Whitehill <james@two-fires.com>` (some older commits used `jamesdwhitehill@gmail.com`). **No `Co-Authored-By` trailers.**
- **Archive, never delete.** Never delete contacts, leads, enquiries, subscribers, or client data. Mark a status (e.g. `abandoned`, `archived`) instead. Test rows are left in place rather than removed.
- **Approval gates - get explicit user approval before:** database migrations, Vercel deploys / `git push`, secret rotations, deleting files, sending any external email/message, modifying billing or invoices. Present a plan or a diff first; do not execute and ask forgiveness.
- **"Show diff before saving" for frontend edits.** For `index.html` and other frontend changes, show the diff and wait for review before committing or deploying. James reviews drafts before they ship.

---

## 8. Current state and open items

**Working in production:**
- Marketing site on Vercel (auto-deploys from `main`).
- Email capture: blog, podcast, and the homepage contact form all flow page → Supabase → Resend. The contact pipeline was tested end-to-end on 2026-06-16 (row insert + both Resend message IDs confirmed).
- Customer Insight Agent at `insight.two-fires.com` - research agent with web search, executive-summary layer, and PDF export (shipped 2026-06-16).
- Brand Benefit Ladder in the portal - multi-turn conversational tool, portal-auth-gated.

**In flight / recent:**
- Latest commit: `05ff7ba` "Insight: exec summary layer + PDF export. Ladder: portal auth fix". **Working tree is clean** - everything is committed.
- The `tf-insight-api` service (separate location, `/home/james/tf-insight-api/`) is live via systemd; its changes are deployed by restart, independent of this repo.

**Known stale / drift (important - the repo migrations are NOT a faithful snapshot of the live DB):**
- `20260615000000_customer_insight_agent.sql` is **inaccurate vs. live**: it declares `tf_sessions.evidence_chars` and `tf_sessions.completed_at`, but the live table uses **`input_chars`** and has **no `completed_at`**. Its comments also say "3-free limit" (live code uses **1** free run) and "Vercel serverless functions" (the backend has since **moved to the VPS** `tf-insight-api`).
- **`tf_ladder_sessions` has no migration file in the repo.** It was created live via the Supabase MCP `apply_migration` tool and never written to `supabase/migrations/`.
- The RLS policies on `tf_email_subscribers`, `tf_leads`, `tf_usage`, and `tf_sessions` exist **live** but were added **out-of-band** (the email-capture migration left RLS off; the insight migration enabled RLS with no policies). The live auth state in §5 is authoritative; the migration files under-describe it.
- `agent.html` depends on `agent.two-fires.com`, a backend not represented anywhere in this repo.

**Ideas backlog:** `/root/.openclaw/workspace/playbooks/IDEAS_BACKLOG.md` (updated 2026-06-13) - **Active and Parked sections are both empty** ("to be populated from next strategy session"). Governing rule: max 5 active items; every item must pass "does this get the next client to yes?" and must not require James to become an executor. (This file is outside the repo; read-only.)

---

## 9. How to work with James

- **Direct and iterative.** He moves fast and expects fast, concrete acknowledgement. Lead with the answer or the result, not preamble.
- **Plans before destructive actions.** Show the plan or the diff before migrations, deploys, deletes, or anything outward-facing, and wait for the go. He reviews drafts.
- **One-shot prompts, not procedures.** He prefers a single Claude Code prompt he can paste and run, over a multi-step "do this, then that" checklist he has to walk through himself. Claude/Claude.ai plans and architects; Claude Code executes. Do not hand James the execution.
- **Faith context.** James is a Christian and it informs his framing and decisions. Don't over-spiritualise or inject it into work output unless he raises it first.
- **Role: Chief Connector.** He makes strategic and architectural decisions and connects people and capital. He is not the turnaround executor. Keep him in the strategy seat; automate or absorb the execution rather than routing it back to him.

---

*End of context. When something here conflicts with the live system, trust the live system and update this file.*
