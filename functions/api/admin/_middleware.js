// Cloudflare Pages middleware for every route under /api/admin/*.
// Cloudflare runs it before each admin endpoint, so a new admin endpoint is
// covered automatically.
//
// 1. Rejects any request without the Cloudflare Access headers (403).
// 2. On preview / non-production hosts, blocks every write (anything other
//    than GET or HEAD) so previews never change real data. Reads still work.

import { hasAccessHeaders } from '../../_lib/auth.js';
import { isProduction, logSkippedWrite } from '../../_lib/env.js';

export async function onRequest(context) {
  const { request } = context;

  if (!hasAccessHeaders(request)) {
    return jsonResponse({ message: 'Not authorized.' }, 403);
  }

  const isRead = request.method === 'GET' || request.method === 'HEAD';
  if (!isRead && !isProduction(request)) {
    logSkippedWrite(request, `admin ${request.method} ${new URL(request.url).pathname}`);
    return jsonResponse({ message: 'Preview mode: changes disabled' }, 403);
  }

  return context.next();
}

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
