// Cloudflare Pages Function
// Handles GET /api/articles
// Public, unauthenticated endpoint used by the public /articles list
// and the individual article page. Always returns published articles
// only — any query parameter is ignored so drafts can never leak
// through this endpoint regardless of auth state. Creating, updating,
// and deleting articles lives under /api/admin/articles, which is
// protected by Cloudflare Access at the infrastructure level.
//
// Optional filter: /api/articles?audience=founders (or general,
// job-seekers) returns only published articles with that audience tag.
// Without it the query is the original one, which does not read the
// audience column, so the full list works even on a database where
// migration 0004 has not been run. With it, a missing column gives a 500
// and the /founders/ page simply keeps its articles section hidden.

import { isAudience } from '../_lib/articles.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const audience = new URL(request.url).searchParams.get('audience');

  if (audience !== null && !isAudience(audience)) {
    return jsonResponse({ message: 'Unknown audience.' }, 400);
  }

  if (!env.DB) {
    return jsonResponse({ message: 'Server not configured.' }, 500);
  }

  try {
    const stmt = audience === null
      ? env.DB.prepare(
        'SELECT id, slug, title, content, excerpt, published, created_at, updated_at FROM articles WHERE published = 1 ORDER BY created_at DESC'
      )
      : env.DB.prepare(
        'SELECT id, slug, title, excerpt, audience, created_at, updated_at FROM articles WHERE published = 1 AND audience = ? ORDER BY created_at DESC'
      ).bind(audience);
    const { results } = await stmt.all();
    return jsonResponse({ articles: results || [] }, 200);
  } catch (err) {
    return jsonResponse({ message: 'Something went wrong. Please try again.' }, 500);
  }
}

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
