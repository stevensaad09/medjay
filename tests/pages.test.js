import test from 'node:test';
import assert from 'node:assert/strict';
import { makeD1, seedDummyKeys } from './d1-shim.js';
import { ctx } from './helpers.js';
import { claimCertificate } from '../functions/_lib/exam-db.js';
import { onRequestGet as certPage } from '../functions/certificate/[number].js';
import { onRequestGet as verifyPage } from '../functions/verify/[number].js';
import { onRequestGet as examPage } from '../functions/exam/[slug].js';
import { LINKEDIN_COMPANY_ID, LINKEDIN_COMPANY_URL, LINKEDIN_PROFILE_URL } from '../functions/_lib/exam.js';

const SLUG = 'store-manager-essentials';

async function seedCert(DB, fullName, email = 'secret.person@example.com') {
  seedDummyKeys(DB, SLUG);
  const id = crypto.randomUUID();
  DB.raw.prepare(`INSERT INTO exam_attempts (id, course_slug, answers, score, passed, created_at)
    VALUES (?, ?, ?, 18, 1, ?)`).run(id, SLUG, 'A'.repeat(20), new Date().toISOString());
  const r = await claimCertificate(DB, { attemptId: id, slug: SLUG, fullName, email, now: '2026-11-05T09:00:00.000Z' });
  return r.cert.certificate_no;
}

async function get(handler, path, env, params) {
  const res = await handler(ctx({ url: 'https://medjay.pro' + path, env, params, method: 'GET' }));
  return { res, html: await res.text() };
}

test('certificate page: name, course, date, number, verify line, signature; no email, no score', async () => {
  const DB = makeD1();
  const no = await seedCert(DB, "Zoë O'Brien-Hassan");
  const { res, html } = await get(certPage, `/certificate/${no}`, { DB }, { number: no });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('X-Robots-Tag'), 'noindex, nofollow');
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  assert.ok(html.includes('Certificate of Completion'));
  assert.ok(html.includes('Zoë O&#39;Brien-Hassan'));
  assert.ok(html.includes('has successfully completed'));
  assert.ok(html.includes('Store Manager Essentials — Level 1'));
  assert.ok(html.includes(`Issued: 5 November 2026 · Certificate No: ${no}`));
  assert.ok(html.includes(`Verify at medjay.pro/verify/${no}`));
  assert.ok(html.includes('Steven Saad, Founder, MEDJAY'));
  assert.ok(html.includes('https://www.linkedin.com/profile/add?'));
  assert.ok(html.includes('@page{size:A4 landscape'));
  assert.ok(!html.includes('secret.person'));
  assert.ok(!/18\s*\/\s*20|Score/i.test(html));
});

test('certificate page: Add to LinkedIn profile link carries the company id', async () => {
  assert.ok(LINKEDIN_COMPANY_ID.length > 0, 'LINKEDIN_COMPANY_ID must not be empty');
  const DB = makeD1();
  const no = await seedCert(DB, 'Jane Doe');
  const { html } = await get(certPage, `/certificate/${no}`, { DB }, { number: no });
  const m = html.match(/href="(https:\/\/www\.linkedin\.com\/profile\/add\?[^"]+)"[^>]*>Add to LinkedIn profile</);
  assert.ok(m, 'Add to LinkedIn profile link is on the page');
  const u = new URL(m[1].replace(/&amp;/g, '&'));
  assert.equal(u.searchParams.get('organizationId'), LINKEDIN_COMPANY_ID);
  assert.equal(u.searchParams.get('organizationName'), null);
  assert.equal(u.searchParams.get('certId'), no);
});

test('certificate + verify escape hostile names (defence in depth)', async () => {
  const DB = makeD1();
  const no = await seedCert(DB, 'Jane Doe');
  DB.raw.prepare('UPDATE certificates SET full_name = ? WHERE certificate_no = ?').run('<img src=x onerror=alert(1)>"', no);
  for (const [h, p] of [[certPage, '/certificate/'], [verifyPage, '/verify/']]) {
    const { html } = await get(h, p + no, { DB }, { number: no });
    assert.ok(!html.includes('<img src=x'), p);
    assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;&quot;'), p);
  }
});

test('verify page: valid, shows issuer links, never email', async () => {
  const DB = makeD1();
  const no = await seedCert(DB, 'محمد عبدالله');
  const { res, html } = await get(verifyPage, `/verify/${no}`, { DB }, { number: no });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('X-Robots-Tag'), 'noindex, nofollow');
  assert.ok(html.includes('محمد عبدالله'));
  assert.ok(html.includes('>Valid<'));
  assert.ok(html.includes('Store Manager Essentials — Level 1'));
  assert.ok(html.includes('5 November 2026'));
  assert.ok(html.includes('Issued by <a href="' + LINKEDIN_COMPANY_URL));
  assert.ok(html.includes(LINKEDIN_PROFILE_URL));
  assert.ok(!html.includes('secret.person'));
});

test('verify + certificate: revoked status', async () => {
  const DB = makeD1();
  const no = await seedCert(DB, 'Jane Doe');
  DB.raw.prepare('UPDATE certificates SET revoked = 1 WHERE certificate_no = ?').run(no);
  let { html } = await get(verifyPage, `/verify/${no}`, { DB }, { number: no });
  assert.ok(html.includes('>Revoked<'));
  ({ html } = await get(certPage, `/certificate/${no}`, { DB }, { number: no }));
  assert.ok(html.includes('has been revoked'));
  assert.ok(!html.includes('Certificate of Completion'));
});

test('unknown and malformed numbers: 404, noindex; malformed never hits the DB', async () => {
  const DB = makeD1();
  let r = await get(verifyPage, '/verify/MJ-RSE-2026-ZZZZZZ', { DB }, { number: 'MJ-RSE-2026-ZZZZZZ' });
  assert.equal(r.res.status, 404);
  assert.equal(r.res.headers.get('X-Robots-Tag'), 'noindex, nofollow');
  assert.ok(r.html.includes('Certificate not found'));
  const before = DB.calls.length;
  for (const bad of ['x', "MJ-RSE-2026-' OR 1=1", 'MJ-RSE-2026-0000OO', '<script>']) {
    r = await get(verifyPage, '/verify/x', { DB }, { number: bad });
    assert.equal(r.res.status, 404);
    r = await get(certPage, '/certificate/x', { DB }, { number: bad });
    assert.equal(r.res.status, 404);
  }
  assert.equal(DB.calls.length, before);
});

test('lower-case number redirects to the canonical upper-case URL', async () => {
  const DB = makeD1();
  const { res } = await get(verifyPage, '/verify/mj-rse-2026-abcdef', { DB }, { number: 'mj-rse-2026-abcdef' });
  assert.equal(res.status, 301);
  assert.equal(res.headers.get('Location'), '/verify/MJ-RSE-2026-ABCDEF');
});

test('exam page: 20 questions in JSON order, Turnstile, no answer data', async () => {
  const { res, html } = await get(examPage, '/exam/retail-sales-essentials', {}, { slug: 'retail-sales-essentials' });
  assert.equal(res.status, 200);
  assert.equal((html.match(/<fieldset class="question"/g) || []).length, 20);
  assert.equal((html.match(/type="radio"/g) || []).length, 80);
  assert.ok(html.indexOf('id="q1"') < html.indexOf('id="q2"'));
  assert.ok(html.includes('class="cf-turnstile"'));
  assert.ok(html.includes('challenges.cloudflare.com/turnstile'));
  assert.ok(html.includes('Send me MEDJAY updates and new courses'));
  assert.ok(!/id="updates"[^>]*checked/.test(html));
  assert.ok(html.includes('href="/privacy/"'));
  assert.ok(!/answer_key|exam_keys|"correct"|correct:/i.test(html.replace(/<p class="stem">[\s\S]*?<\/p>|<span class="opt-text">[\s\S]*?<\/span>/g, '')));
  const missing = await get(examPage, '/exam/nope', {}, { slug: 'nope' });
  assert.equal(missing.res.status, 404);
});

test('exam pages: noindex, follow in meta and X-Robots-Tag; back link kept; 404 is noindex, nofollow', async () => {
  for (const slug of ['retail-sales-essentials', 'sales-manager-essentials']) {
    const { res, html } = await get(examPage, `/exam/${slug}`, {}, { slug });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('X-Robots-Tag'), 'noindex, follow');
    assert.match(html, /<meta name="robots" content="noindex, follow">/);
    assert.ok(!/content="index, follow"/.test(html));
    assert.ok(html.includes(`href="/courses/${slug}/"`));
  }
  const missing = await get(examPage, '/exam/nope', {}, { slug: 'nope' });
  assert.equal(missing.res.status, 404);
  assert.equal(missing.res.headers.get('X-Robots-Tag'), 'noindex, nofollow');
  assert.match(missing.html, /<meta name="robots" content="noindex, nofollow">/);
});
