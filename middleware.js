// Two Fires — Edge middleware portal gate.
//
// Runs before static assets are served. For protected paths it verifies the
// signed `tf_portal` cookie (HMAC-SHA256 over {exp, nonce}, keyed by env
// PORTAL_SESSION_SECRET) and redirects to /portal.html (the login page) when
// the cookie is missing, malformed, expired, or has a bad signature.
//
// Edge runtime cannot use Node `crypto`, so this uses Web Crypto (crypto.subtle)
// with the SAME secret and token format produced by api/portal-auth.js.

const COOKIE_NAME = 'tf_portal';

// Paths that require a valid portal session. Matched by prefix.
const PROTECTED_PREFIXES = ['/insight', '/agent.html', '/ladder'];

export const config = {
  // Only run the middleware on the protected tool paths. The login page
  // (/portal.html), the auth API, the marketing site, images, and all other
  // public assets are never intercepted.
  matcher: ['/insight/:path*', '/agent.html', '/ladder/:path*'],
};

function isProtected(pathname) {
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  );
}

function getCookie(req, name) {
  const header = req.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    if (k === name) return part.slice(idx + 1).trim();
  }
  return null;
}

// base64url -> Uint8Array
function b64urlToBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4;
  if (pad) s += '='.repeat(4 - pad);
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function b64urlToString(s) {
  const bytes = b64urlToBytes(s);
  return new TextDecoder().decode(bytes);
}

function timingSafeEqualBytes(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function verifyToken(token, secret) {
  if (!token) return false;
  const dot = token.indexOf('.');
  if (dot === -1) return false;
  const body = token.slice(0, dot);
  const sigPart = token.slice(dot + 1);
  if (!body || !sigPart) return false;

  let expectedSig;
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    expectedSig = new Uint8Array(
      await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)),
    );
  } catch {
    return false;
  }

  let providedSig;
  try {
    providedSig = b64urlToBytes(sigPart);
  } catch {
    return false;
  }

  if (!timingSafeEqualBytes(expectedSig, providedSig)) return false;

  // Signature valid — check expiry.
  let payload;
  try {
    payload = JSON.parse(b64urlToString(body));
  } catch {
    return false;
  }
  if (!payload || typeof payload.exp !== 'number') return false;
  if (Math.floor(Date.now() / 1000) >= payload.exp) return false;

  return true;
}

export default async function middleware(request) {
  const url = new URL(request.url);

  if (!isProtected(url.pathname)) {
    return; // not a gated path — let it through
  }

  const secret = process.env.PORTAL_SESSION_SECRET;
  if (!secret) {
    // Fail closed: if the gate is misconfigured, deny access to billable tools.
    return new Response('Portal not configured.', { status: 503 });
  }

  const token = getCookie(request, COOKIE_NAME);
  const ok = await verifyToken(token, secret);

  if (ok) return; // authenticated — serve the page

  // Not authenticated — send them to the login page.
  const loginUrl = new URL('/portal.html', url.origin);
  return Response.redirect(loginUrl.toString(), 302);
}
