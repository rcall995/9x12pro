-- ============================================
-- COMPLETE RESET AND VERIFICATION
-- Run this to start fresh and verify setup
-- ============================================

-- STEP 1: DELETE ALL EXISTING DATA
DELETE FROM postcards WHERE user_email = 'lastcall.me@hotmail.com';
DELETE FROM clients WHERE user_email = 'lastcall.me@hotmail.com';
DELETE FROM app_data WHERE user_email = 'lastcall.me@hotmail.com';
DELETE FROM expenses WHERE user_email = 'lastcall.me@hotmail.com';

-- STEP 2: VERIFY TABLES ARE EMPTY
SELECT 'Postcards' as table_name, COUNT(*) as count FROM postcards WHERE user_email = 'lastcall.me@hotmail.com'
UNION ALL
SELECT 'Clients', COUNT(*) FROM clients WHERE user_email = 'lastcall.me@hotmail.com'
UNION ALL
SELECT 'App Data', COUNT(*) FROM app_data WHERE user_email = 'lastcall.me@hotmail.com'
UNION ALL
SELECT 'Expenses', COUNT(*) FROM expenses WHERE user_email = 'lastcall.me@hotmail.com';

-- STEP 3: VERIFY RLS POLICIES ARE CORRECT
SELECT
  tablename,
  policyname,
  qual
FROM pg_policies
WHERE tablename IN ('postcards', 'clients', 'app_data', 'expenses')
ORDER BY tablename;

-- STEP 4: TEST INSERT A POSTCARD (verify RLS allows it)
INSERT INTO postcards (
  user_email, mailer_id, town, mail_date, in_homes_date, payment_status,
  spot_1, spot_2, spot_3, spot_4, spot_5, spot_6, spot_7, spot_8, spot_9,
  spot_10, spot_11, spot_12, spot_13, spot_14, spot_15, spot_16, spot_17, spot_18,
  postcard_bg, banner_bg
) VALUES (
  'lastcall.me@hotmail.com',
  'GRAND-ISLAND-12-2025',
  'Grand Island',
  '2025-12-01',  -- ISO format date
  '2025-12-05',
  'Active',
  'Available', 'Available', 'Available', 'Available', 'Available', 'Available',
  'Available', 'Available', 'Available', 'Available', 'Available', 'Available',
  'Available', 'Available', 'Available', 'Available', 'Available', 'Available',
  '#000000',
  '#0910ec'
) RETURNING mailer_id, town, mail_date;

-- STEP 5: VERIFY POSTCARD WAS INSERTED
SELECT mailer_id, town, mail_date, created_at
FROM postcards
WHERE user_email = 'lastcall.me@hotmail.com';

-- STEP 6: TEST INSERT CLIENT
INSERT INTO clients (
  user_email, business_name, category, contact_name, phone, email
) VALUES (
  'lastcall.me@hotmail.com',
  'Test Business',
  'Test Category',
  'John Doe',
  '7165551234',
  'test@example.com'
) RETURNING business_name, category;

-- STEP 7: VERIFY CLIENT WAS INSERTED
SELECT business_name, category, contact_name
FROM clients
WHERE user_email = 'lastcall.me@hotmail.com';

-- STEP 8: TEST APP_DATA INSERT
INSERT INTO app_data (
  user_email, data_type, data
) VALUES (
  'lastcall.me@hotmail.com',
  'tasks',
  '[{"id": 1, "text": "Test task", "dueDate": "2025-12-01", "completed": false}]'::jsonb
) ON CONFLICT (user_email, data_type) DO UPDATE SET
  data = EXCLUDED.data,
  updated_at = NOW()
RETURNING data_type, jsonb_array_length(data) as item_count;

-- STEP 9: VERIFY APP_DATA WAS INSERTED
SELECT data_type, data
FROM app_data
WHERE user_email = 'lastcall.me@hotmail.com';

-- STEP 10: CLEANUP TEST DATA
DELETE FROM postcards WHERE mailer_id = 'GRAND-ISLAND-12-2025';
DELETE FROM clients WHERE business_name = 'Test Business';
DELETE FROM app_data WHERE data_type = 'tasks';

-- STEP 11: FINAL VERIFICATION - ALL TABLES SHOULD BE EMPTY AGAIN
SELECT 'Postcards' as table_name, COUNT(*) as count FROM postcards WHERE user_email = 'lastcall.me@hotmail.com'
UNION ALL
SELECT 'Clients', COUNT(*) FROM clients WHERE user_email = 'lastcall.me@hotmail.com'
UNION ALL
SELECT 'App Data', COUNT(*) FROM app_data WHERE user_email = 'lastcall.me@hotmail.com';

-- ============================================
-- RESULTS INTERPRETATION:
-- ============================================
-- All counts should be 0 at steps 2 and 11
-- Steps 4, 6, 8 should succeed without errors
-- Steps 5, 7, 9 should show the test data
-- If any step fails, there's a problem with RLS or table setup
