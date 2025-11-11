-- ============================================
-- SEED DATA - Import existing postcards from Google Sheets
-- Run this in Supabase SQL Editor AFTER running supabase_schema.sql
-- ============================================

-- Insert Grand Island postcard
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
  NULL,
  'Active',
  'Reserved: Adam''s',
  'Reserved: Adam''s',
  'Reserved: Trilogy',
  'Reserved: Trilogy',
  'Available',
  'Available',
  'Available',
  'Reserved: Test',
  'Available',
  'Available',
  'Available',
  'Available',
  'Reserved: CasXteriors',
  'Available',
  'Available',
  'Available',
  'Available',
  'Available',
  '#000000',
  '#0910ec'
);

-- Insert Kenmore postcard
INSERT INTO postcards (
  user_email, mailer_id, town, mail_date, in_homes_date, payment_status,
  spot_1, spot_2, spot_3, spot_4, spot_5, spot_6, spot_7, spot_8, spot_9,
  spot_10, spot_11, spot_12, spot_13, spot_14, spot_15, spot_16, spot_17, spot_18,
  postcard_bg, banner_bg
) VALUES (
  'lastcall.me@hotmail.com',
  'KENMORE-12-2026',
  'Kenmore',
  '2025-12-02',
  NULL,
  'Active',
  'Available',
  'Available',
  'Reserved: Trilogy',
  'Reserved: Trilogy',
  'Available',
  'Available',
  'Available',
  'Reserved: Test',
  'Available',
  'Available',
  'Available',
  'Available',
  'Reserved: CasXteriors',
  'Available',
  'Available',
  'Available',
  'Available',
  'Available',
  '#000001',
  '#0910ec'
);

-- Verify the data was inserted
SELECT * FROM postcards WHERE user_email = 'lastcall.me@hotmail.com';
