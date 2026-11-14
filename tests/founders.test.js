// For Founders section: hub, First Customer course and download pages,
// nav, article audience tag and 10-day downloads.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
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
import { hasFile, isCountedFile, daysOf, isCourse, COURSE_NAMES, COURSE_SLUGS, FILES } from '../functions/_lib/courses.js';
import { getExam, EXAM_SLUGS } from '../functions/_lib/exam.js';

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
  const files = walk(ROOT)
    .filter((p) => /\.(html|js)$/.test(p))
    .map((p) => p.slice(ROOT.length).replace(/\\/g, '/'))
    .filter((p) => read(p).includes('<ul class="navlinks">'));
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
  assert.match(main, /<article class="course-card">[\s\S]*?<h3>First Customer<\/h3>[\s\S]*?href="\/founders\/first-customer\/"[^>]*>Start free</);
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

const DAY_TITLES = [
  'Target Customer and Buying Trigger',
  'Finding the First Buyers: Networks, Communities, and Signals',
  'The Opener That Earns Attention',
  'Discovery: Validate the Problem with Past Behavior',
  'The Offer and Pricing for First Customers',
  'The First-Customer Offer: Pilots and Launch Deals',
  'Presenting the Offer with A.I.M.',
  'Handling Objections with A.R.T.',
  'The Close: From Yes to Payment',
  'Pipeline, Follow-Up Cadence, and Activity Math',
];

const FC_PAGES = ['founders/first-customer/index.html', 'founders/first-customer/download/index.html'];

function text(fragment) {
  return rendered(fragment).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

test('first customer pages are finished: no import tokens, pending blocks or placeholder notes', () => {
  for (const f of [...FC_PAGES, 'founders/index.html']) {
    const h = read(f);
    assert.ok(!/\[\[[^\]]*\]\]/.test(h), `${f}: import token left`);
    assert.ok(!/<template\b/i.test(h), `${f}: <template> block left`);
    assert.ok(!/IMPORT FROM SCC|GO-LIVE|data-pending|provisional|coming soon|lorem/i.test(h), `${f}: placeholder note left`);
  }
});

test('first customer page: live, indexable, in the sitemap; download page stays noindex and unlisted', async () => {
  const c = read(FC_PAGES[0]);
  const xml = await (await sitemap({ env: {} })).text();
  assert.ok(c.includes('<meta name="robots" content="index, follow">'));
  assert.ok(c.includes('<link rel="canonical" href="https://medjay.pro/founders/first-customer/">'));
  assert.ok(c.includes('<meta property="og:url" content="https://medjay.pro/founders/first-customer/">'));
  assert.ok(xml.includes('<loc>https://medjay.pro/founders/</loc>'));
  assert.ok(xml.includes('<loc>https://medjay.pro/founders/first-customer/</loc>'));
  assert.ok(!xml.includes('/founders/first-customer/download/'));
  assert.ok(read(FC_PAGES[1]).includes('<meta name="robots" content="noindex, follow">'));
});

test('first customer has no exam and no certificate, anywhere', () => {
  assert.equal(getExam('first-customer'), null);
  assert.equal(EXAM_SLUGS.length, 22); // 11 Level 1 + 11 Level 2
  assert.ok(!read('functions/_data/exam-questions.json').includes('first-customer'));
  assert.ok(!/FCU/.test(read('migrations/0003_exams.sql') + read('migrations/0005_level2_exams.sql') + read('schema.sql')));
  for (const f of FC_PAGES) {
    const h = read(f);
    assert.ok(!/\bexams?\b|certificat|Level 1|\/exam\/|MJ-FCU/i.test(h), `${f}: exam or certificate mention`);
  }
  assert.ok(!/\bexams?\b|certificat/i.test(text(read('founders/index.html').match(/<main[^>]*>([\s\S]*?)<\/main>/)[1])));
});

test('first customer page: ten days with the guide titles, full content, download button', () => {
  const c = read(FC_PAGES[0]);
  const main = c.match(/<main[^>]*>([\s\S]*?)<\/main>/)[1];
  assert.equal((c.match(/<h1[\s>]/g) || []).length, 1);
  assert.match(main, /<h1[^>]*>First Customer<\/h1>/);
  assert.match(main, /10 days · Self-study · Free/);
  assert.match(main, /in English/);
  assert.ok(!/anywhere|global|minutes/i.test(text(main)), 'no "global" claim and no time per day');

  const days = [...main.matchAll(/<span class="mnum">Day (\d+)<\/span>\s*<h3>([^<]+)<\/h3>\s*<p>([^<]+)<\/p>/g)];
  assert.deepEqual(days.map((m) => Number(m[1])), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(days.map((m) => m[2].replace(/&amp;/g, '&')), DAY_TITLES);
  const items = main.split('<span class="mnum">Day ').slice(1);
  for (const [i, item] of items.entries()) {
    for (const label of ['What you’ll learn:', 'How you’ll think:', 'Stretch goal:', 'What’s inside:']) {
      assert.ok(item.includes(`<strong>${label}</strong>`), `Day ${i + 1}: ${label}`);
    }
    assert.match(item, /a self-check quiz/, `Day ${i + 1}: self-check quiz`);
  }

  assert.equal((main.match(/<section id="outcomes">[\s\S]*?<\/section>/)[0].match(/<li>/g) || []).length, 10);
  for (const id of ['who', 'outcomes', 'days', 'how', 'reading', 'faq', 'teams']) assert.ok(main.includes(`<section id="${id}">`), id);
  for (const id of ['exam', 'related']) assert.ok(!main.includes(`<section id="${id}">`), `no ${id} section`);
  assert.equal((main.match(/Voss/g) || []).filter(Boolean).length >= 1, true);
  assert.equal((main.match(/Never Split the Difference/g) || []).length, 1, 'Voss cited once in Further reading');
  assert.ok(main.includes('Voss, C., &amp; Raz, T. (2016), Never Split the Difference: Negotiating As If Your Life Depended On It'));

  const links = [...rendered(main).matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(links)].sort(), ['/#contact', '/founders/', '/founders/first-customer/download/']);
  assert.ok(text(main).split(' ').length >= 700, 'page has real content');
});

test('first customer page: JSON-LD is valid, 10 days, syllabus matches the day titles', () => {
  const c = read(FC_PAGES[0]);
  const graph = JSON.parse(c.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'];
  const course = graph.find((n) => n['@type'] === 'Course');
  assert.equal(course.name, 'First Customer');
  assert.equal(course.url, 'https://medjay.pro/founders/first-customer/');
  assert.equal(course.isAccessibleForFree, true);
  assert.equal(course.hasCourseInstance.courseSchedule.repeatCount, 10);
  assert.deepEqual(course.syllabusSections.map((s) => s.name), DAY_TITLES.map((t, i) => `Day ${i + 1}: ${t}`));
  assert.ok(course.syllabusSections.every((s) => s.description.length > 40));
  const crumbs = graph.find((n) => n['@type'] === 'BreadcrumbList').itemListElement.map((i) => i.item);
  assert.deepEqual(crumbs, ['https://medjay.pro/', 'https://medjay.pro/founders/', 'https://medjay.pro/founders/first-customer/']);
});

test('first customer download page: noindex, ten titled day links and the zip', () => {
  const d = read(FC_PAGES[1]);
  for (const [i, title] of DAY_TITLES.entries()) {
    const n = i + 1;
    assert.ok(d.includes(`/api/dl?course=first-customer&amp;file=day-${n}"`), `day ${n} link`);
    assert.ok(d.includes(`<span class="label"><b>Day ${n}:</b> ${title}</span>`), `day ${n} title`);
  }
  assert.ok(d.includes('/api/dl?course=first-customer&amp;file=all"'));
  assert.ok(d.includes("var course = 'first-customer';"));
  assert.ok(d.includes('href="/founders/first-customer/"') && d.includes('href="/founders/"'));
  assert.ok(!/b2b/i.test(d));
});

test('every download link of every course points at a file that exists (PDF or zip)', () => {
  for (const slug of COURSE_SLUGS) {
    for (const file of Object.keys(FILES)) {
      if (!hasFile(slug, file)) continue;
      const path = `courses/files/${slug}${FILES[file]}`;
      assert.ok(existsSync(join(ROOT, path)), `${path} is missing`);
      const head = readFileSync(join(ROOT, path)).subarray(0, 4).toString('latin1');
      assert.equal(head, file === 'all' ? 'PK\x03\x04' : '%PDF', `${path}: wrong file type`);
    }
  }
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
