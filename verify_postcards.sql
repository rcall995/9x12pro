-- Check if postcards exist
SELECT mailer_id, town, mail_date, user_email
FROM postcards
WHERE user_email = 'lastcall.me@hotmail.com'
ORDER BY mail_date DESC;

-- If no results, let's insert them fresh
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
  'Available', 'Available', 'Available', 'Available', 'Available', 'Available',
  'Available', 'Available', 'Available', 'Available', 'Available', 'Available',
  'Available', 'Available', 'Available', 'Available', 'Available', 'Available',
  '#000000',
  '#0910ec'
) ON CONFLICT (mailer_id) DO UPDATE SET
  town = EXCLUDED.town,
  mail_date = EXCLUDED.mail_date;

-- Verify
SELECT mailer_id, town, mail_date FROM postcards WHERE user_email = 'lastcall.me@hotmail.com';
