// Cloudflare Pages Function
// Handles POST /api/exam/submit
//
// Body: { course: <slug>, answers: "<20 letters A-D>", turnstile_token }
//
// 1. Validates the slug and that all 20 questions are answered (A-D).
// 2. Verifies Turnstile on EVERY submit (one token per submit), so the
//    endpoint cannot be used to brute-force the answer key cheaply.
// 3. For Level 2 (paid) exams only, checks the access code on the server
//    (D1 exam_access_codes) with a per-IP rate limit on wrong codes.
//    Level 1 exams need no code and skip this step entirely.
// 4. Loads the key from D1 (exam_keys) and grades on the server.
// 5. Stores the attempt and returns ONLY { score, total, passed } plus,
//    when passed, the attempt_id needed to claim the certificate.
//    It never returns correct answers or which questions were wrong.
//    Level 2 keeps this score-only response: with unlimited retakes,
//    per-question feedback would let anyone reverse-engineer the key.
//
// Preview deployments (*.pages.dev) share the production D1, so exams
// are refused there; they work on medjay.pro, and on localhost when
// EXAM_LOCAL_WRITES=1 (local D1, Turnstile skipped).

import { getExam, isValidAnswers, grade, levelOf } from '../../_lib/exam.js';
import { loadExamRow, loadKeys, insertAttempt, checkAccessCode } from '../../_lib/exam-db.js';
import { isProduction, isLocalDevWrites } from '../../_lib/env.js';
import { verifyTurnstile } from '../../_lib/turnstile.js';
import { jsonResponse } from '../../_lib/site.js';

const NOT_AVAILABLE = 'This exam is not available yet. Please try again later.';

export async function onRequestPost(context) {
  const { request, env } = context;

  const local = isLocalDevWrites(request, env);
  if (!isProduction(request) && !local) {
    return jsonResponse({ message: 'Exams can only be submitted on medjay.pro.' }, 403);
  }

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return jsonResponse({ message: 'Invalid request.' }, 400);
  }
  if (!body || typeof body !== 'object') return jsonResponse({ message: 'Invalid request.' }, 400);

  const exam = getExam(body.course);
  if (!exam) return jsonResponse({ message: 'Unknown exam.' }, 404);

  const total = exam.questions.length;
  const answers = typeof body.answers === 'string' ? body.answers : '';
  if (!isValidAnswers(answers, total)) {
    return jsonResponse({ message: `Please answer all ${total} questions before submitting.` }, 400);
  }

  if (!local) {
    const t = await verifyTurnstile(request, env, body.turnstile_token);
    if (t === 'missing') return jsonResponse({ message: 'Please complete the verification challenge.' }, 400);
    if (t === 'unconfigured') return jsonResponse({ message: 'Server not configured. Please try again later.' }, 500);
    if (t !== 'ok') return jsonResponse({ message: 'Verification failed. Please try again.' }, 403);
  }

  if (!env.DB) return jsonResponse({ message: 'Server not configured. Please try again later.' }, 500);

  // Level 2 only: the access code is checked on the server, never only
  // in the browser. A missing code is a 400; a wrong code counts toward
  // the per-IP rate limit inside checkAccessCode.
  if (levelOf(exam) === 2) {
    const codeCheck = await checkAccessCode(env.DB, {
      request, slug: exam.slug, code: body.access_code,
    });
    if (!codeCheck.ok) {
      if (codeCheck.reason === 'missing') {
        return jsonResponse({ message: 'An access code is required for this exam. Enter the code from your purchase.' }, 400);
      }
      if (codeCheck.reason === 'rate_limited') {
        return jsonResponse({ message: 'Too many wrong codes. Try again in 15 minutes.' }, 429);
      }
      return jsonResponse({ message: 'This access code is not valid for this exam. Check the code and try again.' }, 403);
    }
  }

  let row, keys;
  try {
    row = await loadExamRow(env.DB, exam.slug);
    keys = await loadKeys(env.DB, exam.slug);
  } catch (err) {
    console.error('[exam] key load failed');
    return jsonResponse({ message: NOT_AVAILABLE }, 503);
  }
  if (!row || Number(row.active) !== 1 || Number(row.total) !== total || keys.size !== total) {
    console.error(`[exam] not ready: ${exam.slug} (row ${row ? 'yes' : 'no'}, keys ${keys.size})`);
    return jsonResponse({ message: NOT_AVAILABLE }, 503);
  }

  const score = grade(answers, keys, total);
  if (score === null) {
    console.error(`[exam] incomplete key: ${exam.slug}`);
    return jsonResponse({ message: NOT_AVAILABLE }, 503);
  }
  const passMark = Number(row.pass_mark);
  const passed = score >= passMark;
  const id = crypto.randomUUID();

  try {
    await insertAttempt(env.DB, { id, slug: exam.slug, answers, score, passed, createdAt: new Date().toISOString() });
  } catch (err) {
    console.error('[exam] attempt insert failed');
    return jsonResponse({ message: 'Something went wrong. Please try again.' }, 500);
  }

  const out = { score, total, passed };
  if (passed) out.attempt_id = id;
  return jsonResponse(out, 200);
}
