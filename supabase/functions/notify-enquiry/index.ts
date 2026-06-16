import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const FROM = "Two Fires <hello@two-fires.com>";
const NOTIFY_TO = "james@two-fires.com";
const RESEND_ENDPOINT = "https://api.resend.com/emails";

// Built-in env injected by Supabase into every edge function.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface EnquiryRecord {
  id?: string;
  name: string;
  email: string;
  company?: string | null;
  message: string;
  created_at?: string;
}

function sbHeaders(extra: Record<string, string> = {}) {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function getSecrets(): Promise<Record<string, string>> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_app_secrets`, {
    method: "POST",
    headers: sbHeaders(),
    body: "{}",
  });
  if (!res.ok) throw new Error(`secret fetch failed: ${res.status}`);
  return (await res.json()) ?? {};
}

async function sendEmail(
  apiKey: string,
  payload: { to: string; subject: string; text?: string; html?: string; replyTo?: string },
) {
  const { replyTo, ...rest } = payload;
  const body: Record<string, unknown> = { from: FROM, ...rest };
  if (replyTo) body.reply_to = replyTo;
  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const resBody = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, id: resBody?.id ?? null, body: resBody };
}

function prettyTime(raw?: string): string {
  if (!raw) return "just now";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toUTCString();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Warm, short, on-brand confirmation to the enquirer.
function enquiryConfirmationHtml(name: string): string {
  const first = escapeHtml((name || "").trim().split(/\s+/)[0] || "there");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>We've got it.</title>
</head>
<body style="margin:0;padding:0;background-color:#05050A;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#05050A;">
<tr><td align="center" style="padding:48px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
<tr><td style="padding:0 8px;">
<p style="margin:0 0 40px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#A855F7;">Two Fires</p>
<h1 style="margin:0 0 24px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:30px;line-height:1.2;font-weight:700;color:#ffffff;">We&rsquo;ve got it.</h1>
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<p style="margin:0 0 18px 0;font-size:16px;line-height:1.6;color:#C9C9D4;">Thanks ${first}. Your message just landed with us. One of us reads every message that comes in, personally.</p>
<p style="margin:0 0 18px 0;font-size:16px;line-height:1.6;color:#C9C9D4;">Give us up to two business days and you&rsquo;ll hear back from one of us with a real reply.</p>
</div>
<p style="margin:36px 0 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#ffffff;font-weight:600;">James and Paul, Two Fires</p>
<hr style="border:none;border-top:1px solid #1c1c28;margin:40px 0 20px 0;">
<p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#6b6b7b;">You&rsquo;re receiving this because you contacted us at two-fires.com.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let secrets: Record<string, string>;
  try {
    secrets = await getSecrets();
  } catch (e) {
    console.error("secret load error:", e);
    return new Response(JSON.stringify({ error: "secret load failed" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }

  const webhookSecret = secrets["WEBHOOK_SECRET"];
  const resendKey = secrets["RESEND_API_KEY"];
  if (!webhookSecret || req.headers.get("x-webhook-secret") !== webhookSecret) {
    console.warn("unauthorized webhook call");
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  let payload: { type?: string; record?: EnquiryRecord };
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "bad payload" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  const record = payload.record ?? (payload as unknown as EnquiryRecord);
  if (!record?.email || !record?.name || !record?.message) {
    return new Response(JSON.stringify({ error: "missing name/email/message" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  const company = record.company && String(record.company).trim()
    ? String(record.company).trim() : null;
  const subject = company
    ? `Enquiry from ${record.name} at ${company}`
    : `Enquiry from ${record.name}`;

  try {
    // a) Alert James. Reply-to set to the enquirer so he can reply straight back.
    const notify = await sendEmail(resendKey, {
      to: NOTIFY_TO,
      replyTo: record.email,
      subject,
      text:
        `New enquiry from the two-fires.com contact form.\n\n` +
        `Name: ${record.name}\n` +
        `Email: ${record.email}\n` +
        `Company: ${company ?? "(not provided)"}\n` +
        `Time: ${prettyTime(record.created_at)}\n\n` +
        `Message:\n${record.message}\n`,
    });
    console.log("enquiry notify(james):", notify.status, notify.id);

    // b) Confirm to the enquirer.
    const confirm = await sendEmail(resendKey, {
      to: record.email,
      subject: "We've got it.",
      html: enquiryConfirmationHtml(record.name),
    });
    console.log("enquiry confirm(sender):", confirm.status, confirm.id);

    return new Response(
      JSON.stringify({
        ok: notify.ok && confirm.ok,
        notify: { status: notify.status, id: notify.id },
        confirm: { status: confirm.status, id: confirm.id },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("handler error:", e);
    return new Response(JSON.stringify({ error: "handler failed" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
