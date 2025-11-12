-- Add postcard_size column to postcards table
-- This allows tracking whether a postcard is 9x12 or 6.5x12 format

ALTER TABLE postcards
ADD COLUMN IF NOT EXISTS postcard_size TEXT DEFAULT '9x12';

-- Update all existing postcards to 9x12 (the current default)
UPDATE postcards
SET postcard_size = '9x12'
WHERE postcard_size IS NULL;

-- Add check constraint to ensure only valid sizes
ALTER TABLE postcards
ADD CONSTRAINT postcards_size_check
CHECK (postcard_size IN ('9x12', '6.5x12'));

-- Verify the column was added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'postcards' AND column_name = 'postcard_size';
