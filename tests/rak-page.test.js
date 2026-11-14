// Static checks for the RAK Enterprise sales page
// (programs/rak-real-estate-enterprise/index.html).
// Everything is read from the raw HTML on disk, so it proves the content is
// visible without JavaScript and that the JSON-LD stays valid.
//
// Price is AED 10,000 (~$2,723 USD via Payhip). Both Buy Now buttons point
// at the real Payhip product https://payhip.com/b/HyZWa.
// Do NOT point Buy Now at the existing $4,900 enterprise product.
//
// Hard rule: no learner count anywhere on this page — not in visible text,
// not in JSON-LD, not in meta. Steven explicitly said not to mention it now.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { onRequestGet as sitemap } from '../functions/sitemap.xml.js';

const PAGE_URL = 'https://medjay.pro/programs/rak-real-estate-enterprise/';
const PAYHIP_URL = 'https://payhip.com/b/HyZWa';

const html = readFileSync(new URL('../programs/rak-real-estate-enterprise/index.html', import.meta.url), 'utf8');

function decode(s) {
  return s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    .replace(/&ldquo;/g, '“').replace(/&rdquo;/g, '”').replace(/&rsquo;/g, '’').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–');
}
const visible = (h) => decode(h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const jsonLd = (h) => [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/)[1];

test('rak page: title, canonical, og:url, H1 all name the RAK Edition', () => {
  assert.ok(html.includes('<title>Real Estate Brokerage Training Program (Ras Al Khaimah) | MEDJAY Enterprise</title>'));
  assert.ok(html.includes(`<link rel="canonical" href="${PAGE_URL}">`));
  assert.ok(html.includes(`<meta property="og:url" content="${PAGE_URL}">`));
  assert.match(visible(html), /Build your RAK brokers' sales method in-house\./);
});

test('rak page: AED 10,000 first, about $2,723 in parentheses', () => {
  assert.ok(html.includes('<meta name="description" content="Trainer-led sales training for Ras Al Khaimah brokerages: 10-day onboarding, 12-week curriculum, 20-page playbook. AED 10,000 one-time, perpetual licence.">'));
  assert.ok(html.includes('AED 10,000 one-time (about $2,723)'));
  assert.ok(html.includes('About $2,723, one-time'));
  assert.ok(html.includes('Payment is taken in USD via Payhip at checkout (about $2,723).'));
  assert.ok(!/17,995|29,013|47,375/.test(html), 'no UAE enterprise tier prices');
});

test('rak page: Buy Now primary (hero + pricing), both to the real Payhip product via the modal', () => {
  const buys = [...html.matchAll(/<a href="(https:\/\/payhip\.com\/b\/HyZWa)" class="[^"]*payhip-buy" data-payhip="\1"/g)];
  assert.equal(buys.length, 2, `expected 2 Buy Now buttons, found ${buys.length}`);
  assert.ok(buys.every((b) => b[1] === PAYHIP_URL), 'both buttons link to the real Payhip product');
  assert.ok(html.includes('Buy Now — AED 10,000'));
  assert.ok(html.includes('Buy Now &mdash; AED 10,000'));
  assert.ok(!html.includes('https://payhip.com/b/P8vD9'), 'must not point at the $4,900 enterprise product');
  assert.ok(html.includes('<div class="payhip-overlay" id="payhipOverlay" role="dialog" aria-modal="true" aria-labelledby="payhipTitle"'), 'modal overlay');
  assert.ok(html.includes('<h2 id="payhipTitle">Secure checkout with Payhip</h2>'), 'modal title');
  assert.ok(html.includes('You&rsquo;ll check out securely with Payhip, our payment partner. Your payment is taken in USD, and you&rsquo;ll get instant access to your program as soon as it&rsquo;s complete.'), 'modal body');
  assert.ok(html.includes('<a href="#" target="_blank" rel="noopener" class="payhip-continue" id="payhipContinue">Continue to secure checkout</a>'), 'modal Continue link');
  assert.ok(html.includes('<button type="button" class="payhip-cancel" id="payhipCancel">Cancel</button>'), 'modal Cancel button');
  assert.ok(!html.includes('RAK-PAYHIP-LINK-TODO'), 'no placeholder Payhip link');
  assert.ok(!html.includes('TODO-PAYHIP'), 'no TODO marker in the page source');
  assert.ok(!/payhip/i.test(jsonLd(html).join('')), 'no Payhip in JSON-LD');
});

test('rak page: Discuss more secondary to #contact, no Request a proposal anywhere', () => {
  assert.ok(main.includes('<a href="/#contact" class="btn-ghost">Discuss more</a>'), 'hero Discuss more button');
  assert.ok(!/Request a proposal/i.test(visible(html)), 'no proposal path on this page');
  assert.ok(main.includes('href="/courses/"'), 'links to free courses in main');
  assert.ok(main.includes('href="/#contact"'), 'Discovery Call link in main');
});

test('rak page: no learner count anywhere — visible text, JSON-LD, meta', () => {
  assert.ok(!/learner/i.test(visible(html)), 'visible text must not mention learners');
  assert.ok(!/learner/i.test(jsonLd(html).join('')), 'JSON-LD must not mention learners');
  assert.ok(!/up to \d+/i.test(visible(html)), 'no "up to N" tier wording');
});

test('rak page: JSON-LD parses, Course with a single AED 10,000 offer, BreadcrumbList', () => {
  const blocks = jsonLd(html);
  assert.ok(blocks.length >= 1);
  for (const b of blocks) assert.doesNotThrow(() => JSON.parse(b));
  const graph = JSON.parse(blocks[0])['@graph'];
  const course = graph.filter((n) => n['@type'] === 'Course');
  assert.equal(course.length, 1);
  assert.equal(course[0]['@id'], `${PAGE_URL}#course`);
  assert.equal(course[0].name, 'MEDJAY Enterprise Brokerage Program: RAK Edition');
  assert.equal(course[0].url, PAGE_URL);
  assert.equal(course[0].offers.length, 1);
  assert.equal(course[0].offers[0].price, '10000');
  assert.equal(course[0].offers[0].priceCurrency, 'AED');
  assert.equal(course[0].offers[0].url, PAGE_URL);
  const bc = graph.filter((n) => n['@type'] === 'BreadcrumbList');
  assert.equal(bc.length, 1);
  assert.deepEqual(bc[0].itemListElement, [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://medjay.pro/' },
    { '@type': 'ListItem', position: 2, name: 'Programs', item: 'https://medjay.pro/programs/' },
    { '@type': 'ListItem', position: 3, name: 'RAK Enterprise Brokerage Program', item: PAGE_URL },
  ]);
});

test('rak page: content comes from the verified RAK zip, nothing invented', () => {
  const text = visible(main);
  assert.ok(text.includes('135 files'), 'package file count');
  assert.ok(text.includes('20-page'), 'playbook length');
  assert.ok(text.includes('50-objection matrix'), 'playbook matrix');
  for (const day of [
    'Professional Identity & the Ambivert Advantage',
    'Active Listening & the Discipline of Full Attention',
    'Explanatory Style & Resilience Before the Call',
    'The “No”-Oriented Opener',
    'Insight-Led Selling & Commercial Teaching',
    'Ethical Influence: Consistency, Social Proof & Liking',
    'Physiological Composure Under Pressure',
    'Emotional Intelligence & Reading the Room',
    'Negotiation Fundamentals & the Ackerman System',
    'Full-Cycle Simulation & Graduation',
  ]) assert.ok(text.includes(day), `onboarding day missing: ${day}`);
  for (const week of [
    'The Psychology of First Contact',
    'Trust Engineering & Discovery',
    'Tactical Empathy & Discovery Engineering',
    'The Cold Call Blueprint',
    'Decoding High-Ticket Buyer Avatars',
    'Frame Control & Authority Engineering',
    'The Challenger Reframe — Insight Selling',
    'Financial Persuasion & ROI Mastery',
    'The Objection Handling Matrix',
    'Client Retention & Trust Architecture',
    'Tactical Closing & Deal Acceleration',
    'Grand Master Simulation & Graduation',
  ]) assert.ok(text.includes(week), `week missing: ${week}`);
  assert.ok(text.includes('Pass 48/60 with no critical failure'));
  assert.ok(text.includes('24/30'));
  assert.ok(text.includes('MEDJAY Enterprise Advisor'));
  assert.ok(text.includes('not an accredited qualification or a regulatory licence'));
  assert.ok(!/Day 00|30-Day Ramp Plan|101-page|213 files/.test(text), 'no UAE-edition-only content');
  assert.ok(!/Level 2/i.test(text), 'no "Level 2" in visible text');
});

test('rak page: sitemap lists it with a lastmod date', async () => {
  const xml = await (await sitemap({ env: {} })).text();
  assert.ok(xml.includes(`<loc>${PAGE_URL}</loc>`));
  const block = xml.match(new RegExp(`<url>[\\s\\S]*?<loc>${PAGE_URL.replace(/\//g, '\\/')}</loc>[\\s\\S]*?</url>`));
  assert.ok(block, 'sitemap entry present');
  assert.match(block[0], /<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
});

test('rak page: noscript fallback, exactly one h1, no relative src/href', () => {
  assert.match(html, /<noscript><style>\.reveal\{opacity:1; transform:none;\}<\/style><\/noscript>/);
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
  const stripped = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  for (const m of stripped.matchAll(/\b(?:href|src)="([^"]*)"/g)) {
    assert.match(m[1], /^(\/|#|https?:|mailto:|tel:)/, `relative link: ${m[1]}`);
  }
});

test('rak page: every internal link resolves to a real file', () => {
  const stripped = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  const urls = [...stripped.matchAll(/\b(?:href|src)="([^"]+)"/g)].map((m) => m[1])
    .filter((u) => u.startsWith('/') && !u.startsWith('//'));
  assert.ok(urls.length > 0);
  for (const u of urls) {
    const clean = u.split('#')[0].split('?')[0];
    if (clean === '' || clean === '/') continue;
    const rel = clean.replace(/^\//, '');
    const ok = existsSync(new URL(`../${rel}`, import.meta.url))
      || existsSync(new URL(`../${rel}/index.html`, import.meta.url));
    assert.ok(ok, `${u} does not resolve`);
  }
});

test('uae enterprise page links to the RAK Edition (hero bridge + footer)', () => {
  const uae = readFileSync(new URL('../programs/uae-real-estate-enterprise/index.html', import.meta.url), 'utf8');
  assert.ok(uae.includes('<a href="/programs/rak-real-estate-enterprise/">RAK Edition</a>'), 'hero bridge to RAK');
  assert.ok(uae.includes('<a href="/programs/rak-real-estate-enterprise/">RAK Real Estate: Enterprise</a>'), 'footer link to RAK');
});
