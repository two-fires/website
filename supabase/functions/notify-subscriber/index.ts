import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const FROM = "Two Fires <hello@two-fires.com>";
const NOTIFY_TO = "james@two-fires.com";
const RESEND_ENDPOINT = "https://api.resend.com/emails";

// Built-in env injected by Supabase into every edge function.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface SubscriberRecord {
  id?: string;
  email: string;
  source: string;
  sources?: string[];
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
  payload: { to: string; subject: string; text?: string; html?: string },
) {
  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, ...payload }),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, id: body?.id ?? null, body };
}

function prettyTime(raw?: string): string {
  if (!raw) return "just now";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toUTCString();
}

function confirmationHtml(source: string): string {
  const isBlog = source === "blog";
  const bodyParas = isBlog
    ? [
        `We&rsquo;ll let you know when new posts drop. Every piece we publish is grounded in real customer research &mdash; the questions your ideal customers are actually asking online.`,
        `<a href="https://two-fires.com" style="color:#A855F7;text-decoration:none;">two-fires.com</a>`,
      ]
    : [
        `<strong style="color:#ffffff;">Light the Fuse</strong> is coming. We&rsquo;ll send you one email the moment it drops &mdash; no spam, no newsletter, just the launch notification you asked for.`,
        `In the meantime, if you want to see what Two Fires is about, the website is at <a href="https://two-fires.com" style="color:#A855F7;text-decoration:none;">two-fires.com</a>`,
      ];

  const paras = bodyParas
    .map(
      (p) =>
        `<p style="margin:0 0 18px 0;font-size:16px;line-height:1.6;color:#C9C9D4;">${p}</p>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>You're on the list.</title>
</head>
<body style="margin:0;padding:0;background-color:#05050A;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#05050A;">
<tr><td align="center" style="padding:48px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
<tr><td style="padding:0 8px;">
<p style="margin:0 0 40px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#A855F7;">Two Fires</p>
<h1 style="margin:0 0 24px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:30px;line-height:1.2;font-weight:700;color:#ffffff;">You&rsquo;re on the list.</h1>
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
${paras}
</div>
<p style="margin:36px 0 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#ffffff;font-weight:600;">James &amp; Paul &mdash; Two Fires</p>
<hr style="border:none;border-top:1px solid #1c1c28;margin:40px 0 20px 0;">
<p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#6b6b7b;">You&rsquo;re receiving this because you signed up at two-fires.com. That&rsquo;s the only reason.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

// Existing subscriber added a new interest: append the source (dedup) and notify James only.
async function handleUpdate(resendKey: string, email: string, addedSource: string) {
  // Fetch current sources.
  const getRes = await fetch(
    `${SUPABASE_URL}/rest/v1/tf_email_subscribers?email=eq.${encodeURIComponent(email)}&select=sources`,
    { headers: sbHeaders() },
  );
  const rows = (await getRes.json().catch(() => [])) as { sources?: string[] }[];
  const current = rows?.[0]?.sources ?? [];
  const merged = Array.from(new Set([...current, addedSource])); // array_append, dedup

  // Persist the merged sources array.
  await fetch(
    `${SUPABASE_URL}/rest/v1/tf_email_subscribers?email=eq.${encodeURIComponent(email)}`,
    {
      method: "PATCH",
      headers: sbHeaders({ Prefer: "return=minimal" }),
      body: JSON.stringify({ sources: merged }),
    },
  );

  const notify = await sendEmail(resendKey, {
    to: NOTIFY_TO,
    subject: "🔥 Two Fires — existing subscriber updated",
    text:
      `Email: ${email}\n` +
      `Added to: ${addedSource}\n` +
      `Now subscribed to: ${merged.join(" + ")}\n`,
  });
  console.log("update notify(james):", notify.status, notify.id, "sources:", merged.join(","));

  return new Response(
    JSON.stringify({
      ok: notify.ok,
      type: "update",
      sources: merged,
      notify: { status: notify.status, id: notify.id },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

// Brand-new subscriber: notify James + send the branded confirmation.
async function handleNew(resendKey: string, record: SubscriberRecord) {
  const email = record.email;
  const source = record.source ?? "unknown";

  const notify = await sendEmail(resendKey, {
    to: NOTIFY_TO,
    subject: `🔥 New Two Fires subscriber — ${source}`,
    text:
      `Someone just joined the Two Fires list.\n\n` +
      `Email: ${email}\n` +
      `Source: ${source} page\n` +
      `Time: ${prettyTime(record.created_at)}\n`,
  });
  console.log("new notify(james):", notify.status, notify.id);

  const confirm = await sendEmail(resendKey, {
    to: email,
    subject: "You're on the list.",
    html: confirmationHtml(source),
  });
  console.log("new confirm(subscriber):", confirm.status, confirm.id);

  return new Response(
    JSON.stringify({
      ok: notify.ok && confirm.ok,
      type: "new",
      notify: { status: notify.status, id: notify.id },
      confirm: { status: confirm.status, id: confirm.id },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let secrets: Record<string, string>;
  try {
    secrets = await getSecrets();
  } catch (e) {
    console.error("secret load error:", e);
    return new Response(JSON.stringify({ error: "secret load failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const webhookSecret = secrets["WEBHOOK_SECRET"];
  const resendKey = secrets["RESEND_API_KEY"];
  if (!webhookSecret || req.headers.get("x-webhook-secret") !== webhookSecret) {
    console.warn("unauthorized webhook call");
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let payload: { type?: string; email?: string; source?: string; record?: SubscriberRecord };
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "bad payload" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    if (payload.type === "update") {
      if (!payload.email || !payload.source) {
        return new Response(JSON.stringify({ error: "update missing email/source" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      return await handleUpdate(resendKey, payload.email, payload.source);
    }

    // Default: new subscriber.
    const record = payload.record ?? (payload as unknown as SubscriberRecord);
    if (!record?.email) {
      return new Response(JSON.stringify({ error: "no email in record" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    return await handleNew(resendKey, record);
  } catch (e) {
    console.error("handler error:", e);
    return new Response(JSON.stringify({ error: "handler failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
