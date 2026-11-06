// Static checks for the Programs area SEO batch P1 (programs, homepage, books,
// info, articles and the renamed "Selling to Contractors" page).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { onRequestGet as sitemap } from '../functions/sitemap.xml.js';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const PROGRAM_PAGES = [
  'programs/usa-real-estate/index.html',
  'programs/usa-real-estate-enterprise/index.html',
  'programs/uae-real-estate/index.html',
  'programs/uae-real-estate-enterprise/index.html',
  'programs/selling-to-contractors/index.html',
];
const CHANGED = [...PROGRAM_PAGES, 'programs/index.html', 'index.html', 'books/index.html', 'info/stevensaad/index.html', 'articles/index.html'];
const NEW_URL = 'https://medjay.pro/programs/selling-to-contractors';
const OLD_NAME = /contractor\s+sales\s+mastery|contractor-sales-mastery/i;

function decode(s) {
  return s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
}
const visible = (h) => decode(h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const jsonLd = (h) => [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules' || n === '.git') continue;
    const p = join(dir, n);
    statSync(p).isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
}

// ---- 1. noscript fallback
for (const p of CHANGED) {
  test(`noscript fallback on ${p}`, () => {
    assert.match(read(p), /<noscript><style>\.reveal\{opacity:1; transform:none;\}<\/style><\/noscript>/);
  });
}

// ---- 2. exactly one H1
for (const p of CHANGED) {
  test(`exactly one h1 on ${p}`, () => {
    assert.equal((read(p).match(/<h1[\s>]/g) || []).length, 1);
  });
}

// ---- 3. hub
test('hub has For Individuals and For Companies with the right cards', () => {
  const h = read('programs/index.html');
  assert.match(h, /<h1[^>]*>Sales Training Programs\.<br>One Method\.<\/h1>/);
  assert.ok(!/Five Programs/.test(h));
  const ind = h.match(/<h2[^>]*>For Individuals<\/h2>([\s\S]*?)<h2[^>]*>For Companies<\/h2>/);
  assert.ok(ind, 'For Individuals before For Companies');
  const com = h.match(/<h2[^>]*>For Companies<\/h2>([\s\S]*?)class="free-card/);
  assert.ok(com, 'For Companies section');
  const links = (x) => [...x.matchAll(/class="kit-link" aria-label="[^"]*" ?>|href="(\/programs\/[a-z-]+)" class="kit-link"/g)].map((m) => m[1]).filter(Boolean);
  assert.deepEqual(links(ind[1]), ['/programs/usa-real-estate', '/programs/uae-real-estate']);
  assert.deepEqual(links(com[1]), ['/programs/usa-real-estate-enterprise', '/programs/uae-real-estate-enterprise', '/programs/selling-to-contractors']);
  assert.match(h, /Customize Your Course/);
  assert.match(h, /id="customize-form"/);
  assert.match(h, /href="\/courses\/" class="btn-ghost">Browse free courses/);
});

// ---- 4. old name gone
test('old program name appears nowhere except _redirects and tests', () => {
  const hits = walk(ROOT).filter((p) => /\.(html|js|json|md|xml|webmanifest)$/.test(p) && !p.includes('/tests/') && !p.endsWith('/_redirects'))
    .filter((p) => OLD_NAME.test(readFileSync(p, 'utf8')));
  assert.deepEqual(hits, []);
  for (const p of CHANGED) assert.ok(!OLD_NAME.test(visible(read(p))) && !OLD_NAME.test(jsonLd(read(p)).join('')), p);
  assert.ok(!existsSync(join(ROOT, 'programs/contractor-sales-mastery')), 'old folder moved');
});

// ---- 5. sitemap
test('sitemap lists the new route and not the old one', async () => {
  const xml = await (await sitemap({ env: {} })).text();
  assert.ok(xml.includes(`<loc>${NEW_URL}</loc>`));
  assert.ok(!xml.includes('contractor-sales-mastery'));
});

// ---- 6. redirects
test('_redirects sends the three old paths to the new route with 301', () => {
  const r = read('_redirects');
  for (const from of ['/programs/contractor-sales-mastery', '/programs/contractor-sales-mastery/', '/programs/contractor-sales-mastery/index.html']) {
    assert.ok(r.split('\n').includes(`${from} /programs/selling-to-contractors 301`), from);
  }
  assert.ok(existsSync(join(ROOT, 'programs/selling-to-contractors/index.html')));
});

// ---- 7. canonical
test('construction page canonical and og:url are the new URL', () => {
  const h = read('programs/selling-to-contractors/index.html');
  assert.ok(h.includes(`<link rel="canonical" href="${NEW_URL}">`));
  assert.ok(h.includes(`<meta property="og:url" content="${NEW_URL}">`));
  assert.match(h, /<title>Selling to Contractors/);
  assert.match(visible(h), /trainer-led program licensed to companies/);
});

// ---- 8. internal links resolve
const redirectSources = () => read('_redirects').split('\n').filter((l) => l.startsWith('/')).map((l) => l.split(/\s+/)[0]);
function functionRoutes() {
  const base = join(ROOT, 'functions');
  return walk(base).map((p) => p.slice(base.length).replace(/\.js$/, '')).filter((p) => !p.startsWith('/_'))
    .map((p) => p.replace(/\/index$/, '') || '/');
}
function resolves(path) {
  const clean = path.split('#')[0].split('?')[0];
  if (clean === '' || clean === '/') return true;
  if (redirectSources().includes(clean)) return true;
  const rel = clean.replace(/^\//, '');
  const cands = [rel, `${rel}/index.html`, `${rel}.html`];
  if (cands.some((c) => existsSync(join(ROOT, c)) && statSync(join(ROOT, c)).isFile())) return true;
  const trimmed = clean.replace(/\/$/, '');
  return functionRoutes().some((r) => {
    const re = new RegExp('^' + r.replace(/\[[^\]]+\]/g, '[^/]+') + '$');
    return re.test(trimmed);
  });
}
for (const p of CHANGED) {
  test(`internal links resolve on ${p}`, () => {
    const h = read(p).replace(/<script[\s\S]*?<\/script>/gi, '');
    const urls = [...h.matchAll(/\b(?:href|src)="([^"]+)"/g)].map((m) => m[1]).filter((u) => u.startsWith('/') && !u.startsWith('//'));
    assert.ok(urls.length > 0);
    for (const u of urls) assert.ok(resolves(u), `${p}: ${u} does not resolve`);
  });
}

// ---- 9. JSON-LD
for (const p of CHANGED) {
  test(`JSON-LD parses on ${p}`, () => {
    const b = jsonLd(read(p));
    assert.ok(b.length >= 1);
    for (const x of b) assert.doesNotThrow(() => JSON.parse(x));
  });
}

// ---- 10. no relative src/href
for (const p of CHANGED) {
  test(`no relative src/href on ${p}`, () => {
    const h = read(p).replace(/<script[\s\S]*?<\/script>/gi, '');
    for (const m of h.matchAll(/\b(?:href|src)="([^"]*)"/g)) {
      assert.match(m[1], /^(\/|#|https?:|mailto:|tel:)/, `${p}: ${m[1]}`);
    }
  });
}

// ---- 11. program pages link to free courses and Discovery Call
for (const p of PROGRAM_PAGES) {
  test(`${p} links to /courses/ and /#contact in main`, () => {
    const main = read(p).match(/<main[^>]*>([\s\S]*?)<\/main>/)[1];
    assert.ok(main.includes('href="/courses/"'));
    assert.ok(main.includes('href="/#contact"'));
  });
}
test('homepage links to /programs and to every program', () => {
  const h = read('index.html');
  const sec = h.match(/<section id="programs">([\s\S]*?)<\/section>/)[1];
  for (const u of ['/programs', ...PROGRAM_PAGES.map((p) => '/' + p.replace('/index.html', ''))]) assert.ok(sec.includes(`href="${u}"`), u);
});

// ---- 12. no Level 2 of the free courses
for (const p of CHANGED) {
  test(`no "Level 2" on ${p} (except the contractor program's own level)`, () => {
    let t = visible(read(p));
    if (p.includes('selling-to-contractors')) t = t.replace(/Level 2 Intermediate/g, '');
    assert.ok(!/Level 2/i.test(t));
  });
}
