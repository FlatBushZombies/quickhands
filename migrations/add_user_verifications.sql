-- Identity verification record per user. A row is created when the user
-- submits a verification request; 'verified' and 'rejected' are set by a
-- reviewer, not by the public API.
CREATE TABLE IF NOT EXISTS user_verifications (
  id SERIAL PRIMARY KEY,
  clerk_id VARCHAR(255) NOT NULL UNIQUE,
  status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  document_type VARCHAR(16) NOT NULL CHECK (document_type IN ('id', 'passport')),
  consent_at TIMESTAMP NOT NULL,
  submitted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
