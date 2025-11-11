-- ============================================
-- COMPLETE REBUILD FROM SCRATCH
-- Copy and paste this ENTIRE script into Supabase SQL Editor
-- Click RUN once
-- ============================================

-- DROP EVERYTHING
DROP TABLE IF EXISTS postcards CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS app_data CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS spot_pricing CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS kanban CASCADE;
DROP TABLE IF EXISTS manual_prospects CASCADE;
DROP TABLE IF EXISTS not_interested CASCADE;

-- CREATE TABLES (NO RLS - WIDE OPEN FOR NOW)
CREATE TABLE postcards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  mailer_id TEXT NOT NULL UNIQUE,
  town TEXT NOT NULL,
  mail_date DATE NOT NULL,
  in_homes_date DATE,
  payment_status TEXT DEFAULT 'Active',
  spot_1 TEXT DEFAULT 'Available',
  spot_2 TEXT DEFAULT 'Available',
  spot_3 TEXT DEFAULT 'Available',
  spot_4 TEXT DEFAULT 'Available',
  spot_5 TEXT DEFAULT 'Available',
  spot_6 TEXT DEFAULT 'Available',
  spot_7 TEXT DEFAULT 'Available',
  spot_8 TEXT DEFAULT 'Available',
  spot_9 TEXT DEFAULT 'Available',
  spot_10 TEXT DEFAULT 'Available',
  spot_11 TEXT DEFAULT 'Available',
  spot_12 TEXT DEFAULT 'Available',
  spot_13 TEXT DEFAULT 'Available',
  spot_14 TEXT DEFAULT 'Available',
  spot_15 TEXT DEFAULT 'Available',
  spot_16 TEXT DEFAULT 'Available',
  spot_17 TEXT DEFAULT 'Available',
  spot_18 TEXT DEFAULT 'Available',
  postcard_bg TEXT DEFAULT '#000000',
  banner_bg TEXT DEFAULT '#000000',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  business_name TEXT NOT NULL,
  category TEXT,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE app_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  data_type TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_email, data_type)
);

CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  mailer_id TEXT NOT NULL,
  printing DECIMAL(10,2) DEFAULT 0,
  postage DECIMAL(10,2) DEFAULT 0,
  design DECIMAL(10,2) DEFAULT 0,
  misc DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_email, mailer_id)
);

-- DISABLE RLS ON ALL TABLES (WIDE OPEN - NO SECURITY FOR NOW)
ALTER TABLE postcards DISABLE ROW LEVEL SECURITY;
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE app_data DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;

-- INSERT TEST DATA
INSERT INTO postcards (user_email, mailer_id, town, mail_date, in_homes_date, payment_status, postcard_bg, banner_bg) VALUES
('lastcall.me@hotmail.com', 'GRAND-ISLAND-12-2025', 'Grand Island', '2025-12-01', '2025-12-05', 'Active', '#000000', '#0910ec'),
('lastcall.me@hotmail.com', 'KENMORE-01-2026', 'Kenmore', '2026-01-01', '2026-01-05', 'Active', '#000000', '#0910ec');

INSERT INTO clients (user_email, business_name, category, contact_name, phone, email) VALUES
('lastcall.me@hotmail.com', 'Test Business 1', 'Restaurant', 'John Doe', '7165551111', 'test1@example.com'),
('lastcall.me@hotmail.com', 'Test Business 2', 'Retail', 'Jane Smith', '7165552222', 'test2@example.com'),
('lastcall.me@hotmail.com', 'Test Business 3', 'Service', 'Bob Johnson', '7165553333', 'test3@example.com');

-- VERIFY DATA EXISTS
SELECT 'POSTCARDS' as table_name, COUNT(*) as count FROM postcards
UNION ALL
SELECT 'CLIENTS', COUNT(*) FROM clients;

-- SHOW ACTUAL DATA
SELECT mailer_id, town, mail_date FROM postcards ORDER BY mail_date;
SELECT business_name, category FROM clients ORDER BY business_name;
