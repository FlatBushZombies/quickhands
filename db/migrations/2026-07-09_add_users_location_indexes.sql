-- Speeds up findUsersMatchingJob's nearby-freelancer bounding-box filter
-- (src/services/match.service.js), which previously pulled every user row
-- into JS. Partial + guarded so only rows with numeric-castable location
-- values are indexed (metadata is freeform JSONB, can't assume every row
-- has valid coordinates).

CREATE INDEX IF NOT EXISTS idx_users_location_lat
  ON users (((metadata->'location'->>'latitude')::numeric))
  WHERE metadata->'location'->>'latitude' ~ '^-?[0-9]+\.?[0-9]*$';

CREATE INDEX IF NOT EXISTS idx_users_location_lng
  ON users (((metadata->'location'->>'longitude')::numeric))
  WHERE metadata->'location'->>'longitude' ~ '^-?[0-9]+\.?[0-9]*$';
