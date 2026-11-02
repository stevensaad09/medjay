-- Migration 0001: comment moderation
--
-- Run ONCE in the D1 Console (Workers & Pages -> D1 -> medjay-articles ->
-- Console) BEFORE merging the comment-moderation change, or with:
--   wrangler d1 execute medjay-articles --remote --file=migrations/0001_comment_moderation.sql
--
-- Adds an `approved` flag to comments. New comments default to 0 (hidden
-- until approved in /dashboard). Every comment that already exists is
-- marked approved so it stays visible.

ALTER TABLE comments ADD COLUMN approved INTEGER NOT NULL DEFAULT 0;
UPDATE comments SET approved = 1;
CREATE INDEX IF NOT EXISTS idx_comments_article_approved ON comments(article_id, approved);
