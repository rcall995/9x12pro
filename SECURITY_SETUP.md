# Security Setup Guide for 9x12 Pro

## ⚠️ CRITICAL: API Keys Exposed

Your API keys are currently exposed in the codebase. Follow these steps **immediately** to secure your application.

---

## Step 1: Rotate Google Maps API Key

1. **Go to Google Cloud Console:**
   - Visit: https://console.cloud.google.com/apis/credentials

2. **Delete the old key:**
   - Find key: `AIzaSyCNzXL-8UT-JI1Dy9wBN14KtH-UDMbeOlo`
   - Click the trash icon to delete it

3. **Create a new key:**
   - Click "Create Credentials" → "API Key"
   - Click "Restrict Key" immediately

4. **Restrict the new key:**
   - **Application restrictions:**
     - Select "HTTP referrers (websites)"
     - Add your domain: `*.9x12pro.com/*` (or your actual domain)
     - Add localhost for dev: `http://localhost:*/*`

   - **API restrictions:**
     - Select "Restrict key"
     - Enable only: "Maps JavaScript API" and "Places API"

5. **Save the new key** (you'll use it in Step 3)

---

## Step 2: Check Supabase Security

1. **Go to Supabase Dashboard:**
   - Visit: https://app.supabase.com/project/kurhsdvxsgkgnfimfqdo/settings/api

2. **Verify your anon key** (public key is OK to expose, but check your Row Level Security)

3. **Enable Row Level Security (RLS) on all tables:**
   ```sql
   -- Run in SQL Editor for each table
   ALTER TABLE user_approvals ENABLE ROW LEVEL SECURITY;
   ALTER TABLE cloud_data ENABLE ROW LEVEL SECURITY;

   -- Add policies to protect data
   CREATE POLICY "Users can only see their own data"
   ON cloud_data FOR SELECT
   USING (auth.uid() = user_id);
   ```

4. **Never expose your SERVICE_ROLE_KEY** (only use ANON_KEY in frontend)

---

## Step 3: Set Up Environment Variables in Vercel

1. **Go to Vercel Dashboard:**
   - Visit: https://vercel.com/your-username/9x12pro/settings/environment-variables

2. **Add these environment variables:**

   ```
   Variable Name: GOOGLE_MAPS_API_KEY
   Value: [your new Google Maps API key from Step 1]
   Environments: Production, Preview, Development
   ```

   ```
   Variable Name: SUPABASE_URL
   Value: https://kurhsdvxsgkgnfimfqdo.supabase.co
   Environments: Production, Preview, Development
   ```

   ```
   Variable Name: SUPABASE_ANON_KEY
   Value: [your Supabase anon key]
   Environments: Production, Preview, Development
   ```

3. **Click "Save" for each**

---

## Step 4: Create Local .env File

1. **Copy the example file:**
   ```bash
   cp .env.example .env
   ```

2. **Edit .env file** and add your keys:
   ```env
   SUPABASE_URL=https://kurhsdvxsgkgnfimfqdo.supabase.co
   SUPABASE_ANON_KEY=your-supabase-anon-key
   GOOGLE_MAPS_API_KEY=your-new-google-maps-key
   ENVIRONMENT=development
   DEBUG=true
   ```

3. **Verify .env is in .gitignore** (it already is, but double-check)

---

## Step 5: Update Your Code to Use Environment Variables

The code has been updated to use `config.js` which loads from `window.ENV_*` variables.

For **local development**, you'll need to inject environment variables. Add this script to load them:

Create `load-env.html` (include before config.js):
```html
<script>
  // In production, Vercel will inject these
  // For local dev, we load from .env (you'll need a build step or manual set)
  window.ENV_GOOGLE_MAPS_API_KEY = 'YOUR_LOCAL_DEV_KEY';
  window.ENV_SUPABASE_URL = 'https://kurhsdvxsgkgnfimfqdo.supabase.co';
  window.ENV_SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
</script>
```

**OR** for production deployment, Vercel will automatically inject environment variables.

---

## Step 6: Deploy Updated Code

1. **Commit your changes:**
   ```bash
   git add .
   git commit -m "Add security improvements and environment config"
   ```

2. **Deploy to Vercel:**
   ```bash
   npm run deploy
   ```

3. **Verify environment variables are loaded:**
   - Open your deployed site
   - Open browser console
   - Type: `window.APP_CONFIG`
   - You should see your configuration (keys will be present but from env vars)

---

## Step 7: Clean Git History (Optional but Recommended)

Your API keys are in git history. To remove them:

1. **Install BFG Repo-Cleaner:**
   ```bash
   # Download from: https://rdrr.io/cran/bfg/
   ```

2. **Remove sensitive data:**
   ```bash
   java -jar bfg.jar --replace-text passwords.txt
   ```

3. **Create `passwords.txt`:**
   ```
   AIzaSyCNzXL-8UT-JI1Dy9wBN14KtH-UDMbeOlo
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1cmhzZHZ4c2drZ25maW1mcWRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MDk3NDYsImV4cCI6MjA3ODM4NTc0Nn0.nB_GsE89WJ3eAQrgmNKb-fbCktHTHf-987D-G6lscZA
   ```

4. **Force push (⚠️ WARNING: This rewrites history):**
   ```bash
   git push --force
   ```

---

## Step 8: Monitor for Unauthorized Usage

1. **Google Maps:**
   - Check usage: https://console.cloud.google.com/google/maps-apis/metrics
   - Set up billing alerts
   - Monitor for unusual spikes

2. **Supabase:**
   - Check usage: https://app.supabase.com/project/kurhsdvxsgkgnfimfqdo/settings/billing
   - Monitor auth logs
   - Review database activity

---

## Ongoing Security Best Practices

1. **Never commit API keys** - Always use environment variables
2. **Rotate keys** every 90 days
3. **Use key restrictions** (domain, API, IP)
4. **Enable RLS** on all Supabase tables
5. **Monitor usage** regularly
6. **Keep dependencies updated** (`npm audit` and `npm update`)
7. **Use HTTPS only** (Vercel handles this automatically)

---

## Questions?

If you need help with any step, refer to:
- Google Maps API: https://developers.google.com/maps/documentation
- Supabase: https://supabase.com/docs
- Vercel: https://vercel.com/docs/environment-variables
