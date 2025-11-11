-- ============================================
-- CHECK WHAT DATA EXISTS IN SUPABASE
-- ============================================

-- Check if postcards exist
SELECT 'Postcards' as table_name, COUNT(*) as row_count
FROM postcards
WHERE user_email = 'lastcall.me@hotmail.com';

-- Check if clients exist
SELECT 'Clients' as table_name, COUNT(*) as row_count
FROM clients
WHERE user_email = 'lastcall.me@hotmail.com';

-- Check app_data
SELECT 'App Data' as table_name, data_type,
       jsonb_array_length(data) as item_count
FROM app_data
WHERE user_email = 'lastcall.me@hotmail.com';

-- List all postcards
SELECT mailer_id, town, mail_date, payment_status
FROM postcards
WHERE user_email = 'lastcall.me@hotmail.com'
ORDER BY mail_date DESC;
