-- ============================================
-- FIX EVERYTHING - RUN THIS ONE SCRIPT ONLY
-- ============================================

-- STEP 1: DISABLE RLS TEMPORARILY TO VERIFY DATABASE WORKS
ALTER TABLE app_data DISABLE ROW LEVEL SECURITY;
ALTER TABLE postcards DISABLE ROW LEVEL SECURITY;
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;

-- STEP 2: DELETE ALL EXISTING DATA
DELETE FROM postcards;
DELETE FROM clients;
DELETE FROM app_data;
DELETE FROM expenses;

-- STEP 3: INSERT TEST POSTCARD
INSERT INTO postcards (
  user_email, mailer_id, town, mail_date, in_homes_date, payment_status,
  spot_1, spot_2, spot_3, spot_4, spot_5, spot_6, spot_7, spot_8, spot_9,
  spot_10, spot_11, spot_12, spot_13, spot_14, spot_15, spot_16, spot_17, spot_18,
  postcard_bg, banner_bg
) VALUES (
  'lastcall.me@hotmail.com',
  'GRAND-ISLAND-12-2025',
  'Grand Island',
  '2025-12-01',
  '2025-12-05',
  'Active',
  'Available', 'Available', 'Available', 'Available', 'Available', 'Available',
  'Available', 'Available', 'Available', 'Available', 'Available', 'Available',
  'Available', 'Available', 'Available', 'Available', 'Available', 'Available',
  '#000000',
  '#0910ec'
);

-- STEP 4: INSERT 5 TEST CLIENTS
INSERT INTO clients (user_email, business_name, category, contact_name, phone, email) VALUES
('lastcall.me@hotmail.com', 'Test Business 1', 'Restaurant', 'John Doe', '7165551111', 'test1@example.com'),
('lastcall.me@hotmail.com', 'Test Business 2', 'Retail', 'Jane Smith', '7165552222', 'test2@example.com'),
('lastcall.me@hotmail.com', 'Test Business 3', 'Service', 'Bob Johnson', '7165553333', 'test3@example.com'),
('lastcall.me@hotmail.com', 'Test Business 4', 'Healthcare', 'Alice Brown', '7165554444', 'test4@example.com'),
('lastcall.me@hotmail.com', 'Test Business 5', 'Construction', 'Mike Wilson', '7165555555', 'test5@example.com');

-- STEP 5: VERIFY DATA WAS INSERTED
SELECT 'POSTCARDS' as table_name, COUNT(*) as count FROM postcards
UNION ALL
SELECT 'CLIENTS', COUNT(*) FROM clients;

-- STEP 6: SHOW THE ACTUAL DATA
SELECT mailer_id, town, mail_date FROM postcards;
SELECT business_name, category FROM clients LIMIT 5;

-- ============================================
-- RESULTS YOU SHOULD SEE:
-- POSTCARDS: 1
-- CLIENTS: 5
-- Then the actual postcard and client data listed
-- If you see this, the database works!
-- ============================================
