-- Pre-existing schema drift discovered while wiring up background location
-- pings: production `users` never had a `metadata` column, even though
-- src/models/user.model.js declares one and most of user.service.js
-- (push tokens, location, device-location-token, reviews) reads/writes
-- metadata via the defensive getUserColumnState() probe. Without this
-- column, patchUserMetadataByClerkId has been throwing "User metadata is
-- not available in this database" on every call — meaning push-token
-- registration and location sync have been silently failing in production.
-- (email/full_name/image_url are also missing vs. the Drizzle model but
-- are out of scope here — production uses `name` instead of `full_name`
-- and code already falls back accordingly; not touching those now.)

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
