-- Migration 0004: audience tag for articles (additive)
--
-- Run ONCE, BEFORE deploying the Founders section, in the D1 Console
-- (Workers & Pages -> D1 -> medjay-articles -> Console), or with:
--   wrangler d1 execute medjay-articles --remote --file=migrations/0004_article_audience.sql
--
-- Adds one column to articles. Every existing article gets 'general'
-- automatically; no existing row is rewritten or removed.
-- Allowed values: general, founders, job-seekers
-- (the same list as functions/_lib/articles.js).
--
-- Do not run it twice: the second ALTER TABLE fails with
-- "duplicate column name: audience" (harmless, nothing changes).

ALTER TABLE articles ADD COLUMN audience TEXT NOT NULL DEFAULT 'general'
  CHECK (audience IN ('general','founders','job-seekers'));

CREATE INDEX IF NOT EXISTS idx_articles_audience ON articles(published, audience);

-- Rollback (run these two lines, in this order, to undo the migration):
--   DROP INDEX IF EXISTS idx_articles_audience;
--   ALTER TABLE articles DROP COLUMN audience;
