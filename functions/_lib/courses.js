// Shared allowlists for the free Level 1 course tracking endpoints.
// Not a route: this file exports no onRequest handlers.

export const COURSE_NAMES = {
  'retail-sales-essentials': 'Retail Sales Essentials',
  'counter-sales-essentials': 'Counter Sales Essentials',
  'tele-sales-essentials': 'Tele Sales Essentials',
  'b2b-sales-essentials': 'B2B Sales Essentials',
  'customer-service-essentials': 'Customer Service Essentials',
  'call-center-essentials': 'Call Center Essentials',
  'team-leader-essentials': 'Team Leader Essentials',
  'assistant-manager-essentials': 'Assistant Manager Essentials',
  'store-manager-essentials': 'Store Manager Essentials',
  'area-manager-essentials': 'Area Manager Essentials',
  'sales-manager-essentials': 'Sales Manager Essentials',
};

export const COURSE_SLUGS = Object.keys(COURSE_NAMES);

// file value -> file name suffix in /courses/files/
export const FILES = {
  'day-1': '-day-1.pdf',
  'day-2': '-day-2.pdf',
  'day-3': '-day-3.pdf',
  'day-4': '-day-4.pdf',
  'day-5': '-day-5.pdf',
  'all': '-all.zip',
};

export const ROLES = ['Individual', 'Team Leader', 'Manager', 'Business Owner'];
export const TEAM_SIZES = ['1', '2-10', '11-50', '50+'];

// Follow-up rule: Manager or Business Owner with a team of 2 or more.
export function isFollowUp(role, teamSize) {
  return (role === 'Manager' || role === 'Business Owner') && teamSize !== '1';
}

export function isCourse(slug) {
  return Object.prototype.hasOwnProperty.call(COURSE_NAMES, slug);
}

// Requests we do not count: obvious bots, link previews, prefetches.
// Link-preview fetchers of chat and social apps already match "bot" or
// "preview" (Slackbot, LinkedInBot, TelegramBot, SkypeUriPreview), so app
// names are not listed: their in-app browsers are real people.
const BOT_UA = /bot\b|bot\/|crawl|spider|slurp|scrap|preview|facebookexternalhit|embedly|^whatsapp\/|vkshare|curl|wget|python|httpclient|okhttp|java\/|go-http|node-fetch|axios|headless|phantom|lighthouse|pingdom|uptime|monitor/i;

export function isLikelyBot(request) {
  if (request.method === 'HEAD') return true;
  const ua = request.headers.get('User-Agent') || '';
  if (!ua || BOT_UA.test(ua)) return true;
  const purpose = (request.headers.get('Sec-Purpose') || request.headers.get('Purpose') || '').toLowerCase();
  if (purpose.includes('prefetch') || purpose.includes('prerender')) return true;
  return false;
}

// Two-letter country code from Cloudflare, or null. Never the IP.
export function countryOf(request) {
  const c = (request.cf && request.cf.country) || request.headers.get('CF-IPCountry') || '';
  return /^[A-Z0-9]{2}$/.test(c) ? c : null;
}
