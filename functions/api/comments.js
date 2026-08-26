// Cloudflare Pages Function
// Handles GET/POST /api/comments
//
// GET  ?article_id=X - returns all comments for that article, newest first.
// POST - accepts { article_id, author_name, rating, comment_text, turnstile_token }.
//        Verifies turnstile_token server-side against Cloudflare's siteverify
//        endpoint before touching the DB, then validates the rest of the
//        fields and inserts the comment.

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env.DB) {
    return jsonResponse({ message: 'Server not configured.' }, 500);
  }

  const url = new URL(request.url);
  const articleId = parseInt(url.searchParams.get('article_id'), 10);

  if (!Number.isInteger(articleId)) {
    return jsonResponse({ message: 'article_id is required.' }, 400);
  }

  try {
    const { results } = await env.DB.prepare(
      `SELECT id, author_name, rating, comment_text, created_at
       FROM comments WHERE article_id = ? ORDER BY created_at DESC, id DESC`
    ).bind(articleId).all();
    return jsonResponse({ comments: results || [] }, 200);
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

  const articleId = parseInt(body.article_id, 10);
  const authorName = (body.author_name || '').trim();
  const rating = parseInt(body.rating, 10);
  const commentText = (body.comment_text || '').trim();
  const turnstileToken = (body.turnstile_token || '').trim();

  if (!Number.isInteger(articleId) || !authorName || !commentText || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return jsonResponse({ message: 'Please fill in your name, a rating (1-5), and a comment.' }, 400);
  }

  if (!turnstileToken) {
    return jsonResponse({ message: 'Please complete the verification challenge.' }, 400);
  }

  if (!env.TURNSTILE_SECRET_KEY) {
    return jsonResponse({ message: 'Server not configured. Please try again later.' }, 500);
  }

  try {
    const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET_KEY,
        response: turnstileToken,
        remoteip: request.headers.get('CF-Connecting-IP') || '',
      }),
    });
    const verifyData = await verifyRes.json().catch(() => ({}));
    if (!verifyData.success) {
      return jsonResponse({ message: 'Verification failed. Please try again.' }, 403);
    }
  } catch (err) {
    return jsonResponse({ message: 'Verification failed. Please try again.' }, 502);
  }

  try {
    const article = await env.DB.prepare(
      'SELECT id FROM articles WHERE id = ? AND published = 1'
    ).bind(articleId).first();
    if (!article) {
      return jsonResponse({ message: 'Article not found.' }, 404);
    }

    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO comments (article_id, author_name, rating, comment_text, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(articleId, authorName, rating, commentText, now).run();

    return jsonResponse({ message: 'Thanks — your comment has been posted.' }, 201);
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
