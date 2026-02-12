-- Run this to check if the migration has been applied
-- Go to https://console.neon.tech and run this in SQL Editor

SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'job_applications'
ORDER BY ordinal_position;

-- If you DON'T see 'quotation' and 'conditions' in the results,
-- then run the migration:

-- ALTER TABLE job_applications
-- ADD COLUMN IF NOT EXISTS quotation TEXT,
-- ADD COLUMN IF NOT EXISTS conditions TEXT;
