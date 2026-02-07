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
- [ ] **Rotate API keys that are still in use** (Manual - requires dashboard access)
  - [x] ~~Anthropic API key~~ - REMOVED (no longer using AI)
  - [x] ~~Hunter.io API key~~ - REMOVED (deleted hunter-email.js)
  - [x] ~~Outscraper API key~~ - REMOVED (never worked)
  - [ ] Revoke Google Maps API key, generate new
  - [ ] Revoke Yelp API key, generate new
  - [ ] Revoke Foursquare API key, generate new
  - [ ] Revoke Serper API key, generate new
  - [ ] Update all keys in Vercel environment variables
  - [x] Remove hardcoded Google Maps key from config.js (use env var)

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
- [ ] **Add Sentry error tracking**
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

- [ ] **Run SQL schema in Supabase**
  - [ ] Run sql/subscription-tables.sql in Supabase SQL Editor

- [x] **Payment API endpoints** (Created)
  - [x] /api/square/create-checkout.js
  - [x] /api/square/webhook.js
  - [x] /api/square/subscription-status.js

- [x] **Payment UI** (Created)
  - [x] pricing.html page

### Day 11-12: Usage Quotas & Limits (Feb 16-17)
- [ ] **Implement usage tracking**
  - [ ] Track enrichments per user
  - [ ] Track API calls per user
  - [ ] Store in Supabase

- [ ] **Enforce plan limits**
  - [ ] Check quota before enrichment
  - [ ] Show usage dashboard
  - [ ] Overage warnings

### Day 13: Database & Schema (Feb 18)
- [ ] **Supabase schema updates**
  - [x] Created sql/subscription-tables.sql
  - [ ] Run schema in Supabase
  - [ ] Test row-level security policies

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

### Pricing Strategy (Draft - Updated)
| Plan | Price | Limits |
|------|-------|--------|
| Starter | $49/mo | 500 enrichments, 1 campaign |
| Pro | $99/mo | 2000 enrichments, 5 campaigns |
| Enterprise | $199/mo | Unlimited enrichments, unlimited campaigns |

*Note: AI generations removed from pricing - feature was deleted*

### API Costs (Current)
| API | Cost |
|-----|------|
| Yelp Fusion | FREE (5,000/day) |
| Serper | ~$0.001/search |
| Google Maps | ~$0.003/request |
| Foursquare | FREE (99,000/mo) |
| HERE | FREE (250,000/mo) |
| Brave Search | FREE (2,000/mo) |
| Supabase | FREE tier |

**Estimated cost per user:** $0.10-0.50/month

### Client List Location
- Full list: `9x12_operators_FULL_LIST.csv` (265 contacts)
- Priority list: `9x12_operators_contact_list.csv` (25 contacts)

---

## PROGRESS LOG

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
