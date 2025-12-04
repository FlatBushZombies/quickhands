-- Migration: Add completed_onboarding flag to users table
-- Date: 2025-12-04

ALTER TABLE users
ADD COLUMN IF NOT EXISTS completed_onboarding BOOLEAN NOT NULL DEFAULT FALSE;


