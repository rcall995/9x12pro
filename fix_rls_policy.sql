-- ============================================
-- FIX RLS POLICY - Allow anon access for dev user
-- ============================================

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can manage their own app data" ON app_data;

-- Create a new policy that allows:
-- 1. Authenticated users to access their own data (future)
-- 2. Anon users to access lastcall.me@hotmail.com data (current dev setup)
CREATE POLICY "Allow access to app data" ON app_data
  FOR ALL
  USING (
    user_email = 'lastcall.me@hotmail.com'
    OR
    user_email = current_setting('request.jwt.claims', true)::json->>'email'
  );

-- Verify the policy
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'app_data';

-- Test query (should now work)
SELECT * FROM app_data WHERE user_email = 'lastcall.me@hotmail.com';
