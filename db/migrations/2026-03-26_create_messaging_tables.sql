CREATE TABLE IF NOT EXISTS messaging_conversations (
  id VARCHAR(36) PRIMARY KEY,
  conversation_type VARCHAR(50) NOT NULL DEFAULT 'direct',
  job_id INTEGER,
  job_title VARCHAR(255),
  participant_one_clerk_id VARCHAR(255) NOT NULL,
  participant_one_name VARCHAR(255),
  participant_two_clerk_id VARCHAR(255) NOT NULL,
  participant_two_name VARCHAR(255),
  last_message_text TEXT,
  last_message_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messaging_conversations_participant_one
  ON messaging_conversations (participant_one_clerk_id);

CREATE INDEX IF NOT EXISTS idx_messaging_conversations_participant_two
  ON messaging_conversations (participant_two_clerk_id);

CREATE INDEX IF NOT EXISTS idx_messaging_conversations_last_message_at
  ON messaging_conversations (last_message_at DESC);

CREATE TABLE IF NOT EXISTS messaging_messages (
  id VARCHAR(36) PRIMARY KEY,
  conversation_id VARCHAR(36) NOT NULL REFERENCES messaging_conversations(id) ON DELETE CASCADE,
  sender_clerk_id VARCHAR(255) NOT NULL,
  sender_name VARCHAR(255),
  text TEXT NOT NULL,
  client_message_id VARCHAR(36),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messaging_messages_conversation_created_at
  ON messaging_messages (conversation_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_messaging_messages_client_message
  ON messaging_messages (conversation_id, client_message_id)
  WHERE client_message_id IS NOT NULL;
