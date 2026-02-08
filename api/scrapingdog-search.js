/**
 * Scrapingdog Search via DuckDuckGo GWS
 * Uses General Web Scraping at 1 credit per search (vs 5 for Google SERP)
 * 1,000 free credits = 1,000 searches!
 * https://www.scrapingdog.com
 */

import { checkRateLimit } from './lib/rate-limit.js';
import { checkApiQuota, recordApiCall } from './lib/api-usage.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limit: 30 requests per minute
  const rateLimited = checkRateLimit(req, res, { limit: 30, window: 60, keyPrefix: 'scrapingdog' });
  if (rateLimited) {
    return res.status(rateLimited.status).json(rateLimited.body);
  }

  const { query, businessName, zipCode, city, state } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Query required' });
  }

  const SCRAPINGDOG_API_KEY = process.env.SCRAPINGDOG_API_KEY;

  if (!SCRAPINGDOG_API_KEY) {
    console.log('⚠️ Scrapingdog API key not configured');
    return res.status(200).json({
      success: false,
      source: 'scrapingdog',
      error: 'not_configured',
      website: null
    });
  }

  // Check monthly quota before making API call
  const quota = await checkApiQuota('scrapingdog');
  if (!quota.allowed) {
    console.log(`🐕 Scrapingdog quota exceeded: ${quota.used}/${quota.limit} used`);
    return res.status(200).json({
      success: false,
      source: 'scrapingdog',
      error: 'quota_exceeded',
      used: quota.used,
      limit: quota.limit,
      website: null
    });
  }

  try {
    const startTime = Date.now();
    console.log(`🐕 Scrapingdog/DuckDuckGo search: "${query}"`);

    // Use DuckDuckGo HTML version via GWS - costs only 1 credit!
    const duckduckgoUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const apiUrl = `https://api.scrapingdog.com/scrape?api_key=${SCRAPINGDOG_API_KEY}&url=${encodeURIComponent(duckduckgoUrl)}&dynamic=false`;

    const response = await fetch(apiUrl);
    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Scrapingdog API error:', response.status, errorText);
      throw new Error(`Scrapingdog returned ${response.status}`);
    }

    const html = await response.text();

    // Record successful API call
    await recordApiCall('scrapingdog');

    // Parse URLs from DuckDuckGo HTML
    // Format: <a rel="nofollow" class="result__a" href="URL">
    let allUrls = [];

    const ddgMatches = html.match(/class="result__a"[^>]*href="([^"]+)"/g) || [];
    for (const match of ddgMatches) {
      const urlMatch = match.match(/href="([^"]+)"/);
      if (urlMatch && urlMatch[1]) {
        let url = urlMatch[1];
        // DuckDuckGo sometimes wraps URLs in redirect
        if (url.includes('uddg=')) {
          const uddg = url.match(/uddg=([^&]+)/);
          if (uddg) url = decodeURIComponent(uddg[1]);
        }
        if (url.startsWith('http')) {
          allUrls.push(url);
        }
      }
    }

    // Also check for direct href links as fallback
    const directLinks = html.match(/href="(https?:\/\/[^"]+)"/g) || [];
    for (const match of directLinks) {
      const url = match.replace('href="', '').replace('"', '');
      if (!url.includes('duckduckgo.com') && url.startsWith('http')) {
        allUrls.push(url);
      }
    }

    allUrls = [...new Set(allUrls)];

    if (allUrls.length === 0) {
      console.log(`🐕 No URLs found in DuckDuckGo results`);
      return res.status(200).json({
        success: true,
        source: 'scrapingdog-ddg',
        query,
        website: null,
        responseTime,
        htmlLength: html.length
      });
    }

    // Skip patterns - comprehensive junk filtering
    const skipDomains = [
      // Directories and review sites
      'yelp.com', 'yellowpages.com', 'bbb.org', 'tripadvisor.',
      'foursquare.com', 'mapquest.com', 'manta.com', 'chamberofcommerce.com',
      'bizapedia.com', 'dnb.com', 'zoominfo.com', 'angi.com', 'thumbtack.com',
      'nextdoor.com', 'hotfrog.com', 'cylex.us', 'superpages.com',
      'porch.com', 'homeadvisor.com', 'expertise.com', 'alignable.com',
      'citysearch.com', 'judysbook.com', 'brownbook.net', 'buzzfile.com',
      'spoke.com', 'merchantcircle.com', 'local.com', 'kudzu.com',
      'dexknows.com', 'showmelocal.com', 'dandb.com', 'salespider.com',
      'buildzoom.com', 'mystore411.com', 'hoursguide.com', 'opengovny.com',

      // Menu aggregators
      'menuweb.menu', 'zmenu.com', 'menupix.com', 'allmenus.com',
      'restaurantji.com', 'sirved.com', 'menuism.com', 'zomato.com',
      'restaurantguru.com', 'openmenu.com', 'menufy.com', 'beyondmenu.com',

      // Food delivery
      'grubhub.com', 'doordash.com', 'ubereats.com', 'seamless.com',
      'postmates.com', 'slice.com', 'toasttab.com', 'chownow.com',

      // Booking platforms (NOT business websites - these host OTHER businesses!)
      'glossgenius.com', 'vagaro.com', 'styleseat.com', 'booksy.com',
      'fresha.com', 'schedulicity.com', 'squareup.com/appointments',
      'square.site', 'acuityscheduling.com', 'calendly.com', 'mindbodyonline.com',
      'gettimely.com', 'zenoti.com', 'booker.com', 'salonbiz.com',

      // Vacation rentals / real estate
      'vrbo.com', 'airbnb.com', 'booking.com', 'hotels.com', 'expedia.com',
      'zillow.com', 'realtor.com', 'redfin.com', 'trulia.com',

      // Social media
      'facebook.com', 'instagram.com', 'twitter.com', 'tiktok.com',
      'youtube.com', 'pinterest.com', 'reddit.com', 'linkedin.com',

      // News sites and media outlets
      'patch.com', 'thrillist.com', 'eater.com', 'timeout.com',
      'newspapers.com', 'buffalorising.com', 'stepoutbuffalo.com',
      'usnews.com', 'money.usnews.com', 'forbes.com', 'bloomberg.com',
      'cnbc.com', 'cnn.com', 'wsj.com', 'nytimes.com', 'washingtonpost.com',
      'businessinsider.com', 'investopedia.com', 'marketwatch.com',
      'yahoo.com', 'msn.com', 'aol.com', 'huffpost.com', 'buzzfeed.com',
      'newsweek.com', 'usatoday.com', 'reuters.com', 'apnews.com',

      // Financial advisor/professional directories
      'brokercheck.finra.org', 'wealthminder.com', 'advisorhub.com',
      'smartasset.com', 'nerdwallet.com', 'bankrate.com', 'thebalance.com',
      'wiseradvisor.com', 'brightscope.com', 'adviserinfo.sec.gov',
      'paladin-investorregistry.com', 'letsmakeaplan.org', 'napfa.org',
      'indyfin.com', 'advisorinfo.com', 'advisorfinder.com',

      // Insurance/agent directories (NOT actual business sites)
      'agents.mutualofomaha.com', 'agent.amfam.com', 'agents.allstate.com',
      'agent.statefarm.com', 'localagent.com', 'insuranceagentlocator.com',
      'agentpronto.com', 'trustedchoice.com', 'agents.farmers.com',

      // Insurance corporate sites (not individual agent sites)
      'mutualofomaha.com', 'statefarm.com', 'allstate.com', 'farmers.com',
      'amfam.com', 'nationwide.com', 'libertymutual.com', 'progressive.com',
      'geico.com', 'usaa.com', 'travelers.com', 'thehartford.com',
      'metlife.com', 'prudential.com', 'newyorklife.com', 'massmutual.com',
      'northwesternmutual.com', 'principal.com', 'lincolnfinancial.com',
      'transamerica.com', 'aig.com', 'aflac.com', 'cigna.com', 'aetna.com',
      'humana.com', 'anthem.com', 'bluecrossblue', 'uhc.com', 'unitedhealth',

      // Legal directories
      'avvo.com', 'lawyers.com', 'findlaw.com', 'martindale.com',
      'justia.com', 'superlawyers.com', 'lawinfo.com', 'nolo.com',

      // Healthcare directories
      'healthgrades.com', 'vitals.com', 'zocdoc.com', 'webmd.com',
      'findatopdoc.com', 'ratemds.com', 'wellness.com', 'doctoroogle.com',
      'sharecare.com', 'castleconnolly.com', 'ucomparehealth.com',

      // Accounting directories
      'cpaverify.org', 'cpafinder.com', 'accountant-finder.com',

      // Generic platforms
      'wikipedia.org', 'medium.com', 'eventbrite.com', 'meetup.com',
      'crunchbase.com', 'glassdoor.com', 'indeed.com', 'careerbuilder.com',
      'groupon.com', 'livingsocial.com', 'retailmenot.com', 'coupons.com',
      'comparably.com', 'citysquares.com', 'chamberorganizer.com',

      // Government and education
      '.gov', '.edu',

      // Spam/redirect sites
      'dot-reviews.org', 'rateclubs.com',
      'giftly.com', 'carfax.com', 'autotrader.com', 'cars.com', 'cargurus.com',

      // Search engines
      'google.com', 'bing.com', 'duckduckgo.com'
    ];

    const skipExtensions = ['.pdf', '.doc', '.docx', '.jpg', '.png', '.gif'];

    // Filter URLs
    const filteredUrls = allUrls.filter(url => {
      const urlLower = url.toLowerCase();
      if (skipDomains.some(domain => urlLower.includes(domain))) return false;
      if (skipExtensions.some(ext => urlLower.endsWith(ext))) return false;
      // Skip spam/redirect URLs
      if (urlLower.includes('?domain=') || urlLower.includes('&domain=') ||
          urlLower.includes('?oref=') || urlLower.includes('&oref=') ||
          urlLower.includes('?redirect=') || urlLower.includes('psystem=')) return false;
      return true;
    });

    // Find best match for business
    let website = null;

    if (businessName && filteredUrls.length > 0) {
      // Get significant words (exclude common words)
      const commonWords = ['the', 'and', 'inc', 'llc', 'of', 'at', 'in', 'on', 'for', 'co', 'company', 'corp', 'studio', 'shop', 'store', 'services', 'service', 'salon', 'barber'];
      const bizWords = businessName.toLowerCase()
        .replace(/[''`´&]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 2 && !commonWords.includes(w));

      // First try to find domain match (require multiple words)
      for (const url of filteredUrls) {
        try {
          const hostname = new URL(url).hostname.toLowerCase().replace('www.', '');
          const matchCount = bizWords.filter(word => hostname.includes(word)).length;

          // Require at least 2 words to match, OR if business has only 1-2 significant words, require all
          const minRequired = bizWords.length <= 2 ? bizWords.length : 2;

          if (matchCount >= minRequired) {
            website = url;
            break;
          }
        } catch {
          continue;
        }
      }

      // DO NOT fallback to first URL if no good match - better to return nothing than wrong result
    } else if (filteredUrls.length > 0) {
      website = filteredUrls[0];
    }

    console.log(`🐕 Scrapingdog/DDG found: ${website || 'none'} (${responseTime}ms, 1 credit)`);

    return res.status(200).json({
      success: true,
      source: 'scrapingdog-ddg',
      query,
      website,
      responseTime,
      urlsFound: allUrls.length,
      filteredCount: filteredUrls.length
    });

  } catch (error) {
    console.error('🐕 Scrapingdog search error:', error);
    return res.status(200).json({
      success: false,
      source: 'scrapingdog',
      query,
      website: null,
      error: error.message
    });
  }
}
