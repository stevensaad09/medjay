// Static checks for the Advanced Courses sales page (courses/advanced/index.html).
// Everything is read from the raw HTML on disk, so it proves the content is
// visible without JavaScript and that the JSON-LD stays valid.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { onRequestGet as sitemap } from '../functions/sitemap.xml.js';

const PAYHIP = {
  'retail-sales-essentials': 'https://payhip.com/b/4kwsv',
  'counter-sales-essentials': 'https://payhip.com/b/oKZOU',
  'tele-sales-essentials': 'https://payhip.com/b/HU7Np',
  'b2b-sales-essentials': 'https://payhip.com/b/CSo2X',
  'customer-service-essentials': 'https://payhip.com/b/8ImZo',
  'call-center-essentials': 'https://payhip.com/b/tip4S',
  'team-leader-essentials': 'https://payhip.com/b/3NKhy',
  'assistant-manager-essentials': 'https://payhip.com/b/GQdmU',
  'store-manager-essentials': 'https://payhip.com/b/DvAmb',
  'area-manager-essentials': 'https://payhip.com/b/TZNw8',
  'sales-manager-essentials': 'https://payhip.com/b/oKPTa',
};
const SLUGS = Object.keys(PAYHIP);
const PAGE_URL = 'https://medjay.pro/courses/advanced/';

const html = readFileSync(new URL('../courses/advanced/index.html', import.meta.url), 'utf8');

test('advanced page: title, canonical, og:url, H1 all name the page', () => {
  assert.ok(html.includes('<title>Advanced Sales, Customer Service &amp; Leadership Courses | MEDJAY</title>'));
  assert.ok(html.includes(`<link rel="canonical" href="${PAGE_URL}">`));
  assert.ok(html.includes(`<meta property="og:url" content="${PAGE_URL}">`));
  assert.match(html, /<h1[^>]*>Advanced Courses<\/h1>/);
});

test('advanced page: says plainly that no free course is required first', () => {
  assert.match(html, /No prerequisites/i);
  assert.match(html, /Level 1 is recommended, not required/);
  assert.match(html, /Do I need to take the free Level 1 course first\?/);
});

test('advanced page: 11 Buy Now buttons, one per course, each to its own Payhip product', () => {
  const buys = [...html.matchAll(/<a href="(https:\/\/payhip\.com\/b\/[A-Za-z0-9]+)" class="btn-primary payhip-buy" data-payhip="\1"/g)];
  assert.equal(buys.length, 11, `expected 11 Buy Now buttons, found ${buys.length}`);
  const urls = buys.map((m) => m[1]);
  for (const slug of SLUGS) assert.ok(urls.includes(PAYHIP[slug]), `${slug}: Payhip link missing`);
  assert.ok(html.includes('Buy Now — $29'));
  assert.ok(html.includes('Secure checkout with Payhip'));
  assert.ok(html.includes('id="payhipOverlay"'));
});

test('advanced page: JSON-LD parses, 11 Courses with $29 USD offers', () => {
  const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(m, 'has JSON-LD');
  const data = JSON.parse(m[1]);
  const page = data['@graph'].find((n) => n['@type'] === 'CollectionPage');
  assert.ok(page, 'CollectionPage present');
  assert.equal(page.url, PAGE_URL);
  const items = page.mainEntity.itemListElement;
  assert.equal(items.length, 11);
  for (const [i, slug] of SLUGS.entries()) {
    const item = items[i].item;
    assert.equal(item['@type'], 'Course');
    assert.equal(item.url, `${PAGE_URL}#${slug}`);
    assert.equal(item.offers.price, '29');
    assert.equal(item.offers.priceCurrency, 'USD');
    assert.equal(item.offers.url, PAYHIP[slug]);
  }
});

test('advanced page: sitemap lists it with a lastmod date', async () => {
  const xml = await (await sitemap({ env: {} })).text();
  assert.ok(xml.includes(`<loc>${PAGE_URL}</loc>`));
  const block = xml.match(new RegExp(`<url>[\\s\\S]*?<loc>${PAGE_URL.replace(/\//g, '\\/')}</loc>[\\s\\S]*?</url>`));
  assert.ok(block, 'sitemap entry present');
  assert.match(block[0], /<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
});

test('hub links to Advanced Courses; every Level 1 page links to its Advanced card', () => {
  const hub = readFileSync(new URL('../courses/index.html', import.meta.url), 'utf8');
  assert.ok(hub.includes('href="/courses/advanced/"'), 'hub links to the Advanced page');
  for (const slug of SLUGS) {
    const page = readFileSync(new URL(`../courses/${slug}/index.html`, import.meta.url), 'utf8');
    assert.ok(page.includes(`href="/courses/advanced/#${slug}"`), `${slug}: anchor link missing`);
    assert.ok(!/Level 2/i.test(page.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ')),
      `${slug}: visible text must stay free of "Level 2"`);
  }
});

test('homepage: Advanced Courses section after Free Courses, plus footer link', () => {
  const home = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(home.includes('id="advanced-courses"'), 'homepage has the Advanced section');
  assert.ok(home.includes('Want to go deeper?'), 'homepage teaser heading present');
  assert.ok(home.includes('Browse Advanced Courses'), 'homepage teaser CTA present');
  assert.ok(home.includes('href="/courses/advanced/"'), 'homepage links to the Advanced page');
  assert.ok(home.includes('<a href="/courses/advanced/">Advanced Courses</a>'), 'homepage footer links to Advanced');
  const freeAt = home.indexOf('id="free-courses"');
  const advAt = home.indexOf('id="advanced-courses"');
  const contactAt = home.indexOf('id="contact"');
  assert.ok(freeAt > -1 && advAt > freeAt && contactAt > advAt, 'Advanced section sits after Free Courses, before Contact');
});

test('every page with a Programs footer column links to Advanced Courses', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      const p = join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.endsWith('.html')) files.push(p);
    }
  };
  walk(root);
  const withFooter = files.filter((f) => readFileSync(f, 'utf8').includes('<h4>Programs</h4>'));
  assert.equal(withFooter.length, 73, `expected 73 pages with a Programs footer, found ${withFooter.length}`);
  for (const f of withFooter) {
    const page = readFileSync(f, 'utf8');
    assert.ok(page.includes('<a href="/courses/advanced/">Advanced Courses</a>'), `${f}: footer link to Advanced missing`);
  }
});

test('article template footer also links to Advanced Courses', () => {
  const slug = readFileSync(new URL('../functions/articles/[slug].js', import.meta.url), 'utf8');
  assert.ok(slug.includes('<a href="/courses/advanced/">Advanced Courses</a>'), 'article template footer links to Advanced');
});
