# Prospect Scoring & Enrichment Analysis
## 9x12 Pro - Determining High-Value Advertising Prospects

---

## 📊 Current Data Collection

### From Google Places API (Free)
- **Name** - Business name
- **Address** - Full address with ZIP validation
- **Phone** - Primary contact number
- **Website** - Business website URL
- **Rating** - Google star rating (1-5)
- **User Ratings Total** - Number of reviews
- **Business Status** - OPERATIONAL vs CLOSED
- **Place ID** - Unique Google identifier
- **Types** - Google business categories
- **Location** - Lat/lng coordinates

### From Smart Enrichment (Your Scraper)
- **Email addresses** - Contact emails from website
- **Social media** - Facebook, Instagram, LinkedIn, Twitter
- **Contact names** - Decision makers
- **Pages scraped** - Website depth

### From Outscraper (Paid)
- Enhanced contact details
- Additional phone numbers
- Verified social media profiles

---

## 🎯 Signals for "Likely to Buy Advertising"

### **HIGH-VALUE INDICATORS** (Businesses MOST likely to advertise)

#### 1. **New or Growing Businesses** ⭐⭐⭐⭐⭐
**Why:** New businesses need customers desperately and spend aggressively on marketing.
- **Signal:** `user_ratings_total` < 20 (fewer than 20 reviews = new business)
- **Signal:** Business opened in last 6-12 months (need Google opening date)
- **Action:** Prioritize businesses with 5-50 reviews (new but established enough to have budget)

#### 2. **High Online Presence** ⭐⭐⭐⭐⭐
**Why:** Businesses investing in digital presence understand marketing value.
- **Signal:** Has website + Facebook + Instagram
- **Signal:** Active social media (need post dates)
- **Signal:** Professional website (not just social media)
- **Action:** Score businesses with 3+ online channels higher

#### 3. **Service-Based Local Businesses** ⭐⭐⭐⭐⭐
**Why:** Rely on local customer flow, high ROI from local ads.
- **Best categories:** HVAC, Plumbing, Roofing, Landscaping, Home Services
- **Best categories:** Restaurants, Salons, Gyms, Auto Repair
- **Signal:** Categories from Google `types` array
- **Action:** Weight service businesses 2x over retail

#### 4. **Mid-Range Review Count** ⭐⭐⭐⭐
**Why:** Established enough to have budget, but still growing.
- **Sweet spot:** 20-200 reviews
- **Too few (<10):** Might be too new/struggling
- **Too many (>500):** Might already have established marketing channels
- **Action:** Score 20-200 reviews highest

#### 5. **Good But Not Perfect Rating** ⭐⭐⭐⭐
**Why:** Businesses with 4.0-4.5 stars need to compete harder than 5-star businesses.
- **Signal:** `rating` between 4.0-4.5
- **Why it works:** They have customers (proof of viability) but need more/better ones
- **Action:** Deprioritize 5-star businesses (less urgency)

#### 6. **No Website or Poor Website** ⭐⭐⭐
**Why:** Businesses without strong online presence have marketing gaps to fill.
- **Signal:** Missing website OR only social media
- **Signal:** No Instagram/Facebook presence
- **Action:** These businesses need traditional advertising more

#### 7. **Multi-Location Potential** ⭐⭐⭐
**Why:** Businesses with multiple locations have larger budgets.
- **Signal:** Business name ends in location (e.g., "Joe's Pizza - Downtown")
- **Signal:** Chain indicators in name
- **Action:** Check if similar business names exist in other ZIPs

---

## 🚫 AVOID These Businesses (Waste of Time)

### **LOW-VALUE INDICATORS**

1. **Non-Profits & Government** - No budget for ads
   - Signal: types include 'local_government_office', 'library', 'post_office'

2. **National Chains** - Corporate marketing departments handle advertising
   - Signal: Recognized brand names (McDonald's, Starbucks, etc.)
   - Action: Create blacklist of major chains

3. **Medical/Professional** - Often restricted in advertising, use referrals
   - Signal: 'doctor', 'dentist', 'lawyer' types
   - Note: SOME dental/law practices do advertise, but lower conversion

4. **Very New (<5 reviews)** - Might not survive, no budget yet
   - Signal: user_ratings_total < 5

5. **Permanently Closed** - Already filtered out
   - Signal: business_status !== 'OPERATIONAL'

---

## 🤖 Scoring Algorithm (Proposed)

### Weighted Score Out of 100

```javascript
function calculateProspectScore(business) {
  let score = 0;

  // BASE SCORE: Business Type (0-30 points)
  const serviceTypes = ['plumber', 'electrician', 'hvac', 'roofing', 'contractor',
                        'landscaping', 'restaurant', 'salon', 'gym', 'auto_repair'];
  const isService = business.types.some(type => serviceTypes.includes(type));
  score += isService ? 30 : 15;

  // REVIEW COUNT: Sweet Spot 20-200 (0-25 points)
  const reviews = business.userRatingsTotal;
  if (reviews >= 20 && reviews <= 200) score += 25;
  else if (reviews >= 10 && reviews < 20) score += 15;
  else if (reviews > 200 && reviews < 500) score += 10;
  else if (reviews >= 500) score += 5; // Too established
  else score += 5; // Too new

  // RATING: 4.0-4.5 Sweet Spot (0-15 points)
  const rating = business.rating;
  if (rating >= 4.0 && rating <= 4.5) score += 15;
  else if (rating > 4.5 && rating < 5.0) score += 10;
  else if (rating >= 3.5 && rating < 4.0) score += 8;
  else score += 5;

  // ONLINE PRESENCE: Has website + social (0-20 points)
  const hasWebsite = business.website ? 10 : 0;
  const hasSocial = (business.facebook || business.instagram) ? 10 : 0;
  score += hasWebsite + hasSocial;

  // GAP OPPORTUNITY: Missing online pieces (0-10 points)
  if (!business.website) score += 5; // Needs traditional marketing more
  if (!business.facebook && !business.instagram) score += 5;

  return Math.min(score, 100); // Cap at 100
}
```

### Score Interpretation
- **80-100**: HOT LEAD - Contact immediately
- **60-79**: WARM LEAD - Good prospect
- **40-59**: COLD LEAD - Follow up later
- **0-39**: SKIP - Not worth pursuing

---

## ✅ What You've Already Accomplished

From your list, here's what's already built:

### ✅ **DONE:**
1. **Pre-selection automation** - Partial (ZIP filtering, category selection)
2. **Competitor research** - Basic (can search by category, see who's in area)
3. **Follow-up automation** - Yes (Tasks tab, due dates, reminders)
4. **Digital mockups** - Yes (Postcard designer with live preview)
5. **ROI calculators** - Not explicitly, but pricing is visible
6. **Remote closing tools** - Basic (can track PAID/RESERVED status)

### ❌ **NOT DONE:**
1. **Pre-selection automation** - Seasonal/scoring not automated
2. **Email templates** - No pre-written sequences
3. **Digital signatures** - No e-signature integration
4. **Payment processing** - No Stripe/PayPal integration

---

## 🚀 Improvements to Implement

### **PRIORITY 1: Prospect Scoring Engine** (Highest Impact)

**Feature:** Automatic "Lead Score" for every prospect

**Implementation:**
```javascript
// Add to searchGooglePlaces() and renderProspectPool()
business.leadScore = calculateProspectScore(business);
business.scoreCategory = getScoreCategory(business.leadScore); // HOT/WARM/COLD
```

**UI Changes:**
- Add "Lead Score" badge to each prospect card (🔥 HOT | ⭐ WARM | ❄️ COLD)
- Sort by score by default (highest first)
- Filter by score category
- Color-code prospects: Red (HOT), Orange (WARM), Blue (COLD)

**Why This Wins:** Users immediately know which businesses to call first. Saves hours of manual research.

---

### **PRIORITY 2: Seasonal Recommendations** (Easy Win)

**Feature:** Auto-suggest best categories for current month

**Implementation:**
```javascript
const seasonalCategories = {
  'January-March': ['Tax Prep', 'HVAC (Heating)', 'Gym', 'Wedding Vendors'],
  'April-June': ['Landscaping', 'Home Improvement', 'Roofing', 'Pool Services'],
  'July-September': ['HVAC (Cooling)', 'Pool Maintenance', 'Back to School'],
  'October-December': ['Restaurants', 'Retail', 'Holiday Services', 'Snow Removal']
};

// Show banner in Prospect Generator
const currentMonth = new Date().getMonth();
const suggestions = seasonalCategories[getCurrentSeason(currentMonth)];
```

**UI Changes:**
- Add "🔥 Hot Categories This Month" section above search
- One-click to search recommended categories
- Explain WHY each category is good now ("Tax season", "Summer heat", etc.)

**Why This Wins:** Users don't have to think. You tell them exactly what to sell right now.

---

### **PRIORITY 3: Competitor Intelligence** (Unique Differentiator)

**Feature:** "Find Underdogs" - Show businesses being outcompeted

**Implementation:**
```javascript
// After searching a category, analyze the results
function findUnderdogs(businesses) {
  // Sort by review count
  const sorted = businesses.sort((a, b) => b.userRatingsTotal - a.userRatingsTotal);

  // Top 3 = "Market Leaders" (most reviews)
  const leaders = sorted.slice(0, 3);

  // Everyone else with decent rating (4.0+) but fewer reviews = "Underdogs"
  const underdogs = sorted.slice(3).filter(b =>
    b.rating >= 4.0 &&
    b.userRatingsTotal < leaders[0].userRatingsTotal * 0.5
  );

  return {
    leaders,
    underdogs,
    message: `${underdogs.length} businesses are being outcompeted by the top 3. They need your help!`
  };
}
```

**UI Changes:**
- Add "🎯 Underdog Analysis" button in Prospect Pool
- Show market leaders with crown icons 👑
- Highlight underdogs with "NEEDS HELP" badge
- Pitch: "These businesses have great ratings but low visibility. Perfect for postcard campaigns!"

**Why This Wins:** Gives users a compelling sales pitch. "You're being outcompeted by Joe's Pizza. Let me help you get more customers."

---

### **PRIORITY 4: Email Templates** (Sales Acceleration)

**Feature:** Pre-written email sequences for cold outreach

**Implementation:**
```javascript
const emailTemplates = {
  initial_contact: {
    subject: "Help {business_name} compete with {competitor_name}",
    body: `Hi {contact_name},

I noticed {business_name} has great reviews ({rating} stars), but you're being outcompeted by {competitor_name} in the {city} area.

I specialize in helping local {category} businesses increase visibility through targeted postcard campaigns.

Would you be open to a quick 10-minute call this week?

Best,
{your_name}`
  },

  follow_up_1: {
    subject: "Quick question about {business_name}'s marketing",
    body: `Hi {contact_name},

Following up on my previous email. I have a specific campaign idea for {business_name} that could bring in 10-15 new customers this month.

Are you available for a brief call Tuesday or Wednesday?

Thanks,
{your_name}`
  }
};
```

**UI Changes:**
- Add "✉️ Email" button next to each prospect
- Modal with template dropdown
- Auto-fill {business_name}, {rating}, {category}, etc.
- One-click copy to clipboard or send via Gmail integration

**Why This Wins:** Most users don't know what to say. Templates eliminate writer's block.

---

### **PRIORITY 5: ROI Calculator** (Closing Tool)

**Feature:** Show prospects how much they'll make vs. DIY cost

**Calculator:**
```
INPUT:
- Postcard campaign cost: $500
- Expected new customers: 10
- Average transaction value: $100
- Customer lifetime value: 3 purchases

CALCULATION:
Revenue from campaign: 10 customers × $100 × 3 purchases = $3,000
ROI: ($3,000 - $500) / $500 = 500% return

vs. DIY Mailer:
- Design time: 5 hours × $50/hr = $250
- Printing: $200
- Mailing: $150
- Total DIY cost: $600 (and you spent 5 hours)

Savings: $100 + 5 hours of your time
```

**UI Changes:**
- Add "💰 ROI Calculator" button in prospect detail view
- Interactive calculator with sliders
- Generate PDF quote to send to prospect
- Show side-by-side comparison (Your Service vs DIY)

**Why This Wins:** Converts objections into sales. "It's too expensive" → "You'll make 5x your money back."

---

### **PRIORITY 6: Digital Signatures & Payment** (Closing Automation)

**Feature:** Send contracts, get signed, get paid - all online

**Implementation:**
- Integrate **DocuSign** or **HelloSign** for e-signatures
- Integrate **Stripe** for payment processing
- Auto-generate contract PDFs from templates

**Workflow:**
1. User creates quote in app
2. Click "Send Contract"
3. Prospect receives email with:
   - PDF contract
   - E-signature link
   - Payment link ($250 deposit)
4. User gets notified when signed
5. Deposit auto-processes
6. Campaign status auto-updates to "PAID"

**Why This Wins:** Closes deals faster. No "mail me a check" delays. No printer needed.

---

## 📈 Feature Priority Matrix

| Feature | Impact | Effort | Priority |
|---------|--------|--------|----------|
| **Prospect Scoring Engine** | 🔥 HIGH | Medium | **DO FIRST** |
| **Seasonal Recommendations** | 🔥 HIGH | Low | **DO SECOND** |
| **Competitor Intelligence** | 🔥 HIGH | Medium | **DO THIRD** |
| **Email Templates** | ⭐ MEDIUM | Low | DO FOURTH |
| **ROI Calculator** | ⭐ MEDIUM | Medium | DO FIFTH |
| **E-Signatures** | ⭐ MEDIUM | High | DO LATER |
| **Payment Processing** | ⭐ MEDIUM | High | DO LATER |

---

## 🎯 Quick Wins (Implement This Week)

### 1. Add Lead Score Calculation (2 hours)
- Add `calculateProspectScore()` function
- Add score to business objects
- Display score badge in Prospect Pool

### 2. Add Seasonal Banner (1 hour)
- Create seasonal category map
- Add banner to Prospect Generator
- One-click category selection

### 3. Add "Sort by Score" Filter (30 min)
- Add dropdown in Prospect Pool
- Sort businesses by leadScore
- Default to highest score first

---

## 💡 The "Aha!" Moment Feature

**The ONE feature that will make users say "This is amazing!"**

### **"Auto-Prospector" Mode** 🤖

**What it does:**
Every Monday morning at 9am, the app automatically:
1. Determines current season/month
2. Suggests 3 hot categories
3. Runs searches across user's ZIP codes
4. Scores all prospects
5. Emails user: "Here are your 25 hottest leads this week"
6. Pre-populates Prospect Pool with top prospects
7. User just has to start calling (no setup)

**Why it's genius:**
- Removes ALL friction
- User wakes up to warm leads
- No decision fatigue
- Becomes indispensable (they can't live without it)

**Implementation:**
- Cron job on Vercel
- User sets their ZIP codes once
- "Auto-Prospector" toggle in settings
- Weekly email with lead summary

---

## 🚀 Bottom Line

**Your app already has the foundation.** Now add intelligence on top:

1. **Tell users WHO to call** (scoring)
2. **Tell users WHEN to sell** (seasonal)
3. **Tell users WHAT to say** (templates)
4. **Tell users WHY prospects need it** (competitor analysis)

Transform from "lead scraper" to **"sales intelligence platform."**

That's how you charge $99/month instead of $19/month.
