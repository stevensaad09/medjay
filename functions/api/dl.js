// Cloudflare Pages Function
// Handles GET/HEAD /api/dl?course=<slug>&file=<day-1..day-5|all>
// (day-6..day-10 as well for a 10-day course such as first-customer)
//
// Counts a free course download, then redirects to the real file in
// /courses/files/. Only the known courses and each course's own files are
// accepted; the redirect target is built from those allowlisted values,
// so it always stays on this site (no open redirect). Anything else is a
// 404. Logged: course, file, country, date. No IP or other personal data.
// Days 6 to 10 are redirected but not counted (see _lib/courses.js).
// HEAD requests, prefetches and obvious bots are redirected but not counted.
// On preview / non-production hosts nothing is written (see _lib/env.js).

import { FILES, hasFile, isCountedFile, isLikelyBot, countryOf } from '../_lib/courses.js';
import { isProduction, logSkippedWrite } from '../_lib/env.js';

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed.', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }

  const url = new URL(request.url);
  const course = url.searchParams.get('course') || '';
  const file = url.searchParams.get('file') || '';

  if (!hasFile(course, file)) {
    return new Response('File not found.', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=UTF-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
    });
  }

  if (!isProduction(request)) {
    logSkippedWrite(request, `download ${course} ${file}`);
  } else if (env.DB && isCountedFile(file) && !isLikelyBot(request)) {
    const insert = env.DB.prepare(
      'INSERT INTO course_events (course, event, country, created_at) VALUES (?, ?, ?, ?)'
    ).bind(course, file, countryOf(request), new Date().toISOString());
    // Never delay or block the download on logging.
    context.waitUntil(insert.run().catch(() => {}));
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: `/courses/files/${course}${FILES[file]}`,
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}
