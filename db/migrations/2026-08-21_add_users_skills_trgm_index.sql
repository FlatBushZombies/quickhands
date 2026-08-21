-- findUsersMatchingJob (src/services/match.service.js) falls back to a
-- leading-wildcard `skills ILIKE ANY('%term%')` scan whenever a job is
-- posted without lat/lng coordinates (or the client had no location
-- permission at post time). This path was an unindexed full table scan of
-- `users` — a plain btree index can't serve a leading-wildcard ILIKE, so a
-- trigram GIN index is required instead. This is the concrete cause of
-- intermittent slow job creation reported in production.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_users_skills_trgm
  ON users USING GIN (skills gin_trgm_ops);
