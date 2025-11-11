-- ============================================
-- VERIFY AND FIX CLOUD SYNC
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Check if app_data table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'app_data'
) as app_data_exists;

-- 2. If it doesn't exist, create it
CREATE TABLE IF NOT EXISTS app_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email TEXT NOT NULL,
  data_type TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_email, data_type)
);

-- 3. Create index
CREATE INDEX IF NOT EXISTS idx_app_data_user_type ON app_data(user_email, data_type);

-- 4. Enable Row Level Security
ALTER TABLE app_data ENABLE ROW LEVEL SECURITY;

-- 5. Drop existing policy if it exists (to avoid conflicts)
DROP POLICY IF EXISTS "Users can manage their own app data" ON app_data;

-- 6. Create RLS policy
CREATE POLICY "Users can manage their own app data" ON app_data
  FOR ALL USING (user_email = current_setting('request.jwt.claims', true)::json->>'email');

-- 7. Create updated_at trigger
DROP TRIGGER IF EXISTS update_app_data_updated_at ON app_data;
CREATE TRIGGER update_app_data_updated_at BEFORE UPDATE ON app_data
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 8. Add comment
COMMENT ON TABLE app_data IS 'Generic storage for app data - clients, tasks, kanban, expenses, prospects. Will be migrated to normalized tables later.';

-- 9. Verify data
SELECT data_type, created_at, updated_at
FROM app_data
WHERE user_email = 'lastcall.me@hotmail.com'
ORDER BY data_type;

-- 10. Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'app_data';
