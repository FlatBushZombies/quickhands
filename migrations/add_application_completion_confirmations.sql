-- Two-sided completion for accepted jobs.
-- The client confirms by marking the application completed (existing flow),
-- which also stamps client_confirmed_at. The specialist confirms through
-- POST /api/applications/:id/confirm-completion, which stamps
-- freelancer_confirmed_at and sets status to completed once the client has
-- confirmed too. Both columns are nullable, so existing rows are unaffected.

ALTER TABLE job_applications
ADD COLUMN IF NOT EXISTS freelancer_confirmed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS client_confirmed_at TIMESTAMP;

COMMENT ON COLUMN job_applications.freelancer_confirmed_at IS 'When the accepted specialist confirmed the job was finished';
COMMENT ON COLUMN job_applications.client_confirmed_at IS 'When the client confirmed the job was finished (marking it completed)';
