-- ============================================
-- FIX 406 ERROR - Simplify RLS policies for anon access
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Allow access to app data" ON app_data;
DROP POLICY IF EXISTS "Allow access to postcards" ON postcards;
DROP POLICY IF EXISTS "Users can manage their own clients" ON clients;
DROP POLICY IF EXISTS "Users can manage their own expenses" ON expenses;

-- Create simple permissive policies for development
-- These allow full access to your email without JWT requirements

CREATE POLICY "anon_access_app_data" ON app_data
  FOR ALL
  TO anon
  USING (user_email = 'lastcall.me@hotmail.com')
  WITH CHECK (user_email = 'lastcall.me@hotmail.com');

CREATE POLICY "anon_access_postcards" ON postcards
  FOR ALL
  TO anon
  USING (user_email = 'lastcall.me@hotmail.com')
  WITH CHECK (user_email = 'lastcall.me@hotmail.com');

CREATE POLICY "anon_access_clients" ON clients
  FOR ALL
  TO anon
  USING (user_email = 'lastcall.me@hotmail.com')
  WITH CHECK (user_email = 'lastcall.me@hotmail.com');

CREATE POLICY "anon_access_expenses" ON expenses
  FOR ALL
  TO anon
  USING (user_email = 'lastcall.me@hotmail.com')
  WITH CHECK (user_email = 'lastcall.me@hotmail.com');

-- Verify policies were created
SELECT
  tablename,
  policyname,
  roles
FROM pg_policies
WHERE tablename IN ('app_data', 'postcards', 'clients', 'expenses')
ORDER BY tablename;

-- Test queries to verify they work
SELECT COUNT(*) as app_data_count FROM app_data WHERE user_email = 'lastcall.me@hotmail.com';
SELECT COUNT(*) as postcards_count FROM postcards WHERE user_email = 'lastcall.me@hotmail.com';
SELECT COUNT(*) as clients_count FROM clients WHERE user_email = 'lastcall.me@hotmail.com';
