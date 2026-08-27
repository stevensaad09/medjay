// Cloudflare Pages Function
// Handles PUT/DELETE /api/admin/articles/:id
// Dashboard use only. /api/admin/* is protected by Cloudflare Access at
// the infrastructure level (same policy as /dashboard/*), so no
// additional auth check is done here.

export async function onRequestPut(context) {
  const { request, env, params } = context;

  if (!env.DB) {
    return jsonResponse({ message: 'Server not configured.' }, 500);
  }

  const id = parseInt(params.id, 10);
  if (!Number.isInteger(id)) {
    return jsonResponse({ message: 'Invalid article id.' }, 400);
  }

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return jsonResponse({ message: 'Invalid request.' }, 400);
  }

  const title = (body.title || '').trim();
  const slug = slugify(body.slug || body.title || '');
  const excerpt = (body.excerpt || '').trim();
  const content = (body.content || '').trim();
  const published = body.published ? 1 : 0;

  if (!title || !slug || !content) {
    return jsonResponse({ message: 'Title, slug, and content are required.' }, 400);
  }

  try {
    const now = new Date().toISOString();
    const result = await env.DB.prepare(
      `UPDATE articles SET title = ?, slug = ?, excerpt = ?, content = ?, published = ?, updated_at = ?
       WHERE id = ?`
    ).bind(title, slug, excerpt, content, published, now, id).run();

    if (!result.meta || result.meta.changes === 0) {
      return jsonResponse({ message: 'Article not found.' }, 404);
    }
    return jsonResponse({ message: 'Article updated.' }, 200);
  } catch (err) {
    if (String(err && err.message).includes('UNIQUE')) {
      return jsonResponse({ message: 'That slug is already in use. Choose a different one.' }, 409);
    }
    // Access-protected endpoint: safe to surface the real D1 error.
    return jsonResponse({ message: 'Database error: ' + (err && err.message ? err.message : String(err)) }, 500);
  }
}

export async function onRequestDelete(context) {
  const { env, params } = context;

  if (!env.DB) {
    return jsonResponse({ message: 'Server not configured.' }, 500);
  }

  const id = parseInt(params.id, 10);
  if (!Number.isInteger(id)) {
    return jsonResponse({ message: 'Invalid article id.' }, 400);
  }

  try {
    const results = await env.DB.batch([
      env.DB.prepare('DELETE FROM comments WHERE article_id = ?').bind(id),
      env.DB.prepare('DELETE FROM articles WHERE id = ?').bind(id),
    ]);
    const articleResult = results[1];
    if (!articleResult || !articleResult.meta || articleResult.meta.changes === 0) {
      return jsonResponse({ message: 'Article not found.' }, 404);
    }
    return jsonResponse({ message: 'Article deleted.' }, 200);
  } catch (err) {
    // Access-protected endpoint: safe to surface the real D1 error.
    return jsonResponse({ message: 'Database error: ' + (err && err.message ? err.message : String(err)) }, 500);
  }
}

function slugify(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
