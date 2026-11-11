// Shared article audience rules. Not a route: exports no onRequest handlers.
//
// Every article has one audience tag (column articles.audience, added by
// migrations/0004_article_audience.sql). /articles/ lists every audience;
// /founders/ lists only 'founders'.

export const AUDIENCES = ['general', 'founders', 'job-seekers'];
export const DEFAULT_AUDIENCE = 'general';

export function isAudience(value) {
  return typeof value === 'string' && AUDIENCES.includes(value);
}

// True when D1 reports that articles.audience does not exist yet, i.e.
// migration 0004 has not been run on this database.
export function isMissingAudienceColumn(err) {
  const msg = String((err && err.message) || err || '');
  return /audience/i.test(msg) && /no such column|no column named/i.test(msg);
}

export const MIGRATION_HINT = 'The audience column is missing. Run migrations/0004_article_audience.sql on D1 first.';
