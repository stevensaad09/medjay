// AI visibility basics: llms.txt at the site root and the Organization /
// Person entity schema (sameAs + founder credential) on the hub pages and
// the server-rendered article pages.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

import { ctx } from './helpers.js';
import { onRequestGet as sitemap } from '../functions/sitemap.xml.js';
import { onRequestGet as articlePage } from '../functions/articles/[slug].js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const SAME_AS = [
  'https://www.linkedin.com/company/medjay-physcology-training/',
  'https://www.youtube.com/@StevenSaadConsultant',
  'https://www.instagram.com/medjay.pro/',
];

// Every link llms.txt must carry, in order. Keep this list in sync with
// llms.txt; every URL here was verified live (200) before the file shipped.
const EXPECTED_LINKS = [
  'https://medjay.pro/',
  'https://medjay.pro/programs/',
  'https://medjay.pro/articles/first-day-at-work-what-to-do',
  'https://medjay.pro/articles/first-week-at-work-how-to-settle-in',
  'https://medjay.pro/articles/first-month-at-work-how-to-prove-yourself',
  'https://medjay.pro/articles/what-happens-after-you-get-your-real-estate-license',
  'https://medjay.pro/articles/how-to-become-a-real-estate-agent-in-dubai',
  'https://medjay.pro/courses/retail-sales-essentials/',
  'https://medjay.pro/courses/counter-sales-essentials/',
  'https://medjay.pro/courses/tele-sales-essentials/',
  'https://medjay.pro/courses/b2b-sales-essentials/',
  'https://medjay.pro/courses/customer-service-essentials/',
  'https://medjay.pro/courses/call-center-essentials/',
  'https://medjay.pro/courses/team-leader-essentials/',
  'https://medjay.pro/courses/assistant-manager-essentials/',
  'https://medjay.pro/courses/store-manager-essentials/',
  'https://medjay.pro/courses/area-manager-essentials/',
  'https://medjay.pro/courses/sales-manager-essentials/',
  'https://medjay.pro/founders/first-customer/',
  'https://medjay.pro/programs/usa-real-estate-video/',
  'https://medjay.pro/programs/uae-real-estate-video/',
  'https://medjay.pro/programs/rak-real-estate-enterprise/',
  'https://medjay.pro/programs/selling-to-contractors/',
  'https://medjay.pro/books/',
];

function llmsLinks(txt) {
  return [...txt.matchAll(/\]\((https:\/\/medjay\.pro[^)]*)\)/g)].map((m) => m[1]);
}

function jsonLd(html) {
  const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(m, 'page carries a JSON-LD block');
  return JSON.parse(m[1]);
}

function nodeOf(doc, type) {
  const node = doc['@graph'].find((n) => n['@type'] === type);
  assert.ok(node, `${type} node is present in the JSON-LD graph`);
  return node;
}

// ---------------------------------------------------------------- llms.txt

test('llms.txt: served from the repo root, H1 + summary, curated links only', () => {
  assert.ok(existsSync(join(ROOT, 'llms.txt')), 'llms.txt exists at the repo root (Cloudflare Pages serves root files as static assets)');
  const txt = read('llms.txt');
  assert.ok(txt.startsWith('# MEDJAY\n'), 'starts with an H1 naming the brand');
  assert.match(txt, /^> MEDJAY is a sales psychology training brand/m, 'summary blockquote describes MEDJAY');
  assert.deepEqual(llmsLinks(txt), EXPECTED_LINKS, 'links are exactly the curated set, in order');
  for (const line of txt.split('\n')) {
    if (line.startsWith('- [')) assert.match(line, /\]\(https:\/\/medjay\.pro[^)]*\): \S/, `every link carries a one-line description: ${line}`);
  }
});

test('llms.txt: every linked URL is a real page; llms.txt itself is not a page', async () => {
  const xml = await (await sitemap({ env: {} })).text();
  // Articles are DB-rendered, so the sitemap only lists them when a DB is
  // present; their slugs are checked against the published list instead.
  const publishedArticleSlugs = [
    'first-day-at-work-what-to-do',
    'first-week-at-work-how-to-settle-in',
    'first-month-at-work-how-to-prove-yourself',
    'what-happens-after-you-get-your-real-estate-license',
    'how-to-become-a-real-estate-agent-in-dubai',
  ];
  for (const url of EXPECTED_LINKS) {
    const path = new URL(url).pathname;
    if (path.startsWith('/articles/') && path !== '/articles/') {
      assert.ok(publishedArticleSlugs.includes(path.replace('/articles/', '').replace(/\/$/, '')), `published article slug: ${url}`);
      continue;
    }
    assert.ok(xml.includes(`<loc>${url}</loc>`), `sitemap lists ${url}`);
    assert.ok(existsSync(join(ROOT, path, 'index.html')) || path === '/', `page file exists for ${url}`);
  }
  assert.ok(!xml.includes('llms.txt'), 'llms.txt is a map file, not a sitemap page');
});

// ---------------------------------------------------------------- entity schema

const HUB_PAGES = ['index.html', 'programs/index.html', 'founders/index.html', 'articles/index.html'];

for (const page of HUB_PAGES) {
  test(`entity schema on ${page}: Organization sameAs + founder credential`, () => {
    const doc = jsonLd(read(page));
    const org = nodeOf(doc, 'Organization');
    assert.equal(org['@id'], 'https://medjay.pro/#organization');
    assert.equal(org.name, 'MEDJAY');
    assert.deepEqual(org.sameAs, SAME_AS, 'Organization links the brand profiles');
    const person = nodeOf(doc, 'Person');
    assert.equal(person['@id'], 'https://medjay.pro/#founder');
    assert.equal(person.name, 'Steven Saad');
    assert.equal(person.hasCredential, 'IBCT Associate Trainer');
    assert.ok(person.sameAs.includes('https://linkedin.com/in/steven-saad'), 'founder still links his personal LinkedIn');
  });
}

// ------------------------------------------------------- article renderer

const ARTICLES_TABLE = `CREATE TABLE articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
  content TEXT NOT NULL, excerpt TEXT NOT NULL DEFAULT '', published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));`;

function articlesDb() {
  const raw = new DatabaseSync(':memory:');
  raw.exec(ARTICLES_TABLE);
  raw.exec("INSERT INTO articles (slug, title, content, excerpt, published) VALUES ('test-article', 'Test Article', 'First paragraph.\n\nSecond paragraph.', 'Test excerpt', 1)");
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    all: async () => ({ results: raw.prepare(sql).all(...args) }),
    first: async () => raw.prepare(sql).get(...args) ?? null,
    run: async () => {
      const r = raw.prepare(sql).run(...args);
      return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
    },
  });
  return { raw, prepare: (sql) => stmt(sql) };
}

test('article page: rendered JSON-LD carries the same Organization sameAs and founder credential', async () => {
  const db = articlesDb();
  const res = await articlePage(ctx({ url: 'https://medjay.pro/articles/test-article', env: { DB: db }, params: { slug: 'test-article' }, method: 'GET' }));
  assert.equal(res.status, 200);
  const html = await res.text();
  const doc = jsonLd(html);
  assert.deepEqual(nodeOf(doc, 'Organization').sameAs, SAME_AS);
  assert.equal(nodeOf(doc, 'Person').hasCredential, 'IBCT Associate Trainer');
  const post = nodeOf(doc, 'BlogPosting');
  assert.equal(post.author['@id'], 'https://medjay.pro/#founder');
  assert.equal(post.publisher['@id'], 'https://medjay.pro/#organization');
});
