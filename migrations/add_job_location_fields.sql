ALTER TABLE service_request
  ADD COLUMN IF NOT EXISTS location_label VARCHAR(255),
  ADD COLUMN IF NOT EXISTS location_city VARCHAR(120),
  ADD COLUMN IF NOT EXISTS location_latitude NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS location_longitude NUMERIC(10, 7);

CREATE INDEX IF NOT EXISTS idx_service_request_location_city
  ON service_request (location_city);

CREATE INDEX IF NOT EXISTS idx_service_request_location_coords
  ON service_request (location_latitude, location_longitude);
