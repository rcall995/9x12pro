# Outscraper Integration Setup Guide

This guide will help you set up Outscraper API to automatically enrich your business leads with contact information (phone numbers, emails, Facebook pages, Instagram profiles).

## What You'll Get

With Outscraper integrated, when you add businesses to your pipeline, you'll automatically get:
- ✅ **Phone numbers**
- ✅ **Email addresses**
- ✅ **Facebook pages**
- ✅ **Instagram profiles**
- ✅ **Accurate ratings & reviews**
- ✅ **Website URLs**

## Cost

Outscraper charges approximately **$0.01-0.02 per business** enriched. For example:
- 100 businesses = ~$1-2
- 500 businesses = ~$5-10
- 1,000 businesses = ~$10-20

They offer a **free tier** with 100 free enrichments to test it out!

---

## Step 1: Create an Outscraper Account

1. Go to [https://outscraper.com](https://outscraper.com)
2. Click "Sign Up" and create a free account
3. Verify your email address

---

## Step 2: Get Your API Key

1. Log in to your Outscraper account
2. Go to [API Keys page](https://app.outscraper.com/api-keys)
3. Click "Create API Key" or copy your existing key
4. **Save this key** - you'll need it in the next step

---

## Step 3: Add API Key to Vercel (Production)

### Option A: Using Vercel Dashboard (Recommended)

1. Go to [https://vercel.com](https://vercel.com)
2. Log in and select your `9x12pro` project
3. Go to **Settings** → **Environment Variables**
4. Click "Add New"
5. Add the following:
   - **Name:** `OUTSCRAPER_API_KEY`
   - **Value:** Your API key from Step 2
   - **Environments:** Check all (Production, Preview, Development)
6. Click "Save"
7. **Important:** Redeploy your app for changes to take effect:
   - Go to **Deployments** tab
   - Click the three dots (⋮) on the latest deployment
   - Click "Redeploy"

### Option B: Using Vercel CLI

```bash
cd C:\Users\rich\9x12Pro
vercel env add OUTSCRAPER_API_KEY
# Paste your API key when prompted
# Select all environments (Production, Preview, Development)
```

---

## Step 4: Test It Out

1. Open your app at [https://9x12pro.com](https://9x12pro.com)
2. Go to **Lead Generation** tab
3. Search for businesses (e.g., "Restaurants" in ZIP code 14072)
4. Add some businesses to the **Prospect Pool**
5. Select a few prospects and click "Add Selected to Pipeline"
6. Check the **Pipeline** tab - your prospects should now have:
   - Phone numbers (📞)
   - Websites (🌐)
   - Emails (✉️)
   - Facebook (📘)
   - Instagram (📷)

---

## Monitoring Usage & Costs

### Check Your Outscraper Usage

1. Log in to [Outscraper Dashboard](https://app.outscraper.com)
2. Go to **Usage** tab
3. View your current month's API calls and costs

### Cost Management Tips

- **Start with the free tier** (100 free enrichments)
- **Test with 10-20 businesses first** to verify it's working
- **Only enrich businesses you're serious about** - you can use the Prospect Pool to pre-filter
- The enrichment happens when you click "Add Selected to Pipeline", not during searches

---

## How It Works

### The Flow:

1. **Search** → Google Places API finds businesses (free - uses your quota)
2. **Prospect Pool** → Businesses are cached and displayed
3. **Add to Pipeline** → Outscraper enriches with contact info (costs ~$0.01 per business)
4. **Pipeline/Kanban** → Enriched prospects ready to contact

### Where Enrichment Happens:

- ✅ When adding from **Prospect Pool** to **Pipeline**
- ✅ When using **Bulk Auto-Populate** in Lead Generation
- ❌ NOT during initial searches (no cost until you add to pipeline)

---

## Troubleshooting

### "No enrichment data found"

- This is normal - not all businesses have email/social media data
- Phone numbers and websites are most reliable
- Emails and social media are less common

### "Outscraper API key not configured"

- Make sure you added the environment variable in Vercel
- Redeploy your app after adding the variable
- Check that the variable name is exactly: `OUTSCRAPER_API_KEY`

### "API error: 402"

- You've exceeded your free tier
- Add credits to your Outscraper account at [Billing](https://app.outscraper.com/billing)

### "API error: 429"

- Rate limit exceeded (too many requests too fast)
- Wait a few minutes and try again
- The app already has delays built in to avoid this

---

## Need Help?

- **Outscraper Documentation:** [https://docs.outscraper.com](https://docs.outscraper.com)
- **Outscraper Support:** support@outscraper.com
- **Check Console Logs:** Press F12 in browser → Console tab to see enrichment status

---

## Summary Checklist

- [ ] Created Outscraper account
- [ ] Got API key from Outscraper dashboard
- [ ] Added `OUTSCRAPER_API_KEY` to Vercel environment variables
- [ ] Redeployed app on Vercel
- [ ] Tested by adding businesses to pipeline
- [ ] Verified contact info appears on kanban cards

Once complete, your leads will automatically be enriched with contact information! 🎉
