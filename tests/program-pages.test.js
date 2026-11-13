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
const NEW_URL = 'https://medjay.pro/programs/selling-to-contractors/';
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
  const links = (x) => [...x.matchAll(/class="kit-link" aria-label="[^"]*" ?>|href="(\/programs\/[a-z-]+\/)" class="kit-link"/g)].map((m) => m[1]).filter(Boolean);
  assert.deepEqual(links(ind[1]), ['/programs/usa-real-estate/', '/programs/uae-real-estate/']);
  assert.deepEqual(links(com[1]), ['/programs/usa-real-estate-enterprise/', '/programs/uae-real-estate-enterprise/', '/programs/selling-to-contractors/']);
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
    assert.ok(r.split('\n').includes(`${from} /programs/selling-to-contractors/ 301`), from);
  }
  assert.ok(existsSync(join(ROOT, 'programs/selling-to-contractors/index.html')));
});

test('_redirects sends the three retired saas paths to /programs/ with 301 (one hop)', () => {
  const r = read('_redirects').split('\n');
  for (const from of ['/programs/saas', '/programs/saas/', '/programs/saas/index.html']) {
    assert.ok(r.includes(`${from} /programs/ 301`), from);
  }
});

test('every _redirects target is the final slash-form URL of an existing folder page', () => {
  for (const line of read('_redirects').split('\n').filter((l) => l.startsWith('/'))) {
    const [, to, code] = line.split(/\s+/);
    assert.equal(code, '301');
    assert.ok(to.endsWith('/'), `${line}: target must end with /`);
    assert.ok(existsSync(join(ROOT, to.slice(1), 'index.html')), `${line}: target has no index.html`);
  }
});

// ---- 7. canonical
test('construction page canonical and og:url are the new URL', () => {
  const h = read('programs/selling-to-contractors/index.html');
  assert.ok(h.includes(`<link rel="canonical" href="${NEW_URL}">`));
  assert.ok(h.includes(`<meta property="og:url" content="${NEW_URL}">`));
  assert.match(h, /<title>Selling to Contractors/);
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
// No P2 page has a Discovery Call link in main: all three P2 pages offer
// Buy Now plus a "Discuss more" link to the kept interest form. The UAE
// pages (P3) keep their Discovery Call link for now.
const P2_SLUGS = ['usa-real-estate', 'usa-real-estate-enterprise', 'selling-to-contractors'];
for (const p of PROGRAM_PAGES) {
  test(`${p} links to /courses/ in main (and /#contact unless it has the interest form)`, () => {
    const main = read(p).match(/<main[^>]*>([\s\S]*?)<\/main>/)[1];
    assert.ok(main.includes('href="/courses/"'));
    if (P2_SLUGS.some((s) => p === `programs/${s}/index.html`)) assert.ok(!main.includes('href="/#contact"'), 'Discovery Call link removed');
    else assert.ok(main.includes('href="/#contact"'));
  });
}
test('homepage links to /programs and to every program', () => {
  const h = read('index.html');
  const sec = h.match(/<section id="programs">([\s\S]*?)<\/section>/)[1];
  for (const u of ['/programs/', ...PROGRAM_PAGES.map((p) => '/' + p.replace('index.html', ''))]) assert.ok(sec.includes(`href="${u}"`), u);
});

// ---- 12. no Level 2 of the free courses
for (const p of CHANGED) {
  test(`no "Level 2" on ${p} (except the contractor program's own level)`, () => {
    let t = visible(read(p));
    if (p.includes('selling-to-contractors')) t = t.replace(/Level 2(: Intermediate|: Leading the Team|: Fairness and Integrity| teaches team leads)/g, '');
    assert.ok(!/Level 2/i.test(t));
  });
}

// ---- Trailing-slash alignment (SEO batch P2)
// Cloudflare Pages serves folder/index.html at /folder/ and 308-redirects /folder there,
// so every sitemap URL, canonical and internal link must use the slash form.
const FUNCTION_ROUTE_FILES = ['functions/articles/[slug].js', 'functions/_lib/site.js'];

function allFiles() {
  return walk(ROOT).map((p) => p.slice(ROOT.length).replace(/\\/g, '/').replace(/^\//, ''))
    .filter((p) => !p.startsWith('tests/') && !p.startsWith('node_modules/') && !p.startsWith('.git/'));
}

test('every sitemap URL equals the canonical (and og:url) of its page', async () => {
  const xml = await (await sitemap({ env: {} })).text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.ok(locs.length >= 23);
  for (const loc of locs) {
    const path = new URL(loc).pathname;
    const file = join(ROOT, path === '/' ? 'index.html' : path.replace(/^\//, '') + 'index.html');
    assert.ok(existsSync(file), `${loc}: no index.html for this sitemap URL`);
    const h = readFileSync(file, 'utf8');
    assert.ok(h.includes(`<link rel="canonical" href="${loc}">`), `${loc}: canonical differs`);
    assert.ok(h.includes(`<meta property="og:url" content="${loc}">`), `${loc}: og:url differs`);
    // A JSON-LD url or @id that points at the page itself must use the slash form.
    for (const m of h.matchAll(/"(?:url|@id)": "(https:\/\/medjay\.pro\/[^"#]*)(?:#[^"]*)?"/g)) {
      if (path !== '/' && m[1].replace(/\/$/, '') === loc.replace(/\/$/, '')) assert.equal(m[1], loc, `${loc}: JSON-LD ${m[1]}`);
    }
  }
});

test('no internal href to a folder page lacks the trailing slash', () => {
  const files = allFiles().filter((p) => (p.endsWith('.html') && p !== 'programs/saas/index.html') || FUNCTION_ROUTE_FILES.includes(p));
  const bad = [];
  for (const f of files) {
    const src = readFileSync(join(ROOT, f), 'utf8');
    for (const m of src.matchAll(/href="(\/[^"#?]*)(?:[#?][^"]*)?"/g)) {
      const path = m[1];
      if (path === '/' || path.endsWith('/') || /\.[a-z0-9]+$/i.test(path)) continue;
      if (existsSync(join(ROOT, path.slice(1), 'index.html'))) bad.push(`${f}: ${path}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('article-not-found page has a 404 status and no canonical or og:url', async () => {
  const { onRequestGet } = await import('../functions/articles/[slug].js');
  const env = { DB: { prepare: () => ({ bind: () => ({ first: async () => null }) }) } };
  const res = await onRequestGet({ env, params: { slug: 'nope' } });
  assert.equal(res.status, 404);
  const html = await res.text();
  assert.ok(!/rel="canonical"/.test(html));
  assert.ok(!/og:url/.test(html));
  assert.match(html, /<h1[^>]*>Article not found<\/h1>/);
});

// ---- P2: rewritten USA Self-Study, USA Enterprise and Selling to Contractors pages
import { PROGRAMS } from '../functions/api/program-interest.js';

const ORIGIN_P = 'https://medjay.pro/programs/';
const HUB_TEAM = ['Just me', '2–10', '11–50', '50–100', '100–200', '200+'];
const P2 = {
  'usa-real-estate': {
    h1: 'MEDJAY Elite Training: USA Self-Study Edition',
    title: 'USA Real Estate Sales Training for Agents | MEDJAY Self-Study',
    desc: '12-week self-study sales psychology program for US real estate agents. Weekly study guides, AI role-play practice, monthly assessments and a 93-page Sales Playbook. $347.',
    crumb: 'USA Real Estate Self-Study',
    button: 'Discuss more',
    note: 'We will reply to discuss the program with you. We use these details only to reply about this program.',
    teams: HUB_TEAM,
    faqs: 6,
    course: {"@type":"Course","@id":"https://medjay.pro/programs/usa-real-estate/#course","name":"MEDJAY Elite Training: USA Self-Study Edition","description":"12-week self-study sales psychology program for independent US residential agents: discovery, compliant cold calling, objections and closing.","url":"https://medjay.pro/programs/usa-real-estate/","provider":{"@id":"https://medjay.pro/#organization"},"creator":{"@id":"https://medjay.pro/#founder"},"inLanguage":"en","timeRequired":"P12W","offers":{"@type":"Offer","price":"347","priceCurrency":"USD","category":"Paid","availability":"https://schema.org/InStock","url":"https://medjay.pro/programs/usa-real-estate/"}},
  },
  'usa-real-estate-enterprise': {
    h1: 'MEDJAY Enterprise Brokerage Program: USA Edition',
    title: 'Real Estate Brokerage Training Program (USA) | MEDJAY Enterprise',
    desc: 'Trainer-led sales training for US brokerages: 10-day onboarding, 12-week core curriculum, 93-page Sales Playbook, 30-Day Ramp Plan. Perpetual internal license.',
    crumb: 'USA Enterprise Brokerage Program',
    button: 'Request a proposal',
    note: "We will reply to schedule a short call to discuss your team's needs. We use these details only to reply about this program.",
    teams: ['Up to 25', '26–50', '51–100', 'Over 100'],
    faqs: 5,
    course: {"@type":"Course","@id":"https://medjay.pro/programs/usa-real-estate-enterprise/#course","name":"MEDJAY Enterprise Brokerage Program: USA Edition","description":"Trainer-led sales enablement for US residential brokerages: 10-day onboarding, 12-week curriculum, sales playbook and a certification day.","url":"https://medjay.pro/programs/usa-real-estate-enterprise/","provider":{"@id":"https://medjay.pro/#organization"},"creator":{"@id":"https://medjay.pro/#founder"},"inLanguage":"en","timeRequired":"P12W","audience":{"@type":"BusinessAudience","audienceType":"US residential real estate brokerages"}},
  },
  'selling-to-contractors': {
    h1: 'Selling to Contractors',
    title: 'Selling to Contractors: Sales Training for Distribution &amp; Rental Teams (USA) | MEDJAY',
    desc: 'Trainer-led sales program for US distribution and rental teams that sell to contractors: 3 levels, 30 days, role-plays, final exams and certificates of completion.',
    crumb: 'Selling to Contractors',
    button: 'Request a proposal',
    note: "We will reply to schedule a short call to discuss your team's needs. We use these details only to reply about this program.",
    teams: HUB_TEAM,
    faqs: 5,
    course: {"@type":"Course","@id":"https://medjay.pro/programs/selling-to-contractors/#course","name":"Selling to Contractors","description":"Trainer-led sales program for US industrial distribution and rental teams selling to contractors: 3 levels, 30 days, role-plays and certificates.","url":"https://medjay.pro/programs/selling-to-contractors/","provider":{"@id":"https://medjay.pro/#organization"},"creator":{"@id":"https://medjay.pro/#founder"},"inLanguage":"en","audience":{"@type":"BusinessAudience","audienceType":"US industrial distribution and rental teams"}},
  },
};
const pageOf = (slug) => read(`programs/${slug}/index.html`);
const mainOfP = (h) => h.match(/<main[^>]*>([\s\S]*?)<\/main>/)[1];
const sectionOf = (h, id) => { const m = h.match(new RegExp(`<section id="${id}">([\\s\\S]*?)</section>`)); assert.ok(m, `section #${id}`); return m[1]; };
const graphOf = (h) => JSON.parse(jsonLd(h)[0])['@graph'];
const attrDecode = (s) => s.replace(/&#39;/g, "'").replace(/&amp;/g, '&');

for (const [slug, c] of Object.entries(P2)) {
  test(`P2 ${slug}: H1, unchanged title, new meta/og/twitter description`, () => {
    const h = pageOf(slug);
    const h1 = h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)[1];
    assert.equal(visible(h1), c.h1);
    assert.ok(h.includes(`<title>${c.title}</title>`), 'title unchanged');
    const d = c.desc.replace(/&/g, '&amp;');
    assert.ok(h.includes(`<meta name="description" content="${d}">`));
    assert.ok(h.includes(`<meta property="og:description" content="${d}">`));
    assert.ok(h.includes(`<meta name="twitter:description" content="${d}">`));
  });

  test(`P2 ${slug}: Course JSON-LD unchanged, BreadcrumbList added with slash URLs, no FAQPage`, () => {
    const graph = graphOf(pageOf(slug));
    const course = graph.filter((n) => n['@type'] === 'Course');
    assert.equal(course.length, 1);
    assert.deepEqual(course[0], c.course, 'Course node is byte-for-byte the pre-P2 node');
    const bc = graph.filter((n) => n['@type'] === 'BreadcrumbList');
    assert.equal(bc.length, 1);
    assert.deepEqual(bc[0].itemListElement, [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://medjay.pro/' },
      { '@type': 'ListItem', position: 2, name: 'Programs', item: 'https://medjay.pro/programs/' },
      { '@type': 'ListItem', position: 3, name: c.crumb, item: `${ORIGIN_P}${slug}/` },
    ]);
    assert.ok(!graph.some((n) => ['FAQPage', 'Question'].includes(n['@type'])));
    const offers = JSON.stringify(graph).match(/"@type":"Offer"/g) || [];
    assert.equal(offers.length, slug === 'usa-real-estate' ? 1 : 0, 'no new Offer');
  });

  test(`P2 ${slug}: interest form fields, button, note, honeypot, Turnstile and team-size options`, () => {
    const h = pageOf(slug);
    const f = sectionOf(h, 'request').match(/<form id="interest-form"[\s\S]*?<\/form>/);
    assert.ok(f, 'form inside #request');
    const form = f[0];
    assert.ok(form.includes(`<input type="hidden" name="program" value="${slug}">`));
    for (const name of ['name', 'email', 'job_title', 'country']) {
      assert.match(form, new RegExp(`<input [^>]*name="${name}" required`), `${name} required`);
    }
    assert.match(form, /<select id="interest-team-size" name="team_size" required>/);
    assert.match(form, /<label for="interest-name">Full name<\/label>/);
    assert.match(form, /<label for="interest-email">Email<\/label>/);
    assert.match(form, /<label for="interest-job-title">Job title<\/label>/);
    assert.match(form, /<label for="interest-country">Country<\/label>/);
    assert.match(form, /<label for="interest-team-size">Team size<\/label>/);
    assert.match(form, /name="website" tabindex="-1"/, 'honeypot');
    assert.match(form, /class="cf-turnstile" data-sitekey="0x4AAAAAAEdGei9y6nHiNLdP"/);
    assert.ok(h.includes('<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>'));
    assert.ok(form.includes(`<button type="submit" class="btn-primary">${c.button}</button>`));
    assert.ok(attrDecode(form).includes(`<p class="pp-form-note">${c.note}</p>`));
    const opts = [...form.matchAll(/<option value="([^"]*)"/g)].map((m) => m[1]).filter(Boolean);
    assert.deepEqual(opts, c.teams, 'team-size options on the page');
    assert.deepEqual(PROGRAMS[slug].teamSizes, c.teams, 'server-side list matches the page');
    assert.match(h, /fetch\('\/api\/program-interest'/);
    assert.match(h, /<noscript><p class="pp-form-note">Please turn on JavaScript to send this form, or email <a href="mailto:steven@medjay.pro">steven@medjay.pro<\/a>\.<\/p><\/noscript>/);
  });

}

const CONTRACTOR_BUY = {
  'Level 1': 'https://payhip.com/b/BNEAT',
  'Level 2': 'https://payhip.com/b/u90Xw',
  'Level 3': 'https://payhip.com/b/hzk6p',
  'All 3 Levels': 'https://payhip.com/b/pt9ck',
};

test('Selling to Contractors: Buy Now primary, Discuss more secondary, interest form kept', () => {
  const c = P2['selling-to-contractors'];
  const main = mainOfP(pageOf('selling-to-contractors'));
  const text = visible(main);
  assert.ok(main.includes('<a href="https://payhip.com/b/pt9ck" class="btn-primary payhip-buy" data-payhip="https://payhip.com/b/pt9ck">Buy Now — All 3 Levels $9,900</a>'), 'hero Buy Now button');
  assert.ok(main.includes('<a href="#request" class="btn-ghost">Discuss more</a>'), 'Discuss more button to the form');
  assert.ok(main.includes('<a href="/programs/" class="btn-ghost">View All Programs →</a>'));
  const after = main.split('</form>')[1];
  assert.match(after, /<a href="\/courses\/" class="btn-ghost">Browse free courses →<\/a>/, 'Browse free courses under the form');
  assert.ok(main.includes('<form id="interest-form"'), 'interest form kept');
  for (const [label, url] of Object.entries(CONTRACTOR_BUY)) {
    assert.ok(main.includes(`<a href="${url}" class="payhip-buy" data-payhip="${url}">Buy Now</a>`), `Buy Now link for ${label}`);
  }
  assert.ok(main.includes('Multi-branch, all 3 levels, up to 100 learners per level: $24,900 &mdash; <a href="#request">Request a proposal</a>'), 'multi-branch stays proposal');
  assert.ok(main.includes('Additional learners: $120 per learner, per level &mdash; <a href="#request">Request a proposal</a>'), 'additional learners stay proposal');
  assert.ok(main.includes('This program also works outside the United States.'), 'international note');
  assert.ok(!/Book a Discovery Call/.test(text), 'no Discovery Call button in main');
  assert.ok(!/Compare to|Looking for the Enterprise version/.test(text), 'old cross-link buttons dropped');
  assert.ok(!/Enroll Now/.test(text));
  const faqs = (sectionOf(main, 'faq').match(/<h3>/g) || []).length;
  assert.equal(faqs, c.faqs, 'FAQ questions');
  assert.ok(sectionOf(main, 'references').includes('<li>'), 'references listed');
});

test('Selling to Contractors: Payhip checkout modal present with the approved copy, JSON-LD free of Payhip', () => {
  const h = pageOf('selling-to-contractors');
  assert.ok(h.includes('<div class="payhip-overlay" id="payhipOverlay" role="dialog" aria-modal="true" aria-labelledby="payhipTitle"'), 'modal overlay');
  assert.ok(h.includes('<h2 id="payhipTitle">Secure checkout with Payhip</h2>'), 'modal title');
  assert.ok(h.includes('You&rsquo;ll check out securely with Payhip, our payment partner. Your payment is taken in USD, and you&rsquo;ll get instant access to your program as soon as it&rsquo;s complete.'), 'modal body');
  assert.ok(h.includes('<a href="#" target="_blank" rel="noopener" class="payhip-continue" id="payhipContinue">Continue to secure checkout</a>'), 'modal Continue link');
  assert.ok(h.includes('<button type="button" class="payhip-cancel" id="payhipCancel">Cancel</button>'), 'modal Cancel button');
  assert.ok(!/payhip/i.test(jsonLd(h).join('')), 'no Payhip in JSON-LD');
  for (const m of h.matchAll(/<a href="(https:\/\/payhip\.com\/b\/[^"]+)"[^>]*data-payhip="([^"]+)"/g)) {
    assert.equal(m[1], m[2], 'Buy Now data-payhip matches href');
  }
  for (const url of Object.values(CONTRACTOR_BUY)) {
    assert.ok(h.includes(`data-payhip="${url}"`), `Buy Now button for ${url}`);
  }
});

const USA_BUY = {
  'usa-real-estate': { url: 'https://payhip.com/b/bZ9pw', hero: 'Buy Now — $347' },
  'usa-real-estate-enterprise': { url: 'https://payhip.com/b/pyg7l', hero: 'Buy Now — $4,900' },
};

test('USA pages: Buy Now primary, Discuss more secondary, interest form kept', () => {
  for (const [slug, buy] of Object.entries(USA_BUY)) {
    const c = P2[slug];
    const main = mainOfP(pageOf(slug));
    const text = visible(main);
    assert.ok(main.includes(`<a href="${buy.url}" class="btn-primary payhip-buy" data-payhip="${buy.url}">${buy.hero}</a>`), 'hero Buy Now button');
    assert.ok(main.includes('<a href="#request" class="btn-ghost">Discuss more</a>'), 'Discuss more button to the form');
    assert.ok(main.includes('<a href="/programs/" class="btn-ghost">View All Programs →</a>'));
    assert.ok(main.includes('<a href="/courses/" class="btn-ghost">Browse free courses →</a>'));
    assert.ok(main.includes('<form id="interest-form"'), 'interest form kept');
    if (slug === 'usa-real-estate') {
      assert.ok(main.includes('Not sure yet? Discuss more with us'), 'form reframed as a discussion');
    }
    if (slug === 'usa-real-estate-enterprise') {
      assert.ok(main.includes('<a href="#request">Request a proposal</a>'), 'proposal links kept on 50/100 tiers');
      assert.ok(main.includes('<a href="#request">contact us for a custom quote.</a>'), 'custom quote link to the form');
    }
    assert.ok(!/Book a Discovery Call/.test(text), 'no Discovery Call button in main');
    assert.ok(!/Compare to|Looking for the Enterprise version/.test(text), 'old cross-link buttons dropped');
    assert.ok(!/Enroll Now/.test(text));
    const faqs = (sectionOf(main, 'faq').match(/<h3>/g) || []).length;
    assert.equal(faqs, c.faqs, 'FAQ questions');
    assert.ok(sectionOf(main, 'references').includes('<li>'), 'references listed');
  }
});

test('USA pages: Payhip checkout modal present with the approved copy, JSON-LD free of Payhip', () => {
  for (const [slug, buy] of Object.entries(USA_BUY)) {
    const h = pageOf(slug);
    assert.ok(h.includes('<div class="payhip-overlay" id="payhipOverlay" role="dialog" aria-modal="true" aria-labelledby="payhipTitle"'), 'modal overlay');
    assert.ok(h.includes('<h2 id="payhipTitle">Secure checkout with Payhip</h2>'), 'modal title');
    assert.ok(h.includes('You&rsquo;ll check out securely with Payhip, our payment partner. Your payment is taken in USD, and you&rsquo;ll get instant access to your program as soon as it&rsquo;s complete.'), 'modal body');
    assert.ok(h.includes('<a href="#" target="_blank" rel="noopener" class="payhip-continue" id="payhipContinue">Continue to secure checkout</a>'), 'modal Continue link');
    assert.ok(h.includes('<button type="button" class="payhip-cancel" id="payhipCancel">Cancel</button>'), 'modal Cancel button');
    assert.ok(!/payhip/i.test(jsonLd(h).join('')), 'no Payhip in JSON-LD');
    for (const m of h.matchAll(/<a href="(https:\/\/payhip\.com\/b\/[^"]+)"[^>]*data-payhip="([^"]+)"/g)) {
      assert.equal(m[1], m[2], 'Buy Now data-payhip matches href');
    }
    assert.ok(h.includes(`data-payhip="${buy.url}"`), 'Buy Now button for this product');
  }
});

test('P2 cross-links: Self-Study -> Enterprise in Who It\'s For and FAQ; Enterprise -> Self-Study', () => {
  const self = mainOfP(pageOf('usa-real-estate'));
  assert.ok(sectionOf(self, 'who').includes('<a href="/programs/usa-real-estate-enterprise/">Enterprise Brokerage Program</a>'));
  assert.ok(sectionOf(self, 'faq').includes('<a href="/programs/usa-real-estate-enterprise/">Enterprise Brokerage Program</a>'));
  const ent = mainOfP(pageOf('usa-real-estate-enterprise'));
  assert.ok(sectionOf(ent, 'who').includes('<a href="/programs/usa-real-estate/">Self-Study Edition</a>'));
});

test('P2 copy markers: prices, certificate wording and level structure are exactly as approved', () => {
  const self = visible(mainOfP(pageOf('usa-real-estate')));
  assert.match(self, /\$347, one-time\./);
  assert.match(self, /Do I get a certificate\? Not with this edition\./);
  const ent = visible(mainOfP(pageOf('usa-real-estate-enterprise')));
  for (const p of ['$4,900', '$7,900', '$12,900']) assert.ok(ent.includes(p), p);
  assert.match(ent, /More than 100 learners: contact us for a custom quote\./);
  const con = mainOfP(pageOf('selling-to-contractors'));
  for (const p of ['$3,900', '$9,900', '$24,900', '$120 per learner, per level']) assert.ok(visible(con).includes(p), p);
  for (const id of ['level-1', 'level-2', 'level-3']) {
    assert.equal((sectionOf(con, id).match(/<li>/g) || []).length, 10, `${id}: 10 days`);
  }
});
