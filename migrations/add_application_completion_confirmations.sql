-- Two-party completion: the client and the specialist each confirm that the
-- accepted job is finished. The application becomes 'completed' once both
-- confirmations are recorded.
ALTER TABLE job_applications
ADD COLUMN IF NOT EXISTS client_confirmed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS freelancer_confirmed_at TIMESTAMP;

COMMENT ON COLUMN job_applications.client_confirmed_at IS 'When the job client confirmed the accepted work is finished';
COMMENT ON COLUMN job_applications.freelancer_confirmed_at IS 'When the specialist confirmed the accepted work is finished';
