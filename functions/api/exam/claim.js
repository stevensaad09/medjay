// Cloudflare Pages Function
// Handles POST /api/exam/claim
//
// Body: { course, attempt_id, full_name, email, updates }
//
// Issues the certificate for a PASSED attempt (see claimCertificate in
// functions/_lib/exam-db.js for the rules):
//   - a failed, unknown or other-course attempt can never claim;
//   - one certificate per (course, email): claiming again returns the
//     existing certificate;
//   - an attempt that already produced a certificate cannot be reused
//     for a different email.
//
// After a successful claim, in the background (never blocks the claim):
//   - always: one transactional email with the certificate link (Brevo);
//   - only if "updates" was ticked: add the email to Brevo list 57.
// Emails are never written to logs.

import { getExam, cleanName, cleanEmail, certificateUrl, verifyUrl, formatIssueDate, levelOf } from '../../_lib/exam.js';
import { claimCertificate, checkAccessCode, bindAccessCode, loadAccessCode } from '../../_lib/exam-db.js';
import { isProduction, isLocalDevWrites } from '../../_lib/env.js';
import { jsonResponse, escapeHtml } from '../../_lib/site.js';

const BREVO_LIST_ID = 57;
const SENDER = { name: 'MEDJAY', email: 'steven@medjay.pro' };

export async function onRequestPost(context) {
  const { request, env } = context;

  const local = isLocalDevWrites(request, env);
  if (!isProduction(request) && !local) {
    return jsonResponse({ message: 'Certificates can only be claimed on medjay.pro.' }, 403);
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

  const fullName = cleanName(body.full_name);
  if (!fullName) {
    return jsonResponse({ message: 'Please enter your full name (2 to 80 letters; spaces, hyphens, apostrophes and dots are allowed).' }, 400);
  }
  const email = cleanEmail(body.email);
  if (!email) return jsonResponse({ message: 'Please enter a valid email address.' }, 400);
  const wantsUpdates = body.updates === true;

  if (!env.DB) return jsonResponse({ message: 'Server not configured. Please try again later.' }, 500);

  // Level 2 only: the access code is checked on the server and bound to
  // this email BEFORE the certificate is issued, so a certificate can
  // never be issued on a code owned by someone else. Level 1 skips this.
  if (levelOf(exam) === 2) {
    const codeCheck = await checkAccessCode(env.DB, {
      request, slug: exam.slug, code: body.access_code, email,
    });
    if (!codeCheck.ok) {
      if (codeCheck.reason === 'missing') {
        return jsonResponse({ message: 'An access code is required for this exam. Enter the code from your purchase.' }, 400);
      }
      if (codeCheck.reason === 'rate_limited') {
        return jsonResponse({ message: 'Too many wrong codes. Try again in 15 minutes.' }, 429);
      }
      if (codeCheck.reason === 'bound') {
        return jsonResponse({ message: 'This access code is already tied to another email address.' }, 409);
      }
      return jsonResponse({ message: 'This access code is not valid for this exam. Check the code and try again.' }, 403);
    }
    const bound = await bindAccessCode(env.DB, { code: codeCheck.row.code, email });
    if (!bound) {
      const again = await loadAccessCode(env.DB, codeCheck.row.code);
      if (!again || again.email !== email) {
        return jsonResponse({ message: 'This access code is already tied to another email address.' }, 409);
      }
    }
  }

  let result;
  try {
    result = await claimCertificate(env.DB, { attemptId: body.attempt_id, slug: exam.slug, fullName, email });
  } catch (err) {
    console.error('[claim] failed');
    return jsonResponse({ message: 'Something went wrong. Please try again.' }, 500);
  }

  if (result.status === 'invalid') {
    return jsonResponse({ message: 'This exam result cannot be used to claim a certificate. Please pass the exam first.' }, 403);
  }
  if (result.status === 'used') {
    return jsonResponse({ message: 'This exam result has already been used for a certificate with a different email address.' }, 409);
  }
  if (result.status === 'busy') {
    return jsonResponse({ message: 'Your certificate is being created. Please try again in a moment.' }, 409);
  }

  const cert = result.cert;
  if (!local && env.BREVO_API_KEY) {
    context.waitUntil(afterClaim(env.BREVO_API_KEY, { email, cert, exam, wantsUpdates }));
  }

  return jsonResponse({
    certificate_no: cert.certificate_no,
    full_name: cert.full_name,
    existing: result.status === 'existing',
    url: `/certificate/${encodeURIComponent(cert.certificate_no)}`,
  }, result.status === 'created' ? 201 : 200);
}

async function afterClaim(apiKey, { email, cert, exam, wantsUpdates }) {
  const jobs = [sendCertificateEmail(apiKey, email, cert, exam)];
  if (wantsUpdates) jobs.push(addToList(apiKey, email, exam));
  const results = await Promise.allSettled(jobs);
  results.forEach((r, i) => {
    const what = i === 0 ? 'email' : 'list';
    if (r.status === 'rejected' || r.value !== 'ok') console.error(`[claim] brevo ${what}: ${r.value || 'error'}`);
  });
}

async function sendCertificateEmail(apiKey, email, cert, exam) {
  const certLink = certificateUrl(cert.certificate_no);
  const verify = verifyUrl(cert.certificate_no);
  const htmlContent = `
<div style="font-family:Arial,Helvetica,sans-serif;color:#0a1428;max-width:560px;">
  <p>Hello ${escapeHtml(cert.full_name)},</p>
  <p>Congratulations on completing <strong>${escapeHtml(exam.title)} (Level ${levelOf(exam)})</strong>.</p>
  <p>Your certificate: <a href="${escapeHtml(certLink)}">${escapeHtml(certLink)}</a></p>
  <p>Certificate No: ${escapeHtml(cert.certificate_no)}<br>Issued: ${escapeHtml(formatIssueDate(cert.issued_at))}</p>
  <p>Anyone can check it at <a href="${escapeHtml(verify)}">${escapeHtml(verify)}</a>.</p>
  <p>To save it as a PDF, open the link and choose "Download PDF" (or Print, then "Save as PDF").</p>
  <p>Steven Saad<br>Founder, MEDJAY</p>
</div>`;
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'api-key': apiKey },
      body: JSON.stringify({
        sender: SENDER,
        to: [{ email, name: cert.full_name }],
        subject: `Your MEDJAY certificate: ${exam.title} (Level ${levelOf(exam)})`,
        htmlContent,
      }),
    });
    return res.ok ? 'ok' : `error ${res.status}`;
  } catch (err) {
    return 'error network';
  }
}

async function addToList(apiKey, email, exam) {
  try {
    const res = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'api-key': apiKey },
      body: JSON.stringify({
        email,
        listIds: [BREVO_LIST_ID],
        updateEnabled: true,
        attributes: { COURSE: exam.title },
      }),
    });
    if (res.ok || res.status === 204) return 'ok';
    const data = await res.json().catch(() => ({}));
    return `error ${res.status}${data.code ? ' ' + data.code : ''}`;
  } catch (err) {
    return 'error network';
  }
}
