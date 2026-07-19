ALTER TABLE job_applications
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
