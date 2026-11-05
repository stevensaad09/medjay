// Node needs `with { type: 'json' }` for JSON imports; the Cloudflare Pages
// bundler (older esbuild) rejects that syntax. This test-only hook adds the
// attribute for .json imports so the functions code can stay plain.
import { register } from 'node:module';
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(spec, ctx, next) {
  const r = await next(spec, ctx);
  if (r.url.endsWith('.json')) return { ...r, importAttributes: { type: 'json' } };
  return r;
}`));
