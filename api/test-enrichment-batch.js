/**
 * Batch Enrichment Test v2
 * Finds businesses without emails and tests Scrapingdog on them
 * Supports offset parameter for running multiple bursts
 */

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const limit = parseInt(req.query.limit || req.body?.limit || '100');
  const offset = parseInt(req.query.offset || req.body?.offset || '0');
  const dryRun = req.query.dryRun === 'true' || req.body?.dryRun === true;

  // Use env vars with fallback to hardcoded values for testing
  const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kurhsdvxsgkgnfimfqdo.supabase.co').trim().replace(/\s+/g, '');
  const SUPABASE_KEY = (process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1cmhzZHZ4c2drZ25maW1mcWRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MDk3NDYsImV4cCI6MjA3ODM4NTc0Nn0.nB_GsE89WJ3eAQrgmNKb-fbCktHTHf-987D-G6lscZA').trim().replace(/\s+/g, '');

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  try {
    // Fetch all app_data records
    const { data: appData, error: fetchError } = await supabase
      .from('app_data')
      .select('*');

    if (fetchError) {
      throw new Error(`Failed to fetch data: ${fetchError.message}`);
    }

    // Extract businesses without emails from all users' data
    const businessesWithoutEmail = [];
    const allBusinesses = [];

    for (const record of appData || []) {
      // Only process placesCache data type
      if (record.data_type !== 'placesCache') continue;

      const cacheData = record.data || {};

      // Each key is like "14072-bar" containing { cachedData: [...businesses...], cachedUntil, lastFetched }
      for (const [zipCategory, cacheEntry] of Object.entries(cacheData)) {
        // businesses are in cachedData array
        const bizArray = cacheEntry?.cachedData || [];
        if (!Array.isArray(bizArray)) continue;

        for (const business of bizArray) {
          if (!business || typeof business !== 'object') continue;

          allBusinesses.push(business);

          // Check if business lacks email (or hasn't been enriched yet)
          if (!business.email && !business.enriched) {
            businessesWithoutEmail.push({
              zipCategory,
              name: business.name || 'Unknown',
              address: business.address || business.vicinity || '',
              city: business.city || '',
              state: business.state || '',
              category: business.category || zipCategory.split('-')[1] || '',
              userEmail: record.user_email
            });
          }
        }
      }
    }

    console.log(`Found ${businessesWithoutEmail.length} businesses without email`);

    // Take requested limit with offset for running in batches
    console.log(`📊 Batch params: offset=${offset}, limit=${limit}, total=${businessesWithoutEmail.length}`);
    const testBatch = businessesWithoutEmail.slice(offset, offset + limit);
    console.log(`📊 Test batch: ${testBatch.length} businesses starting with "${testBatch[0]?.name || 'none'}"`);

    if (dryRun) {
      const withEmailCount = allBusinesses.filter(b => b.email).length;

      return res.status(200).json({
        dryRun: true,
        totalRecords: appData?.length || 0,
        totalBusinesses: allBusinesses.length,
        withEmail: withEmailCount,
        withoutEmail: businessesWithoutEmail.length,
        testBatchSize: testBatch.length,
        sampleBusinesses: testBatch.slice(0, 10).map(b => ({
          name: b.name,
          city: b.city,
          category: b.category
        }))
      });
    }

    // Run Scrapingdog on each business in bursts to avoid rate limiting
    const results = [];
    let found = 0;
    let notFound = 0;
    let errors = 0;
    const startTime = Date.now();

    // Burst configuration - optimized for Vercel timeout limits
    const BURST_SIZE = parseInt(req.query.burstSize || req.body?.burstSize || '25');
    const BURST_DELAY = parseInt(req.query.burstDelay || req.body?.burstDelay || '1000');  // 1s between requests
    const BURST_PAUSE = parseInt(req.query.burstPause || req.body?.burstPause || '5000');  // 5s pause between bursts

    for (let i = 0; i < testBatch.length; i++) {
      const business = testBatch[i];
      const query = `${business.name} ${business.city || ''} ${business.state || ''} official website`.trim();
      const burstNum = Math.floor(i / BURST_SIZE) + 1;
      const posInBurst = (i % BURST_SIZE) + 1;

      console.log(`[Burst ${burstNum}, ${posInBurst}/${BURST_SIZE}] Testing: ${business.name}`);

      try {
        const response = await fetch(`https://${req.headers.host}/api/scrapingdog-search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            businessName: business.name
          })
        });

        const data = await response.json();

        const result = {
          name: business.name,
          city: business.city,
          query,
          website: data.website || null,
          responseTime: data.responseTime || 0,
          error: data.error || null
        };

        if (data.website) {
          found++;
        } else if (data.error) {
          errors++;
        } else {
          notFound++;
        }

        results.push(result);

        // Check if we need to pause between bursts or just delay within burst
        if (i < testBatch.length - 1) {
          if ((i + 1) % BURST_SIZE === 0) {
            // End of burst - long pause to reset rate limit
            console.log(`⏸️ Burst ${burstNum} complete. Pausing ${BURST_PAUSE/1000}s to reset rate limit...`);
            await new Promise(r => setTimeout(r, BURST_PAUSE));
          } else {
            // Within burst - short delay
            await new Promise(r => setTimeout(r, BURST_DELAY));
          }
        }
      } catch (e) {
        errors++;
        results.push({
          name: business.name,
          city: business.city,
          query,
          website: null,
          error: e.message
        });
      }
    }

    const totalTime = Date.now() - startTime;
    const avgTime = Math.round(totalTime / testBatch.length);

    return res.status(200).json({
      summary: {
        tested: testBatch.length,
        offset,
        found,
        notFound,
        errors,
        successRate: `${Math.round((found / testBatch.length) * 100)}%`,
        totalTimeMs: totalTime,
        avgTimePerSearch: avgTime
      },
      results
    });

  } catch (error) {
    console.error('Batch test error:', error);
    return res.status(500).json({ error: error.message });
  }
}
