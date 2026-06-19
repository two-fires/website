// Two Fires — Portal logout. Clears the session cookie.
// POST /api/portal-logout

const COOKIE_NAME = 'tf_portal';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cookie = [
    `${COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Max-Age=0',
  ].join('; ');

  res.setHeader('Set-Cookie', cookie);
  return res.status(200).json({ ok: true });
}
