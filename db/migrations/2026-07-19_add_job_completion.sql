-- Adds a "completed" application status distinct from "accepted", so
-- reviews/analytics can distinguish work that's actually finished from
-- work that's merely been accepted. Postgres enum values can't be added
-- inside the same transaction they're used in, so this runs as its own
-- statement (IF NOT EXISTS makes it safe to re-run).
ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'completed';
