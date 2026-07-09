-- Tracks the last time we notified a client that their accepted
-- freelancer was nearby the job site, so proximity checks can debounce
-- repeat notifications (see src/services/proximity.service.js).

ALTER TABLE job_applications
  ADD COLUMN IF NOT EXISTS proximity_notified_at TIMESTAMP;
