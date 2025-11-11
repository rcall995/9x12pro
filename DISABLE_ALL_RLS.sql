-- ============================================
-- DISABLE RLS ON EVERY TABLE
-- ============================================

-- Disable RLS on all tables
ALTER TABLE IF EXISTS postcards DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS app_data DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS spot_pricing DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS kanban DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS manual_prospects DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS not_interested DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_profiles DISABLE ROW LEVEL SECURITY;

-- Drop ALL policies from all tables
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'ALTER TABLE IF EXISTS ' || quote_ident(r.tablename) || ' DISABLE ROW LEVEL SECURITY';
    END LOOP;
END $$;

-- Verify RLS is disabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
