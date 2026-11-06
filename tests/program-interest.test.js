// POST /api/program-interest: the interest form on the USA Self-Study,
// USA Enterprise and Selling to Contractors pages.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ctx, mockFetch } from './helpers.js';
import { onRequestPost, PROGRAMS } from '../functions/api/program-interest.js';

const PROD = 'https://medjay.pro/api/program-interest';
const PREVIEW = 'https://abc123.medjay.pages.dev/api/program-interest';
const ENV = { TURNSTILE_SECRET_KEY: 'test-secret', BREVO_API_KEY: 'test-brevo' };

const valid = (over = {}) => ({
  program: 'usa-real-estate-enterprise',
  name: 'Jane Doe',
  email: 'jane@example.com',
  job_title: 'Sales Manager',
  country: 'United States',
  team_size: '26–50',
  website: '',
  turnstile_token: 'ok',
  ...over,
});

async function post(body, { url = PROD, env = ENV } = {}) {
  const res = await onRequestPost(ctx({ url, body, env }));
  return { status: res.status, data: await res.json() };
}

let fx;
test.beforeEach(() => { fx = mockFetch(); });
test.afterEach(() => fx.restore());

const brevoCalls = () => fx.calls.filter((c) => c.url.includes('api.brevo.com'));

test('valid request: Turnstile checked, one email to steven@medjay.pro with Reply-To and program name', async () => {
  const r = await post(valid());
  assert.equal(r.status, 200);
  assert.equal(r.data.message, 'Thanks, we have your details.');
  assert.equal(fx.calls.filter((c) => c.url.includes('turnstile')).length, 1);
  const b = brevoCalls();
  assert.equal(b.length, 1);
  const sent = JSON.parse(b[0].init.body);
  assert.deepEqual(sent.to, [{ email: 'steven@medjay.pro' }]);
  assert.deepEqual(sent.replyTo, { email: 'jane@example.com', name: 'Jane Doe' });
  assert.equal(sent.subject, 'Program request: MEDJAY Enterprise Brokerage Program: USA Edition (Jane Doe)');
  for (const v of ['Jane Doe', 'jane@example.com', 'Sales Manager', 'United States', '26–50']) assert.ok(sent.htmlContent.includes(v), v);
});

test('every program accepts exactly its own team-size options (checked server-side)', async () => {
  for (const [slug, p] of Object.entries(PROGRAMS)) {
    for (const t of p.teamSizes) {
      const r = await post(valid({ program: slug, team_size: t }), { url: PREVIEW });
      assert.equal(r.status, 200, `${slug}: ${t}`);
    }
  }
  assert.equal((await post(valid({ program: 'usa-real-estate-enterprise', team_size: 'Just me' }))).status, 400);
  assert.equal((await post(valid({ program: 'usa-real-estate', team_size: 'Up to 25' }))).status, 400);
  assert.equal((await post(valid({ program: 'selling-to-contractors', team_size: 'Over 100' }))).status, 400);
  assert.equal(brevoCalls().length, 0);
});

test('team-size lists per program', () => {
  assert.deepEqual(PROGRAMS['usa-real-estate-enterprise'].teamSizes, ['Up to 25', '26–50', '51–100', 'Over 100']);
  const hub = ['Just me', '2–10', '11–50', '50–100', '100–200', '200+'];
  assert.deepEqual(PROGRAMS['usa-real-estate'].teamSizes, hub);
  assert.deepEqual(PROGRAMS['selling-to-contractors'].teamSizes, hub);
  assert.deepEqual(Object.keys(PROGRAMS).sort(), ['selling-to-contractors', 'usa-real-estate', 'usa-real-estate-enterprise']);
});

test('missing fields, bad email, unknown program, over-long values and bad JSON are rejected; nothing sent', async () => {
  for (const k of ['name', 'email', 'job_title', 'country', 'team_size']) {
    const r = await post(valid({ [k]: '' }));
    assert.equal(r.status, 400, k);
  }
  assert.equal((await post(valid({ email: 'not-an-email' }))).status, 400);
  assert.equal((await post(valid({ program: 'usa-real-estate-x' }))).status, 400);
  assert.equal((await post(valid({ program: '__proto__' }))).status, 400);
  assert.equal((await post(valid({ name: 'x'.repeat(101) }))).status, 400);
  assert.equal((await post(valid({ country: 'x'.repeat(101) }))).status, 400);
  assert.equal((await post('{not json')).status, 400);
  assert.equal(fx.calls.length, 0);
});

test('honeypot filled: success message, nothing verified or sent', async () => {
  const r = await post(valid({ website: 'http://spam.example' }));
  assert.equal(r.status, 200);
  assert.equal(r.data.message, 'Thanks, we have your details.');
  assert.equal(fx.calls.length, 0);
});

test('Turnstile: missing token 400, failed check 403, missing secret 500 with the fallback message; nothing sent', async () => {
  assert.equal((await post(valid({ turnstile_token: '' }))).status, 400);
  assert.equal((await post(valid({ turnstile_token: 'bad' }))).status, 403);
  const noSecret = await post(valid(), { env: { BREVO_API_KEY: 'k' } });
  assert.equal(noSecret.status, 500);
  assert.equal(noSecret.data.message, 'Something went wrong. Please try again later, or email steven@medjay.pro.');
  assert.equal(brevoCalls().length, 0);
});

test('missing Brevo key 500 with the fallback message; Brevo failure gives the approved error message', async () => {
  const noKey = await post(valid(), { env: { TURNSTILE_SECRET_KEY: 's' } });
  assert.equal(noKey.status, 500);
  assert.equal(noKey.data.message, 'Something went wrong. Please try again later, or email steven@medjay.pro.');
  fx.restore();
  const orig = globalThis.fetch;
  globalThis.fetch = async (url) => (String(url).includes('turnstile')
    ? new Response(JSON.stringify({ success: true }), { status: 200 })
    : new Response('{}', { status: 500 }));
  try {
    const r = await post(valid());
    assert.equal(r.status, 502);
    assert.equal(r.data.message, 'Something went wrong. Please try again.');
  } finally {
    globalThis.fetch = orig;
    fx = mockFetch();
  }
});

test('preview host: validated, success returned, nothing verified or sent, no personal data logged', async () => {
  const logs = [];
  const orig = console.log;
  console.log = (...a) => logs.push(a.join(' '));
  try {
    const r = await post(valid(), { url: PREVIEW });
    assert.equal(r.status, 200);
  } finally {
    console.log = orig;
  }
  assert.equal(fx.calls.length, 0);
  const all = logs.join('\n');
  for (const v of ['Jane Doe', 'jane@example.com', 'Sales Manager', 'United States']) assert.ok(!all.includes(v), `logged ${v}`);
});

test('HTML is escaped in the email and the subject is a single line', async () => {
  await post(valid({ name: 'Eve <b>\r\nBcc: x@y.z', job_title: '<script>alert(1)</script>' }));
  const sent = JSON.parse(brevoCalls()[0].init.body);
  assert.ok(!sent.htmlContent.includes('<script>'));
  assert.ok(sent.htmlContent.includes('&lt;script&gt;'));
  assert.ok(!/[\r\n]/.test(sent.subject));
  assert.ok(!/[\r\n]/.test(sent.replyTo.name));
});

test('no response from this endpoint says "Server not configured"', () => {
  const src = readFileSync(new URL('../functions/api/program-interest.js', import.meta.url), 'utf8');
  assert.ok(!src.includes('Server not configured'));
});
