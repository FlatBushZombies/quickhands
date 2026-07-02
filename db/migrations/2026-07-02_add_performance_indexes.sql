-- Performance indexes for high-frequency queries.
-- Run once against the production database.

-- users: every auth lookup hits this
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_clerk_id
  ON users (clerk_id);

-- service_request: job owner filtering (GET /api/jobs?clerkId=...)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_service_request_clerk_id
  ON service_request (clerk_id);

-- service_request: recent-first ordering (covers the default ORDER BY)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_service_request_created_at
  ON service_request (created_at DESC);

-- job_applications: freelancer's own applications (GET /api/applications/my)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_applications_freelancer_clerk_id
  ON job_applications (freelancer_clerk_id);

-- job_applications: all applications for a job (GET /api/jobs/:id/applications)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_applications_job_id
  ON job_applications (job_id);

-- messaging_conversations: list conversations for a user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messaging_conversations_participant_one
  ON messaging_conversations (participant_one_clerk_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messaging_conversations_participant_two
  ON messaging_conversations (participant_two_clerk_id);

-- messaging_conversations: ordering by latest message
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messaging_conversations_last_message_at
  ON messaging_conversations (last_message_at DESC NULLS LAST);

-- messaging_messages: fetch messages for a conversation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messaging_messages_conversation_id_created_at
  ON messaging_messages (conversation_id, created_at DESC);

-- messaging_messages: idempotency check on clientMessageId
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messaging_messages_client_message_id
  ON messaging_messages (client_message_id)
  WHERE client_message_id IS NOT NULL;

-- notifications: unread lookup per user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_id_read
  ON notifications (user_id, read);
