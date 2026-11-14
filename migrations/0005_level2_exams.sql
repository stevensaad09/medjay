-- Migration 0005: Level 2 exams, access codes, and code-failure rate limiting
--
-- Run ONCE in the D1 Console (Workers & Pages -> D1 -> medjay-articles ->
-- Console), or with:
--   wrangler d1 execute medjay-articles --remote --file=migrations/0005_level2_exams.sql
-- Run AFTER the Level 2 code is merged (or before; the old code ignores
-- these rows because getExam() only knows Level 1 slugs). Then run your
-- exam-answer-keys-level2.sql (440 keys) and level2-access-codes.sql
-- (110 batch codes + test codes) in the D1 Console. Keys and codes are
-- NEVER in this repo and NEVER in this file.
--
-- exam_access_codes: one code per buyer per course. email is NULL until
-- the first successful claim binds the code to that email (see
-- bindAccessCode in functions/_lib/exam-db.js). Unlimited retakes use
-- the same code; submit never consumes it.
-- exam_code_failures: one row per failed access-code check, used only to
-- rate-limit wrong codes per IP (10 failures per IP per 15 minutes).
-- Rows older than a day are deleted whenever a new failure is recorded.

CREATE TABLE IF NOT EXISTS exam_access_codes (
  code TEXT PRIMARY KEY,
  course_slug TEXT NOT NULL,
  email TEXT,
  bound_at TEXT,
  revoked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_exam_access_codes_course_email
  ON exam_access_codes(course_slug, email);

CREATE TABLE IF NOT EXISTS exam_code_failures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL,
  course_slug TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_exam_code_failures_ip_created
  ON exam_code_failures(ip, created_at);

INSERT OR REPLACE INTO exams (course_slug, prefix, title, total, pass_mark) VALUES
  ('retail-sales-essentials-level-2', '2RS', 'Retail Sales Essentials', 40, 28),
  ('customer-service-essentials-level-2', '2CS', 'Customer Service Essentials', 40, 28),
  ('team-leader-essentials-level-2', '2TL', 'Team Leader Essentials', 40, 28),
  ('assistant-manager-essentials-level-2', '2AM', 'Assistant Manager Essentials', 40, 28),
  ('b2b-sales-essentials-level-2', '2B2', 'B2B Sales Essentials', 40, 28),
  ('call-center-essentials-level-2', '2CC', 'Call Center Essentials', 40, 28),
  ('counter-sales-essentials-level-2', '2CT', 'Counter Sales Essentials', 40, 28),
  ('store-manager-essentials-level-2', '2SM', 'Store Manager Essentials', 40, 28),
  ('tele-sales-essentials-level-2', '2TS', 'Tele Sales Essentials', 40, 28),
  ('area-manager-essentials-level-2', '2AR', 'Area Manager Essentials', 40, 28),
  ('sales-manager-essentials-level-2', '2SL', 'Sales Manager Essentials', 40, 28);
