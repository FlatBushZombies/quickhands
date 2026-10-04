-- Job search (jobs.service.js) filters `service_type ILIKE '%term%'` with a
-- leading wildcard, which a btree index cannot serve. Trigram GIN makes it
-- index-backed. pg_trgm is already enabled by 2026-08-21_add_users_skills_trgm_index.sql.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_service_request_service_type_trgm
  ON service_request USING GIN (service_type gin_trgm_ops);

-- "My applications" and per-job applicant lists both filter on one owner
-- column and sort by created_at DESC. The single-column indexes forced a
-- sort of every matching row; these return rows already in order.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_applications_freelancer_created
  ON job_applications (freelancer_clerk_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_applications_job_created
  ON job_applications (job_id, created_at DESC);

-- Notification feed: WHERE user_id = ? ORDER BY created_at DESC.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_created
  ON notifications (user_id, created_at DESC);
