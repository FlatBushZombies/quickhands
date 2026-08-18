-- Per-participant last-read timestamps, so the conversation list can show a
-- real unread count/badge instead of nothing (no read-state existed at all
-- before this). NULL means "never read" -- every message in that
-- conversation counts as unread for that participant until their first
-- visit, which is the correct behavior for existing conversations too.
ALTER TABLE messaging_conversations ADD COLUMN IF NOT EXISTS participant_one_last_read_at TIMESTAMP;
ALTER TABLE messaging_conversations ADD COLUMN IF NOT EXISTS participant_two_last_read_at TIMESTAMP;
