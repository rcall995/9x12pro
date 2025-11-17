# 🚀 Migration Checklist

Use this checklist to deploy the security improvements safely.

---

## ✅ Pre-Deployment Checklist

### 1. Local Testing

- [ ] Open `app.html` in browser (via `npm run dev`)
- [ ] Check browser console - should see:
  ```
  ✅ App configuration loaded - Version: v23
  ✅ Global error handler initialized
  ✅ Utility functions loaded
  ```
- [ ] Verify no JavaScript errors
- [ ] Test login/logout
- [ ] Test one feature (e.g., prospect search)

### 2. Prepare API Keys

- [ ] **Google Maps API:**
  - [ ] Go to https://console.cloud.google.com/apis/credentials
  - [ ] Create new API key (or use existing if already restricted)
  - [ ] Restrict to your domain(s)
  - [ ] Enable only: Maps JavaScript API, Places API
  - [ ] Copy the new key

- [ ] **Supabase:**
  - [ ] Go to https://app.supabase.com/project/kurhsdvxsgkgnfimfqdo/settings/api
  - [ ] Copy your Project URL
  - [ ] Copy your anon/public key
  - [ ] Verify Row Level Security is enabled on all tables

### 3. Set Up Vercel Environment Variables

- [ ] Go to https://vercel.com (or your deployment platform)
- [ ] Navigate to your project settings → Environment Variables
- [ ] Add these variables:

  | Variable Name | Value | Environments |
  |---------------|-------|--------------|
  | `GOOGLE_MAPS_API_KEY` | Your new Google Maps key | Production, Preview, Development |
  | `SUPABASE_URL` | Your Supabase URL | Production, Preview, Development |
  | `SUPABASE_ANON_KEY` | Your Supabase anon key | Production, Preview, Development |
  | `ENVIRONMENT` | `production` | Production |
  | `DEBUG` | `false` | Production |

- [ ] Click Save for each variable

### 4. Create Local .env File (for development)

```bash
# Copy the example
cp .env.example .env

# Edit .env with your values
# DO NOT commit this file to git!
```

Add to `.env`:
```env
GOOGLE_MAPS_API_KEY=your-new-google-maps-key-here
SUPABASE_URL=https://kurhsdvxsgkgnfimfqdo.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key-here
ENVIRONMENT=development
DEBUG=true
```

---

## 🚀 Deployment Steps

### Step 1: Commit Changes

```bash
git status
# Review what changed

git add .

git commit -m "feat: add security improvements and environment config

- Add centralized config.js for environment variables
- Add global error handler
- Add utility functions for validation and sanitization
- Improve service worker caching strategy
- Add security headers to vercel.json
- Fix duplicate favicons
- Update dependencies
- Add documentation for security setup"

# Note: Don't push yet if you want to test on preview first
```

### Step 2: Deploy to Preview (Test First)

```bash
# Deploy to preview environment
vercel

# This will give you a preview URL like:
# https://9x12pro-abc123.vercel.app
```

**Test the preview deployment:**
- [ ] Open preview URL
- [ ] Check browser console for errors
- [ ] Verify config loads: type `window.APP_CONFIG` in console
- [ ] Test login
- [ ] Test Google Maps search
- [ ] Test saving data

### Step 3: Deploy to Production

If preview works:

```bash
# Deploy to production
npm run deploy
# OR
vercel --prod
```

If preview has issues:
- Check that environment variables are set in Vercel
- Check browser console for specific errors
- Fix issues and re-deploy preview

### Step 4: Delete Old Google Maps API Key

**⚠️ ONLY do this AFTER production is working!**

- [ ] Go to https://console.cloud.google.com/apis/credentials
- [ ] Find old key: `AIzaSyCNzXL-8UT-JI1Dy9wBN14KtH-UDMbeOlo`
- [ ] Click trash icon to delete
- [ ] Confirm deletion

---

## ✅ Post-Deployment Verification

### 1. Check Production Site

- [ ] Open your production URL
- [ ] Open browser DevTools (F12)
- [ ] Check Console tab - should see:
  ```
  ✅ App configuration loaded - Version: v23
  ✅ Global error handler initialized
  ✅ Utility functions loaded
  🔧 HEAD: Initializing Supabase client...
  ✅ HEAD: window.supabaseClient created after X attempts
  ```

- [ ] Verify `window.APP_CONFIG` exists:
  ```javascript
  // Type in console:
  window.APP_CONFIG
  // Should show configuration object with your keys
  ```

### 2. Test Core Functionality

- [ ] **Authentication:**
  - [ ] Login works
  - [ ] Logout works
  - [ ] Redirect to login when not authenticated

- [ ] **Google Maps:**
  - [ ] Search by ZIP code works
  - [ ] Business results appear
  - [ ] No API errors in console

- [ ] **Supabase:**
  - [ ] Data loads from database
  - [ ] Data saves to database
  - [ ] Cloud sync works

- [ ] **Postcard Manager:**
  - [ ] Postcards load
  - [ ] Can edit spots
  - [ ] Changes save

- [ ] **Client Database:**
  - [ ] Clients load
  - [ ] Can add/edit clients
  - [ ] CSV import/export works

- [ ] **Kanban Board:**
  - [ ] Prospects appear
  - [ ] Drag and drop works
  - [ ] Changes persist

### 3. Monitor for Issues

**First 24 hours after deployment:**

- [ ] Check Google Maps API usage
  - https://console.cloud.google.com/google/maps-apis/metrics
  - Should be normal usage, not spikes

- [ ] Check Supabase usage
  - https://app.supabase.com/project/kurhsdvxsgkgnfimfqdo/settings/billing
  - Should be normal

- [ ] Check for errors
  - Browser console on your site
  - Network tab for failed requests

---

## 🆘 Troubleshooting

### Issue: "APP_CONFIG is not defined"

**Solution:**
- Verify `config.js` is being loaded
- Check that script loads BEFORE other scripts in HTML
- Check browser Network tab - is config.js loaded successfully?

### Issue: "Google Maps not loading"

**Solution:**
- Check that `GOOGLE_MAPS_API_KEY` is set in Vercel
- Check that key is not restricted to wrong domain
- Check browser console for specific error message

### Issue: "Supabase auth failing"

**Solution:**
- Check that `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set in Vercel
- Verify credentials are correct in Supabase dashboard
- Check that Row Level Security policies allow access

### Issue: "Site still using old API keys"

**Solution:**
- Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)
- Clear browser cache
- Check Network tab - is config.js cached?
- Increment service worker `CACHE_VERSION` in service-worker.js

---

## 📊 Success Criteria

You'll know the deployment was successful when:

✅ Site loads without errors
✅ Console shows all utilities loaded
✅ Login/logout works
✅ Google Maps search works
✅ Data saves to Supabase
✅ No API key errors
✅ Old API key can be deleted without breaking site

---

## 🔄 Rollback Plan

If something goes wrong:

1. **Quick fix:** Re-add old API keys to Vercel env vars temporarily
2. **Full rollback:**
   ```bash
   git revert HEAD
   npm run deploy
   ```
3. **Investigate:** Check what failed and fix before re-deploying

---

**Estimated Time:** 30-45 minutes
**Risk Level:** Low (if following checklist)
**Backup:** Git allows easy rollback if needed
