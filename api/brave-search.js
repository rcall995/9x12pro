/**
 * Brave Search API - 2,000 FREE searches/month
 * Often returns different/better results than Google
 * https://brave.com/search/api/
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query, businessName } = req.body;

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

      // Vacation rentals / real estate
      'vrbo.com', 'airbnb.com', 'booking.com', 'hotels.com', 'expedia.com',
      'zillow.com', 'realtor.com', 'redfin.com', 'trulia.com',

      // Local news / blogs
      'stepoutbuffalo.com', 'buffalorising.com', 'buffaloeats.org',
      'buffalonews.com', 'wivb.com', 'wgrz.com', 'wkbw.com',
      'patch.com', 'thrillist.com', 'eater.com', 'timeout.com',
      'onlyinyourstate.com', 'newspapers.com',

      // Social media
      'facebook.com', 'instagram.com', 'twitter.com', 'tiktok.com',
      'youtube.com', 'pinterest.com', 'reddit.com', 'linkedin.com',

      // Legal
      'avvo.com', 'findlaw.com', 'justia.com', 'lawyers.com',

      // Generic platforms
      'wikipedia.org', 'medium.com', 'eventbrite.com', 'meetup.com',

      // Government and education
      '.gov', '.edu', '.ny.us', '.ca.us', '.tx.us',

      // Tourism directories
      'iloveny.com', 'visitbuffaloniagara.com',

      // Hosting providers / generic
      'giecom.net', '.com-place.com',

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

      // Skip deeply nested URLs (likely articles, not homepages)
      try {
        const parsedUrl = new URL(url);
        const pathSegments = parsedUrl.pathname.split('/').filter(s => s.length > 0);
        if (pathSegments.length > 3) continue;

        // Validate business name appears in domain or title
        if (businessName) {
          const hostname = parsedUrl.hostname.toLowerCase().replace('www.', '');
          const bizWords = businessName.toLowerCase()
            .split(/\s+/)
            .filter(w => w.length > 2 && !['the', 'and', 'inc', 'llc'].includes(w));

          const domainMatch = bizWords.some(word => hostname.includes(word));
          const titleMatch = bizWords.some(word => title.includes(word));

          if (!domainMatch && !titleMatch) {
            console.log(`🦁 Skipping unrelated: ${url} for "${businessName}"`);
            continue;
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
