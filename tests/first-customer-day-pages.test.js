// Static checks for the First Customer full-content pages:
// founders/first-customer/day-1/ .. day-10/ carry the full text of each
// day's study guide on the site (converted from the live PDFs), with a
// per-day PDF download, prev/next navigation, and links back to the course.
// This course has NO exam and NO certificate (getExam('first-customer')
// is null), so day pages carry no exam link: day 10's next step points
// at the download page. The landing page links to all ten and its FAQ no
// longer describes the course as PDF-only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { onRequestGet as sitemap } from '../functions/sitemap.xml.js';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const DAYS = {
  1: {
    title: 'Target Customer and Buying Trigger',
    minWords: 3500,
    sections: ['How to Use This Guide', "Today's Objectives (KASU)",
      'Introduction: Why the First Customer Needs a Name',
      'Buyers, Users and the People in Between',
      'The Buying Trigger: The Moment They Start Looking',
      'Early Adopter Traits: Spotting the First Customers Most Likely to Buy',
      'Worked Examples', 'Apply It in Your Role', 'What Would You Say?',
      'Key Takeaways', 'Quiz', 'Upskill Challenge', 'Model Answers',
      'References'],
  },
  2: {
    title: 'Finding the First Buyers: Networks, Communities, and Signals',
    minWords: 2700,
    sections: ['How to Use This Guide', "Today's Objectives (KASU)",
      'Three Places First Buyers Are Already Standing',
      'Warm Networks: Map Before You Message',
      'Communities: Enter as a Member, Not a Billboard',
      'Buying Signals: Read the Trigger, Not General Interest',
      'Apply It in Your Role', 'What Would You Say?', 'Key Takeaways',
      'Quiz', 'Upskill Challenge', 'Model Answers', 'References'],
  },
  3: {
    title: 'The Opener That Earns Attention',
    minWords: 2800,
    sections: ['How to Use This Guide', "Today's Objectives (KASU)",
      'Why the First Seconds Decide Everything',
      'The Four Behaviors, One at a Time',
      'One Structure, Every Channel',
      'Worked Example: One Call, Four Behaviors', 'Reflection',
      'What Would You Say?', 'Key Takeaways',
      'Quiz', 'Upskill Challenge', 'Model Answers', 'References'],
  },
  4: {
    title: 'Discovery: Validate the Problem with Past Behavior',
    minWords: 2500,
    sections: ['How to Use This Guide', "Today's Objectives (KASU)",
      'Introduction: Why Most Discovery Conversations Give You Bad Data',
      'The Discovery Sequence', 'Ask About the Past, Not the Future',
      'Worked Example: B2B (SaaS)', 'Worked Example: B2C (Services)',
      'Apply It in Your Role', 'What Would You Say?', 'Key Takeaways',
      'Quiz', 'Upskill Challenge', 'Model Answers', 'References'],
  },
  5: {
    title: 'The Offer and Pricing for First Customers',
    minWords: 3600,
    sections: ['How to Use This Guide', "Today's Objectives (KASU)",
      'What a First Offer Actually Does', 'Framing with Jobs to Be Done',
      'Pricing for Value and Learning, Not Cost-Plus',
      'Keep the Offer Simple and the Options Real',
      'Trading Instead of Discounting', 'Apply It in Your Role',
      'What Would You Say?', 'Key Takeaways',
      'Quiz', 'Upskill Challenge', 'Model Answers', 'References'],
  },
  6: {
    title: 'The First-Customer Offer: Pilots and Launch Deals',
    minWords: 2200,
    sections: ['How to Use This Guide', "Today's Objectives (KASU)",
      'Why First Customers Need a Different Offer',
      'B2B: Structuring a Paid Pilot',
      'B2C: Founding Customer and Launch Offers',
      'Risk Reversal Without Giving Away the Store',
      'Building Confidence When You Have Zero Customers',
      'Apply It in Your Role', 'What Would You Say?', 'Key Takeaways',
      'Quiz', 'Upskill Challenge', 'Model Answers', 'References'],
  },
  7: {
    title: 'Presenting the Offer with A.I.M.',
    minWords: 2500,
    sections: ['How to Use This Guide', "Today's Objectives (KASU)",
      'The Rookie Mistake: Ten Features, One Memory',
      "A.I.M.: MEDJAY's Framework for Structuring an Offer",
      'Worked Example: A.I.M. in a B2B Offer',
      'Worked Example: A.I.M. in a B2C Offer',
      'Why It Works: Contrast and Small Commitments', 'Reflection',
      'Apply It in Your Role', 'What Would You Say?', 'Key Takeaways',
      'Quiz', 'Upskill Challenge', 'Model Answers', 'References'],
  },
  8: {
    title: 'Handling Objections with A.R.T.',
    minWords: 3600,
    sections: ['How to Use This Guide', "Today's Objectives (KASU)",
      'Why Objections Are Good News',
      "A.R.T., MEDJAY's Own Framework for Objections",
      'The Four Friction Blocks: Diagnosing What You Heard',
      'The Buyer Psychology Behind the Reframe',
      'Worked Example: B2B (Software)', 'Worked Example: B2C (Service)',
      'What Not to Do', 'Apply It in Your Role', 'What Would You Say?',
      'Key Takeaways', 'Quiz', 'Upskill Challenge', 'Model Answers',
      'References'],
  },
  9: {
    title: 'The Close: From Yes to Payment',
    minWords: 2600,
    sections: ['How to Use This Guide', "Today's Objectives (KASU)",
      'Why a Yes Is Not a Payment', 'The Commitment Close',
      'Silence and the Direct Question',
      'B2B: The Simple Agreement and Clear Payment Terms',
      'B2C: Streamline Checkout and Remove Friction',
      'Turning the Close into a Natural Next Step', 'Reflection',
      'Apply It in Your Role', 'What Would You Say?', 'Key Takeaways',
      'Quiz', 'Upskill Challenge', 'Model Answers', 'References'],
  },
  10: {
    title: 'Pipeline, Follow-Up Cadence, and Activity Math',
    minWords: 3200,
    sections: ['How to Use This Guide', "Today's Objectives (KASU)",
      'Why a Pipeline Is a Customer Tool, Not a Chore',
      'The Five Numbers That Describe Your Week',
      'The Weekly Review: Fifteen Minutes',
      'Follow-Up That Respects the Buyer',
      'Activity Math: From Outreaches to Customers',
      'Recording What a Customer Actually Said',
      'Apply It in Your Role', 'What Would You Say?', 'Key Takeaways',
      'Quiz', 'Upskill Challenge', 'Model Answers', 'References'],
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
  const path = `founders/first-customer/day-${day}/index.html`;
  const url = `https://medjay.pro/founders/first-customer/day-${day}/`;

  test(`first-customer day ${day}: page exists, one H1, noscript fallback`, () => {
    assert.ok(existsSync(join(ROOT, path)), 'page file exists');
    const h = read(path);
    assert.equal((h.match(/<h1[\s>]/g) || []).length, 1, 'exactly one h1');
    assert.match(h, /<h1[^>]*>Day \d+: /);
    assert.match(h, /<noscript><style>\.reveal\{opacity:1; transform:none;\}<\/style><\/noscript>/);
  });

  test(`first-customer day ${day}: title/meta/canonical/og name the day page`, () => {
    const h = read(path);
    const title = `Day ${day}: ${d.title} — First Customer | MEDJAY`;
    assert.ok(h.includes(`<title>${title}</title>`), 'title');
    assert.ok(h.includes(`<link rel="canonical" href="${url}">`), 'canonical');
    assert.ok(h.includes(`<meta property="og:url" content="${url}">`), 'og:url');
    assert.ok(h.includes(`<meta property="og:title" content="${title}">`), 'og:title');
    assert.ok(h.includes('<meta name="robots" content="index, follow">'), 'indexable');
  });

  test(`first-customer day ${day}: JSON-LD parses, breadcrumb ends at this page`, () => {
    const h = read(path);
    const blocks = jsonLd(h);
    assert.equal(blocks.length, 1, 'one JSON-LD block');
    const data = JSON.parse(blocks[0]);
    const crumbs = data['@graph'].find((x) => x['@type'] === 'BreadcrumbList');
    assert.ok(crumbs, 'has BreadcrumbList');
    const items = crumbs.itemListElement;
    assert.equal(items.length, 4, 'four breadcrumb levels');
    assert.equal(items[1].item, 'https://medjay.pro/founders/', 'via For Founders');
    assert.equal(items[2].item, 'https://medjay.pro/founders/first-customer/', 'via First Customer');
    assert.equal(items[3].item, url, 'last crumb is this page');
    assert.equal(items[3].name, `Day ${day}: ${d.title}`);
    assert.ok(!JSON.stringify(data).includes('FAQPage'), 'no FAQPage schema');
  });

  test(`first-customer day ${day}: all ${d.sections.length} sections present with full text`, () => {
    const h = read(path);
    const lesson = lessonOf(h);
    for (const s of d.sections) {
      const id = s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      assert.ok(lesson.includes(`<h2 id="${id}">`), `missing h2: ${s}`);
    }
    const words = visible(lesson).split(' ').filter(Boolean).length;
    assert.ok(words >= d.minWords, `day ${day} has ${words} visible words, need ${d.minWords}`);
  });

  test(`first-customer day ${day}: quiz has 5 questions with A-D options`, () => {
    const lesson = lessonOf(read(path));
    assert.ok(lesson.includes('<ol class="quiz">'), 'quiz list present');
    assert.equal((lesson.match(/<p class="quiz-q">/g) || []).length, 5, 'five questions');
    assert.equal((lesson.match(/<ol type="A" class="quiz-options">/g) || []).length, 5, 'five option sets');
    assert.equal((lesson.match(/<ol type="A" class="quiz-options"><li>/g) || []).length, 5, 'each option set starts with an option');
  });

  test(`first-customer day ${day}: PDF download, no exam link, prev/next nav`, () => {
    const h = read(path);
    const main = mainOf(h);
    assert.ok(main.includes(`href="/api/dl?course=first-customer&amp;file=day-${day}"`), 'per-day PDF download');
    assert.ok(!main.includes('/exam/'), 'no exam link anywhere on the page (this course has no exam)');
    assert.ok(main.includes('href="/founders/first-customer/"'), 'link back to the course');
    if (day > 1) {
      assert.ok(main.includes(`href="/founders/first-customer/day-${day - 1}/"`), 'prev day link');
    }
    if (day < 10) {
      assert.ok(main.includes(`href="/founders/first-customer/day-${day + 1}/"`), 'next day link');
    } else {
      assert.ok(main.includes('href="/founders/first-customer/download/"'), 'day 10 next step is the download page');
    }
  });

  test(`first-customer day ${day}: no PDF artifacts in visible lesson text`, () => {
    const lesson = lessonOf(read(path));
    const text = visible(lesson);
    assert.ok(!text.includes('•'), 'no bullet glyphs left in text');
    assert.ok(!text.includes('☐'), 'no checkbox glyphs left in text');
    assert.ok(!/First Customer · \d/.test(text), 'no page footers left in text');
    assert.ok(!text.includes('NOTES'), 'NOTES label rendered as Note, not raw');
  });
}

test('first-customer day 3: no "Apply It in Your Role" section (faithful to the guide)', () => {
  const lesson = lessonOf(read('founders/first-customer/day-3/index.html'));
  assert.ok(!lesson.includes('Apply It in Your Role'), 'day 3 has no Apply It section in the source');
});

test('first-customer day 7: model answers are quiz answers plus a note with the exercise models', () => {
  const lesson = lessonOf(read('founders/first-customer/day-7/index.html'));
  assert.ok(lesson.includes('<strong>Quiz answers:</strong>'), 'quiz answers present');
  assert.ok(lesson.includes('Two-sentence B2B Anchor and Illuminate'), 'exercise models live in the note');
  assert.ok(lesson.includes('B2B Mobilize as a paid pilot'), 'pilot model in the note');
});

test('first-customer day 8: model answers are one paragraph per question', () => {
  const lesson = lessonOf(read('founders/first-customer/day-8/index.html'));
  assert.ok(lesson.includes('Question 1, B2B higher quote.'), 'question 1 model present');
  assert.ok(lesson.includes('Question 4,'), 'question 4 model present');
});

test('first-customer day 9: model answers are Situation bullets', () => {
  const lesson = lessonOf(read('founders/first-customer/day-9/index.html'));
  assert.ok(lesson.includes('Situation 1:'), 'situation 1 model present');
  assert.ok(lesson.includes('Situation 3:'), 'situation 3 model present');
});

test('first-customer day 10: model answers are free paragraphs ending with Why it works', () => {
  const lesson = lessonOf(read('founders/first-customer/day-10/index.html'));
  assert.ok(lesson.includes('A buyer you spoke to ten days ago has gone quiet'), 'quiet-buyer model present');
  assert.ok(lesson.includes('No history yet:'), 'no-history model present');
  assert.ok(lesson.includes('<strong>Why it works:</strong>'), 'Why it works markers present');
});

test('first-customer landing page: links to all 10 day pages, FAQ no longer PDF-only, no exam', () => {
  const h = read('founders/first-customer/index.html');
  for (let day = 1; day <= 10; day++) {
    assert.ok(h.includes(`href="/founders/first-customer/day-${day}/"`), `links to day ${day}`);
    assert.ok(h.includes(`Read the full Day ${day} lesson`), `day ${day} read link label`);
  }
  const faq = h.match(/<section id="faq">([\s\S]*?)<\/section>/)[1];
  assert.ok(!/Each day is a PDF study guide, ten in total/.test(faq), 'old PDF-only line gone');
  assert.ok(/read right here on the site/.test(faq), 'FAQ says the full lesson is on the site');
  assert.ok(!h.includes('/exam/'), 'landing page has no exam link');
});

test('sitemap lists all 10 first-customer day pages with a lastmod date', async () => {
  const xml = await (await sitemap({ env: {} })).text();
  for (let day = 1; day <= 10; day++) {
    const loc = `https://medjay.pro/founders/first-customer/day-${day}/`;
    assert.ok(xml.includes(`<loc>${loc}</loc>`), `sitemap lists day ${day}`);
    const block = xml.match(new RegExp(`<url>[\\s\\S]*?<loc>${loc.replace(/\//g, '\\/')}</loc>[\\s\\S]*?</url>`));
    assert.ok(block, `sitemap entry present for day ${day}`);
    assert.match(block[0], /<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/, `day ${day}: lastmod`);
  }
});
