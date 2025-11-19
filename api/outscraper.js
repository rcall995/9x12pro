// Vercel Serverless Function - Outscraper API Proxy
// This prevents CORS issues and keeps API key secure

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query, limit = 1 } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Query parameter required' });
  }

  const OUTSCRAPER_API_KEY = process.env.OUTSCRAPER_API_KEY;

  if (!OUTSCRAPER_API_KEY) {
    return res.status(500).json({ error: 'Outscraper API key not configured' });
  }

  try {
    // Call Outscraper Google Maps Scraper API
    // Docs: https://app.outscraper.com/api-docs#tag/Google-Maps/paths/~1maps~1search-v3/get
    const url = `https://api.app.outscraper.com/maps/search-v3?query=${encodeURIComponent(query)}&limit=${limit}&language=en&region=us&fields=name,full_address,phone,site,emails,facebook_url,instagram_url`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-API-KEY': OUTSCRAPER_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Outscraper API error:', errorText);
      return res.status(response.status).json({
        error: 'Outscraper API request failed',
        details: errorText
      });
    }

    const data = await response.json();

    // Extract the first result
    const result = data?.data?.[0]?.[0] || null;

    if (!result) {
      return res.status(200).json({
        phone: '',
        website: '',
        email: '',
        facebook: '',
        instagram: '',
        enriched: false,
        source: 'outscraper',
        cost: 1 // 1 credit used
      });
    }

    // Parse the response
    const enrichedData = {
      phone: result.phone || '',
      website: result.site || '',
      email: result.emails?.[0] || '', // Take first email if multiple
      facebook: result.facebook_url || '',
      instagram: result.instagram_url || '',
      enriched: !!(result.phone || result.site || result.emails || result.facebook_url || result.instagram_url),
      source: 'outscraper',
      cost: 1
    };

    return res.status(200).json(enrichedData);

  } catch (error) {
    console.error('Outscraper proxy error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
