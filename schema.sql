-- MEDJAY articles/blog database schema (Cloudflare D1)
--
-- Apply with:
--   wrangler d1 execute medjay-articles --file=schema.sql
-- or paste this file's contents into the D1 Console in the Cloudflare
-- dashboard (Workers & Pages -> D1 -> medjay-articles -> Console).
--
-- Note on `content`: stored as raw HTML, rendered directly on the
-- article page with no further parsing (e.g. write <p>, <h2>,
-- <strong>, <a href="..."> directly in the dashboard's content field).
-- The dashboard that writes this table sits behind Cloudflare Access,
-- so only Steven can author it.

CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT NOT NULL DEFAULT '',
  published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment_text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_comments_article_id ON comments(article_id);
