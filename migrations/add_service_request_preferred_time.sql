-- Post a task: the design asks for Morning / Afternoon / Evening / Any time
-- when a specific day is picked. Stored as its own column (not appended to
-- additional_info) so the value can be filtered and displayed on its own.
-- NULL means no preference (ASAP and flexible jobs never ask for a time).
-- IF NOT EXISTS / DROP IF EXISTS make the script safe to re-run.
ALTER TABLE service_request
  ADD COLUMN IF NOT EXISTS preferred_time VARCHAR(16);

ALTER TABLE service_request
  DROP CONSTRAINT IF EXISTS service_request_preferred_time_check;

ALTER TABLE service_request
  ADD CONSTRAINT service_request_preferred_time_check
  CHECK (preferred_time IS NULL OR preferred_time IN ('morning', 'afternoon', 'evening', 'any'));
