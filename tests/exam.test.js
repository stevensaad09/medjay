import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EXAMS, EXAM_SLUGS, getExam, isValidAnswers, grade, randomCode, makeCertificateNo,
  isCertificateNo, CERT_CHARSET, cleanName, cleanEmail, addYears, linkedInAddUrl, formatIssueDate,
} from '../functions/_lib/exam.js';
import { readFileSync } from 'node:fs';

const EXPECTED = {
  'retail-sales-essentials': 'RSE', 'customer-service-essentials': 'CSE', 'team-leader-essentials': 'TLE',
  'assistant-manager-essentials': 'AME', 'b2b-sales-essentials': 'B2B', 'call-center-essentials': 'CCE',
  'counter-sales-essentials': 'CTS', 'store-manager-essentials': 'SME', 'tele-sales-essentials': 'TSE',
  'area-manager-essentials': 'ARM', 'sales-manager-essentials': 'SLM',
};

test('exam data: 11 exams, prefixes as specified, 20 questions each with A-D in order', () => {
  assert.equal(EXAM_SLUGS.length, 11);
  for (const [slug, prefix] of Object.entries(EXPECTED)) {
    const e = getExam(slug);
    assert.ok(e, slug);
    assert.equal(e.prefix, prefix);
    assert.equal(e.questions.length, 20);
    e.questions.forEach((q, i) => {
      assert.equal(q.no, i + 1);
      assert.deepEqual(Object.keys(q.options), ['A', 'B', 'C', 'D']);
    });
  }
});

test('exam data contains no answer key fields', () => {
  for (const e of Object.values(EXAMS)) {
    for (const q of e.questions) assert.deepEqual(Object.keys(q).sort(), ['id', 'no', 'options', 'stem']);
  }
});

test('migration exams rows match the JSON exactly', () => {
  const sql = readFileSync(new URL('../migrations/0003_exams.sql', import.meta.url), 'utf8');
  for (const e of Object.values(EXAMS)) {
    assert.ok(sql.includes(`('${e.slug}', '${e.prefix}', '${e.title}', 20, 14)`), e.slug);
  }
  assert.ok(!/INSERT\s+(OR\s+\w+\s+)?INTO\s+exam_keys/i.test(sql), 'no exam_keys inserts in migration');
});

test('getExam rejects unknown and prototype keys', () => {
  assert.equal(getExam('nope'), null);
  assert.equal(getExam('__proto__'), null);
  assert.equal(getExam(undefined), null);
});

test('isValidAnswers requires exactly 20 upper-case A-D letters', () => {
  assert.ok(isValidAnswers('ABCD'.repeat(5), 20));
  assert.ok(!isValidAnswers('ABCD'.repeat(5).slice(0, 19), 20));
  assert.ok(!isValidAnswers('ABCD'.repeat(5) + 'A', 20));
  assert.ok(!isValidAnswers('abcd'.repeat(5), 20));
  assert.ok(!isValidAnswers('ABCE'.repeat(5), 20));
  assert.ok(!isValidAnswers('ABC '.repeat(5), 20));
  assert.ok(!isValidAnswers(['A'], 20));
  assert.ok(!isValidAnswers(null, 20));
});

test('grade counts matches; 13 fails, 14 passes; incomplete key returns null', () => {
  const key = 'ABCDABCDABCDABCDABCD';
  const keys = new Map([...key].map((c, i) => [i + 1, c]));
  assert.equal(grade(key, keys, 20), 20);
  assert.equal(grade('DDDDDDDDDDDDDDDDDDDD', keys, 20), 5);
  const wrong = (s) => [...s].map((c) => 'ABCD'[('ABCD'.indexOf(c) + 1) % 4]).join('');
  assert.equal(grade(key.slice(0, 14) + wrong(key.slice(14)), keys, 20), 14);
  assert.equal(grade(key.slice(0, 13) + wrong(key.slice(13)), keys, 20), 13);
  keys.delete(20);
  assert.equal(grade(key, keys, 20), null);
});

test('certificate numbers: format, charset excludes O 0 I 1', () => {
  assert.equal(CERT_CHARSET.length, 32);
  for (const ch of 'O0I1') assert.ok(!CERT_CHARSET.includes(ch));
  for (let i = 0; i < 2000; i++) {
    const code = randomCode();
    assert.match(code, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  }
  const no = makeCertificateNo('RSE', 2026, '7K4Q9X');
  assert.equal(no, 'MJ-RSE-2026-7K4Q9X');
  assert.ok(isCertificateNo(no));
  assert.ok(isCertificateNo('MJ-B2B-2026-ABCDEF'));
  assert.ok(!isCertificateNo('MJ-RSE-2026-7K4Q90'));
  assert.ok(!isCertificateNo('MJ-RSE-2026-7K4Q9'));
  assert.ok(!isCertificateNo('mj-rse-2026-7k4q9x'));
  assert.ok(!isCertificateNo("MJ-RSE-2026-7K4Q9X' OR 1=1"));
});

test('cleanName accepts Arabic and Latin names, trims and collapses spaces', () => {
  assert.equal(cleanName('  Steven   Saad '), 'Steven Saad');
  assert.equal(cleanName('ستيفن سعد'), 'ستيفن سعد');
  assert.equal(cleanName("Mary-Jane O'Neil"), "Mary-Jane O'Neil");
  assert.equal(cleanName('José Álvarez Jr.'), 'José Álvarez Jr.');
  assert.equal(cleanName('محمد عبدالله'), 'محمد عبدالله');
  assert.equal(cleanName('A'), null);
  assert.equal(cleanName('x'.repeat(81)), null);
  assert.ok(cleanName('x'.repeat(80)));
  assert.equal(cleanName('<script>alert(1)</script>'), null);
  assert.equal(cleanName('John 123'), null);
  assert.equal(cleanName('Evil‮Name'), null);
  assert.equal(cleanName('Tab\u0000Name'), null);
  assert.equal(cleanName('-John'), null);
  assert.equal(cleanName("''"), null);
  assert.equal(cleanName(42), null);
});

test('cleanEmail trims, lower-cases and validates', () => {
  assert.equal(cleanEmail('  Foo@Example.COM '), 'foo@example.com');
  assert.equal(cleanEmail('foo@example'), null);
  assert.equal(cleanEmail('foo bar@example.com'), null);
  assert.equal(cleanEmail('<a>@example.com'), null);
  assert.equal(cleanEmail('a@b.c'), null);
  assert.equal(cleanEmail('a'.repeat(250) + '@x.com'), null);
});

test('purge_after is issued_at + 10 years', () => {
  assert.equal(addYears('2026-11-05T10:00:00.000Z', 10), '2036-11-05T10:00:00.000Z');
  assert.equal(formatIssueDate('2026-11-05T10:00:00.000Z'), '5 November 2026');
});

test('LinkedIn URL: encoded, organizationName by default, organizationId when set', () => {
  const args = { courseTitle: 'B2B Sales Essentials', certNo: 'MJ-B2B-2026-7K4Q9X', issuedAt: '2026-11-05T10:00:00Z' };
  const u = new URL(linkedInAddUrl(args, ''));
  assert.equal(u.origin + u.pathname, 'https://www.linkedin.com/profile/add');
  assert.equal(u.searchParams.get('startTask'), 'CERTIFICATION_NAME');
  assert.equal(u.searchParams.get('name'), 'B2B Sales Essentials (Level 1)');
  assert.equal(u.searchParams.get('organizationName'), 'MEDJAY');
  assert.equal(u.searchParams.get('organizationId'), null);
  assert.equal(u.searchParams.get('issueYear'), '2026');
  assert.equal(u.searchParams.get('issueMonth'), '11');
  assert.equal(u.searchParams.get('certUrl'), 'https://medjay.pro/verify/MJ-B2B-2026-7K4Q9X');
  assert.equal(u.searchParams.get('certId'), 'MJ-B2B-2026-7K4Q9X');
  const raw = linkedInAddUrl(args, '');
  assert.ok(raw.includes('certUrl=https%3A%2F%2Fmedjay.pro%2Fverify%2FMJ-B2B-2026-7K4Q9X'));
  assert.ok(raw.includes('name=B2B%20Sales%20Essentials%20(Level%201)') || raw.includes('name=B2B%20Sales%20Essentials%20%28Level%201%29'));
  assert.ok(!raw.includes('+'));
  const v = new URL(linkedInAddUrl(args, '12345'));
  assert.equal(v.searchParams.get('organizationId'), '12345');
  assert.equal(v.searchParams.get('organizationName'), null);
});
