-- ============================================
-- LIST ALL DATA IN SUPABASE
-- ============================================

-- List all postcards
SELECT mailer_id, town, mail_date, payment_status,
       spot_1, spot_2, spot_3
FROM postcards
WHERE user_email = 'lastcall.me@hotmail.com'
ORDER BY mail_date DESC;

-- Count clients
SELECT COUNT(*) as client_count
FROM clients
WHERE user_email = 'lastcall.me@hotmail.com';

-- List first 5 clients
SELECT business_name, category, contact_name, phone
FROM clients
WHERE user_email = 'lastcall.me@hotmail.com'
ORDER BY business_name
LIMIT 5;
