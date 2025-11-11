-- ============================================
-- DEBUG: Find ALL postcards regardless of user
-- ============================================

-- 1. Check if ANY postcards exist at all
SELECT
  user_email,
  mailer_id,
  town,
  mail_date,
  created_at
FROM postcards
ORDER BY created_at DESC
LIMIT 20;

-- 2. Check what user_emails exist
SELECT DISTINCT user_email, COUNT(*) as postcard_count
FROM postcards
GROUP BY user_email;

-- 3. Check if the specific user has any data
SELECT COUNT(*) as count
FROM postcards
WHERE user_email = 'lastcall.me@hotmail.com';

-- 4. Try inserting a test postcard to verify RLS works
INSERT INTO postcards (
  user_email, mailer_id, town, mail_date, payment_status,
  spot_1, spot_2, spot_3, spot_4, spot_5, spot_6, spot_7, spot_8, spot_9,
  spot_10, spot_11, spot_12, spot_13, spot_14, spot_15, spot_16, spot_17, spot_18,
  postcard_bg, banner_bg
) VALUES (
  'lastcall.me@hotmail.com',
  'DEBUG-TEST-001',
  'Debug Town',
  '2025-12-01',
  'Active',
  'Available', 'Available', 'Available', 'Available', 'Available', 'Available',
  'Available', 'Available', 'Available', 'Available', 'Available', 'Available',
  'Available', 'Available', 'Available', 'Available', 'Available', 'Available',
  '#000000',
  '#0910ec'
)
RETURNING mailer_id, town, mail_date;
