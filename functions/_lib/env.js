// Shared environment check. Not a route: exports no onRequest handlers.
//
// Preview deployments (*.medjay.pages.dev) and local development share the
// production D1 database and Brevo key, so anything that writes real data
// must call isProduction() first and skip the write when it returns false.

const PRODUCTION_HOSTS = ['medjay.pro', 'www.medjay.pro'];

export function isProduction(request) {
  return PRODUCTION_HOSTS.includes(new URL(request.url).hostname);
}

// One log line per skipped write, visible in Pages > Functions > Real-time logs.
export function logSkippedWrite(request, what) {
  console.log(`[preview] skipped write: ${what} (host ${new URL(request.url).hostname})`);
}
