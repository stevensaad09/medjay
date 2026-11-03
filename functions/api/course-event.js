// Cloudflare Pages Function
// Handles POST /api/course-event  body: { course }
//
// Logs a "page open" when a free course download page is opened (sent by
// a small script on the page). Same rules as /api/dl: allowlisted course
// only, no IP or other personal data, obvious bots are not counted.
// On preview / non-production hosts nothing is written.

import { isCourse, isLikelyBot, countryOf } from '../_lib/courses.js';
import { isProduction, logSkippedWrite } from '../_lib/env.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  let course = '';
  try {
    const body = await request.json();
    course = String(body.course || '');
  } catch (err) {
    return new Response(null, { status: 400 });
  }

  if (!isCourse(course)) {
    return new Response(null, { status: 400 });
  }

  if (!isProduction(request)) {
    logSkippedWrite(request, `page open ${course}`);
  } else if (env.DB && !isLikelyBot(request)) {
    try {
      await env.DB.prepare(
        "INSERT INTO course_events (course, event, country, created_at) VALUES (?, 'open', ?, ?)"
      ).bind(course, countryOf(request), new Date().toISOString()).run();
    } catch (err) {
      // Counting is best effort; never surface an error to the page.
    }
  }

  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}
