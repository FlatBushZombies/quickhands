-- Add client contact handoff fields to job_applications
-- Run this migration on your Neon database before using the phone-sharing flow

ALTER TABLE job_applications
ADD COLUMN IF NOT EXISTS client_contact_phone VARCHAR(32),
ADD COLUMN IF NOT EXISTS client_contact_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS contact_release_notes TEXT,
ADD COLUMN IF NOT EXISTS contact_shared_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS contact_shared_by_clerk_id VARCHAR(255);

COMMENT ON COLUMN job_applications.client_contact_phone IS 'Client phone number shared with the accepted freelancer';
COMMENT ON COLUMN job_applications.client_contact_name IS 'Preferred contact name supplied by the client';
COMMENT ON COLUMN job_applications.contact_release_notes IS 'Optional contact instructions after acceptance';
COMMENT ON COLUMN job_applications.contact_shared_at IS 'When the client released direct contact details';
COMMENT ON COLUMN job_applications.contact_shared_by_clerk_id IS 'Clerk user id that shared the contact details';
