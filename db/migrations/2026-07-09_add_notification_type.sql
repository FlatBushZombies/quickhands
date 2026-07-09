-- Lets notifications carry a machine-readable type and an optional
-- conversation id, so client apps can deep-link a push/notification tap
-- straight to the right chat or job screen instead of just opening the app.

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS type VARCHAR(64),
  ADD COLUMN IF NOT EXISTS conversation_id UUID;
