# 9x12 Pro - Launch Preparation Checklist
**Created:** 2026-02-06
**Target Launch:** 2026-02-20 (2 weeks)
**Potential Clients:** 265 9x12 operators

---

## WEEK 1: Security & Infrastructure (Feb 6-12)

### Day 1-2: Critical Security (Feb 6-7)
- [ ] **Rotate ALL exposed API keys** (2 hrs)
  - [ ] Revoke Anthropic API key, generate new
  - [ ] Revoke Google Maps API key, generate new
  - [ ] Revoke Yelp API key, generate new
  - [ ] Revoke Outscraper API key, generate new
  - [ ] Revoke Hunter.io API key, generate new
  - [ ] Revoke Foursquare API key, generate new
  - [ ] Update all keys in Vercel environment variables
  - [ ] Remove hardcoded keys from config.js (use env vars only)
  - [ ] Purge .env.local from git history

- [ ] **Add rate limiting to API routes** (4 hrs)
  - [ ] /api/generate-pitch.js - 20 requests/min
  - [ ] /api/generate-comment.js - 20 requests/min
  - [ ] /api/enrich-contact.js - 30 requests/min
  - [ ] /api/hunter-email.js - 30 requests/min
  - [ ] /api/serper-search.js - 50 requests/min
  - [ ] /api/yelp.js - 50 requests/min
  - [ ] /api/validate-email.js - 100 requests/min

### Day 3-4: Input Validation & Security (Feb 8-9)
- [ ] **Add input validation to all API routes** (6 hrs)
  - [ ] URL format validation
  - [ ] Domain validation (block private IPs for SSRF)
  - [ ] Request size limits
  - [ ] Sanitize all user inputs

- [ ] **Fix XSS vulnerabilities** (8 hrs)
  - [ ] Audit all innerHTML usage
  - [ ] Use escapeHTML() consistently
  - [ ] Sanitize AI-generated content
  - [ ] Sanitize enrichment data display

### Day 5: Error Tracking & Monitoring (Feb 10)
- [ ] **Add Sentry error tracking** (4 hrs)
  - [ ] Create Sentry account/project
  - [ ] Add Sentry SDK to app
  - [ ] Configure error boundaries
  - [ ] Test error reporting

### Day 6-7: Testing & Buffer (Feb 11-12)
- [ ] Security testing
- [ ] Fix any issues found
- [ ] Buffer time for overflow

---

## WEEK 2: Testing & Polish (Feb 13-19)

### Day 8-10: Square Payment Integration (Feb 13-15) - DEFERRED
- [ ] **Square account setup** (2 hrs)
  - [ ] Create Square Developer account
  - [ ] Create application
  - [ ] Get API credentials (sandbox first)
  - [ ] Configure webhooks

- [ ] **Subscription plans in Square** (2 hrs)
  - [ ] Create "Starter" plan ($49/mo)
  - [ ] Create "Pro" plan ($99/mo)
  - [ ] Create "Enterprise" plan ($199/mo)
  - [ ] Define feature limits per plan

- [ ] **Payment API endpoints** (8 hrs)
  - [ ] POST /api/square/create-customer.js
  - [ ] POST /api/square/create-subscription.js
  - [ ] POST /api/square/cancel-subscription.js
  - [ ] POST /api/square/webhook.js (payment events)
  - [ ] GET /api/square/subscription-status.js

- [ ] **Payment UI** (6 hrs)
  - [ ] Pricing page
  - [ ] Checkout flow
  - [ ] Subscription management page
  - [ ] Payment history/invoices

### Day 11-12: Usage Quotas & Limits (Feb 16-17)
- [ ] **Implement usage tracking** (6 hrs)
  - [ ] Track AI generations per user
  - [ ] Track enrichments per user
  - [ ] Track API calls per user
  - [ ] Store in Supabase

- [ ] **Enforce plan limits** (4 hrs)
  - [ ] Check quota before AI calls
  - [ ] Check quota before enrichment
  - [ ] Show usage dashboard
  - [ ] Overage warnings

### Day 13: Database & Schema (Feb 18)
- [ ] **Supabase schema updates** (4 hrs)
  - [ ] Add subscriptions table
  - [ ] Add usage_tracking table
  - [ ] Add invoices table
  - [ ] Add audit_logs table
  - [ ] Row-level security policies

### Day 14: Final Testing & Soft Launch (Feb 19)
- [ ] **Pre-launch checklist**
  - [ ] All API keys rotated and working
  - [ ] Rate limiting active
  - [ ] Payment flow tested (sandbox)
  - [ ] Switch to Square production
  - [ ] Test with 1-2 beta users

---

## WEEK 3: Launch (Feb 20+)

### Launch Day (Feb 20)
- [ ] **Soft launch to 10-25 operators**
  - [ ] Select from 9x12_operators_contact_list.csv
  - [ ] Send personal outreach emails
  - [ ] Offer launch discount (20% off first 3 months?)
  - [ ] Gather feedback

### Post-Launch (Feb 21-28)
- [ ] Monitor error tracking
- [ ] Address user feedback
- [ ] Scale outreach to remaining 240 operators
- [ ] Begin code modularization (app-main.js split)

---

## POST-LAUNCH BACKLOG (March+)

### Code Quality
- [ ] Split app-main.js into modules (~40 hrs)
  - [ ] modules/kanban.js
  - [ ] modules/crm.js
  - [ ] modules/prospecting.js
  - [ ] modules/outreach.js
  - [ ] modules/spark.js
  - [ ] modules/campaign-board.js

### Accessibility
- [ ] ARIA labels for all interactive elements
- [ ] Keyboard navigation
- [ ] Screen reader support

### Performance
- [ ] Optimize DOM rendering
- [ ] Parallelize API calls
- [ ] Lazy load modules

### Features
- [ ] Team/multi-user support
- [ ] White-label option
- [ ] API access for integrations

---

## NOTES

### Square vs Stripe Decision
Using Square because:
- Simpler subscription API
- Good for service businesses
- Integrated invoicing
- Lower fees for subscriptions

### Pricing Strategy (Draft)
| Plan | Price | Limits |
|------|-------|--------|
| Starter | $49/mo | 100 AI generations, 500 enrichments, 1 campaign |
| Pro | $99/mo | 500 AI generations, 2000 enrichments, 5 campaigns |
| Enterprise | $199/mo | Unlimited AI, unlimited enrichments, unlimited campaigns |

### Client List Location
- Full list: `9x12_operators_FULL_LIST.csv` (265 contacts)
- Priority list: `9x12_operators_contact_list.csv` (25 contacts)

---

## PROGRESS LOG

### 2026-02-06
- [x] Comprehensive codebase review completed
- [x] Created this TODO list
- [x] Verified .env.local is gitignored (not exposed in repo)
- [x] Created Square payment integration:
  - [x] /api/square/create-checkout.js
  - [x] /api/square/webhook.js
  - [x] /api/square/subscription-status.js
- [x] Created pricing.html page
- [x] Created SQL schema for subscriptions (sql/subscription-tables.sql)
- [x] Added Square SDK to package.json
- [ ] TODO: Configure Square environment variables in Vercel
- [ ] TODO: Run SQL schema in Supabase
- [ ] TODO: Test Square checkout flow (sandbox)
- [x] Dead code cleanup (v505):
  - [x] Removed Spark comment system completely (~650 lines)
    - Deleted spark-mobile.html
    - Deleted /api/ai/generate-comment.js
    - Removed all Spark state, functions, and window exposures from app-main.js
  - [x] Removed Outscraper API (never worked)
    - Deleted /api/outscraper.js
    - Deleted /api/outscraper-search.js
  - [x] Updated onboarding tip to remove Spark reference
  - [x] app-main.js reduced from ~30,550 to ~29,900 lines

### SQUARE SETUP REQUIRED (Manual Steps)
1. Create Square Developer account: https://developer.squareup.com
2. Create application, get credentials
3. Add to Vercel environment variables:
   - SQUARE_ACCESS_TOKEN
   - SQUARE_LOCATION_ID
   - SQUARE_ENVIRONMENT=sandbox (or production)
   - SQUARE_WEBHOOK_SIGNATURE_KEY
   - SQUARE_STARTER_PLAN_ID
   - SQUARE_PRO_PLAN_ID
   - SQUARE_ENTERPRISE_PLAN_ID
   - SUPABASE_SERVICE_ROLE_KEY (for webhooks)
4. Configure webhook URL in Square: https://9x12pro.com/api/square/webhook
5. Run sql/subscription-tables.sql in Supabase SQL Editor

