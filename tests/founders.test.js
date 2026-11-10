// For Founders section: hub, First Customer template, nav, article
// audience tag, 10-day downloads and the exam back link.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

import { ctx } from './helpers.js';
import { onRequestGet as publicArticles } from '../functions/api/articles.js';
import { onRequestGet as adminList, onRequestPost as adminCreate } from '../functions/api/admin/articles.js';
import { onRequestPut as adminUpdate } from '../functions/api/admin/articles/[id].js';
import { onRequest as dl } from '../functions/api/dl.js';
import { onRequestGet as sitemap } from '../functions/sitemap.xml.js';
import { AUDIENCES } from '../functions/_lib/articles.js';
import { hasFile, isCountedFile, daysOf, isCourse, COURSE_NAMES } from '../functions/_lib/courses.js';
import { coursePath, getExam, EXAM_SLUGS } from '../functions/_lib/exam.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === '.git' || name === 'node_modules' || name === 'tests') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

// What a browser shows: <template> content, comments, scripts and styles removed.
function rendered(html) {
  return html
    .replace(/<template[\s\S]*?<\/template>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');
}

// ---------------------------------------------------------------- nav

const NAV = [
  ['/', 'Home'],
  ['/books/', 'Books'],
  ['/info/stevensaad/', 'Info'],
  ['/programs/', 'Programs'],
  ['/courses/', 'Free Courses'],
  ['/founders/', 'Founders'],
  ['/articles/', 'Articles'],
  ['/#contact', 'Contact Us'],
];

test('every copy of the main menu is identical, with Founders between Free Courses and Articles', () => {
  // programs/saas/ is the retired page (301-redirected, old menu kept until removal).
  const files = walk(ROOT)
    .filter((p) => /\.(html|js)$/.test(p))
    .map((p) => p.slice(ROOT.length).replace(/\\/g, '/'))
    .filter((p) => p !== 'programs/saas/index.html' && read(p).includes('<ul class="navlinks">'));
  assert.ok(files.length >= 41, `expected at least 41 menu copies, found ${files.length}`);
  for (const f of files) {
    const menus = [...read(f).matchAll(/<ul class="navlinks">([\s\S]*?)<\/ul>/g)];
    assert.equal(menus.length, 1, `${f}: one menu`);
    const links = [...menus[0][1].matchAll(/<li><a href="([^"]+)">([^<]+)<\/a><\/li>/g)].map((m) => [m[1], m[2]]);
    // The dashboard menu has never had the Books link; everything else matches.
    const expected = f === 'dashboard/index.html' ? NAV.filter(([href]) => href !== '/books/') : NAV;
    assert.deepEqual(links, expected, `${f}: menu differs`);
  }
});

// ---------------------------------------------------------------- hub

test('founders hub: SEO basics, course card, contact line, no placeholders', () => {
  const h = read('founders/index.html');
  assert.ok(h.includes('<link rel="canonical" href="https://medjay.pro/founders/">'));
  assert.ok(h.includes('<meta property="og:url" content="https://medjay.pro/founders/">'));
  assert.ok(h.includes('<meta name="robots" content="index, follow">'));
  assert.equal((h.match(/<h1[\s>]/g) || []).length, 1);
  for (const m of h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(m[1]);

  const main = rendered(h.match(/<main[^>]*>([\s\S]*?)<\/main>/)[1]);
  assert.match(main, /from job seekers to founders/);
  assert.match(main, /<article class="course-card">[\s\S]*?<h3>First Customer<\/h3>[\s\S]*?href="\/founders\/first-customer\/"/);
  assert.equal((main.match(/<article class="course-card">/g) || []).length, 1);
  assert.match(main, /Training a team once you grow\?[\s\S]*?href="\/#contact"[^>]*>Talk to us/);
  assert.ok(!/coming soon|\[\[|lorem/i.test(main), 'no placeholder text');
});

test('founders hub: articles section starts hidden and only asks for founders articles', () => {
  const h = read('founders/index.html');
  assert.match(h, /<div id="founder-articles" hidden>/);
  assert.ok(h.includes("fetch('/api/articles?audience=founders')"));
  assert.ok(!h.includes("fetch('/api/articles')"));
  // Shown only after a non-empty result.
  assert.match(h, /if\(!articles\.length\) return;[\s\S]*box\.hidden = false;/);
});

// ---------------------------------------------------------------- course page

test('first customer page: noindex and out of the sitemap until import; go-live is consistent', async () => {
  const c = read('founders/first-customer/index.html');
  const xml = await (await sitemap({ env: {} })).text();
  const inSitemap = xml.includes('<loc>https://medjay.pro/founders/first-customer/</loc>');
  const indexable = c.includes('<meta name="robots" content="index, follow">');
  const pending = /\[\[[A-Z0-9_]+\]\]/.test(c) || c.includes('<template data-pending');

  assert.ok(xml.includes('<loc>https://medjay.pro/founders/</loc>'), 'hub is in the sitemap');
  assert.ok(!xml.includes('/founders/first-customer/download/'), 'download page never listed');
  assert.equal(inSitemap, indexable, 'sitemap and robots tag must agree');
  if (indexable) {
    assert.ok(!pending, 'page is set to index but import tokens or pending <template> blocks remain');
    assert.ok(getExam('first-customer'), 'live page needs its exam entry');
  } else {
    assert.ok(c.includes('<meta name="robots" content="noindex, follow">'));
  }
});

test('first customer page: before import, nothing unfinished is visible', () => {
  const c = read('founders/first-customer/index.html');
  if (!c.includes('<template data-pending')) return; // already live
  const shown = rendered(c.match(/<main[^>]*>([\s\S]*?)<\/main>/)[1]);
  assert.ok(!shown.includes('[['), 'no import token is rendered');
  assert.ok(!shown.includes('/download/'), 'Download button hidden');
  assert.ok(!shown.includes('/exam/'), 'Exam button hidden');
  assert.match(shown, /<h1[^>]*>First Customer<\/h1>/);
  assert.match(shown, /10 days · Self-study · Free/);
  assert.match(shown, /href="\/#contact"/);
});

test('first customer page: 10-day template, canonical, valid JSON-LD', () => {
  const c = read('founders/first-customer/index.html');
  assert.ok(c.includes('<link rel="canonical" href="https://medjay.pro/founders/first-customer/">'));
  for (let n = 1; n <= 10; n++) assert.ok(c.includes(`<span class="mnum">Day ${n}</span>`), `Day ${n} slot`);
  assert.ok(!c.includes('<span class="mnum">Day 11</span>'));
  assert.ok(c.includes('href="/exam/first-customer"'));
  const graph = JSON.parse(c.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'];
  const course = graph.find((n) => n['@type'] === 'Course');
  assert.equal(course.url, 'https://medjay.pro/founders/first-customer/');
  assert.equal(course.hasCourseInstance.courseSchedule.repeatCount, 10);
});

test('first customer download page: noindex, ten day links and the zip', () => {
  const d = read('founders/first-customer/download/index.html');
  assert.ok(d.includes('<meta name="robots" content="noindex, follow">'));
  for (let n = 1; n <= 10; n++) assert.ok(d.includes(`/api/dl?course=first-customer&amp;file=day-${n}"`));
  assert.ok(d.includes('/api/dl?course=first-customer&amp;file=all"'));
  assert.ok(d.includes("var course = 'first-customer';"));
  assert.ok(!/b2b/i.test(d));
});

// ---------------------------------------------------------------- downloads

test('course files: 5 days by default, 10 for first-customer; days 6-10 are not counted', () => {
  assert.ok(isCourse('first-customer'));
  assert.equal(COURSE_NAMES['first-customer'], 'First Customer');
  assert.equal(daysOf('first-customer'), 10);
  assert.equal(daysOf('b2b-sales-essentials'), 5);
  assert.ok(hasFile('b2b-sales-essentials', 'day-5') && hasFile('b2b-sales-essentials', 'all'));
  assert.ok(!hasFile('b2b-sales-essentials', 'day-6'));
  assert.ok(hasFile('first-customer', 'day-10') && !hasFile('first-customer', 'day-11'));
  assert.ok(!hasFile('nope', 'day-1') && !hasFile('first-customer', 'constructor'));
  assert.ok(isCountedFile('day-5') && isCountedFile('all') && !isCountedFile('day-6'));
});

test('/api/dl: existing courses unchanged; first-customer day 6-10 redirect without a DB write', async () => {
  const sqls = [];
  const env = { DB: { prepare(sql) { sqls.push(sql); return { bind() { return { run: async () => ({}) }; } }; } } };
  const get = (q) => {
    const c = ctx({ url: `https://medjay.pro/api/dl?${q}`, env, method: 'GET' });
    c.request.headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537.36');
    return dl(c);
  };

  let res = await get('course=b2b-sales-essentials&file=day-5');
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('Location'), '/courses/files/b2b-sales-essentials-day-5.pdf');
  assert.equal(sqls.length, 1);

  assert.equal((await get('course=b2b-sales-essentials&file=day-6')).status, 404);
  assert.equal(sqls.length, 1);

  res = await get('course=first-customer&file=day-1');
  assert.equal(res.headers.get('Location'), '/courses/files/first-customer-day-1.pdf');
  assert.equal(sqls.length, 2);

  res = await get('course=first-customer&file=day-10');
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('Location'), '/courses/files/first-customer-day-10.pdf');
  assert.equal(sqls.length, 2, 'day 10 is not written to course_events');

  assert.equal((await get('course=first-customer&file=day-11')).status, 404);
});

// ---------------------------------------------------------------- exam link

test('exam back link: /courses/<slug>/ by default, course_url when set and safe', () => {
  for (const slug of EXAM_SLUGS) {
    if (!getExam(slug).course_url) assert.equal(coursePath(getExam(slug)), `/courses/${slug}/`);
  }
  assert.equal(coursePath({ slug: 'first-customer', course_url: '/founders/first-customer/' }), '/founders/first-customer/');
  for (const bad of ['https://evil.example/', '//evil.example/', '/x"onclick="/', 'founders/', 7]) {
    assert.equal(coursePath({ slug: 'first-customer', course_url: bad }), '/courses/first-customer/');
  }
});

// ---------------------------------------------------------------- article audience

// D1 stand-in over node:sqlite. `migrated: false` is the database as it
// is today, before migrations/0004_article_audience.sql has been run.
const OLD_ARTICLES = `CREATE TABLE articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
  content TEXT NOT NULL, excerpt TEXT NOT NULL DEFAULT '', published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));`;

function articlesDb({ migrated = true } = {}) {
  const raw = new DatabaseSync(':memory:');
  raw.exec(OLD_ARTICLES);
  raw.exec("INSERT INTO articles (slug, title, content, excerpt, published) VALUES ('old-one', 'Old One', 'Body', 'Ex', 1), ('old-draft', 'Old Draft', 'Body', '', 0)");
  if (migrated) raw.exec(read('migrations/0004_article_audience.sql'));
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

const pub = (db, q = '') => publicArticles(ctx({ url: `https://medjay.pro/api/articles${q}`, env: { DB: db }, method: 'GET' }));
const put = (db, id, body) => adminUpdate(ctx({ url: `https://medjay.pro/api/admin/articles/${id}`, env: { DB: db }, params: { id: String(id) }, body, method: 'PUT' }));
const post = (db, body) => adminCreate(ctx({ url: 'https://medjay.pro/api/admin/articles', env: { DB: db }, body }));
const audienceOf = (db, slug) => db.raw.prepare('SELECT audience FROM articles WHERE slug = ?').get(slug).audience;

test('migration 0004: additive, existing articles become general, rollback restores the old table', () => {
  const db = articlesDb({ migrated: false });
  const rows = () => db.raw.prepare('SELECT * FROM articles ORDER BY id').all().map((r) => ({ ...r }));
  const before = rows();
  const sql = read('migrations/0004_article_audience.sql');
  const statements = sql.replace(/--.*$/gm, '').split(';').map((s) => s.trim()).filter(Boolean);
  assert.equal(statements.length, 2);
  assert.match(statements[0], /^ALTER TABLE articles ADD COLUMN audience /);
  assert.match(statements[1], /^CREATE INDEX IF NOT EXISTS idx_articles_audience /);
  assert.ok(!/\b(DROP|DELETE|UPDATE|INSERT)\b/.test(statements.join(';')));

  db.raw.exec(sql);
  const after = rows();
  assert.deepEqual(after.map(({ audience, ...rest }) => rest), before);
  assert.ok(after.every((a) => a.audience === 'general'));
  assert.throws(() => db.raw.exec("UPDATE articles SET audience = 'investors' WHERE id = 1"));
  for (const a of AUDIENCES) db.raw.exec(`UPDATE articles SET audience = '${a}' WHERE id = 1`);

  // The rollback lines from the file's comments.
  const rollback = [...sql.matchAll(/^--\s+((?:DROP INDEX|ALTER TABLE)[^\n]*;)$/gm)].map((m) => m[1]);
  assert.equal(rollback.length, 2);
  db.raw.exec(rollback.join('\n'));
  assert.deepEqual(rows(), before);
});

test('schema.sql articles table matches the migrated table', () => {
  const fresh = new DatabaseSync(':memory:');
  fresh.exec(read('schema.sql'));
  const cols = (d) => d.prepare('PRAGMA table_info(articles)').all().map((c) => `${c.name} ${c.type} ${c.notnull} ${c.dflt_value}`).sort();
  assert.deepEqual(cols(fresh), cols(articlesDb().raw));
});

test('/api/articles: no parameter is the old behaviour; audience filters; bad value is 400', async () => {
  const db = articlesDb();
  await post(db, { title: 'For Founders', content: 'Body', published: true, audience: 'founders' });
  await post(db, { title: 'Founder Draft', content: 'Body', published: false, audience: 'founders' });

  let data = await (await pub(db)).json();
  assert.deepEqual(data.articles.map((a) => a.slug).sort(), ['for-founders', 'old-one']);
  assert.deepEqual(Object.keys(data.articles[0]).sort(),
    ['content', 'created_at', 'excerpt', 'id', 'published', 'slug', 'title', 'updated_at']);

  // The existing /articles/ page calls it with ?published=1.
  data = await (await pub(db, '?published=1')).json();
  assert.equal(data.articles.length, 2);

  data = await (await pub(db, '?audience=founders')).json();
  assert.deepEqual(data.articles.map((a) => a.slug), ['for-founders']);
  data = await (await pub(db, '?audience=general')).json();
  assert.deepEqual(data.articles.map((a) => a.slug), ['old-one']);
  data = await (await pub(db, '?audience=job-seekers')).json();
  assert.deepEqual(data.articles, []);

  assert.equal((await pub(db, '?audience=investors')).status, 400);
  assert.equal((await pub(db, "?audience=founders'%20OR%201=1")).status, 400);
});

test('before migration 0004: /articles/ list, dashboard list, create and edit all keep working', async () => {
  const db = articlesDb({ migrated: false });

  const all = await pub(db);
  assert.equal(all.status, 200);
  assert.equal((await all.json()).articles.length, 1);

  // Founders filter fails cleanly, so the hub keeps its section hidden.
  const filtered = await pub(db, '?audience=founders');
  assert.equal(filtered.status, 500);
  assert.equal((await filtered.json()).articles, undefined);

  const list = await (await adminList(ctx({ url: 'https://medjay.pro/api/admin/articles', env: { DB: db }, method: 'GET' }))).json();
  assert.equal(list.articles.length, 2);
  assert.ok(list.articles.every((a) => a.audience === 'general'));

  assert.equal((await post(db, { title: 'New', content: 'Body', audience: 'general' })).status, 201);
  assert.equal((await post(db, { title: 'New 2', content: 'Body' })).status, 201);
  assert.equal((await post(db, { title: 'New 3', content: 'Body', audience: 'founders' })).status, 409);

  assert.equal((await put(db, 1, { title: 'Old One', slug: 'old-one', content: 'Body 2', published: true, audience: 'general' })).status, 200);
  assert.equal((await put(db, 1, { title: 'Old One', slug: 'old-one', content: 'Body 3', published: true })).status, 200);
  assert.equal((await put(db, 1, { title: 'Old One', slug: 'old-one', content: 'Body 4', published: true, audience: 'founders' })).status, 409);
  assert.equal(db.raw.prepare('SELECT content FROM articles WHERE id = 1').get().content, 'Body 3');
});

test('admin create: audience defaults to general, is saved when sent, unknown value rejected', async () => {
  const db = articlesDb();
  assert.equal((await post(db, { title: 'A', content: 'Body' })).status, 201);
  assert.equal(audienceOf(db, 'a'), 'general');
  assert.equal((await post(db, { title: 'B', content: 'Body', audience: 'job-seekers' })).status, 201);
  assert.equal(audienceOf(db, 'b'), 'job-seekers');
  assert.equal((await post(db, { title: 'C', content: 'Body', audience: 'investors' })).status, 400);

  const list = await (await adminList(ctx({ url: 'https://medjay.pro/api/admin/articles', env: { DB: db }, method: 'GET' }))).json();
  assert.equal(list.articles.find((a) => a.slug === 'b').audience, 'job-seekers');
});

test('admin update: PUT without audience keeps the stored tag; with audience changes it', async () => {
  const db = articlesDb();
  await post(db, { title: 'F', content: 'Body', audience: 'founders' });
  const id = db.raw.prepare("SELECT id FROM articles WHERE slug = 'f'").get().id;

  // The old publish/unpublish toggle body: no audience field.
  let res = await put(db, id, { title: 'F', slug: 'f', excerpt: '', content: 'Body', published: true });
  assert.equal(res.status, 200);
  assert.equal(audienceOf(db, 'f'), 'founders');
  assert.equal(db.raw.prepare("SELECT published FROM articles WHERE slug = 'f'").get().published, 1);

  for (const empty of [undefined, null, '']) {
    await put(db, id, { title: 'F', slug: 'f', content: 'Body', published: false, audience: empty });
    assert.equal(audienceOf(db, 'f'), 'founders');
  }

  res = await put(db, id, { title: 'F', slug: 'f', content: 'Body', published: true, audience: 'job-seekers' });
  assert.equal(res.status, 200);
  assert.equal(audienceOf(db, 'f'), 'job-seekers');

  res = await put(db, id, { title: 'F', slug: 'f', content: 'Body', published: true, audience: 'investors' });
  assert.equal(res.status, 400);
  assert.equal(audienceOf(db, 'f'), 'job-seekers');
});

test('dashboard: audience select, and the publish toggle sends the stored audience', () => {
  const d = read('dashboard/index.html');
  for (const a of AUDIENCES) assert.ok(d.includes(`<option value="${a}"`), `option ${a}`);
  assert.match(d, /audience: audienceInput\.value/);
  const toggle = d.slice(d.indexOf('async function togglePublished'), d.indexOf('async function', d.indexOf('async function togglePublished') + 10));
  assert.match(toggle, /audience: article\.audience/);
});
