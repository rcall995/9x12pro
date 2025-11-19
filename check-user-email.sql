-- Check what user_email values exist in app_data table
-- Run this in Supabase SQL Editor to find your actual email

SELECT
    user_email,
    data_type,
    created_at,
    updated_at
FROM app_data
WHERE data_type = 'clients'
ORDER BY updated_at DESC;
