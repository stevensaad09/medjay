// Exam and certificate logic with no database or network access.
// Not a route: exports no onRequest handlers. Unit-tested in tests/.
//
// Correct answers never live in this repo. They are loaded from the
// D1 table exam_keys at grading time (see functions/_lib/exam-db.js).

import data from '../_data/exam-questions.json';

// ---- Config constants (Steven fills the empty ones after merge) ----

// LinkedIn numeric company id. The "Add to LinkedIn" link always sends
// organizationName=MEDJAY; when this id is set it also sends organizationId.
export const LINKEDIN_COMPANY_ID = '106624858';
// Shown on the verification page next to "Issued by MEDJAY".
export const LINKEDIN_PROFILE_URL = 'https://linkedin.com/in/steven-saad';
export const LINKEDIN_COMPANY_URL = 'https://www.linkedin.com/company/medjay-physcology-training/';

export const SITE_ORIGIN = 'https://medjay.pro';
export const CERT_YEARS_KEPT = 10;

// ---- Exams (from functions/_data/exam-questions.json) ----

export const EXAMS = Object.freeze(
  Object.fromEntries(data.exams.map((e) => [e.slug, e]))
);
export const EXAM_SLUGS = Object.keys(EXAMS);
export const LETTERS = ['A', 'B', 'C', 'D'];

export function getExam(slug) {
  return typeof slug === 'string' && Object.prototype.hasOwnProperty.call(EXAMS, slug)
    ? EXAMS[slug]
    : null;
}

// Level of an exam: 2 for Level 2 entries in exam-questions.json, 1 for
// everything else (Level 1 entries carry no `level` field, so missing
// means 1). Level 1 behaviour is unchanged by this.
export function levelOf(exam) {
  return exam && exam.level === 2 ? 2 : 1;
}

export function levelLabel(exam) {
  return `Level ${levelOf(exam)}`;
}

// answers: exactly `total` characters, each A-D (upper case only).
export function isValidAnswers(answers, total) {
  return typeof answers === 'string'
    && answers.length === total
    && /^[ABCD]+$/.test(answers);
}

// keys: Map or object of question_no -> letter. Returns the score, or
// null if the key set is incomplete (so the caller can refuse to grade).
export function grade(answers, keys, total) {
  const get = (n) => (keys instanceof Map ? keys.get(n) : keys[n]);
  let score = 0;
  for (let n = 1; n <= total; n++) {
    const k = get(n);
    if (!LETTERS.includes(k)) return null;
    if (answers[n - 1] === k) score++;
  }
  return score;
}

// ---- Certificate numbers ----

// 32 characters: A-Z and 2-9 without O, 0, I, 1.
export const CERT_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CERT_NO_RE = /^MJ-[A-Z0-9]{3}-\d{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

export function randomCode(len = 6, rand = (n) => crypto.getRandomValues(new Uint8Array(n))) {
  // 256 is a multiple of 32, so byte % 32 has no bias.
  const bytes = rand(len);
  let out = '';
  for (let i = 0; i < len; i++) out += CERT_CHARSET[bytes[i] % 32];
  return out;
}

export function makeCertificateNo(prefix, year, code = randomCode()) {
  return `MJ-${prefix}-${year}-${code}`;
}

export function isCertificateNo(value) {
  return typeof value === 'string' && CERT_NO_RE.test(value);
}

// ---- Claim form fields ----

// Trim, collapse runs of whitespace, NFC-normalize. Returns the cleaned
// name or null. Allows letters and marks of any script (Arabic, Latin,
// ...), spaces, and . ' - (plus the Arabic tatweel via \p{L}/\p{M}).
// Rejects digits, symbols, control and bidi-override characters.
export const NAME_MIN = 2;
export const NAME_MAX = 80;
export function cleanName(raw) {
  if (typeof raw !== 'string') return null;
  const name = raw.normalize('NFC').replace(/\s+/gu, ' ').trim();
  if (name.length < NAME_MIN || name.length > NAME_MAX) return null;
  if (!/^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u.test(name)) return null;
  if (!/\p{L}.*\p{L}/su.test(name)) return null;
  return name;
}

export function cleanEmail(raw) {
  if (typeof raw !== 'string') return null;
  const email = raw.trim().toLowerCase();
  if (email.length > 254) return null;
  if (!/^[^\s@<>"',;:()]+@[^\s@<>"',;:()]+\.[^\s@<>"',;:()]{2,}$/.test(email)) return null;
  return email;
}

// ---- Dates ----

export function addYears(iso, years) {
  const d = new Date(iso);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString();
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];
export function formatIssueDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// ---- URLs ----

export function verifyUrl(certNo) {
  return `${SITE_ORIGIN}/verify/${encodeURIComponent(certNo)}`;
}
export function certificateUrl(certNo) {
  return `${SITE_ORIGIN}/certificate/${encodeURIComponent(certNo)}`;
}

export function linkedInAddUrl({ courseTitle, certNo, issuedAt, level }, companyId = LINKEDIN_COMPANY_ID) {
  const d = new Date(issuedAt);
  const p = new URLSearchParams();
  p.set('startTask', 'CERTIFICATION_NAME');
  p.set('name', `${courseTitle} (Level ${level === 2 ? 2 : 1})`);
  if (companyId) p.set('organizationId', String(companyId));
  // Always sent: a plain-text fallback if LinkedIn cannot resolve the id.
  p.set('organizationName', 'MEDJAY');
  p.set('issueYear', String(d.getUTCFullYear()));
  p.set('issueMonth', String(d.getUTCMonth() + 1));
  p.set('certUrl', verifyUrl(certNo));
  p.set('certId', certNo);
  // URLSearchParams encodes spaces as "+"; use %20 so every client reads it the same.
  return 'https://www.linkedin.com/profile/add?' + p.toString().replace(/\+/g, '%20');
}
