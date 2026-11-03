// Cloudflare Pages Function
// Handles GET /api/admin/course-stats?range=all|30|7
// Dashboard use only. /api/admin/* is protected by Cloudflare Access at
// the infrastructure level (same policy as /dashboard/*).
//
// Because this endpoint returns lead emails, it also refuses any request
// that does not carry the user header Cloudflare Access adds after login.
// This is a second lock in case a URL (for example a preview deployment)
// is ever reachable without Access; it is not a replacement for Access.
//
// Returns per-course counts (page opens, Day 1, Day 5, zip, form
// submissions) for the chosen range, and the list of "Follow up" leads.

import { COURSE_SLUGS, COURSE_NAMES } from '../../_lib/courses.js';

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!request.headers.get('Cf-Access-Authenticated-User-Email')) {
    return jsonResponse({ message: 'Not authorized.' }, 403);
  }
  if (!env.DB) {
    return jsonResponse({ message: 'Server not configured.' }, 500);
  }

  const range = new URL(request.url).searchParams.get('range') || 'all';
  const days = range === '7' ? 7 : range === '30' ? 30 : null;
  const since = days ? new Date(Date.now() - days * 86400000).toISOString() : '0000';

  try {
    const [events, leads, followUps] = await env.DB.batch([
      env.DB.prepare(
        'SELECT course, event, COUNT(*) AS n FROM course_events WHERE created_at >= ? GROUP BY course, event'
      ).bind(since),
      env.DB.prepare(
        'SELECT course, COUNT(*) AS n FROM course_leads WHERE created_at >= ? GROUP BY course'
      ).bind(since),
      env.DB.prepare(
        `SELECT id, email, role, team_size, course, country, brevo_status, created_at
         FROM course_leads WHERE follow_up = 1 ORDER BY created_at DESC, id DESC LIMIT 500`
      ),
    ]);

    const rows = COURSE_SLUGS.map((slug) => ({
      course: slug, name: COURSE_NAMES[slug], open: 0, day1: 0, day5: 0, zip: 0, forms: 0,
    }));
    const bySlug = Object.fromEntries(rows.map((r) => [r.course, r]));
    const key = { open: 'open', 'day-1': 'day1', 'day-5': 'day5', all: 'zip' };
    for (const r of events.results || []) {
      if (bySlug[r.course] && key[r.event]) bySlug[r.course][key[r.event]] = r.n;
    }
    for (const r of leads.results || []) {
      if (bySlug[r.course]) bySlug[r.course].forms = r.n;
    }
    const followUpLeads = (followUps.results || []).map((l) => ({ ...l, course_name: COURSE_NAMES[l.course] || l.course }));

    return jsonResponse({ range: days ? String(days) : 'all', courses: rows, followUps: followUpLeads }, 200);
  } catch (err) {
    // Access-protected endpoint: safe to surface the real D1 error.
    return jsonResponse({ message: 'Database error: ' + (err && err.message ? err.message : String(err)) }, 500);
  }
}

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
