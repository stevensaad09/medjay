import test from 'node:test';
import assert from 'node:assert/strict';
import { makeD1, seedDummyKeys, answersWithScore } from './d1-shim.js';
import { ctx, mockFetch } from './helpers.js';
import { onRequestPost as submit } from '../functions/api/exam/submit.js';
import { onRequestPost as claim } from '../functions/api/exam/claim.js';
import { claimCertificate } from '../functions/_lib/exam-db.js';

const SLUG = 'retail-sales-essentials';
const SUBMIT = 'https://medjay.pro/api/exam/submit';
const CLAIM = 'https://medjay.pro/api/exam/claim';

function setup() {
  const DB = makeD1();
  const key = seedDummyKeys(DB, SLUG);
  const env = { DB, TURNSTILE_SECRET_KEY: 'test-secret', BREVO_API_KEY: 'test-brevo' };
  return { DB, key, env };
}

async function doSubmit(env, body) {
  const c = ctx({ url: SUBMIT, body, env });
  const res = await submit(c);
  return { status: res.status, data: await res.json() };
}
async function doClaim(env, body) {
  const c = ctx({ url: CLAIM, body, env });
  const res = await claim(c);
  await Promise.all(c.waits);
  return { status: res.status, data: await res.json() };
}
async function passAttempt(env, key, score = 16) {
  const r = await doSubmit(env, { course: SLUG, answers: answersWithScore(key, score), turnstile_token: 'ok' });
  assert.equal(r.status, 200);
  assert.equal(r.data.passed, true);
  return r.data.attempt_id;
}

let fx;
test.beforeEach(() => { fx = mockFetch(); });
test.afterEach(() => fx.restore());

// ---------- submit ----------

test('submit: pass at 14 returns only score/total/passed/attempt_id and stores attempt', async () => {
  const { DB, key, env } = setup();
  const r = await doSubmit(env, { course: SLUG, answers: answersWithScore(key, 14), turnstile_token: 'ok' });
  assert.equal(r.status, 200);
  assert.deepEqual(Object.keys(r.data).sort(), ['attempt_id', 'passed', 'score', 'total']);
  assert.equal(r.data.score, 14);
  assert.equal(r.data.total, 20);
  assert.equal(r.data.passed, true);
  const row = DB.raw.prepare('SELECT * FROM exam_attempts WHERE id = ?').get(r.data.attempt_id);
  assert.equal(row.score, 14);
  assert.equal(row.passed, 1);
  assert.equal(row.answers, answersWithScore(key, 14));
  assert.equal(row.certificate_no, null);
});

test('submit: 13 fails, response has no attempt_id and no answer info', async () => {
  const { key, env } = setup();
  const r = await doSubmit(env, { course: SLUG, answers: answersWithScore(key, 13), turnstile_token: 'ok' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data, { score: 13, total: 20, passed: false });
  assert.ok(!JSON.stringify(r.data).includes(key));
});

test('submit: Turnstile required and verified on every submit', async () => {
  const { DB, key, env } = setup();
  const answers = answersWithScore(key, 20);
  assert.equal((await doSubmit(env, { course: SLUG, answers })).status, 400);
  assert.equal((await doSubmit(env, { course: SLUG, answers, turnstile_token: 'bad' })).status, 403);
  assert.equal((await doSubmit({ ...env, TURNSTILE_SECRET_KEY: '' }, { course: SLUG, answers, turnstile_token: 'ok' })).status, 500);
  assert.equal(DB.raw.prepare('SELECT COUNT(*) n FROM exam_attempts').get().n, 0);
  await doSubmit(env, { course: SLUG, answers, turnstile_token: 'ok' });
  await doSubmit(env, { course: SLUG, answers, turnstile_token: 'ok' });
  assert.equal(fx.calls.filter((c) => c.url.includes('turnstile')).length, 3); // bad + 2 ok (missing token and missing secret never call out)
});

test('submit: bad input rejected (unanswered, bad letters, unknown slug, bad JSON)', async () => {
  const { DB, env } = setup();
  const t = 'ok';
  assert.equal((await doSubmit(env, { course: SLUG, answers: 'ABCD'.repeat(4) + 'ABC', turnstile_token: t })).status, 400);
  assert.equal((await doSubmit(env, { course: SLUG, answers: 'ABCD'.repeat(4) + 'ABC ', turnstile_token: t })).status, 400);
  assert.equal((await doSubmit(env, { course: SLUG, answers: 'abcd'.repeat(5), turnstile_token: t })).status, 400);
  assert.equal((await doSubmit(env, { course: SLUG, answers: ['A'], turnstile_token: t })).status, 400);
  assert.equal((await doSubmit(env, { course: 'nope', answers: 'ABCD'.repeat(5), turnstile_token: t })).status, 404);
  assert.equal((await doSubmit(env, '{not json')).status, 400);
  assert.equal((await doSubmit(env, 'null')).status, 400);
  assert.equal(DB.raw.prepare('SELECT COUNT(*) n FROM exam_attempts').get().n, 0);
});

test('submit: missing or incomplete keys -> clean 503, nothing stored', async () => {
  const DB = makeD1();
  const env = { DB, TURNSTILE_SECRET_KEY: 'x' };
  let r = await doSubmit(env, { course: SLUG, answers: 'ABCD'.repeat(5), turnstile_token: 'ok' });
  assert.equal(r.status, 503);
  assert.match(r.data.message, /not available/);
  seedDummyKeys(DB, SLUG);
  DB.raw.prepare('DELETE FROM exam_keys WHERE question_no = 7').run();
  r = await doSubmit(env, { course: SLUG, answers: 'ABCD'.repeat(5), turnstile_token: 'ok' });
  assert.equal(r.status, 503);
  // keys present but exams table missing (migration not applied) -> 503, no crash
  const bare = makeD1({ migrate: false });
  r = await doSubmit({ DB: bare, TURNSTILE_SECRET_KEY: 'x' }, { course: SLUG, answers: 'ABCD'.repeat(5), turnstile_token: 'ok' });
  assert.equal(r.status, 503);
  assert.equal(DB.raw.prepare('SELECT COUNT(*) n FROM exam_attempts').get().n, 0);
});

test('submit: inactive exam -> 503', async () => {
  const { DB, key, env } = setup();
  DB.raw.prepare('UPDATE exams SET active = 0 WHERE course_slug = ?').run(SLUG);
  assert.equal((await doSubmit(env, { course: SLUG, answers: key, turnstile_token: 'ok' })).status, 503);
});

test('submit: refused on preview hosts; localhost works only with EXAM_LOCAL_WRITES=1', async () => {
  const { key, env } = setup();
  const body = { course: SLUG, answers: key };
  let res = await submit(ctx({ url: 'https://abc123.medjay.pages.dev/api/exam/submit', body, env }));
  assert.equal(res.status, 403);
  res = await submit(ctx({ url: 'http://localhost:8788/api/exam/submit', body, env }));
  assert.equal(res.status, 403);
  res = await submit(ctx({ url: 'http://localhost:8788/api/exam/submit', body, env: { ...env, EXAM_LOCAL_WRITES: '1' } }));
  assert.equal(res.status, 200);
  assert.equal((await res.json()).score, 20);
  res = await submit(ctx({ url: 'https://abc123.medjay.pages.dev/api/exam/submit', body, env: { ...env, EXAM_LOCAL_WRITES: '1' } }));
  assert.equal(res.status, 403);
});

// ---------- claim ----------

test('claim: passed attempt creates certificate with correct fields', async () => {
  const { DB, key, env } = setup();
  const id = await passAttempt(env, key, 17);
  const r = await doClaim(env, { course: SLUG, attempt_id: id, full_name: '  Steven   Saad ', email: ' Steven@Example.com ', updates: false });
  assert.equal(r.status, 201);
  assert.match(r.data.certificate_no, /^MJ-RSE-\d{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  assert.equal(r.data.full_name, 'Steven Saad');
  assert.equal(r.data.existing, false);
  assert.equal(r.data.url, `/certificate/${r.data.certificate_no}`);
  assert.ok(!JSON.stringify(r.data).includes('example.com'));
  const c = DB.raw.prepare('SELECT * FROM certificates').get();
  assert.equal(c.email, 'steven@example.com');
  assert.equal(c.score, 17);
  assert.equal(c.attempt_id, id);
  assert.equal(new Date(c.purge_after).getUTCFullYear(), new Date(c.issued_at).getUTCFullYear() + 10);
  assert.equal(DB.raw.prepare('SELECT certificate_no FROM exam_attempts WHERE id = ?').get(id).certificate_no, c.certificate_no);
  // transactional email always sent; list 57 only when ticked
  const brevo = fx.calls.filter((x) => x.url.includes('brevo'));
  assert.equal(brevo.length, 1);
  assert.ok(brevo[0].url.endsWith('/smtp/email'));
  assert.ok(brevo[0].init.body.includes(c.certificate_no));
});

test('claim: updates ticked adds contact to Brevo list 57', async () => {
  const { key, env } = setup();
  const id = await passAttempt(env, key);
  await doClaim(env, { course: SLUG, attempt_id: id, full_name: 'Jane Doe', email: 'jane@example.com', updates: true });
  const list = fx.calls.find((x) => x.url.endsWith('/v3/contacts'));
  assert.ok(list);
  assert.deepEqual(JSON.parse(list.init.body).listIds, [57]);
});

test('claim: Brevo failure does not block the certificate', async () => {
  const { DB, key, env } = setup();
  const id = await passAttempt(env, key);
  fx.restore();
  const orig = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('down'); };
  try {
    const r = await doClaim(env, { course: SLUG, attempt_id: id, full_name: 'Jane Doe', email: 'jane@example.com', updates: true });
    assert.equal(r.status, 201);
    assert.equal(DB.raw.prepare('SELECT COUNT(*) n FROM certificates').get().n, 1);
  } finally {
    globalThis.fetch = orig;
    fx = mockFetch();
  }
});

test('claim: a failed attempt can never claim', async () => {
  const { DB, key, env } = setup();
  const r1 = await doSubmit(env, { course: SLUG, answers: answersWithScore(key, 13), turnstile_token: 'ok' });
  assert.equal(r1.data.attempt_id, undefined);
  const failedId = DB.raw.prepare('SELECT id FROM exam_attempts WHERE passed = 0').get().id;
  const r = await doClaim(env, { course: SLUG, attempt_id: failedId, full_name: 'Jane Doe', email: 'jane@example.com' });
  assert.equal(r.status, 403);
  assert.equal(DB.raw.prepare('SELECT COUNT(*) n FROM certificates').get().n, 0);
});

test('claim: unknown / malformed attempt ids refused', async () => {
  const { DB, env } = setup();
  for (const id of [undefined, '', 'x', crypto.randomUUID(), "' OR 1=1 --"]) {
    const r = await doClaim(env, { course: SLUG, attempt_id: id, full_name: 'Jane Doe', email: 'jane@example.com' });
    assert.equal(r.status, 403, String(id));
  }
  assert.equal(DB.raw.prepare('SELECT COUNT(*) n FROM certificates').get().n, 0);
});

test('claim: attempt cannot be used for another course', async () => {
  const { DB, key, env } = setup();
  seedDummyKeys(DB, 'call-center-essentials');
  const id = await passAttempt(env, key);
  const r = await doClaim(env, { course: 'call-center-essentials', attempt_id: id, full_name: 'Jane Doe', email: 'jane@example.com' });
  assert.equal(r.status, 403);
  assert.equal(DB.raw.prepare('SELECT COUNT(*) n FROM certificates').get().n, 0);
});

test('claim: same attempt, different email is refused; same email returns existing', async () => {
  const { DB, key, env } = setup();
  const id = await passAttempt(env, key);
  const a = await doClaim(env, { course: SLUG, attempt_id: id, full_name: 'Jane Doe', email: 'jane@example.com' });
  assert.equal(a.status, 201);
  const b = await doClaim(env, { course: SLUG, attempt_id: id, full_name: 'Mallory', email: 'mallory@example.com' });
  assert.equal(b.status, 409);
  const c = await doClaim(env, { course: SLUG, attempt_id: id, full_name: 'Jane Other', email: 'JANE@example.com' });
  assert.equal(c.status, 200);
  assert.equal(c.data.existing, true);
  assert.equal(c.data.certificate_no, a.data.certificate_no);
  assert.equal(c.data.full_name, 'Jane Doe');
  assert.equal(DB.raw.prepare('SELECT COUNT(*) n FROM certificates').get().n, 1);
});

test('claim: same email + course via a new attempt returns the existing certificate and consumes the attempt', async () => {
  const { DB, key, env } = setup();
  const id1 = await passAttempt(env, key);
  const id2 = await passAttempt(env, key, 20);
  const a = await doClaim(env, { course: SLUG, attempt_id: id1, full_name: 'Jane Doe', email: 'jane@example.com' });
  const b = await doClaim(env, { course: SLUG, attempt_id: id2, full_name: 'Jane D', email: 'jane@example.com' });
  assert.equal(b.status, 200);
  assert.equal(b.data.existing, true);
  assert.equal(b.data.certificate_no, a.data.certificate_no);
  // id2 is now tied to Jane's certificate: cannot be reused for another email
  const c = await doClaim(env, { course: SLUG, attempt_id: id2, full_name: 'Mallory', email: 'mallory@example.com' });
  assert.equal(c.status, 409);
  assert.equal(DB.raw.prepare('SELECT COUNT(*) n FROM certificates').get().n, 1);
});

test('claim: same email may hold certificates for different courses', async () => {
  const { DB, key, env } = setup();
  const cc = seedDummyKeys(DB, 'call-center-essentials');
  const id1 = await passAttempt(env, key);
  const r2 = await doSubmit(env, { course: 'call-center-essentials', answers: cc, turnstile_token: 'ok' });
  await doClaim(env, { course: SLUG, attempt_id: id1, full_name: 'Jane Doe', email: 'jane@example.com' });
  const b = await doClaim(env, { course: 'call-center-essentials', attempt_id: r2.data.attempt_id, full_name: 'Jane Doe', email: 'jane@example.com' });
  assert.equal(b.status, 201);
  assert.match(b.data.certificate_no, /^MJ-CCE-/);
});

test('claim: invalid name / email rejected', async () => {
  const { key, env } = setup();
  const id = await passAttempt(env, key);
  for (const full_name of ['', 'A', '<b>x</b>', 'x'.repeat(81), 'John 2']) {
    assert.equal((await doClaim(env, { course: SLUG, attempt_id: id, full_name, email: 'a@example.com' })).status, 400);
  }
  for (const email of ['', 'nope', 'a@b', 'a b@example.com']) {
    assert.equal((await doClaim(env, { course: SLUG, attempt_id: id, full_name: 'Jane Doe', email })).status, 400);
  }
  const ar = await doClaim(env, { course: SLUG, attempt_id: id, full_name: 'ستيفن سعد', email: 'a@example.com' });
  assert.equal(ar.status, 201);
  assert.equal(ar.data.full_name, 'ستيفن سعد');
});

test('claim: certificate number collision is retried', async () => {
  const { DB, key, env } = setup();
  const id1 = await passAttempt(env, key);
  const id2 = await passAttempt(env, key);
  const codes = ['AAAAAA', 'AAAAAA', 'BBBBBB'];
  const code = () => codes.shift();
  const a = await claimCertificate(DB, { attemptId: id1, slug: SLUG, fullName: 'Jane Doe', email: 'jane@example.com', code });
  const b = await claimCertificate(DB, { attemptId: id2, slug: SLUG, fullName: 'John Roe', email: 'john@example.com', code });
  assert.equal(a.status, 'created');
  assert.equal(b.status, 'created');
  assert.ok(a.cert.certificate_no.endsWith('-AAAAAA'));
  assert.ok(b.cert.certificate_no.endsWith('-BBBBBB'));
  assert.equal(DB.raw.prepare('SELECT certificate_no FROM exam_attempts WHERE id = ?').get(id2).certificate_no, b.cert.certificate_no);
});

test('claim: gives the attempt back if the insert keeps failing', async () => {
  const { DB, key, env } = setup();
  const id = await passAttempt(env, key);
  DB.failNext = (sql) => sql.includes('INSERT INTO certificates');
  await assert.rejects(claimCertificate(DB, { attemptId: id, slug: SLUG, fullName: 'Jane Doe', email: 'jane@example.com' }));
  assert.equal(DB.raw.prepare('SELECT certificate_no FROM exam_attempts WHERE id = ?').get(id).certificate_no, null);
  const ok = await claimCertificate(DB, { attemptId: id, slug: SLUG, fullName: 'Jane Doe', email: 'jane@example.com' });
  assert.equal(ok.status, 'created');
});

test('claim: refused on preview hosts', async () => {
  const { key, env } = setup();
  const id = await passAttempt(env, key);
  const res = await claim(ctx({ url: 'https://abc.medjay.pages.dev/api/exam/claim', body: { course: SLUG, attempt_id: id, full_name: 'Jane Doe', email: 'j@example.com' }, env }));
  assert.equal(res.status, 403);
});

test('no SQL string concatenation of user input in exam code', async () => {
  const { readFileSync } = await import('node:fs');
  for (const f of ['../functions/_lib/exam-db.js', '../functions/api/exam/submit.js', '../functions/api/exam/claim.js']) {
    const src = readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.ok(!/prepare\(\s*`[^`]*\$\{/.test(src), f);
  }
});
