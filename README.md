# 9x12 PRO - Postcard Advertising Management SaaS

Complete solution for managing postcard advertising campaigns with CRM, financials, and lead generation.

## Features
- 📮 **Postcard Campaign Management** - Visual 9x12 postcard layout with 18 ad spots
- 💼 **CRM** - Client database with linked spots and revenue tracking
- 📊 **Financial Dashboard** - Real-time revenue, expenses, and profit tracking
- 🎯 **Lead Generation** - Google Places API integration for prospect discovery
- ✅ **Task Management** - Built-in todo and kanban boards
- ☁️ **Cloud Sync** - Supabase backend with real-time updates

## Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   - Copy `.env.example` to `.env.local`
   - Add your Supabase credentials

3. **Run locally:**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000

## Deploy to Vercel

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Deploy:**
   ```bash
   npm run deploy
   ```

3. **Connect custom domain:**
   - Go to Vercel dashboard
   - Settings → Domains → Add 9x12pro.com

## Tech Stack
- **Frontend:** Vanilla JavaScript, Tailwind CSS
- **Backend:** Supabase (PostgreSQL)
- **Hosting:** Vercel
- **APIs:** Google Maps Places API

## License
Proprietary - 9x12 PRO
