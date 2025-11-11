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

    // Build search query
    let query = businessName;
    if (address) {
      query += `, ${address}`;
    }

    console.log('🔍 Enriching business:', query);

    // Call Outscraper API
    // Using Google Maps Scraper endpoint
    const outscraperUrl = `https://api.app.outscraper.com/maps/search-v3?query=${encodeURIComponent(query)}&limit=1&language=en&region=us&fields=name,full_address,phone,site,emails,social_media,rating,reviews`;

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

      // Return fallback data instead of failing
      return res.status(200).json({
        phone: '',
        website: '',
        email: '',
        facebook: '',
        instagram: '',
        enriched: false,
        error: `API error: ${response.status}`
      });
    }

    const data = await response.json();

    // Parse Outscraper response
    if (!data.data || data.data.length === 0 || !data.data[0] || data.data[0].length === 0) {
      console.warn('⚠️ No results found for:', query);
      return res.status(200).json({
        phone: '',
        website: '',
        email: '',
        facebook: '',
        instagram: '',
        enriched: false
      });
    }

    const business = data.data[0][0];

    // Extract contact information
    const phone = business.phone || '';
    const website = business.site || '';
    const emails = business.emails || [];
    const email = Array.isArray(emails) && emails.length > 0 ? emails[0] : '';

    // Extract social media links
    const socialMedia = business.social_media || {};
    const facebook = socialMedia.facebook || '';
    const instagram = socialMedia.instagram || '';

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
