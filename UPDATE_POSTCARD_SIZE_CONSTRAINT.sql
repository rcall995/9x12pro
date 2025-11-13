-- Remove 6.5x12 size option, only allow 9x12
-- This updates the existing constraint to only accept 9x12

-- First, drop the old constraint
ALTER TABLE postcards
DROP CONSTRAINT IF EXISTS postcards_size_check;

-- Add new constraint that only allows 9x12
ALTER TABLE postcards
ADD CONSTRAINT postcards_size_check
CHECK (postcard_size = '9x12');

-- Update any existing 6.5x12 postcards to 9x12
UPDATE postcards
SET postcard_size = '9x12'
WHERE postcard_size = '6.5x12';

-- Verify the update
SELECT postcard_size, COUNT(*) as count
FROM postcards
GROUP BY postcard_size;
