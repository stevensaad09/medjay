// Shared Cloudflare Turnstile helpers (same check as /api/comments).
// Not a route: exports no onRequest handlers.

export const TURNSTILE_SITE_KEY = '0x4AAAAAAEdGei9y6nHiNLdP';
// Cloudflare's public test site key (always passes). Used only when the
// page is served from localhost, where the real key is not allowed.
export const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA';

export function siteKeyFor(request) {
  const host = new URL(request.url).hostname;
  return host === 'localhost' || host === '127.0.0.1' ? TURNSTILE_TEST_SITE_KEY : TURNSTILE_SITE_KEY;
}

// Returns 'ok', 'missing', 'failed', 'unconfigured' or 'error'.
export async function verifyTurnstile(request, env, token) {
  if (!token || typeof token !== 'string') return 'missing';
  if (!env.TURNSTILE_SECRET_KEY) return 'unconfigured';
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET_KEY,
        response: token,
        remoteip: request.headers.get('CF-Connecting-IP') || '',
      }),
    });
    const data = await res.json().catch(() => ({}));
    return data.success ? 'ok' : 'failed';
  } catch (err) {
    return 'error';
  }
}
