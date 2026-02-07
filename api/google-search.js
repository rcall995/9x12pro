/**
 * Google Custom Search API for finding business websites
 * This searches Google for business websites (not using Places API - this is FREE!)
 *
 * Free tier: 100 queries/day
 * If you need more, you can upgrade or use caching aggressively
 */

import { checkRateLimit } from './lib/rate-limit.js';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limit: 20 requests per minute (Google has daily limit of 100)
  const rateLimited = checkRateLimit(req, res, { limit: 20, window: 60, keyPrefix: 'google-search' });
  if (rateLimited) {
    return res.status(rateLimited.status).json(rateLimited.body);
  }

  try {
    const { query, businessName } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Get API credentials from environment variables
    const API_KEY = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
    const CSE_ID = process.env.GOOGLE_CSE_ID;

    if (!API_KEY || !CSE_ID) {
      console.error('Missing Google Custom Search credentials - GOOGLE_CUSTOM_SEARCH_API_KEY and GOOGLE_CSE_ID must be set in Vercel');
      // Return 200 with empty website so client doesn't show errors
      return res.status(200).json({
        website: '',
        error: 'not_configured'
      });
    }

    // Search Google using Custom Search API
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${API_KEY}&cx=${CSE_ID}&q=${encodeURIComponent(query)}&num=3`;

    const response = await fetch(searchUrl);
    const data = await response.json();

    if (!response.ok) {
      console.error('Google Custom Search error:', data);
      const errorMsg = data.error?.message || `HTTP ${response.status}`;
      return res.status(200).json({
        website: '',
        topUrl: null,
        error: `Google API error: ${errorMsg}`
      });
    }

    // Find the first result that looks like a business website
    let website = '';
    if (data.items && data.items.length > 0) {
      for (const item of data.items) {
        const url = item.link?.toLowerCase() || '';

        // Skip directories, social media, news sites - comprehensive list
        const skipDomains = [
          'yelp.com', 'facebook.com', 'instagram.com', 'twitter.com',
          'linkedin.com', 'yellowpages.com', 'google.com', 'maps.google.com',
          'bbb.org', 'tripadvisor.', 'foursquare.com', // tripadvisor. catches all TLDs
          // Directories
          'mapquest.com', 'superpages.com', 'citysearch.com', 'manta.com',
          'autorepairlocal.com', 'local.com', 'hotfrog.com', 'cylex.us',
          'angieslist.com', 'homeadvisor.com', 'thumbtack.com', 'nextdoor.com',
          'alignable.com', 'chamberofcommerce.com', 'dnb.com', 'zoominfo.com',
          'buzzfile.com', 'spoke.com', 'merchantcircle.com', 'brownbook.net',
          'kudzu.com', 'dexknows.com', 'showmelocal.com', 'dandb.com',
          'chamberorganizer.com', 'findglocal.com', 'getfave.com', 'salespider.com',
          'roadtrippers.com', 'judysbook.com',
          // Menu aggregators (NOT business websites!)
          'zmenu.com', 'menupix.com', 'allmenus.com', 'menuweb.menu',
          'restaurantji.com', 'sirved.com', 'menuism.com', 'zomato.com',
          'wheree.com', 'restaurantguru.com', 'openmenu.com', 'locu.com',
          'singleplatform.com', 'yext.com', 'menuvenue.com', 'menufy.com',
          'beyondmenu.com', 'menulog.com',
          // Food delivery (NOT business websites!)
          'grubhub.com', 'doordash.com', 'ubereats.com', 'seamless.com',
          'postmates.com', 'slice.com', 'toasttab.com', 'chownow.com',
          'eat24.com', 'caviar.com',
          // Vacation rentals / real estate
          'vrbo.com', 'airbnb.com', 'booking.com', 'hotels.com', 'expedia.com',
          'zillow.com', 'realtor.com', 'redfin.com', 'trulia.com',
          // Tourism directories
          'iloveny.com', 'visitbuffaloniagara.com', 'tripadvisor.',
          // Local news / blogs
          'stepoutbuffalo.com', 'buffalorising.com', 'buffaloeats.org',
          'wnypapers.com', 'newspapers.com', 'patch.com', 'news.google.com',
          'buffalonews.com', 'wivb.com', 'wgrz.com', 'wkbw.com',
          'thrillist.com', 'eater.com', 'timeout.com', 'onlyinyourstate.com',
          // Legal
          'avvo.com', 'findlaw.com', 'justia.com', 'lawyers.com',
          // Government (not businesses!)
          '.gov', '.ny.us', '.ca.us', '.tx.us',
          // Other junk
          'wikipedia.org', 'youtube.com', 'tiktok.com', 'pinterest.com',
          'reddit.com', 'medium.com', 'eventbrite.com', 'meetup.com',
          'giecom.net', // hosting provider
          '.com-place.com' // spam domains
        ];

        // Skip file extensions
        const skipExtensions = ['.pdf', '.doc', '.docx', '.jpg', '.png', '.gif'];

        const isSkipDomain = skipDomains.some(domain => url.includes(domain));
        const isSkipFile = skipExtensions.some(ext => url.endsWith(ext));

        if (isSkipDomain || isSkipFile) continue;

        // Validate: domain or title should relate to business name
        if (businessName) {
          const bizWords = businessName.toLowerCase().split(/\s+/).filter(w => w.length > 2);
          const hostname = new URL(item.link).hostname.toLowerCase().replace('www.', '');
          const title = (item.title || '').toLowerCase();

          // Check if domain contains business name words
          const domainMatch = bizWords.some(word => hostname.includes(word));
          // Check if title contains business name words
          const titleMatch = bizWords.some(word => title.includes(word));

          if (!domainMatch && !titleMatch) {
            console.log(`Skipping unrelated result for "${businessName}": ${item.link}`);
            continue;
          }
        }

        website = item.link;
        break;
      }

      // Don't fall back to junk - better to return nothing than garbage
    }

    return res.status(200).json({
      website: website,
      totalResults: data.searchInformation?.totalResults || '0'
    });

  } catch (error) {
    console.error('Google Custom Search handler error:', error);
    return res.status(200).json({ website: '' }); // Return empty instead of error to not break the flow
  }
}
