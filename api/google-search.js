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
      console.error('Missing Google Custom Search credentials');
      return res.status(500).json({
        error: 'Google Custom Search not configured',
        website: ''
      });
    }

    // Search Google using Custom Search API
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${API_KEY}&cx=${CSE_ID}&q=${encodeURIComponent(query)}&num=3`;

    const response = await fetch(searchUrl);
    const data = await response.json();

    if (!response.ok) {
      console.error('Google Custom Search error:', data);
      return res.status(200).json({ website: '' }); // Return empty instead of error
    }

    // Find the first result that looks like a business website
    let website = '';
    if (data.items && data.items.length > 0) {
      for (const item of data.items) {
        const url = item.link;

        // Skip common non-business sites
        const skipDomains = [
          'yelp.com', 'facebook.com', 'instagram.com', 'twitter.com',
          'linkedin.com', 'yellowpages.com', 'google.com', 'maps.google.com',
          'bbb.org', 'tripadvisor.com', 'foursquare.com'
        ];

        const isSkipDomain = skipDomains.some(domain => url.includes(domain));

        if (!isSkipDomain) {
          website = url;
          break;
        }
      }

      // If all results were social/directory sites, just take the first non-Google result
      if (!website && data.items.length > 0) {
        const firstNonGoogle = data.items.find(item => !item.link.includes('google.com'));
        if (firstNonGoogle) {
          website = firstNonGoogle.link;
        }
      }
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
