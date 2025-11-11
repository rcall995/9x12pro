/**
 * Vercel Serverless Function - Outscraper Proxy
 *
 * This function acts as a proxy to the Outscraper API to enrich business data
 * with contact information (phone, email, Facebook, Instagram, etc.)
 *
 * Environment Variables Required:
 * - OUTSCRAPER_API_KEY: Your Outscraper API key
 */

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { businessName, address, placeId } = req.body;

    if (!businessName) {
      return res.status(400).json({ error: 'businessName is required' });
    }

    // Get API key from environment variable
    const apiKey = process.env.OUTSCRAPER_API_KEY;

    if (!apiKey) {
      console.error('❌ OUTSCRAPER_API_KEY not configured in environment variables');
      return res.status(500).json({
        error: 'Outscraper API key not configured',
        enriched: false
      });
    }

    // Build query using business name + address (most reliable)
    // Note: Outscraper doesn't support Place IDs directly, use name+location instead
    let query = businessName;
    if (address) {
      query += `, ${address}`;
    }

    console.log('🔍 Enriching business:', query);

    // Use the Google Maps Scraper API endpoint
    const outscraperUrl = `https://api.app.outscraper.com/maps/search?query=${encodeURIComponent(query)}&limit=1&language=en&region=us`;

    const response = await fetch(outscraperUrl, {
      method: 'GET',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Outscraper API error:', response.status, errorText);

      // Return detailed error info
      return res.status(200).json({
        phone: '',
        website: '',
        email: '',
        facebook: '',
        instagram: '',
        enriched: false,
        error: `Outscraper API ${response.status}: ${errorText.substring(0, 200)}`,
        debug: {
          status: response.status,
          hint: response.status === 402 ? '💳 Out of credits! Add credits at https://app.outscraper.com/billing' :
                response.status === 401 || response.status === 403 ? '🔑 Invalid API key! Check at https://app.outscraper.com/api-keys' :
                '❓ Unknown API error'
        }
      });
    }

    const data = await response.json();

    // Log the raw API response for debugging
    console.log('📥 Raw Outscraper API response:', JSON.stringify(data, null, 2));

    // Parse Outscraper response
    if (!data.data || data.data.length === 0 || !data.data[0] || data.data[0].length === 0) {
      console.warn('⚠️ No results found for:', placeId || businessName);
      console.warn('⚠️ Response structure:', JSON.stringify(data, null, 2));
      return res.status(200).json({
        phone: '',
        website: '',
        email: '',
        facebook: '',
        instagram: '',
        enriched: false,
        error: 'No results found - business might not exist in Google Maps or account out of credits'
      });
    }

    const business = data.data[0][0];

    // Log the full response for debugging
    console.log('📦 Full Outscraper response for', businessName, ':', JSON.stringify(business, null, 2));

    // Extract contact information
    const phone = business.phone || '';
    const website = business.site || '';
    const emails = business.emails || [];
    const email = Array.isArray(emails) && emails.length > 0 ? emails[0] : '';

    // Extract social media links - try multiple possible formats
    let facebook = '';
    let instagram = '';

    // Try parsing social_media object
    if (business.social_media) {
      console.log('🔍 social_media object:', JSON.stringify(business.social_media, null, 2));

      if (typeof business.social_media === 'object') {
        facebook = business.social_media.facebook || business.social_media.Facebook || '';
        instagram = business.social_media.instagram || business.social_media.Instagram || '';
      }
    }

    // Try parsing social links array (alternative format)
    if (business.social_links && Array.isArray(business.social_links)) {
      console.log('🔍 social_links array:', JSON.stringify(business.social_links, null, 2));

      business.social_links.forEach(link => {
        if (link.includes('facebook.com')) facebook = link;
        if (link.includes('instagram.com')) instagram = link;
      });
    }

    // Try parsing from raw fields
    if (business.facebook) facebook = business.facebook;
    if (business.instagram) instagram = business.instagram;

    const enrichedData = {
      phone,
      website,
      email,
      facebook,
      instagram,
      rating: business.rating || 0,
      reviewsCount: business.reviews || 0,
      enriched: true,
      cost: 0.01, // Approximate cost per business
      source: 'outscraper'
    };

    console.log('✅ Enriched successfully:', businessName, {
      hasPhone: !!phone,
      hasEmail: !!email,
      hasFacebook: !!facebook,
      hasInstagram: !!instagram
    });

    return res.status(200).json(enrichedData);

  } catch (error) {
    console.error('💥 Serverless function error:', error);

    // Return fallback data instead of failing
    return res.status(200).json({
      phone: '',
      website: '',
      email: '',
      facebook: '',
      instagram: '',
      enriched: false,
      error: error.message
    });
  }
}
