// Cloudflare Pages Function
// Handles GET /api/admin/comments
// Dashboard use only. /api/admin/* is protected by Cloudflare Access at
// the infrastructure level (same policy as /dashboard/*), so no
// additional auth check is done here.
//
// GET - returns ALL comments (pending and approved) with their article's
//       title and slug, pending first, then newest first.

export async function onRequestGet(context) {
  const { env } = context;

  if (!env.DB) {
    return jsonResponse({ message: 'Server not configured.' }, 500);
  }

  try {
    const { results } = await env.DB.prepare(
      `SELECT c.id, c.article_id, c.author_name, c.rating, c.comment_text, c.approved, c.created_at,
              a.title AS article_title, a.slug AS article_slug
       FROM comments c
       LEFT JOIN articles a ON a.id = c.article_id
       ORDER BY c.approved ASC, c.created_at DESC, c.id DESC`
    ).all();
    return jsonResponse({ comments: results || [] }, 200);
  } catch (err) {
    // Access-protected endpoint: safe to surface the real D1 error.
    return jsonResponse({ message: 'Database error: ' + (err && err.message ? err.message : String(err)) }, 500);
  }
}

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
