// Cloudflare Pages Function
// Handles POST /api/program-interest
//
// Interest form on three program pages ("Request access" on the USA
// Self-Study page, "Request a proposal" on the USA Enterprise and Selling
// to Contractors pages). Emails the request to steven@medjay.pro through
// Brevo, with the submitter as Reply-To. Nothing is stored in D1.
//
// Fields (JSON): program, name, email, job_title, country, team_size,
// turnstile_token, plus a hidden honeypot "website".
//
// Order: parse -> honeypot (fake success, nothing sent) -> validate ->
// preview / non-production (validated, nothing sent) -> Turnstile -> Brevo.
// Field values are never logged and never put in a URL.
//
// SETUP: uses the existing Cloudflare secrets BREVO_API_KEY and
// TURNSTILE_SECRET_KEY.

import { isProduction, logSkippedWrite } from '../_lib/env.js';
import { verifyTurnstile } from '../_lib/turnstile.js';

const SEND_TO = 'steven@medjay.pro';

const HUB_TEAM_SIZES = ['Just me', '2–10', '11–50', '50–100', '100–200', '200+'];
const ENTERPRISE_TEAM_SIZES = ['Up to 25', '26–50', '51–100', 'Over 100'];

// Allowed programs, their display names and the team-size options shown on each page.
export const PROGRAMS = {
  'usa-real-estate': { name: 'MEDJAY Elite Training: USA Self-Study Edition', teamSizes: HUB_TEAM_SIZES },
  'usa-real-estate-enterprise': { name: 'MEDJAY Enterprise Brokerage Program: USA Edition', teamSizes: ENTERPRISE_TEAM_SIZES },
  'selling-to-contractors': { name: 'Selling to Contractors', teamSizes: HUB_TEAM_SIZES },
};

const MAX = { name: 100, email: 254, job_title: 100, country: 100 };

const MSG_OK = 'Thanks, we have your details.';
const MSG_ERROR = 'Something went wrong. Please try again.';
const MSG_UNCONFIGURED = 'Something went wrong. Please try again later, or email steven@medjay.pro.';

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return jsonResponse({ message: 'Invalid request.' }, 400);
  }
  if (!body || typeof body !== 'object') return jsonResponse({ message: 'Invalid request.' }, 400);

  const field = (k) => (typeof body[k] === 'string' ? body[k].trim() : '');
  const programSlug = field('program');
  const name = field('name');
  const email = field('email');
  const jobTitle = field('job_title');
  const country = field('country');
  const teamSize = field('team_size');
  const token = field('turnstile_token');

  const program = Object.prototype.hasOwnProperty.call(PROGRAMS, programSlug) ? PROGRAMS[programSlug] : null;
  if (!program) return jsonResponse({ message: 'Invalid request.' }, 400);

  // Honeypot filled in: pretend it worked, send nothing.
  if (field('website')) return jsonResponse({ message: MSG_OK }, 200);

  if (!name || !email || !jobTitle || !country || !teamSize) {
    return jsonResponse({ message: 'Please fill in all fields.' }, 400);
  }
  if (name.length > MAX.name || jobTitle.length > MAX.job_title || country.length > MAX.country || email.length > MAX.email) {
    return jsonResponse({ message: 'Invalid request.' }, 400);
  }
  if (!isValidEmail(email)) {
    return jsonResponse({ message: 'Please enter a valid email address.' }, 400);
  }
  if (!program.teamSizes.includes(teamSize)) {
    return jsonResponse({ message: 'Invalid request.' }, 400);
  }

  // Preview / non-production: validated, nothing sent.
  if (!isProduction(request)) {
    logSkippedWrite(request, 'program interest email');
    return jsonResponse({ message: MSG_OK }, 200);
  }

  const check = await verifyTurnstile(request, env, token);
  if (check === 'missing') return jsonResponse({ message: 'Please complete the verification challenge.' }, 400);
  if (check === 'failed') return jsonResponse({ message: 'Verification failed. Please try again.' }, 403);
  if (check === 'unconfigured') return jsonResponse({ message: MSG_UNCONFIGURED }, 500);
  if (check !== 'ok') return jsonResponse({ message: 'Verification failed. Please try again.' }, 502);

  if (!env.BREVO_API_KEY) {
    return jsonResponse({ message: MSG_UNCONFIGURED }, 500);
  }

  const htmlContent = `
    <p><strong>Program:</strong> ${escapeHtml(program.name)}</p>
    <p><strong>Name:</strong> ${escapeHtml(name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(email)}</p>
    <p><strong>Job title:</strong> ${escapeHtml(jobTitle)}</p>
    <p><strong>Country:</strong> ${escapeHtml(country)}</p>
    <p><strong>Team size:</strong> ${escapeHtml(teamSize)}</p>
  `;

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'api-key': env.BREVO_API_KEY },
      body: JSON.stringify({
        sender: { name: 'MEDJAY Website', email: SEND_TO },
        to: [{ email: SEND_TO }],
        replyTo: { email, name: oneLine(name) },
        subject: oneLine(`Program request: ${program.name} (${name})`),
        htmlContent,
      }),
    });
    if (res.ok) return jsonResponse({ message: MSG_OK }, 200);
    return jsonResponse({ message: MSG_ERROR }, 502);
  } catch (err) {
    return jsonResponse({ message: MSG_ERROR }, 502);
  }
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Subjects and display names must be a single line.
function oneLine(str) {
  return String(str).replace(/[\r\n]+/g, ' ').slice(0, 200);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
