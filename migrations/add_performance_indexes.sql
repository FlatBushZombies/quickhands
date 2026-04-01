-- Add performance indexes for the existing read and write paths.
-- These indexes are additive and do not change API behavior.

CREATE INDEX IF NOT EXISTS idx_job_applications_job_created_at
  ON job_applications (job_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_applications_freelancer_created_at
  ON job_applications (freelancer_clerk_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_applications_job_freelancer
  ON job_applications (job_id, freelancer_clerk_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created_at
  ON notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_unread_user_created_at
  ON notifications (user_id, created_at DESC)
  WHERE read = false;

CREATE INDEX IF NOT EXISTS idx_users_clerk_id
  ON users (clerk_id);

CREATE INDEX IF NOT EXISTS idx_service_request_clerk_created_at
  ON service_request (clerk_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_service_request_max_price
  ON service_request (max_price);

CREATE INDEX IF NOT EXISTS idx_service_request_selected_services_gin
  ON service_request
  USING GIN (selected_services);
