// Serper.dev Search API - 2,500 FREE searches/month
// Fast Google search results without scraping
// https://serper.dev

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query, businessName } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Query required' });
  }

  const SERPER_API_KEY = process.env.SERPER_API_KEY;

  if (!SERPER_API_KEY) {
    console.log('⚠️ Serper API key not configured, falling back to Google');
    return fallbackToGoogle(req, res, query, businessName);
  }

  try {
    console.log(`🔍 Serper search: "${query}"`);

    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: query,
        num: 10
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Serper API error:', response.status, errorText);

      // If quota exceeded or error, fall back to Google
      if (response.status === 429 || response.status === 403) {
        console.log('🔍 Serper quota/auth issue, falling back to Google');
        return fallbackToGoogle(req, res, query, businessName);
      }

      throw new Error(`Serper returned ${response.status}`);
    }

    const data = await response.json();
    const organic = data.organic || [];

    if (organic.length === 0) {
      return res.status(200).json({
        success: true,
        source: 'serper',
        query,
        results: [],
        topUrl: null
      });
    }

    // Filter out directory sites and bad results
    let topUrl = null;

    // Skip patterns for all searches
    const skipDomains = [
      'yelp.com', 'yellowpages.com', 'bbb.org', 'tripadvisor.com',
      'foursquare.com', 'mapquest.com', 'manta.com', 'chamberofcommerce.com',
      'bizapedia.com', 'dnb.com', 'zoominfo.com', 'angi.com', 'thumbtack.com',
      'nextdoor.com', 'linkedin.com/posts', 'twitter.com/search'
    ];

    // For Facebook searches, ONLY accept business page URLs (reject everything else)
    const isFacebookSearch = query.includes('site:facebook.com');
    // Skip these patterns - they're not business pages
    const fbSkipPatterns = ['/groups/', '/share.php', '/events/', '/marketplace/', '/watch/', '/posts/', '/photos/', '/videos/', '/story.php', '/permalink.php', '/notes/'];

    // For Instagram searches, ONLY accept profile URLs (reject posts/reels)
    const isInstagramSearch = query.includes('site:instagram.com');
    // Skip these patterns - they're posts, not profiles
    const igSkipPatterns = ['/p/', '/reel/', '/reels/', '/stories/', '/tv/', '/explore/', '/s/', '/live/'];

    for (const result of organic) {
      const url = result.link || '';

      // Skip directory sites
      if (skipDomains.some(domain => url.includes(domain))) continue;

      // For Facebook: validate it's a real business page URL
      if (isFacebookSearch) {
        // Skip bad patterns
        if (fbSkipPatterns.some(p => url.includes(p))) continue;
        // Skip personal profiles
        if (url.includes('profile.php')) continue;
        // Must be a simple page URL like facebook.com/businessname
        // Valid: facebook.com/adamshvac or facebook.com/Adams-Heating-123456
        const fbMatch = url.match(/facebook\.com\/([^\/\?]+)\/?$/);
        if (!fbMatch || !fbMatch[1]) continue;
        // Skip if the "page name" is a generic word
        const fbPageName = fbMatch[1].toLowerCase();
        if (['home', 'watch', 'marketplace', 'gaming', 'login', 'help'].includes(fbPageName)) continue;
        // This looks like a valid business page
        topUrl = url;
        break;
      }

      // For Instagram: validate it's a profile URL, not a post
      if (isInstagramSearch) {
        if (igSkipPatterns.some(p => url.includes(p))) {
          // Try to extract profile from post URL
          const match = url.match(/instagram\.com\/([^\/\?]+)/);
          if (match && match[1] && !['p', 'reel', 'reels', 'stories', 'tv', 'explore', 's', 'live', 'accounts'].includes(match[1])) {
            topUrl = `https://www.instagram.com/${match[1]}`;
            break;
          }
          continue;
        }
        // Validate it's a profile URL (instagram.com/username with no extra path)
        const igMatch = url.match(/instagram\.com\/([^\/\?]+)\/?$/);
        if (igMatch && igMatch[1] && !['p', 'reel', 'reels', 'stories', 'tv', 'explore', 's', 'live', 'accounts'].includes(igMatch[1].toLowerCase())) {
          topUrl = url;
          break;
        }
        continue;
      }

      // Valid result found (for website searches)
      if (url) {
        topUrl = url;
        break;
      }
    }

    // If no good result found, return null rather than bad data
    if (!topUrl) {
      topUrl = null;
    }

    console.log(`🔍 Serper found ${organic.length} results, top: ${topUrl}`);

    return res.status(200).json({
      success: true,
      source: 'serper',
      query,
      results: organic.slice(0, 5).map(r => ({
        title: r.title,
        url: r.link,
        description: r.snippet
      })),
      topUrl
    });

  } catch (error) {
    console.error('🔍 Serper search error:', error);
    return fallbackToGoogle(req, res, query, businessName);
  }
}

// Fallback to Google Custom Search (100/day free)
async function fallbackToGoogle(req, res, query, businessName) {
  try {
    const GOOGLE_API_KEY = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
    const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID;

    if (!GOOGLE_API_KEY || !GOOGLE_CSE_ID) {
      console.log('⚠️ Google Custom Search not configured either');
      return res.status(200).json({
        success: false,
        query,
        error: 'No search API configured',
        results: [],
        topUrl: null
      });
    }

    console.log('🔍 Using Google Custom Search fallback...');

    const googleUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CSE_ID}&q=${encodeURIComponent(query)}&num=10`;
    const googleResponse = await fetch(googleUrl);

    if (!googleResponse.ok) {
      throw new Error(`Google API error: ${googleResponse.status}`);
    }

    const googleData = await googleResponse.json();
    const items = googleData.items || [];

    if (items.length === 0) {
      return res.status(200).json({
        success: true,
        source: 'google',
        query,
        results: [],
        topUrl: null
      });
    }

    // Filter out directory sites for business searches
    let topUrl = items[0]?.link || null;

    if (businessName && !query.includes('site:')) {
      const skipDomains = [
        'yelp.com', 'yellowpages.com', 'bbb.org', 'tripadvisor.com',
        'foursquare.com', 'mapquest.com', 'manta.com'
      ];

      for (const item of items) {
        const isSkipDomain = skipDomains.some(domain => item.link?.includes(domain));
        if (!isSkipDomain && item.link) {
          topUrl = item.link;
          break;
        }
      }
    }

    console.log(`🔍 Google fallback found: ${topUrl}`);

    return res.status(200).json({
      success: true,
      source: 'google',
      query,
      results: items.slice(0, 5).map(item => ({
        title: item.title,
        url: item.link,
        description: item.snippet
      })),
      topUrl
    });

  } catch (error) {
    console.error('🔍 Google fallback error:', error);
    return res.status(200).json({
      success: false,
      query,
      error: error.message,
      results: [],
      topUrl: null
    });
  }
}
