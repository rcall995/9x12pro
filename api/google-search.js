/**
 * Google Custom Search API for finding business websites
 * This searches Google for business websites (not using Places API - this is FREE!)
 *
 * Free tier: 100 queries/day
 * If you need more, you can upgrade or use caching aggressively
 */

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
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
          'bbb.org', 'tripadvisor.com', 'foursquare.com',
          // Directories
          'mapquest.com', 'superpages.com', 'citysearch.com', 'manta.com',
          'autorepairlocal.com', 'local.com', 'hotfrog.com', 'cylex.us',
          'angieslist.com', 'homeadvisor.com', 'thumbtack.com', 'nextdoor.com',
          'alignable.com', 'chamberofcommerce.com', 'dnb.com', 'zoominfo.com',
          // News sites
          'wnypapers.com', 'newspapers.com', 'patch.com', 'news.google.com',
          'buffalonews.com', 'wivb.com', 'wgrz.com', 'wkbw.com',
          // Other junk
          'wikipedia.org', 'youtube.com', 'tiktok.com', 'pinterest.com'
        ];

        // Skip file extensions
        const skipExtensions = ['.pdf', '.doc', '.docx', '.jpg', '.png', '.gif'];

        const isSkipDomain = skipDomains.some(domain => url.includes(domain));
        const isSkipFile = skipExtensions.some(ext => url.endsWith(ext));

        if (!isSkipDomain && !isSkipFile) {
          website = item.link; // Use original case
          break;
        }
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
