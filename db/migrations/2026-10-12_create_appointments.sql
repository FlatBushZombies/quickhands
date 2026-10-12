-- Specialist weekly availability and client bookings against it.
--
-- specialist_availability: recurring weekly open windows the specialist sets
-- themselves (day_of_week 0=Sunday..6=Saturday). Multiple rows per day are
-- allowed (e.g. a morning and an evening window).
--
-- appointments: a confirmed booking is exclusive for its specialist — the
-- gist exclusion constraint below makes overlapping confirmed bookings for
-- the same specialist impossible at the database level, so a race between
-- two clients booking the same slot can't both succeed. Cancelled rows are
-- kept (not deleted) and don't count toward the exclusion.

CREATE TABLE IF NOT EXISTS specialist_availability (
  id SERIAL PRIMARY KEY,
  specialist_clerk_id VARCHAR(255) NOT NULL,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL CHECK (end_time > start_time),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_specialist_availability_specialist
  ON specialist_availability (specialist_clerk_id, day_of_week);

CREATE TABLE IF NOT EXISTS appointments (
  id SERIAL PRIMARY KEY,
  specialist_clerk_id VARCHAR(255) NOT NULL,
  client_clerk_id VARCHAR(255) NOT NULL,
  service_type VARCHAR(255),
  scheduled_start TIMESTAMP NOT NULL,
  scheduled_end TIMESTAMP NOT NULL CHECK (scheduled_end > scheduled_start),
  status VARCHAR(20) NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('confirmed', 'cancelled', 'completed')),
  cancelled_by VARCHAR(255),
  cancelled_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointments_specialist_start
  ON appointments (specialist_clerk_id, scheduled_start);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointments_client_start
  ON appointments (client_clerk_id, scheduled_start);

ALTER TABLE appointments
  ADD CONSTRAINT appointments_no_overlap
  EXCLUDE USING gist (
    specialist_clerk_id WITH =,
    tsrange(scheduled_start, scheduled_end) WITH &&
  ) WHERE (status = 'confirmed');
