// Cloudflare Pages Function
// Handles GET /sitemap.xml
// Generates the sitemap on every request: the fixed site pages below,
// plus every PUBLISHED article from D1 (drafts are never listed).
// To add a new static page to the sitemap, add it to STATIC_PAGES.
// Free course pages are listed from COURSE_SLUGS: /courses/ plus one
// /courses/<slug>/ page per slug (with trailing slashes, matching their
// canonical URLs). Download pages and /courses/files/* are deliberately
// never listed. To add a course, add its slug to COURSE_SLUGS.
// If D1 is unavailable, the static pages are still returned so search
// engines always get a valid sitemap.

const ORIGIN = 'https://medjay.pro';

const STATIC_PAGES = [
  { path: '/', changefreq: 'monthly', priority: '1.0' },
  { path: '/programs', changefreq: 'monthly', priority: '0.9' },
  { path: '/programs/usa-real-estate', changefreq: 'monthly', priority: '0.8' },
  { path: '/programs/usa-real-estate-enterprise', changefreq: 'monthly', priority: '0.8' },
  { path: '/programs/uae-real-estate', changefreq: 'monthly', priority: '0.8' },
  { path: '/programs/uae-real-estate-enterprise', changefreq: 'monthly', priority: '0.8' },
  { path: '/programs/contractor-sales-mastery', changefreq: 'monthly', priority: '0.8' },
  { path: '/books', changefreq: 'monthly', priority: '0.8' },
  { path: '/info/stevensaad', changefreq: 'monthly', priority: '0.7' },
  { path: '/articles', changefreq: 'weekly', priority: '0.7' },
  { path: '/privacy/', changefreq: 'yearly', priority: '0.3' },
];

const COURSE_SLUGS = [
  'retail-sales-essentials',
  'counter-sales-essentials',
  'tele-sales-essentials',
  'b2b-sales-essentials',
  'customer-service-essentials',
  'call-center-essentials',
  'team-leader-essentials',
  'assistant-manager-essentials',
  'store-manager-essentials',
  'area-manager-essentials',
  'sales-manager-essentials',
];

const COURSE_PAGES = [
  { path: '/courses/', changefreq: 'monthly', priority: '0.8' },
  ...COURSE_SLUGS.map((slug) => ({ path: `/courses/${slug}/`, changefreq: 'monthly', priority: '0.7' })),
];

export async function onRequestGet(context) {
  const { env } = context;

  const urls = [...STATIC_PAGES, ...COURSE_PAGES].map((p) => ({
    loc: ORIGIN + p.path,
    changefreq: p.changefreq,
    priority: p.priority,
  }));

  if (env.DB) {
    try {
      const { results } = await env.DB.prepare(
        'SELECT slug, created_at, updated_at FROM articles WHERE published = 1 ORDER BY created_at DESC'
      ).all();
      for (const a of results || []) {
        urls.push({
          loc: `${ORIGIN}/articles/${encodeURIComponent(a.slug)}`,
          lastmod: toDate(a.updated_at || a.created_at),
          changefreq: 'monthly',
          priority: '0.6',
        });
      }
    } catch (err) {
      // Fall through with static pages only.
    }
  }

  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(renderUrl).join('') +
    '</urlset>\n';

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=UTF-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

function renderUrl(u) {
  return (
    '  <url>\n' +
    `    <loc>${escapeXml(u.loc)}</loc>\n` +
    (u.lastmod ? `    <lastmod>${u.lastmod}</lastmod>\n` : '') +
    `    <changefreq>${u.changefreq}</changefreq>\n` +
    `    <priority>${u.priority}</priority>\n` +
    '  </url>\n'
  );
}

// D1 stores either ISO strings or SQLite "YYYY-MM-DD HH:MM:SS"; the
// sitemap only needs the date part (YYYY-MM-DD).
function toDate(value) {
  if (!value) return '';
  const m = String(value).match(/^\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : '';
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
