// Static checks for the three separate video-course pages:
// programs/usa-real-estate-video/ ($497 Gumroad),
// programs/uae-real-estate-video/ ($597 Gumroad) and
// programs/uae-beginner-kit-video/ ($497 Gumroad).
// The PDF editions stay on Payhip and are only cross-linked from here;
// these pages must contain no Payhip checkout at all.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { onRequestGet as sitemap } from '../functions/sitemap.xml.js';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const VIDEO = {
  'usa-real-estate-video': {
    path: 'programs/usa-real-estate-video/index.html',
    url: 'https://medjay.pro/programs/usa-real-estate-video/',
    gumroad: 'https://stevensaad.gumroad.com/l/toxhdq',
    price: '497',
    lessons: '72',
    hours: '18 hours',
    pdf: '/programs/usa-real-estate/',
    pdfPrice: '$347',
    faqs: 7,
  },
  'uae-real-estate-video': {
    path: 'programs/uae-real-estate-video/index.html',
    url: 'https://medjay.pro/programs/uae-real-estate-video/',
    gumroad: 'https://stevensaad.gumroad.com/l/xgaiw',
    price: '597',
    lessons: '101',
    hours: '24 hours',
    pdf: '/programs/uae-real-estate/',
    pdfPrice: 'AED 1,274',
    faqs: 8,
    offer: 'UAE Self-Study Edition — Video Course, 12 weeks',
    crumb: 'UAE Real Estate Self-Study — Video',
  },
  'uae-beginner-kit-video': {
    path: 'programs/uae-beginner-kit-video/index.html',
    url: 'https://medjay.pro/programs/uae-beginner-kit-video/',
    gumroad: 'https://stevensaad.gumroad.com/l/ctcxr',
    price: '497',
    lessons: '84',
    hours: '22 hours',
    pdf: '/programs/uae-real-estate/',
    pdfPrice: 'AED 1,642',
    faqs: 7,
    offer: 'UAE Real Estate Beginner Kit — Video Course',
    crumb: 'UAE Real Estate Beginner Kit — Video',
  },
};

function decode(s) {
  return s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
}
const visible = (h) => decode(h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const jsonLd = (h) => [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const graphOf = (h) => JSON.parse(jsonLd(h)[0])['@graph'];
const mainOf = (h) => h.match(/<main[^>]*>([\s\S]*?)<\/main>/)[1];

for (const [slug, v] of Object.entries(VIDEO)) {
  test(`${slug}: page exists, one H1, noscript fallback`, () => {
    assert.ok(existsSync(join(ROOT, v.path)), 'page file exists');
    const h = read(v.path);
    assert.equal((h.match(/<h1[\s>]/g) || []).length, 1, 'exactly one h1');
    assert.match(h, /<noscript><style>\.reveal\{opacity:1; transform:none;\}<\/style><\/noscript>/);
  });

  test(`${slug}: title/meta/og/twitter name the video course and price`, () => {
    const h = read(v.path);
    assert.match(h, /<title>[^<]*Video Course[^<]*<\/title>/);
    assert.ok(h.includes(`<meta name="description" content="`));
    const desc = h.match(/<meta name="description" content="([^"]+)">/)[1];
    assert.match(desc, /video/i);
    assert.ok(desc.includes(v.lessons) && desc.includes(v.price), 'description has lessons + price');
    assert.ok(h.includes(`<meta property="og:description" content="${desc}">`));
    assert.ok(h.includes(`<meta name="twitter:description" content="${desc}">`));
    assert.ok(h.includes(`<link rel="canonical" href="${v.url}">`));
    assert.ok(h.includes(`<meta property="og:url" content="${v.url}">`));
  });

  test(`${slug}: JSON-LD parses, Course offer is Gumroad price in USD, breadcrumb correct`, () => {
    const h = read(v.path);
    const graph = graphOf(h);
    const course = graph.filter((n) => n['@type'] === 'Course');
    assert.equal(course.length, 1);
    assert.match(course[0].name, /Video Course/);
    assert.deepEqual(course[0].offers, {
      '@type': 'Offer',
      name: v.offer || 'USA Self-Study Edition — Video Course',
      price: v.price,
      priceCurrency: 'USD',
      category: 'Paid',
      availability: 'https://schema.org/InStock',
      url: v.url,
    });
    assert.ok(!/gumroad|payhip/i.test(jsonLd(h).join('')), 'no checkout URL in JSON-LD');
    const bc = graph.filter((n) => n['@type'] === 'BreadcrumbList');
    assert.equal(bc.length, 1);
    assert.deepEqual(bc[0].itemListElement[2], {
      '@type': 'ListItem',
      position: 3,
      name: v.crumb || 'USA Real Estate Self-Study — Video',
      item: v.url,
    });
  });

  test(`${slug}: Buy Now goes to Gumroad with a matching data-gumroad modal`, () => {
    const h = read(v.path);
    const buys = [...h.matchAll(/<a href="(https:\/\/stevensaad\.gumroad\.com\/l\/[^"]+)"[^>]*class="[^"]*gumroad-buy"[^>]*data-gumroad="([^"]+)"/g)];
    assert.ok(buys.length >= 1, 'at least one Gumroad Buy Now button');
    for (const m of buys) {
      assert.equal(m[1], v.gumroad, 'Buy Now href is the right Gumroad product');
      assert.equal(m[1], m[2], 'data-gumroad matches href');
    }
    assert.ok(h.includes('<div class="gumroad-overlay" id="gumroadOverlay" role="dialog" aria-modal="true" aria-labelledby="gumroadTitle"'), 'Gumroad modal overlay');
    assert.ok(h.includes('<h2 id="gumroadTitle">Secure checkout with Gumroad</h2>'), 'Gumroad modal title');
    assert.ok(h.includes(`Your payment is taken in USD ($${v.price})`), 'modal states USD price');
    assert.ok(h.includes('stream-only, no downloads'), 'modal states stream-only');
    assert.ok(h.includes('<a href="#" target="_blank" rel="noopener" class="gumroad-continue" id="gumroadContinue">Continue to secure checkout</a>'), 'modal Continue link');
    assert.ok(h.includes('<button type="button" class="gumroad-cancel" id="gumroadCancel">Cancel</button>'), 'modal Cancel button');
    assert.ok(!/payhip/i.test(h), 'no Payhip anywhere on the video page');
  });

  test(`${slug}: video facts in the visible copy, PDF edition cross-linked`, () => {
    const h = read(v.path);
    const text = visible(h);
    assert.ok(text.includes(`${v.lessons} video lessons`), 'lesson count');
    assert.ok(text.includes(v.hours), 'hours');
    assert.ok(text.includes(`$${v.price}`), 'price');
    assert.ok(/subtitles/i.test(text), 'subtitles mentioned');
    assert.ok(/stream-only/i.test(text), 'stream-only mentioned');
    assert.ok(h.includes(`href="${v.pdf}"`), 'cross-link to the PDF edition');
    assert.ok(text.includes(v.pdfPrice), 'PDF edition price mentioned for comparison');
    assert.ok(!/Level 2/i.test(text), 'no "Level 2" in visible text');
  });

  test(`${slug}: internal links resolve, no relative src/href`, () => {
    const h = read(v.path).replace(/<script[\s\S]*?<\/script>/gi, '');
    const urls = [...h.matchAll(/\b(?:href|src)="([^"]+)"/g)].map((m) => m[1]).filter((u) => u.startsWith('/') && !u.startsWith('//'));
    assert.ok(urls.length > 0);
    for (const u of urls) {
      const clean = u.split('#')[0].split('?')[0];
      if (clean === '' || clean === '/') continue;
      const rel = clean.replace(/^\//, '');
      const cands = [rel, `${rel}/index.html`, `${rel}.html`];
      assert.ok(cands.some((c) => existsSync(join(ROOT, c))), `${v.path}: ${u} does not resolve`);
    }
    for (const m of h.matchAll(/\b(?:href|src)="([^"]*)"/g)) {
      assert.match(m[1], /^(\/|#|https?:|mailto:|tel:)/, `${v.path}: ${m[1]}`);
    }
  });

  test(`${slug}: sitemap lists the new URL with a lastmod date`, async () => {
    const xml = await (await sitemap({ env: {} })).text();
    assert.ok(xml.includes(`<loc>${v.url}</loc>`), 'sitemap has the video URL');
    const escapedUrl = v.url.split('.').join('\\.'); // only dots need escaping here
    const entry = xml.match(new RegExp(`<url>\\s*<loc>${escapedUrl}</loc>\\s*<lastmod>(\\d{4}-\\d{2}-\\d{2})</lastmod>`));
    assert.ok(entry, 'sitemap entry has a lastmod date');
  });
}

test('USA video: Discuss more links to the kept interest form (program value unchanged)', () => {
  const h = read(VIDEO['usa-real-estate-video'].path);
  const main = mainOf(h);
  assert.ok(main.includes('<a href="#request" class="btn-ghost">Discuss more</a>'), 'Discuss more button');
  assert.ok(main.includes('<form id="interest-form"'), 'interest form kept');
  assert.ok(main.includes('<input type="hidden" name="program" value="usa-real-estate">'), 'form still submits as usa-real-estate (existing API key)');
  assert.ok(main.includes('href="/courses/"'), 'links to free courses');
});

test('UAE video: Discuss more is Book a Discovery Call, 12-week-only honesty', () => {
  const h = read(VIDEO['uae-real-estate-video'].path);
  const main = mainOf(h);
  assert.ok(main.includes('href="/#contact"'), 'Discovery Call link kept in main');
  assert.ok(main.includes('This video course covers the 12-week program only'), '12-week-only statement');
  assert.ok(main.includes('The Beginner Kit is now also a video course'), 'Beginner Kit video now exists');
  assert.ok(main.includes('href="/programs/uae-beginner-kit-video/"'), 'links to the Beginner Kit video course');
  const faqs = (main.match(/<section id="faq">([\s\S]*?)<\/section>/)[1].match(/<h3 style=/g) || []).length;
  assert.equal(faqs, 8, 'FAQ has 8 questions');
  assert.ok(main.includes('Is there a video version of the Beginner Kit?'), 'Beginner Kit video FAQ');
  assert.ok(main.includes('Yes. The Beginner Kit is now a video course'), 'Beginner Kit video FAQ answer');
  const buys = [...h.matchAll(/data-gumroad="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(buys)], [VIDEO['uae-real-estate-video'].gumroad], 'only the 12-week Gumroad product is sold');
});

test('USA video: 7 FAQ questions, watch-online section, no PDF-only sections', () => {
  const h = read(VIDEO['usa-real-estate-video'].path);
  const main = mainOf(h);
  const faqs = (main.match(/<section id="faq">([\s\S]*?)<\/section>/)[1].match(/<h3>/g) || []).length;
  assert.equal(faqs, 7, 'FAQ has 7 questions');
  assert.ok(main.includes('id="watch"'), 'watch-online section present');
  assert.ok(!main.includes('id="assessments"'), 'no PDF assessments section');
  assert.ok(!/Study Guide|Workbook/i.test(visible(main)), 'no Study Guide / Workbook wording');
});

test('PDF pages: cross-link lines to the video editions', () => {
  const usa = read('programs/usa-real-estate/index.html');
  assert.ok(usa.includes('<a href="/programs/usa-real-estate-video/">Watch the video course</a> — 72 lessons, about 18 hours, $497.'), 'USA PDF cross-link');
  assert.ok(usa.includes('<a href="https://payhip.com/b/bZ9pw" class="btn-primary payhip-buy" data-payhip="https://payhip.com/b/bZ9pw">Buy Now — $347</a>'), 'USA PDF Buy Now unchanged');
  const uae = read('programs/uae-real-estate/index.html');
  assert.ok(uae.includes('<a href="/programs/uae-real-estate-video/">Watch the 12-week video course</a> — 101 lessons, about 24 hours, $597.'), 'UAE PDF cross-link');
  assert.ok(uae.includes('<a href="/programs/uae-beginner-kit-video/">Watch the Beginner Kit video course</a> — 84 lessons, about 22 hours, $497.'), 'UAE PDF Beginner Kit cross-link');
  assert.ok(uae.includes('<a href="https://payhip.com/b/x3G0t" class="kit-link payhip-buy" data-payhip="https://payhip.com/b/x3G0t">Buy now &mdash; AED 1,642</a>'), 'UAE bundle Buy Now unchanged');
  assert.ok(uae.includes('<a href="https://payhip.com/b/bY9PN" class="kit-link payhip-buy" data-payhip="https://payhip.com/b/bY9PN">Buy now &mdash; AED 1,274</a>'), 'UAE 12W Buy Now unchanged');
});
