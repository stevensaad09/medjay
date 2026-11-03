-- Migration 0002: free course download tracking and optional leads
--
-- Run ONCE in the D1 Console (Workers & Pages -> D1 -> medjay-articles ->
-- Console) BEFORE merging the course-tracking change, or with:
--   wrangler d1 execute medjay-articles --remote --file=migrations/0002_course_tracking.sql
--
-- (0001 belongs to the parked comment-moderation change.)
--
-- course_events: one row per counted page open or file download. No IP
-- address, user agent or other personal data is stored.
-- course_leads: optional form submissions from the download pages.

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
