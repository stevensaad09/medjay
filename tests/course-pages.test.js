// Static checks for the 11 free Level 1 course pages (courses/<slug>/index.html).
// Everything is read from the raw HTML on disk, so it proves the content is
// visible without JavaScript and that the JSON-LD stays valid.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SLUGS = [
  'retail-sales-essentials',
  'counter-sales-essentials',
  'tele-sales-essentials',
  'b2b-sales-essentials',
  'customer-service-essentials',
  'call-center-essentials',
  'team-leader-essentials',
  'assistant-manager-essentials',
  'store-manager-essentials',
  'area-manager-essentials',
  'sales-manager-essentials',
];

const MIN_WORDS = 1000;

function load(slug) {
  return readFileSync(new URL(`../courses/${slug}/index.html`, import.meta.url), 'utf8');
}

function decode(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
}

// Visible text of an HTML fragment: no scripts, styles or tags.
function visibleText(fragment) {
  return decode(
    fragment
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' ')
  ).replace(/\s+/g, ' ').trim();
}

function mainOf(html) {
  const m = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  assert.ok(m, 'page has a <main> element');
  return m[1];
}

function jsonLdBlocks(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
}

function types(node, acc = []) {
  if (Array.isArray(node)) node.forEach((n) => types(n, acc));
  else if (node && typeof node === 'object') {
    if (node['@type']) acc.push(...[].concat(node['@type']));
    Object.values(node).forEach((v) => types(v, acc));
  }
  return acc;
}

for (const slug of SLUGS) {
  test(`course page ${slug}: no PT1H, JSON-LD parses, no FAQPage schema`, () => {
    const html = load(slug);
    assert.ok(!html.includes('PT1H'), 'PT1H removed');
    const blocks = jsonLdBlocks(html);
    assert.ok(blocks.length >= 1, 'has JSON-LD');
    let sawCourse = false;
    for (const b of blocks) {
      let data;
      assert.doesNotThrow(() => { data = JSON.parse(b); }, 'JSON-LD block parses');
      const t = types(data);
      assert.ok(!t.includes('FAQPage'), 'no FAQPage schema');
      assert.ok(!t.includes('Question'), 'no Question schema');
      if (t.includes('Course')) {
        sawCourse = true;
        const sched = JSON.stringify(data).match(/"repeatCount":(\d+)/);
        assert.equal(sched && sched[1], '5', 'repeatCount stays 5');
      }
    }
    assert.ok(sawCourse, 'Course schema still present');
  });

  test(`course page ${slug}: all 8 sections are present in the static HTML`, () => {
    const main = mainOf(load(slug));
    const text = visibleText(main);
    // 1 Header
    assert.match(main, /<h1[^>]*>[^<]+<\/h1>/, 'Header: h1');
    assert.match(main, /class="course-meta[^"]*">5 days · Self-study · Level 1 · Free</, 'Header: meta line');
    // 2-8 sections by id and heading text
    const required = [
      ['who', /Who It(?:'|&#x27;|&#39;)s For/i],
      ['outcomes', /What you(?:'|&#x27;|&#39;)ll be able to do/i],
      ['days', /Day by day/i],
      ['how', /How each day works/i],
      ['exam', /Exam and certificate/i],
      ['reading', /Further reading/i],
      ['faq', />FAQ</],
    ];
    for (const [id, re] of required) {
      const sec = main.match(new RegExp(`<section id="${id}">([\\s\\S]*?)</section>`));
      assert.ok(sec, `section #${id} exists`);
      assert.match(sec[1], re, `section #${id} heading`);
    }
    // Content inside the sections is real text, not empty shells.
    const days = main.match(/<ol class="day-list reveal">([\s\S]*?)<\/ol>/)[1];
    assert.equal((days.match(/<li>\s*<span class="mnum">Day \d<\/span>/g) || []).length, 5, 'five days');
    assert.equal((days.match(/What you(?:'|&#x27;)ll learn:/g) || []).length, 5, 'learn line on each day');
    assert.equal((days.match(/Stretch goal:/g) || []).length, 5, 'stretch goal on each day');
    assert.equal((days.match(/What(?:'|&#x27;)s inside:/g) || []).length, 5, "what's inside on each day");
    // The Frameworks introduced line only appears on days that introduce at least one framework.
    const fw = days.match(/<li><strong>Frameworks introduced:<\/strong>[^<]*<\/li>/g) || [];
    for (const l of fw) assert.ok(visibleText(l).replace('Frameworks introduced:', '').trim().length > 3, 'frameworks line is not empty');
    assert.match(text, /20 multiple-choice questions/, 'exam facts');
    assert.match(text, /Pass with 14 or more/, 'pass mark');
    assert.match(text, /Download PDF/, 'certificate button label');
    const faq = main.match(/<section id="faq">([\s\S]*?)<\/section>/)[1];
    const qs = (faq.match(/<h3>/g) || []).length;
    assert.ok(qs >= 4 && qs <= 5, `FAQ has 4 or 5 questions (found ${qs})`);
  });

  test(`course page ${slug}: at least ${MIN_WORDS} visible words in <main> without JavaScript`, () => {
    const words = visibleText(mainOf(load(slug))).split(' ').filter(Boolean).length;
    assert.ok(words >= MIN_WORDS, `${slug} has ${words} visible words, need ${MIN_WORDS}`);
  });

  test(`course page ${slug}: no draft markers or banned strings in visible text`, () => {
    const html = load(slug);
    const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)[1];
    const text = visibleText(body);
    assert.ok(!/NOT FOUND/.test(text), 'NOT FOUND');
    assert.ok(!/\bn\.d\./.test(text), 'n.d.');
    assert.ok(!/Level 2/i.test(text), 'Level 2');
    assert.ok(!/none named/i.test(text), 'empty "Frameworks introduced" line');
    assert.ok(!/\[(?:EXPAGE|PAGE|EXJSON|SUBMIT|CLAIM|CERT|VERIFY|MIG|EXLIB|DL):/.test(text), 'source tag');
    assert.ok(!/\[[A-Za-z0-9]+ D\d \//.test(text), 'PDF source tag');
    assert.ok(!/Draft notes|Phase 1 Task/.test(text), 'draft markers');
  });
}
