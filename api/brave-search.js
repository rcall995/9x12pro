/**
 * Brave Search API - 2,000 FREE searches/month
 * Often returns different/better results than Google
 * https://brave.com/search/api/
 */

import { checkRateLimit } from './lib/rate-limit.js';
import { checkApiQuota, recordApiCall } from './lib/api-usage.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limit: 30 requests per minute
  const rateLimited = checkRateLimit(req, res, { limit: 30, window: 60, keyPrefix: 'brave' });
  if (rateLimited) {
    return res.status(rateLimited.status).json(rateLimited.body);
  }

  const { query, businessName, zipCode, city, state } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Query required' });
  }

  const BRAVE_API_KEY = process.env.BRAVE_API_KEY;

  if (!BRAVE_API_KEY) {
    console.log('⚠️ Brave API key not configured');
    return res.status(200).json({
      success: false,
      source: 'brave',
      error: 'not_configured',
      website: null
    });
  }

  // Check monthly quota before making API call
  const quota = await checkApiQuota('brave');
  if (!quota.allowed) {
    console.log(`🦁 Brave quota exceeded: ${quota.used}/${quota.limit} used`);
    return res.status(200).json({
      success: false,
      source: 'brave',
      error: 'quota_exceeded',
      used: quota.used,
      limit: quota.limit,
      website: null
    });
  }

  try {
    console.log(`🦁 Brave search: "${query}"`);

    const response = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`,
      {
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': BRAVE_API_KEY
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Brave API error:', response.status, errorText);
      throw new Error(`Brave returned ${response.status}`);
    }

    const data = await response.json();
    const results = data.web?.results || [];

    // Record successful API call
    await recordApiCall('brave');

    if (results.length === 0) {
      return res.status(200).json({
        success: true,
        source: 'brave',
        query,
        website: null,
        results: []
      });
    }

    // Skip patterns - comprehensive junk filtering
    const skipDomains = [
      // Directories and review sites
      'yelp.com', 'yellowpages.com', 'bbb.org', 'tripadvisor.', // catches all TLDs
      'foursquare.com', 'mapquest.com', 'manta.com', 'chamberofcommerce.com',
      'bizapedia.com', 'dnb.com', 'zoominfo.com', 'angi.com', 'thumbtack.com',
      'nextdoor.com', 'hotfrog.com', 'cylex.us', 'superpages.com',
      'porch.com', 'homeadvisor.com', 'expertise.com', 'alignable.com',
      'roadtrippers.com', 'citysearch.com', 'judysbook.com', 'brownbook.net',
      'buzzfile.com', 'spoke.com', 'merchantcircle.com', 'local.com',
      'kudzu.com', 'dexknows.com', 'showmelocal.com', 'dandb.com',
      'chamberorganizer.com', 'findglocal.com', 'getfave.com', 'salespider.com',

      // Menu aggregators (NOT business websites!)
      'menuweb.menu', 'zmenu.com', 'menupix.com', 'allmenus.com',
      'restaurantji.com', 'sirved.com', 'menuism.com', 'zomato.com',
      'wheree.com', 'restaurantguru.com', 'openmenu.com', 'locu.com',
      'singleplatform.com', 'yext.com', 'menuvenue.com', 'menufy.com',
      'beyondmenu.com', 'clover.com/online-ordering', 'menulog.com',

      // Food delivery (NOT business websites!)
      'grubhub.com', 'doordash.com', 'ubereats.com', 'seamless.com',
      'postmates.com', 'slice.com', 'toasttab.com', 'chownow.com',
      'order.online', 'ordering.app', 'eat24.com', 'caviar.com',

      // Booking platforms (NOT business websites - these are other businesses!)
      'glossgenius.com', 'vagaro.com', 'styleseat.com', 'booksy.com',
      'fresha.com', 'schedulicity.com', 'squareup.com/appointments',
      'square.site', 'acuityscheduling.com', 'calendly.com', 'mindbodyonline.com',
      'gettimely.com', 'zenoti.com', 'booker.com', 'salonbiz.com',

      // Vacation rentals / real estate
      'vrbo.com', 'airbnb.com', 'booking.com', 'hotels.com', 'expedia.com',
      'zillow.com', 'realtor.com', 'redfin.com', 'trulia.com',

      // Local news / blogs
      'stepoutbuffalo.com', 'buffalorising.com', 'buffaloeats.org',
      'buffalonews.com', 'wivb.com', 'wgrz.com', 'wkbw.com',
      'patch.com', 'thrillist.com', 'eater.com', 'timeout.com',
      'onlyinyourstate.com', 'newspapers.com',

      // National news sites and media outlets
      'usnews.com', 'money.usnews.com', 'forbes.com', 'bloomberg.com',
      'cnbc.com', 'cnn.com', 'wsj.com', 'nytimes.com', 'washingtonpost.com',
      'businessinsider.com', 'investopedia.com', 'marketwatch.com',
      'yahoo.com', 'msn.com', 'aol.com', 'huffpost.com', 'buzzfeed.com',
      'newsweek.com', 'usatoday.com', 'reuters.com', 'apnews.com',

      // Social media
      'facebook.com', 'instagram.com', 'twitter.com', 'tiktok.com',
      'youtube.com', 'pinterest.com', 'reddit.com', 'linkedin.com',

      // Legal directories
      'avvo.com', 'findlaw.com', 'justia.com', 'lawyers.com',
      'martindale.com', 'superlawyers.com', 'lawinfo.com', 'nolo.com',

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
      '.gov', '.edu', '.ny.us', '.ca.us', '.tx.us',

      // Tourism directories
      'iloveny.com', 'visitbuffaloniagara.com',

      // Hosting providers / generic / spam
      'giecom.net', '.com-place.com', 'dot-reviews.org', 'rateclubs.com',
      'giftly.com', 'carfax.com', 'autotrader.com', 'cars.com', 'cargurus.com',

      // Search engines
      'google.com', 'bing.com', 'duckduckgo.com', 'brave.com/search'
    ];

    const skipExtensions = ['.pdf', '.doc', '.docx', '.jpg', '.png', '.gif'];

    let website = null;

    for (const result of results) {
      const url = result.url || '';
      const urlLower = url.toLowerCase();
      const title = (result.title || '').toLowerCase();

      // Skip junk domains
      if (skipDomains.some(domain => urlLower.includes(domain))) continue;

      // Skip files
      if (skipExtensions.some(ext => urlLower.endsWith(ext))) continue;

      // Skip spam/redirect URLs with suspicious query params
      if (urlLower.includes('?domain=') || urlLower.includes('&domain=') ||
          urlLower.includes('?oref=') || urlLower.includes('&oref=') ||
          urlLower.includes('?redirect=') || urlLower.includes('?url=') ||
          urlLower.includes('psystem=')) continue;

      // Skip deeply nested URLs (likely articles, not homepages)
      try {
        const parsedUrl = new URL(url);
        const pathSegments = parsedUrl.pathname.split('/').filter(s => s.length > 0);
        if (pathSegments.length > 3) continue;

        // Validate business name appears in domain or title - STRICT matching
        if (businessName) {
          const hostname = parsedUrl.hostname.toLowerCase().replace('www.', '');
          // Get significant words (exclude common words)
          const commonWords = ['the', 'and', 'inc', 'llc', 'of', 'at', 'in', 'on', 'for', 'co', 'company', 'corp', 'studio', 'shop', 'store', 'services', 'service'];
          const bizWords = businessName.toLowerCase()
            .replace(/[''`´&]/g, '') // Remove apostrophes and ampersands
            .split(/\s+/)
            .filter(w => w.length > 2 && !commonWords.includes(w));

          // Count how many significant words match
          const domainMatches = bizWords.filter(word => hostname.includes(word)).length;
          const titleMatches = bizWords.filter(word => title.includes(word)).length;
          const bestMatch = Math.max(domainMatches, titleMatches);

          // Require at least 2 words to match, OR if business has only 1-2 significant words, require all to match
          const minRequired = bizWords.length <= 2 ? bizWords.length : 2;

          if (bestMatch < minRequired) {
            console.log(`🦁 Skipping weak match: ${url} (${bestMatch}/${bizWords.length} words) for "${businessName}"`);
            continue;
          }
        }

        // Validate location (ZIP code or city) appears in result - prevents wrong state matches
        if (zipCode || city) {
          const description = (result.description || '').toLowerCase();
          const combinedText = `${title} ${description}`;

          const hasZipMatch = zipCode && combinedText.includes(zipCode);
          const hasCityMatch = city && combinedText.includes(city.toLowerCase());
          const hasStateMatch = state && combinedText.includes(state.toLowerCase());

          // Require ZIP match, OR city+state match
          if (!hasZipMatch && !(hasCityMatch && hasStateMatch)) {
            // Check if it's a national/chain business (these won't have local info)
            const isLikelyChain = hostname.includes('.com') && !hostname.includes(city?.toLowerCase() || 'xxxxx');
            if (isLikelyChain) {
              console.log(`🦁 Skipping non-local result: ${url} (no ZIP ${zipCode} or city ${city})`);
              continue;
            }
          }
        }
      } catch {
        continue;
      }

      website = url;
      break;
    }

    console.log(`🦁 Brave found: ${website || 'none'}`);

    return res.status(200).json({
      success: true,
      source: 'brave',
      query,
      website,
      results: results.slice(0, 5).map(r => ({
        title: r.title,
        url: r.url,
        description: r.description
      }))
    });

  } catch (error) {
    console.error('🦁 Brave search error:', error);
    return res.status(200).json({
      success: false,
      source: 'brave',
      query,
      website: null,
      error: error.message
    });
  }
}
