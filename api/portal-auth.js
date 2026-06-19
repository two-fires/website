// Two Fires — Portal authentication (server-side).
//
// POST /api/portal-auth  { password }
//   - Validates password against env PORTAL_PASSWORD using a constant-time compare.
//   - On success, sets a signed httpOnly cookie (HMAC-SHA256 over {exp, nonce}
//     keyed by env PORTAL_SESSION_SECRET) valid for ~7 days.
//   - Fails closed (500) if either env var is unset.
//
// Node serverless function (uses Node `crypto`). The matching verifier in
// middleware.js uses Web Crypto with the SAME secret + token format.

import crypto from 'node:crypto';

const COOKIE_NAME = 'tf_portal';
const MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

// base64url helpers
function b64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Build a signed token: base64url(JSON{exp,nonce}) + "." + base64url(HMAC)
function signToken(secret) {
  const payload = {
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS,
    nonce: crypto.randomBytes(16).toString('hex'),
  };
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', secret).update(body).digest();
  return `${body}.${b64url(sig)}`;
}

// Constant-time string compare that does not leak length via early return.
function timingSafeEqualStr(a, b) {
  const ab = Buffer.from(String(a), 'utf8');
  const bb = Buffer.from(String(b), 'utf8');
  // Hash both to fixed length so timingSafeEqual never throws on length diff
  // and length is not revealed by the comparison itself.
  const ha = crypto.createHash('sha256').update(ab).digest();
  const hb = crypto.createHash('sha256').update(bb).digest();
  return crypto.timingSafeEqual(ha, hb);
}

async function readBody(req) {
  // Vercel Node functions usually populate req.body; fall back to raw stream.
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      try { return JSON.parse(req.body); } catch { return {}; }
    }
    return req.body;
  }
  return await new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; });
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const PORTAL_PASSWORD = process.env.PORTAL_PASSWORD;
  const PORTAL_SESSION_SECRET = process.env.PORTAL_SESSION_SECRET;

  // Fail closed if not configured.
  if (!PORTAL_PASSWORD || !PORTAL_SESSION_SECRET) {
    return res.status(500).json({ error: 'Portal auth not configured.' });
  }

  const body = await readBody(req);
  const password = body && typeof body.password === 'string' ? body.password : '';

  if (!password || !timingSafeEqualStr(password, PORTAL_PASSWORD)) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }

  const token = signToken(PORTAL_SESSION_SECRET);

  const cookie = [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${MAX_AGE_SECONDS}`,
  ].join('; ');

  res.setHeader('Set-Cookie', cookie);
  return res.status(200).json({ ok: true });
}
