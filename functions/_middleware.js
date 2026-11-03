// Cloudflare Pages middleware for every request on the site.
// The production pages.dev address (exactly medjay.pages.dev) redirects
// permanently to the same path and query on https://medjay.pro, so search
// engines and visitors only see one address. Preview deployments
// (<hash>.medjay.pages.dev, <branch>.medjay.pages.dev) are not redirected.

export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.hostname === 'medjay.pages.dev') {
    return new Response(null, {
      status: 301,
      headers: { Location: `https://medjay.pro${url.pathname}${url.search}` },
    });
  }
  return context.next();
}
