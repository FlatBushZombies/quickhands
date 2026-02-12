-- Add quotation and conditions columns to job_applications table
-- Run this migration on your Neon database

ALTER TABLE job_applications
ADD COLUMN IF NOT EXISTS quotation TEXT,
ADD COLUMN IF NOT EXISTS conditions TEXT;

-- Add a comment to document the schema change
COMMENT ON COLUMN job_applications.quotation IS 'Freelancer proposed rate or total cost';
COMMENT ON COLUMN job_applications.conditions IS 'Special terms, requirements, or timeline specified by freelancer';
