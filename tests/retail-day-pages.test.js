// Static checks for the Retail Sales Essentials full-content pilot:
// courses/retail-sales-essentials/day-1/ .. day-5/ carry the full text of
// each day's study guide on the site (converted from the live PDFs), with a
// per-day PDF download, prev/next navigation, and links back to the course
// and the exam. The landing page links to all five and its FAQ no longer
// describes the course as PDF-only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { onRequestGet as sitemap } from '../functions/sitemap.xml.js';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const DAYS = {
  1: {
    title: 'How Customers Decide',
    minWords: 3400,
    sections: ['How to Use This Guide', "Today's Objectives (KASU)",
      'Fast Thinking and Slow Thinking', 'What this changes about your job',
      'Emotions, Value and Price', 'Building a case they can use',
      'Reading Customer Signals and Decision Styles',
      'Adjusting your pace to the person in front of you',
      'Apply It in Your Role', 'What Would You Say?', 'Key Takeaways',
      'Quiz', 'Upskill Challenge', 'Model Answers', 'References'],
  },
  2: {
    title: 'Opening Conversations and Discovering Needs',
    minWords: 2400,
    sections: ['How to Use This Guide', "Today's Objectives (KASU)",
      'The First Steps of a First Contact', 'The Question Ladder',
      "Listening: The Half of Discovery You Can't Skip", 'Worked Example',
      'Apply It in Your Role', 'What Would You Say?', 'Key Takeaways',
      'Quiz', 'Upskill Challenge', 'Model Answers', 'References'],
  },
  3: {
    title: 'Presenting Value and Handling Objections',
    minWords: 3300,
    sections: ['How to Use This Guide', "Today's Objectives (KASU)",
      'Why Objections Come',
      'Presenting Value: Features, Advantages, Benefits',
      'Handling Objections with A.R.T.',
      'Worked Example: The Second Time the Objection Comes',
      'Apply It in Your Role', 'What Would You Say?', 'Key Takeaways',
      'Quiz', 'Upskill Challenge', 'Model Answers', 'References'],
  },
  4: {
    title: 'The Retail Floor: Approaching Walk-Ins and Add-On Selling',
    minWords: 2800,
    sections: ['How to Use This Guide', "Today's Objectives (KASU)",
      'Reading the Walk-In: Openness and Timing', 'The A.I.M. Offer Structure',
      'Add-On Selling That Feels Helpful', 'Apply It in Your Role',
      'What Would You Say?', 'Key Takeaways',
      'Quiz', 'Upskill Challenge', 'Model Answers', 'References'],
  },
  5: {
    title: 'Closing at the Counter, After-Sale, and Building Repeat Customers',
    minWords: 3000,
    sections: ['How to Use This Guide', "Today's Objectives (KASU)",
      "Why Closing Feels Hard, and Why It Shouldn't", 'The Commitment Close',
      'After-Sale: The Psychology of Satisfaction and Loyalty',
      'When the Customer Says No at the Close', 'Apply It in Your Role',
      'What Would You Say?', 'Key Takeaways',
      'Quiz', 'Upskill Challenge', 'Model Answers', "What's Next: Level 2",
      'References'],
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
const mainOf = (h) => h.match(/<main[^>]*>([\s\S]*?)<\/main>/)[1];
const lessonOf = (h) => h.match(/<div class="lesson">([\s\S]*?)<\/div>\s*<\/div>\s*<\/section>/)[1];

for (const [n, d] of Object.entries(DAYS)) {
  const day = Number(n);
  const path = `courses/retail-sales-essentials/day-${day}/index.html`;
  const url = `https://medjay.pro/courses/retail-sales-essentials/day-${day}/`;

  test(`retail day ${day}: page exists, one H1, noscript fallback`, () => {
    assert.ok(existsSync(join(ROOT, path)), 'page file exists');
    const h = read(path);
    assert.equal((h.match(/<h1[\s>]/g) || []).length, 1, 'exactly one h1');
    assert.match(h, /<h1[^>]*>Day \d: /);
    assert.match(h, /<noscript><style>\.reveal\{opacity:1; transform:none;\}<\/style><\/noscript>/);
  });

  test(`retail day ${day}: title/meta/canonical/og name the day page`, () => {
    const h = read(path);
    const title = `Day ${day}: ${d.title} — Retail Sales Essentials | MEDJAY`;
    assert.ok(h.includes(`<title>${title}</title>`), 'title');
    assert.ok(h.includes(`<link rel="canonical" href="${url}">`), 'canonical');
    assert.ok(h.includes(`<meta property="og:url" content="${url}">`), 'og:url');
    assert.ok(h.includes(`<meta property="og:title" content="${title}">`), 'og:title');
    assert.ok(h.includes('<meta name="robots" content="index, follow">'), 'indexable');
  });

  test(`retail day ${day}: JSON-LD parses, breadcrumb ends at this page`, () => {
    const h = read(path);
    const blocks = jsonLd(h);
    assert.equal(blocks.length, 1, 'one JSON-LD block');
    const data = JSON.parse(blocks[0]);
    const crumbs = data['@graph'].find((x) => x['@type'] === 'BreadcrumbList');
    assert.ok(crumbs, 'has BreadcrumbList');
    const items = crumbs.itemListElement;
    assert.equal(items.length, 4, 'four breadcrumb levels');
    assert.equal(items[3].item, url, 'last crumb is this page');
    assert.equal(items[3].name, `Day ${day}: ${d.title}`);
    assert.ok(!JSON.stringify(data).includes('FAQPage'), 'no FAQPage schema');
  });

  test(`retail day ${day}: all ${d.sections.length} sections present with full text`, () => {
    const h = read(path);
    const lesson = lessonOf(h);
    for (const s of d.sections) {
      const id = s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      assert.ok(lesson.includes(`<h2 id="${id}">`), `missing h2: ${s}`);
    }
    const words = visible(lesson).split(' ').filter(Boolean).length;
    assert.ok(words >= d.minWords, `day ${day} has ${words} visible words, need ${d.minWords}`);
  });

  test(`retail day ${day}: quiz has 5 questions with A-D options`, () => {
    const lesson = lessonOf(read(path));
    assert.ok(lesson.includes('<ol class="quiz">'), 'quiz list present');
    assert.equal((lesson.match(/<p class="quiz-q">/g) || []).length, 5, 'five questions');
    assert.equal((lesson.match(/<ol type="A" class="quiz-options">/g) || []).length, 5, 'five option sets');
    assert.equal((lesson.match(/<ol type="A" class="quiz-options"><li>/g) || []).length, 5, 'each option set starts with an option');
  });

  test(`retail day ${day}: PDF download, exam link, prev/next nav`, () => {
    const h = read(path);
    const main = mainOf(h);
    assert.ok(main.includes(`href="/api/dl?course=retail-sales-essentials&amp;file=day-${day}"`), 'per-day PDF download');
    assert.ok(main.includes('href="/exam/retail-sales-essentials"'), 'exam link');
    assert.ok(main.includes('href="/courses/retail-sales-essentials/"'), 'link back to the course');
    if (day > 1) {
      assert.ok(main.includes(`href="/courses/retail-sales-essentials/day-${day - 1}/"`), 'prev day link');
    }
    if (day < 5) {
      assert.ok(main.includes(`href="/courses/retail-sales-essentials/day-${day + 1}/"`), 'next day link');
    }
  });

  test(`retail day ${day}: no PDF artifacts in visible lesson text`, () => {
    const lesson = lessonOf(read(path));
    const text = visible(lesson);
    assert.ok(!text.includes('•'), 'no bullet glyphs left in text');
    assert.ok(!text.includes('☐'), 'no checkbox glyphs left in text');
    assert.ok(!/Retail Sales Essentials · \d/.test(text), 'no page footers left in text');
    assert.ok(!text.includes('NOTES'), 'NOTES label rendered as Note, not raw');
  });
}

test('retail day 5: "What\'s Next: Level 2" section is present (faithful to the guide)', () => {
  const lesson = lessonOf(read('courses/retail-sales-essentials/day-5/index.html'));
  assert.ok(lesson.includes("What's Next: Level 2") || lesson.includes('What&#x27;s Next: Level 2'), 'section heading present');
  assert.ok(visible(lesson).includes('You have finished Level 1'), 'section content present');
});

test('retail landing page: links to all 5 day pages, FAQ no longer PDF-only', () => {
  const h = read('courses/retail-sales-essentials/index.html');
  for (let day = 1; day <= 5; day++) {
    assert.ok(h.includes(`href="/courses/retail-sales-essentials/day-${day}/"`), `links to day ${day}`);
    assert.ok(h.includes(`Read the full Day ${day} lesson`), `day ${day} read link label`);
  }
  const faq = h.match(/<section id="faq">([\s\S]*?)<\/section>/)[1];
  assert.ok(!/Each day is a PDF study guide, five in total/.test(faq), 'old PDF-only line gone');
  assert.ok(/read right here on the site/.test(faq), 'FAQ says the full lesson is on the site');
  assert.ok(!/Level 2/i.test(visible(mainOf(h))), 'landing page still free of "Level 2"');
});

test('sitemap lists all 5 retail day pages with a lastmod date', async () => {
  const xml = await (await sitemap({ env: {} })).text();
  for (let day = 1; day <= 5; day++) {
    const loc = `https://medjay.pro/courses/retail-sales-essentials/day-${day}/`;
    assert.ok(xml.includes(`<loc>${loc}</loc>`), `sitemap lists day ${day}`);
    const block = xml.match(new RegExp(`<url>[\\s\\S]*?<loc>${loc.replace(/\//g, '\\/')}</loc>[\\s\\S]*?</url>`));
    assert.ok(block, `sitemap entry present for day ${day}`);
    assert.match(block[0], /<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/, `day ${day}: lastmod`);
  }
});
