-- ============================================
-- COMPLETE SUPABASE AUDIT
-- ============================================

-- 1. CHECK ALL POSTCARDS IN DATABASE
SELECT
  mailer_id,
  town,
  mail_date,
  payment_status,
  created_at,
  updated_at,
  spot_1,
  spot_2,
  spot_3
FROM postcards
WHERE user_email = 'lastcall.me@hotmail.com'
ORDER BY created_at DESC;

-- 2. CHECK RLS POLICIES ON POSTCARDS TABLE
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'postcards';

-- 3. CHECK RLS POLICIES ON APP_DATA TABLE
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'app_data';

-- 4. CHECK ALL APP_DATA ENTRIES
SELECT
  data_type,
  created_at,
  updated_at,
  jsonb_array_length(data) as item_count
FROM app_data
WHERE user_email = 'lastcall.me@hotmail.com'
ORDER BY data_type;

-- 5. CHECK FOR DUPLICATE MAILER IDS
SELECT
  mailer_id,
  COUNT(*) as count
FROM postcards
WHERE user_email = 'lastcall.me@hotmail.com'
GROUP BY mailer_id
HAVING COUNT(*) > 1;

-- 6. CHECK CLIENTS
SELECT COUNT(*) as client_count
FROM clients
WHERE user_email = 'lastcall.me@hotmail.com';

-- 7. CHECK TABLE PERMISSIONS
SELECT
  grantee,
  table_schema,
  table_name,
  privilege_type
FROM information_schema.table_privileges
WHERE table_name IN ('postcards', 'app_data', 'clients')
  AND grantee IN ('anon', 'authenticated', 'postgres');

-- 8. CHECK IF RLS IS ENABLED
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename IN ('postcards', 'app_data', 'clients', 'expenses', 'tasks', 'kanban');
