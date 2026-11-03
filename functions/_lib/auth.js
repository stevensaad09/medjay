// Shared admin auth check. Not a route: exports no onRequest handlers.
//
// Cloudflare Access protects /dashboard and /api/admin* and adds these
// headers to every request it lets through. This only checks that one of
// them is present; it does not verify the token. Access is the real
// protection; this is a second layer in code.

export function hasAccessHeaders(request) {
  return Boolean(
    request.headers.get('Cf-Access-Authenticated-User-Email') ||
    request.headers.get('Cf-Access-Jwt-Assertion')
  );
}
