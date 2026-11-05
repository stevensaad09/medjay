-- Migration 0003: Level 1 exams and certificates
--
-- Run ONCE in the D1 Console (Workers & Pages -> D1 -> medjay-articles ->
-- Console), or with:
--   wrangler d1 execute medjay-articles --remote --file=migrations/0003_exams.sql
-- Then run your exam-answer-keys.sql (it fills exam_keys and re-writes the
-- exams rows with INSERT OR REPLACE using the same values as below).
--
-- exam_keys gets NO rows here: correct answers are never in this repo.
-- exams rows are copied from functions/_data/exam-questions.json
-- (slug, prefix, title, total, pass_mark).

CREATE TABLE IF NOT EXISTS exams (
  course_slug TEXT PRIMARY KEY,
  prefix TEXT NOT NULL,
  title TEXT NOT NULL,
  total INTEGER NOT NULL DEFAULT 20,
  pass_mark INTEGER NOT NULL DEFAULT 14,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS exam_keys (
  course_slug TEXT NOT NULL,
  question_no INTEGER NOT NULL,
  correct TEXT NOT NULL CHECK (correct IN ('A','B','C','D')),
  PRIMARY KEY (course_slug, question_no)
);

-- answers: the 20 chosen letters in question order, e.g. ABCDABCD...
-- certificate_no: set once a certificate is claimed with this attempt.
CREATE TABLE IF NOT EXISTS exam_attempts (
  id TEXT PRIMARY KEY,
  course_slug TEXT NOT NULL,
  answers TEXT NOT NULL,
  score INTEGER NOT NULL,
  passed INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  certificate_no TEXT
);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_course_created ON exam_attempts(course_slug, created_at);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_certificate ON exam_attempts(certificate_no);

-- purge_after = issued_at + 10 years (no automatic deletion yet).
-- UNIQUE (course_slug, email) also serves lookups by course + email.
CREATE TABLE IF NOT EXISTS certificates (
  certificate_no TEXT PRIMARY KEY,
  course_slug TEXT NOT NULL,
  attempt_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  score INTEGER NOT NULL,
  issued_at TEXT NOT NULL,
  purge_after TEXT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0,
  UNIQUE (course_slug, email)
);
CREATE INDEX IF NOT EXISTS idx_certificates_attempt ON certificates(attempt_id);
CREATE INDEX IF NOT EXISTS idx_certificates_purge_after ON certificates(purge_after);

INSERT OR IGNORE INTO exams (course_slug, prefix, title, total, pass_mark) VALUES
  ('retail-sales-essentials', 'RSE', 'Retail Sales Essentials', 20, 14),
  ('customer-service-essentials', 'CSE', 'Customer Service Essentials', 20, 14),
  ('team-leader-essentials', 'TLE', 'Team Leader Essentials', 20, 14),
  ('assistant-manager-essentials', 'AME', 'Assistant Manager Essentials', 20, 14),
  ('b2b-sales-essentials', 'B2B', 'B2B Sales Essentials', 20, 14),
  ('call-center-essentials', 'CCE', 'Call Center Essentials', 20, 14),
  ('counter-sales-essentials', 'CTS', 'Counter Sales Essentials', 20, 14),
  ('store-manager-essentials', 'SME', 'Store Manager Essentials', 20, 14),
  ('tele-sales-essentials', 'TSE', 'Tele Sales Essentials', 20, 14),
  ('area-manager-essentials', 'ARM', 'Area Manager Essentials', 20, 14),
  ('sales-manager-essentials', 'SLM', 'Sales Manager Essentials', 20, 14);
