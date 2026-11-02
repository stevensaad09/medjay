// Cloudflare Pages Function
// Handles PUT/DELETE /api/admin/comments/:id
// Dashboard use only. /api/admin/* is protected by Cloudflare Access at
// the infrastructure level (same policy as /dashboard/*), so no
// additional auth check is done here.
//
// PUT    - body { approved: true|false } sets the comment's approval.
// DELETE - permanently deletes the comment.

export async function onRequestPut(context) {
  const { request, env, params } = context;

  if (!env.DB) {
    return jsonResponse({ message: 'Server not configured.' }, 500);
  }

  const id = parseInt(params.id, 10);
  if (!Number.isInteger(id)) {
    return jsonResponse({ message: 'Invalid comment id.' }, 400);
  }

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return jsonResponse({ message: 'Invalid request.' }, 400);
  }

  if (typeof body.approved !== 'boolean') {
    return jsonResponse({ message: '"approved" must be true or false.' }, 400);
  }

  try {
    const result = await env.DB.prepare(
      'UPDATE comments SET approved = ? WHERE id = ?'
    ).bind(body.approved ? 1 : 0, id).run();

    if (!result.meta || result.meta.changes === 0) {
      return jsonResponse({ message: 'Comment not found.' }, 404);
    }
    return jsonResponse({ message: body.approved ? 'Comment approved.' : 'Comment hidden.' }, 200);
  } catch (err) {
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
    return jsonResponse({ message: 'Invalid comment id.' }, 400);
  }

  try {
    const result = await env.DB.prepare('DELETE FROM comments WHERE id = ?').bind(id).run();
    if (!result.meta || result.meta.changes === 0) {
      return jsonResponse({ message: 'Comment not found.' }, 404);
    }
    return jsonResponse({ message: 'Comment deleted.' }, 200);
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
