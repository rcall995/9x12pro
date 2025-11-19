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

    console.log('🔍 Calling Outscraper API:', url);
    console.log('🔑 API Key length:', OUTSCRAPER_API_KEY?.length);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-API-KEY': OUTSCRAPER_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    console.log('📡 Outscraper response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Outscraper API error:', errorText);
      return res.status(response.status).json({
        error: 'Outscraper API request failed',
        details: errorText
      });
    }

    const data = await response.json();

    // Log the full response for debugging
    console.log('Outscraper API response:', JSON.stringify(data, null, 2));

    // Handle async response - Outscraper returns a task ID first
    if (data.status === 'Pending' && data.results_location) {
      console.log('⏳ Task is pending, polling for results:', data.results_location);

      // Poll for results (max 3 attempts with 2 second delay)
      for (let attempt = 0; attempt < 3; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

        const resultResponse = await fetch(data.results_location, {
          method: 'GET',
          headers: {
            'X-API-KEY': OUTSCRAPER_API_KEY,
            'Content-Type': 'application/json'
          }
        });

        if (resultResponse.ok) {
          const resultData = await resultResponse.json();
          console.log('📥 Poll attempt', attempt + 1, ':', JSON.stringify(resultData, null, 2));

          if (resultData.status === 'Success' && resultData.data) {
            // Extract the first result from successful response
            const result = resultData.data?.[0]?.[0] || null;

            if (result) {
              const enrichedData = {
                phone: result.phone || '',
                website: result.site || '',
                email: result.emails?.[0] || '',
                facebook: result.facebook_url || '',
                instagram: result.instagram_url || '',
                enriched: !!(result.phone || result.site || result.emails || result.facebook_url || result.instagram_url),
                source: 'outscraper',
                cost: 1
              };

              console.log('✅ Enriched data:', enrichedData);
              return res.status(200).json(enrichedData);
            }
          }
        }
      }

      console.log('⏱️ Timeout waiting for results');
      return res.status(200).json({
        phone: '',
        website: '',
        email: '',
        facebook: '',
        instagram: '',
        enriched: false,
        source: 'outscraper',
        cost: 1,
        debug: { error: 'Timeout waiting for results' }
      });
    }

    // Handle direct response (if not async)
    const result = data?.data?.[0]?.[0] || null;

    if (!result) {
      console.log('No result found in Outscraper response');
      return res.status(200).json({
        phone: '',
        website: '',
        email: '',
        facebook: '',
        instagram: '',
        enriched: false,
        source: 'outscraper',
        cost: 1, // 1 credit used
        debug: { raw: data } // Include raw data for debugging
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
