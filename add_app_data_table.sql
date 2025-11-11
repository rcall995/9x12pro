-- ============================================
-- APP DATA TABLE - Generic JSON storage for quick migration
-- This allows us to migrate from Google Sheets quickly
-- Later we can refactor to use proper normalized tables
-- ============================================

CREATE TABLE IF NOT EXISTS app_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email TEXT NOT NULL,
  data_type TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_email, data_type)
);

CREATE INDEX idx_app_data_user_type ON app_data(user_email, data_type);

-- Row Level Security
ALTER TABLE app_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own app data" ON app_data
  FOR ALL USING (user_email = current_setting('request.jwt.claims', true)::json->>'email');

-- Trigger for updated_at
CREATE TRIGGER update_app_data_updated_at BEFORE UPDATE ON app_data
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert placeholder comment
COMMENT ON TABLE app_data IS 'Generic storage for app data - clients, tasks, kanban, expenses, prospects. Will be migrated to normalized tables later.';
