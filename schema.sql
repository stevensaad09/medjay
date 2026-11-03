-- MEDJAY articles/blog database schema (Cloudflare D1)
--
-- Apply with:
--   wrangler d1 execute medjay-articles --file=schema.sql
-- or paste this file's contents into the D1 Console in the Cloudflare
-- dashboard (Workers & Pages -> D1 -> medjay-articles -> Console).
--
-- Note on `content`: stored as plain text with minimal Markdown-style
-- formatting (blank lines separate paragraphs, **text** becomes bold).
-- It is converted to HTML only at render time, in
-- functions/articles/[slug].js — the raw plain text stays editable in
-- the dashboard without HTML tags cluttering the textarea. The
-- dashboard that writes this table sits behind Cloudflare Access, so
-- only Steven can author it.
--
-- Note: CREATE TABLE IF NOT EXISTS will NOT update an existing table
-- with a different shape. If articles/comments already exist with a
-- different column set (e.g. from an earlier partial migration),
-- inserts can fail with a NOT NULL / no-such-column error even though
-- this file looks correct — inspect the live schema (`PRAGMA
-- table_info(articles);` in the D1 console) before assuming the code
-- is at fault.

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

-- Free course tracking (also in migrations/0002_course_tracking.sql).
CREATE TABLE IF NOT EXISTS course_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course TEXT NOT NULL,
  event TEXT NOT NULL CHECK (event IN ('open','day-1','day-2','day-3','day-4','day-5','all')),
  country TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_course_events_course_event ON course_events(course, event);
CREATE INDEX IF NOT EXISTS idx_course_events_created ON course_events(created_at);

CREATE TABLE IF NOT EXISTS course_leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Individual','Team Leader','Manager','Business Owner')),
  team_size TEXT NOT NULL CHECK (team_size IN ('1','2-10','11-50','50+')),
  course TEXT NOT NULL,
  country TEXT,
  follow_up INTEGER NOT NULL DEFAULT 0,
  brevo_status TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_course_leads_course ON course_leads(course);
CREATE INDEX IF NOT EXISTS idx_course_leads_follow_up ON course_leads(follow_up);
