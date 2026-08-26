// Cloudflare Pages Function
// Handles GET /api/articles
// Public, unauthenticated endpoint used by the public /articles list
// and the individual article page. Always returns published articles
// only — any query parameter is ignored so drafts can never leak
// through this endpoint regardless of auth state. Creating, updating,
// and deleting articles lives under /api/admin/articles, which is
// protected by Cloudflare Access at the infrastructure level.

export async function onRequestGet(context) {
  const { env } = context;

  if (!env.DB) {
    return jsonResponse({ message: 'Server not configured.' }, 500);
  }

  try {
    const { results } = await env.DB.prepare(
      'SELECT id, slug, title, content, excerpt, published, created_at, updated_at FROM articles WHERE published = 1 ORDER BY created_at DESC'
    ).all();
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
