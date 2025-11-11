-- ============================================
-- COMPLETE SUPABASE AUDIT - FIXED
-- ============================================

-- 1. CHECK ALL POSTCARDS IN DATABASE
SELECT
  mailer_id,
  town,
  mail_date,
  payment_status,
  created_at,
  updated_at
FROM postcards
WHERE user_email = 'lastcall.me@hotmail.com'
ORDER BY mail_date DESC;

-- 2. CHECK FOR DUPLICATE MAILER IDS
SELECT
  mailer_id,
  COUNT(*) as count
FROM postcards
WHERE user_email = 'lastcall.me@hotmail.com'
GROUP BY mailer_id
HAVING COUNT(*) > 1;

-- 3. CHECK RLS POLICIES ON POSTCARDS TABLE
SELECT
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'postcards';

-- 4. CHECK ALL APP_DATA ENTRIES (without array length check)
SELECT
  data_type,
  created_at,
  updated_at,
  CASE
    WHEN jsonb_typeof(data) = 'array' THEN jsonb_array_length(data)
    ELSE NULL
  END as item_count,
  jsonb_typeof(data) as data_type_check
FROM app_data
WHERE user_email = 'lastcall.me@hotmail.com'
ORDER BY data_type;

-- 5. CHECK CLIENTS COUNT
SELECT COUNT(*) as client_count
FROM clients
WHERE user_email = 'lastcall.me@hotmail.com';

-- 6. CHECK IF RLS IS ENABLED
SELECT
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename IN ('postcards', 'app_data', 'clients');
