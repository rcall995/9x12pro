# 9x12 Pro - Launch Preparation Checklist
**Created:** 2026-02-06
**Target Launch:** 2026-02-20 (2 weeks)
**Potential Clients:** 265 9x12 operators

---

## CRITICAL: app-main.js is 29,479 lines

This is a maintenance and performance risk. The file should be split into modules:
- Harder to debug and maintain
- Slower initial page load
- Risk of merge conflicts
- IDE performance issues

**Recommended split:**
| Module | Estimated Lines | Priority |
|--------|-----------------|----------|
| modules/campaign-board.js | ~4,000 | High |
| modules/crm-modal.js | ~3,000 | High |
| modules/prospecting.js | ~3,000 | Medium |
| modules/templates.js | ~2,000 | Medium |
| modules/kanban.js | ~2,500 | Medium |
| modules/clients.js | ~2,000 | Low |
| modules/settings.js | ~1,500 | Low |

---

## WEEK 1: Security & Infrastructure (Feb 6-12)

### Day 1-2: Critical Security (Feb 6-7)
- [x] **Rotate/remove API keys** (Feb 10)
  - [x] ~~Anthropic API key~~ - REMOVED from Vercel (no longer using AI)
  - [x] ~~Hunter.io API key~~ - REMOVED (deleted hunter-email.js)
  - [x] ~~Outscraper API key~~ - REMOVED from Vercel (never worked)
  - [x] ~~Yelp API key~~ - REMOVED from Vercel + deleted api/yelp.js, yelp-details.js (not called)
  - [x] ~~Serper API key~~ - REMOVED from Vercel + deleted api/serper-search.js (replaced by ScrapingDog)
  - [x] ~~Foursquare API key~~ - REMOVED from Vercel + deleted api/foursquare-search.js (not called)
  - [x] ~~Google Custom Search~~ - REMOVED from Vercel + deleted api/google-search.js (debug only)
  - [x] Deleted test files: debug-data.js, test-enrichment-batch.js, scrapingdog-gws-test.js, test-search-comparison.js, validate-email.js, validate-website.js
  - [x] Remove hardcoded Google Maps key from config.js (use env var)
  - [ ] Rotate Google Maps API key (still active, only key needing rotation)

- [x] **Add rate limiting to API routes**
  - [x] Created rate-limit.js library
  - [x] ~~/api/generate-pitch.js~~ - DELETED
  - [x] ~~/api/generate-comment.js~~ - DELETED
  - [x] ~~/api/hunter-email.js~~ - DELETED
  - [x] /api/enrich-contact.js - 30 requests/min
  - [x] /api/serper-search.js - 50 requests/min
  - [x] /api/yelp.js - 50 requests/min
  - [x] /api/yelp-details.js - 50 requests/min
  - [x] /api/foursquare-search.js - 50 requests/min
  - [x] /api/here-search.js - 100 requests/min
  - [x] /api/validate-email.js - 100 requests/min
  - [x] /api/validate-website.js - 50 requests/min
  - [x] /api/scrape-email.js - 30 requests/min
  - [x] /api/google-search.js - 20 requests/min
  - [x] /api/brave-search.js - 30 requests/min
  - [x] /api/zip-neighbors.js - 20 requests/min
  - [x] /api/square/create-checkout.js - 10 requests/min
  - [x] /api/square/subscription-status.js - 30 requests/min

### Day 3-4: Input Validation & Security (Feb 8-9)
- [x] **Add input validation to API routes**
  - [x] Created validation.js library with URL, email, ZIP validation
  - [x] SSRF protection (block private IPs, localhost, metadata endpoints)
  - [x] Applied to enrich-contact.js, scrape-email.js, validate-website.js
  - [ ] Add to remaining routes (lower risk)

- [x] **Fix XSS vulnerabilities (partial)**
  - [x] Created global escapeHtml() function
  - [x] Exposed as window.escapeHtml for templates
  - [ ] Full audit of 145 innerHTML usages (post-launch)
  - Note: Most innerHTML is used with internally-generated data, not user input

### Day 5: Error Tracking & Monitoring (Feb 10)
- [x] **Add Sentry error tracking** (LIVE in app.html)
  - [x] Create Sentry account/project
  - [x] Add Sentry SDK to app
  - [x] Configure error boundaries
  - [x] Test error reporting

### Day 6-7: Testing & Buffer (Feb 11-12)
- [ ] Security testing
- [ ] Fix any issues found
- [ ] Buffer time for overflow

---

## WEEK 2: Testing & Polish (Feb 13-19)

### Day 8-10: Square Payment Integration (Feb 13-15)
- [ ] **Square account setup** (Manual steps required)
  - [ ] Create Square Developer account: https://developer.squareup.com
  - [ ] Create application, get credentials
  - [ ] Configure webhooks

- [ ] **Configure Vercel environment variables**
  - [ ] SQUARE_ACCESS_TOKEN
  - [ ] SQUARE_LOCATION_ID
  - [ ] SQUARE_ENVIRONMENT=sandbox (then production)
  - [ ] SQUARE_WEBHOOK_SIGNATURE_KEY
  - [ ] SQUARE_STARTER_PLAN_ID
  - [ ] SQUARE_PRO_PLAN_ID
  - [ ] SQUARE_ENTERPRISE_PLAN_ID
  - [ ] SUPABASE_SERVICE_ROLE_KEY

- [x] **Run SQL schema in Supabase** (Feb 10)
  - [x] Run sql/subscription-tables.sql in Supabase SQL Editor

- [x] **Payment API endpoints** (Created)
  - [x] /api/square/create-checkout.js
  - [x] /api/square/webhook.js
  - [x] /api/square/subscription-status.js

- [x] **Payment UI** (Created)
  - [x] pricing.html page

### Day 11-12: Usage Quotas & Limits (Feb 16-17)
- [x] **Implement usage tracking** (DONE - v580, Feb 10)
  - [x] Track enrichments per user (monthly)
  - [x] Track ZIP searches per user (monthly, unique)
  - [x] Track email sends per user (monthly)
  - [x] Store in Supabase daily_usage table (aggregated monthly)

- [x] **Enforce plan limits** (DONE - v580, Feb 10)
  - [x] Unified TIER_LIMITS for free/pro/enterprise
  - [x] Monthly enrichment limits (free: 500, pro: 15K, enterprise: unlimited)
  - [x] Campaign limits enforced for all tiers (free: 1, pro: 3)
  - [x] ZIP search limits (free: 1 total, pro: 10/mo)
  - [x] Email campaigns gated (free: blocked, pro: 1K/mo)
  - [x] Facing slips gated (free: blocked)
  - [x] CSV export gated (free: blocked)
  - [x] Financial dashboard gated (free: blocked)
  - [x] Upgrade prompt modal with link to register.html
  - [ ] Show usage dashboard to user (nice to have - post-launch)

### Day 13: Database & Schema (Feb 18)
- [ ] **Supabase schema updates**
  - [x] Created sql/subscription-tables.sql
  - [x] Added email_sends_used column to daily_usage (Feb 10)
  - [x] Created increment_email_send_usage RPC (Feb 10)
  - [x] Run sql/subscription-tables.sql in Supabase (Feb 10)
  - [x] Tables: subscriptions, payments, invoices, usage_tracking, audit_logs
  - [x] RLS policies + service role access
  - [x] increment_usage() function

### Day 14: Final Testing & Soft Launch (Feb 19)
- [ ] **Pre-launch checklist**
  - [ ] All API keys rotated and working
  - [ ] Rate limiting active on all routes
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
- [ ] **Begin app-main.js modularization** (HIGH PRIORITY)

---

## POST-LAUNCH BACKLOG (March+)

### Code Quality (HIGH PRIORITY)
- [ ] **Split app-main.js into modules** (~29,479 lines currently)
  - [ ] modules/campaign-board.js
  - [ ] modules/crm-modal.js
  - [ ] modules/prospecting.js
  - [ ] modules/templates.js
  - [ ] modules/kanban.js
  - [ ] modules/clients.js
  - [ ] modules/settings.js
  - [ ] modules/utils.js

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

### Pricing Strategy (FINALIZED - Feb 9, synced to landing page & code)
| Plan | Price | Enrichments | Campaigns | ZIPs | Email Sends | Facing Slips | CSV | Financials |
|------|-------|-------------|-----------|------|-------------|--------------|-----|------------|
| Free | $0 | 500/mo | 1 | 1 total | Blocked | No | No | No |
| Pro | $49/mo (early bird, reg $79) | 15K/mo | 3 | 10/mo | 1K/mo | Yes | Yes | Yes |
| Enterprise | $99/mo (early bird, reg $139) | Unlimited | Unlimited | Unlimited | Unlimited | Yes | Yes | Yes |

*Note: Tier enforcement implemented in app-main.js v580. Limits defined in TIER_LIMITS constant.*

### Active API Endpoints (Feb 10, 19 total)
| Endpoint | Purpose | Env Key |
|----------|---------|---------|
| `/api/scrapingdog-search` | Website search (primary) | `SCRAPINGDOG_API_KEY` |
| `/api/brave-search` | Website search (fallback) | `BRAVE_API_KEY` |
| `/api/here-search` | Prospect Radar (business discovery) | `HERE_API_KEY` |
| `/api/google-places-search` | Business discovery fallback | `GOOGLE_PLACES_API_KEY` |
| `/api/enrich-contact` | Contact enrichment (scrapes directly) | — |
| `/api/scrape-email` | Email scraping from websites | — |
| `/api/zip-neighbors` | ZIP radius search | — |
| `/api/resend/*` | Email campaigns (6 endpoints) | `RESEND_API_KEY` |
| `/api/square/*` | Payments (3 endpoints, not configured) | `SQUARE_*` |
| `/api/send-renewal-email` | Contract renewal emails (future) | `RESEND_API_KEY` |

**Search chain:** ScrapingDog → Brave (2 steps)
**Business discovery:** HERE → Google Places fallback (when HERE < 5 results)

### API Costs (Current)
| API | Cost |
|-----|------|
| ScrapingDog | FREE (1,000/mo) |
| Brave Search | FREE (2,000/mo) |
| HERE | FREE (250,000/mo) |
| Google Places | $32/1K requests ($200/mo free credit, 6K quota) |
| Google Maps | ~$0.003/request (client-side only) |
| Resend | FREE (100 emails/day) |
| Supabase | FREE tier |

**Estimated cost per user:** $0.05-0.20/month (Google Places mostly covered by free credit)

### Client List Location
- Full list: `9x12_operators_FULL_LIST.csv` (265 contacts)
- Priority list: `9x12_operators_contact_list.csv` (25 contacts)

---

## PROGRESS LOG

### 2026-02-10 (v586 - Evening Session)

**Search Progress Modal:**
- [x] Added "Discovering Businesses" modal matching enrichment modal design
- [x] Gradient header, progress bar, ETA, businesses found counter, rotating messages
- [x] Cancel button to abort long multi-ZIP searches
- [x] Suppressed toasts during search (modal provides all feedback now)

**Category Select All Bug Fix:**
- [x] Fixed "All" checkbox not working when category group is expanded
- [x] Root cause: DOM sync in renderBusinessCategories() was overwriting toggleGroupSelection() changes
- [x] Extracted syncCategoryCheckboxes() and added skipSync parameter

**Search Quality Improvements:**
- [x] Added non-US phone number filter (blocks +852, +234, etc. — only +1 allowed)
- [x] Blocked analytics/tracking junk domains in both search APIs:
  clustrmaps.com, similarweb.com, alexa.com, semrush.com, ahrefs.com, moz.com,
  statshow.com, worthofweb.com, siteprice.org, hypestat.com, websiteoutlook.com

**Repo Cleanup:**
- [x] Committed and pushed all pending changes to GitHub
- [x] Removed 11 dead API endpoints and 7 dev test pages (-5,357 lines)
- [x] GitHub repo now fully synced with production deployment

**Active API Endpoints Updated (19 → +1):**
- [x] `/api/google-places-search` added to endpoints table (Google Places fallback)

---

### 2026-02-10 (v580-v586)

**Google Places Fallback (v586):**
- [x] `/api/google-places-search` — Text Search (New) API, triggers when HERE < 5 results
- [x] Cross-source dedup by normalized name+address
- [x] Rate limited: 20 req/min, 6,000/mo quota
- [x] Facebook search fallback links (zero API cost)
- [x] Junk result filters: no-contact, non-Latin names, street-address-only names

**Tier Enforcement Synced with Landing Page:**
- [x] Replaced FREE_TIER_LIMITS with unified TIER_LIMITS (free/pro/enterprise)
- [x] Changed usage tracking from daily to monthly aggregation
- [x] Added gates: email campaigns, facing slips, CSV export, financial dashboard
- [x] Campaign/enrichment/ZIP limits enforced for ALL tiers (not just free)
- [x] Added new functions: canSendEmail, canUseFacingSlips, canExportCSV, canUseFinancials
- [x] Added recordEmailSend() tracking
- [x] Updated showUpgradePrompt to link to register.html instead of pricing.html
- [x] Updated register.html info box to match new limits
- [x] Rebuilt landing page with accurate pricing/features (v579)

**SQL run in Supabase:**
- [x] ALTER TABLE daily_usage ADD COLUMN email_sends_used
- [x] CREATE FUNCTION increment_email_send_usage

---

### 2026-02-06 (v505-v507)

**Dead Code Removed (~1,580 lines total):**
- [x] Removed Spark comment system completely (~650 lines)
  - Deleted spark-mobile.html
  - Deleted /api/ai/generate-comment.js
  - Removed all Spark state, functions, and window exposures
- [x] Removed AI Pitch system completely (~930 lines)
  - Deleted /api/ai/generate-pitch.js
  - Deleted /api/ai/ folder entirely
  - Removed AI Pitch tab from CRM modal
  - Removed generateCrmPitch, copyCrmPitch functions
  - Removed generateInlinePitch, copyAIResult, refineAIPitch
  - Removed entire PIPELINE OUTREACH PANEL (HTML + JS)
- [x] Removed hunter-email.js (dead code, never called)
- [x] Removed Outscraper APIs (never worked)
  - Deleted /api/outscraper.js
  - Deleted /api/outscraper-search.js

**Features Added:**
- [x] Edit Contact modal in CRM
- [x] Edit button moved to CRM header Quick Actions
- [x] Square payment integration (API endpoints)
- [x] pricing.html page
- [x] sql/subscription-tables.sql schema
- [x] rate-limit.js library

**App Size:**
- Started: ~30,550 lines
- Current: ~29,479 lines
- Removed: ~1,071 lines from app-main.js

---

## QUICK REFERENCE: What Was Removed

| File/Feature | Status | Reason |
|--------------|--------|--------|
| /api/ai/generate-pitch.js | DELETED | AI pitch feature removed |
| /api/ai/generate-comment.js | DELETED | Spark system removed |
| /api/ai/ folder | DELETED | No AI features remain |
| /api/hunter-email.js | DELETED | Dead code, never called |
| /api/outscraper.js | DELETED | Never worked |
| /api/outscraper-search.js | DELETED | Never worked |
| spark-mobile.html | DELETED | Spark system removed |
| pipelineOutreachPanel | DELETED | Orphaned UI, never displayed |
| AI Pitch tab in CRM | DELETED | AI pitch feature removed |
| /api/yelp.js | DELETED | Not called from app (Feb 10) |
| /api/yelp-details.js | DELETED | Not called from app (Feb 10) |
| /api/serper-search.js | DELETED | Replaced by ScrapingDog+Brave (Feb 10) |
| /api/google-search.js | DELETED | Only used in debug test (Feb 10) |
| /api/foursquare-search.js | DELETED | Not called from app (Feb 10) |
| /api/debug-data.js | DELETED | Hardcoded Supabase keys (Feb 10) |
| /api/test-enrichment-batch.js | DELETED | Hardcoded Supabase keys (Feb 10) |
| /api/scrapingdog-gws-test.js | DELETED | Test file (Feb 10) |
| /api/test-search-comparison.js | DELETED | Test file (Feb 10) |
| /api/validate-email.js | DELETED | Only used in dev/ files (Feb 10) |
| /api/validate-website.js | DELETED | Only used in dev/ files (Feb 10) |
