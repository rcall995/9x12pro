-- ============================================
-- FIX: Enable RLS on campaign_revenue view
-- ============================================

-- Drop the existing view
DROP VIEW IF EXISTS campaign_revenue;

-- Recreate with security_invoker option (PostgreSQL 15+)
-- This makes the view execute with the permissions of the calling user,
-- automatically enforcing RLS policies from underlying tables
CREATE VIEW campaign_revenue
WITH (security_invoker = true)
AS
SELECT
  p.mailer_id,
  p.town,
  p.mail_date,
  p.user_email,
  COUNT(CASE WHEN sp.price IS NOT NULL THEN 1 END) as spots_sold,
  COALESCE(SUM(sp.price), 0) as total_revenue,
  COALESCE(e.printing + e.postage + e.design + e.misc, 0) as total_expenses,
  COALESCE(SUM(sp.price), 0) - COALESCE(e.printing + e.postage + e.design + e.misc, 0) as profit
FROM postcards p
LEFT JOIN spot_pricing sp ON p.mailer_id = sp.mailer_id
LEFT JOIN expenses e ON p.mailer_id = e.mailer_id
GROUP BY p.mailer_id, p.town, p.mail_date, p.user_email, e.printing, e.postage, e.design, e.misc;

-- Now the view will automatically respect RLS policies from postcards, spot_pricing, and expenses tables
-- Users will only see revenue data for their own postcards

-- Test query (should only return your data):
-- SELECT * FROM campaign_revenue;
