// D1 access for exams, attempts and certificates. Every query is
// parameterized. Not a route: exports no onRequest handlers.

import {
  getExam, makeCertificateNo, randomCode, addYears, CERT_YEARS_KEPT,
} from './exam.js';

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// The exams row (active flag, pass mark) for a slug, or null.
export async function loadExamRow(db, slug) {
  return db.prepare(
    'SELECT course_slug, prefix, title, total, pass_mark, active FROM exams WHERE course_slug = ?'
  ).bind(slug).first();
}

// question_no -> letter. May be empty or incomplete: the caller checks.
export async function loadKeys(db, slug) {
  const { results } = await db.prepare(
    'SELECT question_no, correct FROM exam_keys WHERE course_slug = ?'
  ).bind(slug).all();
  const keys = new Map();
  for (const r of results || []) keys.set(Number(r.question_no), r.correct);
  return keys;
}

// ---- Level 2 access codes (paid exams only; Level 1 never uses these) ----

// The access-code row for a code, or null. Codes live only in D1.
export async function loadAccessCode(db, code) {
  if (typeof code !== 'string' || !code) return null;
  return db.prepare(
    'SELECT code, course_slug, email, bound_at, revoked FROM exam_access_codes WHERE code = ?'
  ).bind(code).first();
}

// Binds an unbound code to an email on first successful claim.
// Returns true when this call bound it, false when it was already bound
// (to anyone). The caller re-reads the row to see who owns it.
export async function bindAccessCode(db, { code, email }) {
  const res = await db.prepare(
    `UPDATE exam_access_codes SET email = ?, bound_at = datetime('now')
     WHERE code = ? AND email IS NULL AND revoked = 0`
  ).bind(email, code).run();
  return changes(res);
}

// ---- Wrong-code rate limiting (per IP, Level 2 only) ----

export const CODE_FAILURE_LIMIT = 10;
export const CODE_FAILURE_WINDOW_MINUTES = 15;

export function clientIp(request) {
  return request.headers.get('CF-Connecting-IP') || '';
}

export async function countRecentCodeFailures(db, ip) {
  const row = await db.prepare(
    `SELECT COUNT(*) AS n FROM exam_code_failures
     WHERE ip = ? AND created_at >= datetime('now', ?)`
  ).bind(ip, `-${CODE_FAILURE_WINDOW_MINUTES} minutes`).first();
  return Number(row ? row.n : 0);
}

export async function recordCodeFailure(db, { ip, slug }) {
  await db.prepare(
    `DELETE FROM exam_code_failures WHERE created_at < datetime('now', '-1 day')`
  ).run().catch(() => {});
  await db.prepare(
    'INSERT INTO exam_code_failures (ip, course_slug) VALUES (?, ?)'
  ).bind(ip, slug).run();
}

// Validates a Level 2 access code on the server. Returns:
//   { ok: true, row }                      code is valid for this course
//   { ok: false, reason: 'missing' }       no code supplied
//   { ok: false, reason: 'invalid' }       unknown code, wrong course, or revoked
//   { ok: false, reason: 'bound' }         code is bound to a different email
//   { ok: false, reason: 'rate_limited' }  too many wrong codes from this IP
// Level 1 exams never call this: they need no code. The browser never
// decides: every check here reads D1.
export async function checkAccessCode(db, { request, slug, code, email = null }) {
  if (typeof code !== 'string' || !code.trim()) return { ok: false, reason: 'missing' };
  const clean = code.trim().toUpperCase();
  const ip = clientIp(request);
  if ((await countRecentCodeFailures(db, ip)) >= CODE_FAILURE_LIMIT) {
    return { ok: false, reason: 'rate_limited' };
  }
  const row = await loadAccessCode(db, clean);
  if (!row || row.course_slug !== slug || Number(row.revoked) === 1) {
    await recordCodeFailure(db, { ip, slug });
    return { ok: false, reason: 'invalid' };
  }
  if (email && row.email && row.email !== email) return { ok: false, reason: 'bound' };
  return { ok: true, row };
}

export async function insertAttempt(db, { id, slug, answers, score, passed, createdAt }) {
  await db.prepare(
    `INSERT INTO exam_attempts (id, course_slug, answers, score, passed, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(id, slug, answers, score, passed ? 1 : 0, createdAt).run();
}

export async function getCertificate(db, certNo) {
  return db.prepare(
    `SELECT certificate_no, course_slug, full_name, issued_at, revoked
     FROM certificates WHERE certificate_no = ?`
  ).bind(certNo).first();
}

async function certWithEmail(db, certNo) {
  return db.prepare(
    `SELECT certificate_no, course_slug, full_name, email, issued_at, revoked
     FROM certificates WHERE certificate_no = ?`
  ).bind(certNo).first();
}

async function certByCourseEmail(db, slug, email) {
  return db.prepare(
    `SELECT certificate_no, course_slug, full_name, email, issued_at, revoked
     FROM certificates WHERE course_slug = ? AND email = ?`
  ).bind(slug, email).first();
}

async function getAttempt(db, id) {
  return db.prepare(
    'SELECT id, course_slug, passed, certificate_no FROM exam_attempts WHERE id = ?'
  ).bind(id).first();
}

const publicCert = (c) => ({
  certificate_no: c.certificate_no,
  course_slug: c.course_slug,
  full_name: c.full_name,
  issued_at: c.issued_at,
});

// Claims a certificate for a passed attempt.
// Returns one of:
//   { status: 'created',  cert }
//   { status: 'existing', cert }   same (course, email) already has one
//   { status: 'invalid' }          unknown / failed / other-course attempt
//   { status: 'used' }             attempt already claimed by another email
//   { status: 'busy' }             a concurrent claim is in progress
//
// The attempt row is "reserved" first (certificate_no set only if it is
// still NULL), so one attempt can never produce two certificates even
// when two claims race.
export async function claimCertificate(db, {
  attemptId, slug, fullName, email, now = new Date().toISOString(), code = randomCode, maxTries = 5,
}) {
  const exam = getExam(slug);
  if (!exam || typeof attemptId !== 'string' || !UUID_RE.test(attemptId)) return { status: 'invalid' };

  const attempt = await getAttempt(db, attemptId);
  if (!attempt || attempt.course_slug !== slug || Number(attempt.passed) !== 1) return { status: 'invalid' };

  if (attempt.certificate_no) return resolveClaimed(db, attempt.certificate_no, email);

  const existing = await certByCourseEmail(db, slug, email);
  if (existing) return linkExisting(db, attemptId, existing, email);

  const year = new Date(now).getUTCFullYear();
  let certNo = makeCertificateNo(exam.prefix, year, code());

  const reserve = await db.prepare(
    `UPDATE exam_attempts SET certificate_no = ?
     WHERE id = ? AND certificate_no IS NULL AND passed = 1 AND course_slug = ?`
  ).bind(certNo, attemptId, slug).run();
  if (!changes(reserve)) {
    const again = await getAttempt(db, attemptId);
    return again && again.certificate_no ? resolveClaimed(db, again.certificate_no, email) : { status: 'invalid' };
  }

  const purgeAfter = addYears(now, CERT_YEARS_KEPT);
  for (let attemptNo = 1; ; attemptNo++) {
    try {
      await db.prepare(
        `INSERT INTO certificates
           (certificate_no, course_slug, attempt_id, full_name, email, score, issued_at, purge_after)
         VALUES (?, ?, ?, ?, ?, (SELECT score FROM exam_attempts WHERE id = ?), ?, ?)`
      ).bind(certNo, slug, attemptId, fullName, email, attemptId, now, purgeAfter).run();
      return { status: 'created', cert: { certificate_no: certNo, course_slug: slug, full_name: fullName, issued_at: now } };
    } catch (err) {
      // Same (course, email) claimed concurrently through another attempt.
      const dup = await certByCourseEmail(db, slug, email);
      if (dup) {
        await db.prepare('UPDATE exam_attempts SET certificate_no = ? WHERE id = ? AND certificate_no = ?')
          .bind(dup.certificate_no, attemptId, certNo).run();
        return { status: 'existing', cert: publicCert(dup) };
      }
      // Certificate number already taken: pick another and retry.
      const taken = await getCertificate(db, certNo);
      if (taken && attemptNo < maxTries) {
        const next = makeCertificateNo(exam.prefix, year, code());
        await db.prepare('UPDATE exam_attempts SET certificate_no = ? WHERE id = ? AND certificate_no = ?')
          .bind(next, attemptId, certNo).run();
        certNo = next;
        continue;
      }
      // Give the reservation back so the person can try again.
      await db.prepare('UPDATE exam_attempts SET certificate_no = NULL WHERE id = ? AND certificate_no = ?')
        .bind(attemptId, certNo).run().catch(() => {});
      throw err;
    }
  }
}

async function resolveClaimed(db, certNo, email) {
  const cert = await certWithEmail(db, certNo);
  if (!cert) return { status: 'busy' };
  if (cert.email !== email) return { status: 'used' };
  return { status: 'existing', cert: publicCert(cert) };
}

async function linkExisting(db, attemptId, existing, email) {
  const res = await db.prepare(
    'UPDATE exam_attempts SET certificate_no = ? WHERE id = ? AND certificate_no IS NULL'
  ).bind(existing.certificate_no, attemptId).run();
  if (!changes(res)) {
    const again = await getAttempt(db, attemptId);
    return resolveClaimed(db, again.certificate_no, email);
  }
  return { status: 'existing', cert: publicCert(existing) };
}

function changes(result) {
  return Number((result && result.meta && result.meta.changes) || 0);
}
