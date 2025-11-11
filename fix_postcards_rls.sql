-- ============================================
-- FIX POSTCARDS RLS POLICY - Allow anon access
-- ============================================

-- Check current policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'postcards';

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Users can view their own postcards" ON postcards;
DROP POLICY IF EXISTS "Users can insert their own postcards" ON postcards;
DROP POLICY IF EXISTS "Users can update their own postcards" ON postcards;
DROP POLICY IF EXISTS "Users can delete their own postcards" ON postcards;

-- Create a single permissive policy for dev user
CREATE POLICY "Allow access to postcards" ON postcards
  FOR ALL
  USING (
    user_email = 'lastcall.me@hotmail.com'
    OR
    user_email = current_setting('request.jwt.claims', true)::json->>'email'
  );

-- Verify the policy works
SELECT mailer_id, town, mail_date
FROM postcards
WHERE user_email = 'lastcall.me@hotmail.com'
ORDER BY mail_date DESC;

-- Test insert
INSERT INTO postcards (
  user_email, mailer_id, town, mail_date, payment_status,
  spot_1, spot_2, spot_3, spot_4, spot_5, spot_6, spot_7, spot_8, spot_9,
  spot_10, spot_11, spot_12, spot_13, spot_14, spot_15, spot_16, spot_17, spot_18,
  postcard_bg, banner_bg
) VALUES (
  'lastcall.me@hotmail.com',
  'TEST-CARD-001',
  'Test Town',
  '2025-12-15',
  'Active',
  'Available', 'Available', 'Available', 'Available', 'Available', 'Available',
  'Available', 'Available', 'Available', 'Available', 'Available', 'Available',
  'Available', 'Available', 'Available', 'Available', 'Available', 'Available',
  '#000000',
  '#0910ec'
) ON CONFLICT (mailer_id) DO NOTHING;

-- Verify it was inserted
SELECT mailer_id FROM postcards WHERE mailer_id = 'TEST-CARD-001';

-- Clean up test
DELETE FROM postcards WHERE mailer_id = 'TEST-CARD-001';
