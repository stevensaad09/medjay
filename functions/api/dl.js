// Cloudflare Pages Function
// Handles GET/HEAD /api/dl?course=<slug>&file=<day-1..day-5|all>
//
// Counts a free course download, then redirects to the real file in
// /courses/files/. Only the 11 known courses and the 6 known files are
// accepted; the redirect target is built from those allowlisted values,
// so it always stays on this site (no open redirect). Anything else is a
// 404. Logged: course, file, country, date. No IP or other personal data.
// HEAD requests, prefetches and obvious bots are redirected but not counted.

import { FILES, isCourse, isLikelyBot, countryOf } from '../_lib/courses.js';

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed.', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }

  const url = new URL(request.url);
  const course = url.searchParams.get('course') || '';
  const file = url.searchParams.get('file') || '';

  if (!isCourse(course) || !Object.prototype.hasOwnProperty.call(FILES, file)) {
    return new Response('File not found.', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=UTF-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
    });
  }

  if (env.DB && !isLikelyBot(request)) {
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
