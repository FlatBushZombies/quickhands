-- Migration: Add user information fields to service_request table
-- Date: 2025-10-15

-- Add columns for storing user information who created the job
-- Note: created_at and updated_at already exist, so only adding user fields
ALTER TABLE service_request 
ADD COLUMN clerk_id VARCHAR(255),
ADD COLUMN user_name VARCHAR(255),
ADD COLUMN user_avatar VARCHAR(500);

-- Add index on clerk_id for faster queries
CREATE INDEX IF NOT EXISTS idx_service_request_clerk_id ON service_request(clerk_id);

-- Add index on created_at for sorting (if it doesn't exist)
CREATE INDEX IF NOT EXISTS idx_service_request_created_at ON service_request(created_at);
