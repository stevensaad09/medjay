// Static checks for the Customer Service, Call Center and Tele Sales
// full-content pages: courses/<slug>/day-1/ .. day-5/ carry the full text
// of each day's study guide on the site (converted from the live PDFs),
// with a per-day PDF download, prev/next navigation, and links back to
// the course and the exam. All three courses have an exam
// (getExam returns a route for each), so day pages link it in the hero
// and day 5's next step points at it (the Retail pattern, PR #48).
// The landing pages link to all five day pages each and their FAQs no
// longer describe the courses as PDF-only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { onRequestGet as sitemap } from '../functions/sitemap.xml.js';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const COURSES = {

  'customer-service-essentials': {
    name: "Customer Service Essentials",
    footer: "Customer Service Essentials: Level 1",
    days: {
      1: {
        title: "What the Job Is and What the Customer Has Already Lost",
        minWords: 2400,
        sections: ["How to Use This Guide",
      "Today's Objectives (KASU)",
      "The Job, in Plain Words",
      "What the Customer Has Already Lost",
      "Two Speeds of Thinking",
      "Sharp Words Are Safety Signals",
      "The Emotional Bank Account",
      "Worked Example",
      "Apply It in Your Role",
      "What Would You Say?",
      "Key Takeaways",
      "Quiz",
      "Upskill Challenge",
      "Model Answers",
      "References"],
      },
      2: {
        title: "First Contact and Finding the Real Problem",
        minWords: 3000,
        sections: ["How to Use This Guide",
      "Today's Objectives (KASU)",
      "The First-Contact Standard: An Opening the Customer Chooses to Continue",
      "Relevance: Repeat Their Reason Back in Their Own Words",
      "Splitting the Event from the Impact",
      "The Question Ladder: From First Complaint to Real Problem",
      "Why \"Why\" Puts People on the Defensive",
      "Worked Example",
      "Apply It in Your Role",
      "What Would You Say?",
      "Key Takeaways",
      "Quiz",
      "Upskill Challenge",
      "Model Answers",
      "References"],
      },
      3: {
        title: "Angry Customers and Complaints: Staying Steady and Moving Forward",
        minWords: 2900,
        sections: ["How to Use This Guide",
      "Today's Objectives (KASU)",
      "Why Anger Arrives Before You Do",
      "Naming the Feeling Out Loud",
      "A.R.T.: Moving a Complaint Forward",
      "What Escalates a Complaint",
      "Handing a Case to a Supervisor",
      "Apply It in Your Role",
      "What Would You Say?",
      "Key Takeaways",
      "Quiz",
      "Upskill Challenge",
      "Model Answers",
      "References"],
      },
      4: {
        title: "Phone, Chat and Email: Messages That Hold Up",
        minWords: 2500,
        sections: ["How to Use This Guide",
      "Today's Objectives (KASU)",
      "Why the Channel Changes the Job",
      "The Three-Part Message",
      "The Four Dials: Detail, Warmth, Speed and Words",
      "Messages That Hold Up: Email and Case Notes",
      "What Would You Say?",
      "Key Takeaways",
      "Quiz",
      "Upskill Challenge",
      "Model Answers",
      "References"],
      },
      5: {
        title: "Closing, Keeping Promises and What Recovery Can Do",
        minWords: 3200,
        sections: ["How to Use This Guide",
      "Today's Objectives (KASU)",
      "Two Ways to End a Contact",
      "When the Customer Must Choose: The Commitment Close",
      "Keeping Promises When Nothing Has Changed",
      "Inviting Honest Feedback Without Fishing for Praise",
      "What Good Recovery Can and Cannot Do",
      "Apply It in Your Role",
      "Using Today's Skills in a Job Interview",
      "What Would You Say?",
      "Key Takeaways",
      "Quiz",
      "Upskill Challenge",
      "Model Answers",
      "References"],
      },
    },
  },
  'call-center-essentials': {
    name: "Call Center Essentials",
    footer: "Call Center Essentials: Level 1",
    days: {
      1: {
        title: "How a Call Center Works: Queues, Metrics, and the Quality Scorecard",
        minWords: 2300,
        sections: ["How to Use This Guide",
      "Today's Objectives (KASU)",
      "The Queue Is a Line of Real People",
      "Three Channels, One Agent",
      "Your Shift, Breaks, and Adherence",
      "The Key Metrics in Plain Words",
      "Metrics Pull Against Each Other",
      "The Quality Scorecard: Behaviors You Control",
      "Apply It in Your Role",
      "What Would You Say?",
      "Key Takeaways",
      "Quiz",
      "Upskill Challenge",
      "Model Answers",
      "References"],
      },
      2: {
        title: "The Call from Start to Finish: Opening, Verifying, Discovering, Hold, Transfer, Close",
        minWords: 2200,
        sections: ["How to Use This Guide",
      "Today's Objectives (KASU)",
      "Why the First Seconds Decide Everything",
      "The First-Contact Standard",
      "Verify Before You Share or Change Anything",
      "Finding the Real Issue, Not Just the First Complaint",
      "Hold and Transfer Done Properly",
      "Closing the Call With a Clear Next Step",
      "Apply It in Your Role",
      "What Would You Say?",
      "Key Takeaways",
      "Quiz",
      "Upskill Challenge",
      "Model Answers",
      "References"],
      },
      3: {
        title: "Voice and Words: Tone, Plain Language, Listening, and Clear Writing",
        minWords: 2900,
        sections: ["How to Use This Guide",
      "Today's Objectives (KASU)",
      "Your Voice Is the Whole Picture",
      "Say What You Can Do",
      "Listen, Then Say It Back",
      "Write It So It Can Be Read Once",
      "Apply It in Your Role",
      "What Would You Say?",
      "Key Takeaways",
      "Quiz",
      "Upskill Challenge",
      "Model Answers",
      "References"],
      },
      4: {
        title: "Upset Callers and Hard Moments: Pause, A.R.T., Saying No, Escalation",
        minWords: 2300,
        sections: ["How to Use This Guide",
      "Today's Objectives (KASU)",
      "The Mandatory Pause",
      "A.R.T., MEDJAY's own framework for concerns",
      "A Worked Example, Whole and Broken",
      "Saying No Without Doing Damage",
      "Escalation Is a Professional Act",
      "Apply It in Your Role",
      "What Would You Say?",
      "Key Takeaways",
      "Quiz",
      "Upskill Challenge",
      "Model Answers",
      "References"],
      },
      5: {
        title: "Ready for the Job: Notes, Knowledge Base, Stress, and Your First 90 Days",
        minWords: 2800,
        sections: ["How to Use This Guide",
      "Today's Objectives (KASU)",
      "Notes: The Customer's Memory",
      "The Knowledge Base: Fast Search, Honest Gaps",
      "Stress: The Reset Between Calls",
      "Quality Feedback and Coaching: One Behavior at a Time",
      "Interviews and Role-Plays: What Assessors Listen For",
      "Researching a Job and Your First 90 Days",
      "Apply It in Your Role",
      "What Would You Say?",
      "Key Takeaways",
      "Quiz",
      "Upskill Challenge",
      "Model Answers",
      "References"],
      },
    },
  },
  'tele-sales-essentials': {
    name: "Tele Sales Essentials",
    footer: "Tele Sales Essentials",
    days: {
      1: {
        title: "How Tele Sales Works and How You Prepare a Session",
        minWords: 2400,
        sections: ["How to Use This Guide",
      "Today's Objectives (KASU)",
      "What Tele Sales Really Is",
      "What You Are Measured On, and Why It Matters",
      "Preparing a Session",
      "Contact Rules, Briefly",
      "Settling Your Nerves",
      "Apply It in Your Role",
      "What Would You Say?",
      "Key Takeaways",
      "Quiz",
      "Upskill Challenge",
      "Model Answers",
      "References"],
      },
      2: {
        title: "Opening the Call and Reading the First Seconds",
        minWords: 3100,
        sections: ["How to Use This Guide",
      "Today's Objectives (KASU)",
      "The First Seconds Decide the Call",
      "The Outbound Opener in Practice",
      "Answering an Inbound Sales Call",
      "Your Voice Is Half the Message",
      "A Brush-Off Is Not a No",
      "Getting Past a Gatekeeper by Asking for Help",
      "Apply It in Your Role",
      "What Would You Say?",
      "Key Takeaways",
      "Quiz",
      "Upskill Challenge",
      "Model Answers",
      "References"],
      },
      3: {
        title: "Finding the Real Need by Phone",
        minWords: 1800,
        sections: ["How to Use This Guide",
      "Today's Objectives (KASU)",
      "Why Discovery on the Phone Is Different",
      "Ask One Short Question, Then Stop",
      "Reflect Back What You Heard",
      "Notes in the Client's Words",
      "Learn Timing and Budget Gently",
      "Recommend One or Two Options, Not Five",
      "Apply It in Your Role",
      "What Would You Say?",
      "Key Takeaways",
      "Quiz",
      "Upskill Challenge",
      "Model Answers",
      "References"],
      },
      4: {
        title: "Objections, the Pause and A.R.T.",
        minWords: 2800,
        sections: ["How to Use This Guide",
      "Today's Objectives (KASU)",
      "Why the Instant Answer Fails",
      "The Mandatory Pause",
      "A.R.T.: Acknowledging, Reframing and Transitioning",
      "The Four Objections You Will Hear Most",
      "Discount Requests, Authority and a Firm No",
      "Apply It in Your Role",
      "What Would You Say?",
      "Key Takeaways",
      "Quiz",
      "Upskill Challenge",
      "Model Answers",
      "References"],
      },
      5: {
        title: "Closing, Following Up and the Hiring Role-Play",
        minWords: 3000,
        sections: ["How to Use This Guide",
      "Today's Objectives (KASU)",
      "Closing Without Pressure: The Commitment Close",
      "Confirming in the Customer's Words and Follow-Up You Keep",
      "Logging Every Call, and Handling Rejection and Volume",
      "Ready for the Hiring Role-Play and Your First 90 Days",
      "Apply It in Your Role",
      "What Would You Say?",
      "Key Takeaways",
      "Quiz",
      "Upskill Challenge",
      "Model Answers",
      "References"],
      },
    },
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

for (const [slug, course] of Object.entries(COURSES)) {
  for (const [n, d] of Object.entries(course.days)) {
    const day = Number(n);
    const path = `courses/${slug}/day-${day}/index.html`;
    const url = `https://medjay.pro/courses/${slug}/day-${day}/`;

    test(`${slug} day ${day}: page exists, one H1, noscript fallback`, () => {
      assert.ok(existsSync(join(ROOT, path)), 'page file exists');
      const h = read(path);
      assert.equal((h.match(/<h1[\s>]/g) || []).length, 1, 'exactly one h1');
      assert.match(h, /<h1[^>]*>Day \d: /);
      assert.match(h, /<noscript><style>\.reveal\{opacity:1; transform:none;\}<\/style><\/noscript>/);
    });

    test(`${slug} day ${day}: title/meta/canonical/og name the day page`, () => {
      const h = read(path);
      const title = `Day ${day}: ${d.title} — ${course.name} | MEDJAY`;
      assert.ok(h.includes(`<title>${title}</title>`), 'title');
      assert.ok(h.includes(`<link rel="canonical" href="${url}">`), 'canonical');
      assert.ok(h.includes(`<meta property="og:url" content="${url}">`), 'og:url');
      assert.ok(h.includes(`<meta property="og:title" content="${title}">`), 'og:title');
      assert.ok(h.includes('<meta name="robots" content="index, follow">'), 'indexable');
    });

    test(`${slug} day ${day}: JSON-LD parses, breadcrumb ends at this page`, () => {
      const h = read(path);
      const blocks = jsonLd(h);
      assert.equal(blocks.length, 1, 'one JSON-LD block');
      const data = JSON.parse(blocks[0]);
      const crumbs = data['@graph'].find((x) => x['@type'] === 'BreadcrumbList');
      assert.ok(crumbs, 'has BreadcrumbList');
      const items = crumbs.itemListElement;
      assert.equal(items.length, 4, 'four breadcrumb levels');
      assert.equal(items[1].name, 'Free Courses', 'level 2 is Free Courses');
      assert.equal(items[2].name, course.name, 'level 3 is the course');
      assert.equal(items[3].item, url, 'last crumb is this page');
      assert.equal(items[3].name, `Day ${day}: ${d.title}`);
      assert.ok(!JSON.stringify(data).includes('FAQPage'), 'no FAQPage schema');
    });

    test(`${slug} day ${day}: all ${d.sections.length} sections present with full text`, () => {
      const h = read(path);
      const lesson = lessonOf(h);
      for (const s of d.sections) {
        const id = s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        assert.ok(lesson.includes(`<h2 id="${id}">`), `missing h2: ${s}`);
      }
      const words = visible(lesson).split(' ').filter(Boolean).length;
      assert.ok(words >= d.minWords, `day ${day} has ${words} visible words, need ${d.minWords}`);
    });

    test(`${slug} day ${day}: quiz has 5 questions with A-D options`, () => {
      const lesson = lessonOf(read(path));
      assert.ok(lesson.includes('<ol class="quiz">'), 'quiz list present');
      assert.equal((lesson.match(/<p class="quiz-q">/g) || []).length, 5, 'five questions');
      assert.equal((lesson.match(/<ol type="A" class="quiz-options">/g) || []).length, 5, 'five option sets');
      assert.equal((lesson.match(/<ol type="A" class="quiz-options"><li>/g) || []).length, 5, 'each option set starts with an option');
    });

    test(`${slug} day ${day}: PDF download, exam link, prev/next nav`, () => {
      const h = read(path);
      const main = mainOf(h);
      assert.ok(main.includes(`href="/api/dl?course=${slug}&amp;file=day-${day}"`), 'per-day PDF download');
      assert.ok(main.includes(`href="/exam/${slug}"`), 'exam link');
      assert.ok(main.includes(`href="/courses/${slug}/"`), 'link back to the course');
      if (day > 1) {
        assert.ok(main.includes(`href="/courses/${slug}/day-${day - 1}/"`), 'prev day link');
      }
      if (day < 5) {
        assert.ok(main.includes(`href="/courses/${slug}/day-${day + 1}/"`), 'next day link');
      }
    });

    test(`${slug} day ${day}: no PDF artifacts in visible lesson text`, () => {
      const lesson = lessonOf(read(path));
      const text = visible(lesson);
      assert.ok(!text.includes('•'), 'no bullet glyphs left in text');
      assert.ok(!text.includes('☐'), 'no checkbox glyphs left in text');
      assert.ok(!new RegExp(`${course.footer.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')} · \\d`).test(text), 'no page footers left in text');
      assert.ok(!text.includes('NOTES'), 'NOTES label rendered as Note, not raw');
    });
  }

  test(`${slug} landing page: links to all 5 day pages, FAQ no longer PDF-only`, () => {
    const h = read(`courses/${slug}/index.html`);
    for (let day = 1; day <= 5; day++) {
      assert.ok(h.includes(`href="/courses/${slug}/day-${day}/"`), `links to day ${day}`);
      assert.ok(h.includes(`Read the full Day ${day} lesson`), `day ${day} read link label`);
    }
    const faq = h.match(/<section id="faq">([\s\S]*?)<\/section>/)[1];
    assert.ok(!/Each day is a PDF study guide, five in total/.test(faq), 'old PDF-only line gone');
    assert.ok(/read right here on the site/.test(faq), 'FAQ says the full lesson is on the site');
    assert.ok(!/Level 2/i.test(visible(mainOf(h))), 'landing page still free of "Level 2"');
  });
}

test('call-center day 5: "What\'s Next: Level 2" is an inline paragraph inside Upskill Challenge, not a section', () => {
  const lesson = lessonOf(read('courses/call-center-essentials/day-5/index.html'));
  assert.ok(!lesson.includes('<h2 id="what-s-next-level-2">'), "no What's Next heading — faithful to the source PDF");
  assert.ok(lesson.includes("What&#x27;s Next:</strong> Level 2. You will build on these habits"), 'inline paragraph present');
});

test('customer-service day 1 and tele-sales day 1: Upskill Challenge section is present', () => {
  for (const slug of ['customer-service-essentials', 'tele-sales-essentials']) {
    const lesson = lessonOf(read(`courses/${slug}/day-1/index.html`));
    assert.ok(lesson.includes('<h2 id="upskill-challenge">'), `${slug} day 1 has the Upskill Challenge heading`);
    assert.ok(lesson.includes('<strong>Step one:</strong>'), `${slug} day 1 Step one present`);
    assert.ok(lesson.includes('<strong>Step five:</strong>'), `${slug} day 1 Step five present`);
  }
});

test('sitemap lists all 15 day pages with a lastmod date', async () => {
  const xml = await (await sitemap({ env: {} })).text();
  for (const slug of Object.keys(COURSES)) {
    for (let day = 1; day <= 5; day++) {
      const loc = `https://medjay.pro/courses/${slug}/day-${day}/`;
      assert.ok(xml.includes(`<loc>${loc}</loc>`), `sitemap lists ${slug} day ${day}`);
      const block = xml.match(new RegExp(`<url>[\\s\\S]*?<loc>${loc.replace(/\//g, '\\/')}</loc>[\\s\\S]*?</url>`));
      assert.ok(block, `sitemap entry present for ${slug} day ${day}`);
      assert.match(block[0], /<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/, `${slug} day ${day}: lastmod`);
    }
  }
});
