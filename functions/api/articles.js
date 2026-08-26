// Cloudflare Pages Function
// Handles GET/POST /api/articles
//
// GET  - returns all articles as JSON. Pass ?published=1 to filter to
//        published-only (used by the public /articles list). Used
//        unfiltered by the dashboard, which needs drafts too.
// POST - creates a new article. Dashboard use only. /dashboard is
//        protected by Cloudflare Access at the infrastructure level,
//        so no additional auth check is done here.

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env.DB) {
    return jsonResponse({ message: 'Server not configured.' }, 500);
  }

  const url = new URL(request.url);
  const publishedParam = url.searchParams.get('published');

  try {
    let query = 'SELECT id, slug, title, content, excerpt, published, created_at, updated_at FROM articles';
    let stmt;
    if (publishedParam !== null) {
      const published = publishedParam === '1' || publishedParam === 'true' ? 1 : 0;
      stmt = env.DB.prepare(query + ' WHERE published = ? ORDER BY created_at DESC').bind(published);
    } else {
      stmt = env.DB.prepare(query + ' ORDER BY created_at DESC');
    }
    const { results } = await stmt.all();
    return jsonResponse({ articles: results || [] }, 200);
  } catch (err) {
    return jsonResponse({ message: 'Something went wrong. Please try again.' }, 500);
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
    return jsonResponse({ message: 'Something went wrong. Please try again.' }, 500);
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
