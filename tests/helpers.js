// Fake Pages Functions context + fetch mock for tests.
export function ctx({ url, body, env, params = {}, method = 'POST' }) {
  const waits = [];
  const init = { method, headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.9' } };
  if (body !== undefined) init.body = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    request: new Request(url, init),
    env,
    params,
    waitUntil: (p) => waits.push(p),
    waits,
  };
}

// Records outbound calls; Turnstile succeeds unless token === 'bad'.
export function mockFetch() {
  const calls = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    calls.push({ url: u, init });
    if (u.includes('turnstile')) {
      const token = new URLSearchParams(init.body).get('response');
      return new Response(JSON.stringify({ success: token !== 'bad' }), { status: 200 });
    }
    if (u.includes('api.brevo.com')) return new Response('{}', { status: 201 });
    throw new Error('unexpected fetch ' + u);
  };
  return { calls, restore: () => { globalThis.fetch = orig; } };
}
