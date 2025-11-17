# Quick Vercel Environment Variables Setup

## Step-by-Step Guide

### What You've Already Done ✅
- [x] Created new Google Maps API key
- [x] Added `GOOGLE_MAPS_API_KEY` to Vercel

### What We Need to Do Now

---

## Step 1: Add Supabase Environment Variables

Go to: https://vercel.com/richs-projects-6e159a3a/9x12pro/settings/environment-variables

### Add Variable #1: SUPABASE_URL

1. Click "Add New" button
2. Fill in:
   - **Key:** `SUPABASE_URL`
   - **Value:** `https://kurhsdvxsgkgnfimfqdo.supabase.co`
   - **Environments:** Check all 3 boxes (Production, Preview, Development)
3. Click "Save"

### Add Variable #2: SUPABASE_ANON_KEY

1. Click "Add New" button again
2. Fill in:
   - **Key:** `SUPABASE_ANON_KEY`
   - **Value:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1cmhzZHZ4c2drZ25maW1mcWRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MDk3NDYsImV4cCI6MjA3ODM4NTc0Nn0.nB_GsE89WJ3eAQrgmNKb-fbCktHTHf-987D-G6lscZA`
   - **Environments:** Check all 3 boxes (Production, Preview, Development)
3. Click "Save"

---

## Step 2: Verify All Variables Are Set

You should now see 3 environment variables in Vercel:

- ✅ `GOOGLE_MAPS_API_KEY` (your new key)
- ✅ `SUPABASE_URL`
- ✅ `SUPABASE_ANON_KEY`

---

## Step 3: Redeploy to Apply Environment Variables

Environment variables only take effect after a new deployment.

**You can either:**

**Option A: Redeploy via CLI (I can do this for you)**
```bash
vercel --prod
```

**Option B: Redeploy via Dashboard**
1. Go to: https://vercel.com/richs-projects-6e159a3a/9x12pro
2. Click "Deployments" tab
3. Click the "..." menu on latest deployment
4. Click "Redeploy"
5. Confirm

---

## Step 4: Test Your Site

After redeployment completes (~30 seconds):

1. **Visit:** https://9x12pro.com
2. **Hard refresh:** Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
3. **Open DevTools:** F12 → Console tab
4. **Type:** `window.APP_CONFIG`
5. **Check:** Should see your configuration with keys loaded

**Test these features:**
- [ ] Login works
- [ ] Google Maps search works
- [ ] Data loads from Supabase
- [ ] No errors in console

---

## Step 5: Delete Old Google Maps API Key

**⚠️ ONLY DO THIS AFTER YOUR SITE IS WORKING WITH THE NEW KEY**

1. Go to: https://console.cloud.google.com/apis/credentials
2. Find the OLD key: `AIzaSyCNzXL-8UT-JI1Dy9wBN14KtH-UDMbeOlo`
3. Click the trash icon
4. Confirm deletion

---

## Done! 🎉

Your API keys are now secured via environment variables!
