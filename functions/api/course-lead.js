// Cloudflare Pages Function
// Handles POST /api/course-lead
//
// Optional "Stay in touch" form on the free course download pages.
// Accepts JSON (sent by the page script) or a normal form post (no JS).
// Fields: email, role, team_size, course, plus a hidden honeypot "website".
//
// 1. Validates every field against fixed allowlists.
// 2. Saves the lead to D1 (course_leads).
// 3. In the background: adds the contact to Brevo list 57 with the
//    ROLE, TEAM_SIZE and COURSE attributes, and, for a Manager or
//    Business Owner with a team of 2 or more, emails an alert to
//    steven@medjay.pro. That lead is saved with follow_up = 1.
// Brevo problems never fail the request: the lead is already saved, and
// the outcome is written to course_leads.brevo_status.
//
// On preview / non-production hosts the fields are still validated, but
// nothing is saved or sent; the normal success response is returned.
//
// SETUP: uses the existing Cloudflare secret BREVO_API_KEY. The Brevo
// contact attributes ROLE, TEAM_SIZE and COURSE (type Text) must exist.

import { COURSE_NAMES, ROLES, TEAM_SIZES, isCourse, isFollowUp, countryOf } from '../_lib/courses.js';
import { isProduction, logSkippedWrite } from '../_lib/env.js';

const BREVO_LIST_ID = 57;
const ALERT_TO = 'steven@medjay.pro';

export async function onRequestPost(context) {
  const { request, env } = context;
  const type = request.headers.get('Content-Type') || '';
  const isJson = type.includes('application/json');

  let body = {};
  try {
    if (isJson) {
      body = await request.json();
    } else {
      const form = await request.formData();
      body = Object.fromEntries(form.entries());
    }
  } catch (err) {
    return reply(isJson, null, false, 'Invalid request.', 400);
  }

  const course = String(body.course || '');
  const email = String(body.email || '').trim().toLowerCase();
  const role = String(body.role || '');
  const teamSize = String(body.team_size || '');
  const honeypot = String(body.website || '').trim();

  if (!isCourse(course)) {
    return reply(isJson, null, false, 'Invalid request.', 400);
  }

  // Honeypot filled in: pretend it worked, save nothing.
  if (honeypot) {
    return reply(isJson, course, true, 'Thanks. You are on the list.', 200);
  }

  if (!isValidEmail(email) || !ROLES.includes(role) || !TEAM_SIZES.includes(teamSize)) {
    return reply(isJson, course, false, 'Please enter a valid email and choose a role and team size.', 400);
  }

  // Preview / non-production: no D1 write, no Brevo contact, no alert email.
  if (!isProduction(request)) {
    logSkippedWrite(request, `course lead ${course}`);
    return reply(isJson, course, true, 'Thanks. You are on the list.', 200);
  }

  if (!env.DB) {
    return reply(isJson, course, false, 'Something went wrong. Please try again later.', 500);
  }

  const followUp = isFollowUp(role, teamSize);
  let leadId;
  try {
    const result = await env.DB.prepare(
      `INSERT INTO course_leads (email, role, team_size, course, country, follow_up, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(email, role, teamSize, course, countryOf(request), followUp ? 1 : 0, new Date().toISOString()).run();
    leadId = result.meta && result.meta.last_row_id;
  } catch (err) {
    return reply(isJson, course, false, 'Something went wrong. Please try again later.', 500);
  }

  context.waitUntil(syncToBrevo(env, leadId, { email, role, teamSize, course, followUp }));

  return reply(isJson, course, true, 'Thanks. You are on the list.', 200);
}

async function syncToBrevo(env, leadId, lead) {
  const statuses = [];
  if (!env.BREVO_API_KEY) {
    statuses.push('contact: no key');
  } else {
    statuses.push('contact: ' + await addContact(env.BREVO_API_KEY, lead));
    if (lead.followUp) {
      statuses.push('alert: ' + await sendAlert(env.BREVO_API_KEY, lead));
    }
  }
  if (leadId) {
    try {
      await env.DB.prepare('UPDATE course_leads SET brevo_status = ? WHERE id = ?')
        .bind(statuses.join('; '), leadId).run();
    } catch (err) {
      // Nothing more to do; the lead itself is saved.
    }
  }
}

async function addContact(apiKey, lead) {
  try {
    const res = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'api-key': apiKey },
      body: JSON.stringify({
        email: lead.email,
        listIds: [BREVO_LIST_ID],
        updateEnabled: true,
        attributes: { ROLE: lead.role, TEAM_SIZE: lead.teamSize, COURSE: COURSE_NAMES[lead.course] },
      }),
    });
    if (res.ok || res.status === 204) return 'ok';
    const data = await res.json().catch(() => ({}));
    return `error ${res.status}${data.code ? ' ' + data.code : ''}`;
  } catch (err) {
    return 'error network';
  }
}

async function sendAlert(apiKey, lead) {
  const courseName = COURSE_NAMES[lead.course];
  const htmlContent = `
    <p>A free course lead matches the follow-up rule (Manager or Business Owner, team of 2 or more).</p>
    <p><strong>Email:</strong> ${escapeHtml(lead.email)}</p>
    <p><strong>Role:</strong> ${escapeHtml(lead.role)}</p>
    <p><strong>Team size:</strong> ${escapeHtml(lead.teamSize)}</p>
    <p><strong>Course:</strong> ${escapeHtml(courseName)}</p>
    <p>It is marked "Follow up" in the dashboard.</p>
  `;
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'api-key': apiKey },
      body: JSON.stringify({
        sender: { name: 'MEDJAY Website', email: 'steven@medjay.pro' },
        to: [{ email: ALERT_TO }],
        replyTo: { email: lead.email },
        subject: `Follow-up lead: ${lead.role}, team ${lead.teamSize} (${courseName})`,
        htmlContent,
      }),
    });
    return res.ok ? 'ok' : `error ${res.status}`;
  } catch (err) {
    return 'error network';
  }
}

// JSON for the page script. For a normal form post (no JavaScript), a
// small thank-you or error page with a link back to the downloads; the
// link is built from an allowlisted slug.
function reply(isJson, course, ok, message, status) {
  if (isJson || !course) {
    return new Response(JSON.stringify({ ok, message }), {
      status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }
  const back = `/courses/${course}/download/`;
  const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>${ok ? 'Thanks' : 'Please try again'} | MEDJAY</title>
</head>
<body style="margin:0; background:#0a1428; color:#f7f4ec; font-family:Inter, system-ui, sans-serif;">
<main style="max-width:560px; margin:0 auto; padding:64px 20px;">
<h1 style="font-family:Georgia, serif; font-size:30px; margin:0 0 16px;">${escapeHtml(message)}</h1>
<p style="color:#b7bccb;">Your downloads are still on the course page.</p>
<p><a href="${back}" style="color:#e8c572;">Back to your downloads</a></p>
</main>
</body>
</html>`;
  return new Response(page, {
    status,
    headers: { 'Content-Type': 'text/html; charset=UTF-8', 'Cache-Control': 'no-store' },
  });
}

function isValidEmail(email) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
