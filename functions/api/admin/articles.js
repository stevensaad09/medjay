// Cloudflare Pages Function
// Handles GET/POST /api/admin/articles
// Dashboard use only. /api/admin/* is protected by Cloudflare Access at
// the infrastructure level (same policy as /dashboard/*), so no
// additional auth check is done here.
//
// GET  - returns ALL articles (published and drafts).
// POST - creates a new article.

export async function onRequestGet(context) {
  const { env } = context;

  if (!env.DB) {
    return jsonResponse({ message: 'Server not configured.' }, 500);
  }

  try {
    const { results } = await env.DB.prepare(
      'SELECT id, slug, title, content, excerpt, published, created_at, updated_at FROM articles ORDER BY created_at DESC'
    ).all();
    return jsonResponse({ articles: results || [] }, 200);
  } catch (err) {
    // Access-protected endpoint: safe to surface the real D1 error.
    return jsonResponse({ message: 'Database error: ' + (err && err.message ? err.message : String(err)) }, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.DB) {
    return jsonResponse({ message: 'Server not configured.' }, 500);
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
    // created_at/updated_at are always supplied explicitly below rather
    // than relying on the schema's SQL defaults, since articles, slug,
    // title, content, excerpt, published, created_at, and updated_at
    // are all NOT NULL columns and every one of them needs a bound value.
    const now = new Date().toISOString();
    const result = await env.DB.prepare(
      `INSERT INTO articles (slug, title, content, excerpt, published, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(slug, title, content, excerpt, published, now, now).run();

    return jsonResponse({ message: 'Article created.', id: result.meta.last_row_id }, 201);
  } catch (err) {
    if (String(err && err.message).includes('UNIQUE')) {
      return jsonResponse({ message: 'That slug is already in use. Choose a different one.' }, 409);
    }
    // This endpoint sits behind Cloudflare Access, so it's safe to
    // surface the real D1 error here to make issues diagnosable from
    // the dashboard UI instead of a generic message.
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
