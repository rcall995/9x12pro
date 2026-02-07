// Vercel Serverless Function - Yelp Fusion API Proxy
// Free tier: 2,500 calls per day - much better than Google Places!
// Docs: https://docs.developer.yelp.com/reference/v3_business_search

import { checkRateLimit } from './lib/rate-limit.js';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limit: 100 requests per minute (supports bulk operations)
  const rateLimited = checkRateLimit(req, res, { limit: 100, window: 60, keyPrefix: 'yelp' });
  if (rateLimited) {
    return res.status(rateLimited.status).json(rateLimited.body);
  }

  const { location, term, radius, limit = 20 } = req.body;

  if (!location) {
    return res.status(400).json({ error: 'Location parameter required' });
  }

  const YELP_API_KEY = process.env.YELP_API_KEY;

  if (!YELP_API_KEY) {
    return res.status(500).json({
      error: 'Yelp API key not configured',
      message: 'Please add YELP_API_KEY to Vercel environment variables'
    });
  }

  try {
    // Build Yelp API URL
    // Note: We don't use radius - we search by ZIP and then filter to exact ZIP matches on client
    const params = new URLSearchParams({
      location: location, // e.g., "14221" or "Buffalo, NY"
      limit: Math.min(limit, 50) // Yelp max is 50 per request
      // No radius parameter - let Yelp return results near the ZIP code
      // We'll filter to exact ZIP matches on the client side
    });

    // Add term/category if provided
    if (term) {
      params.append('term', term); // e.g., "restaurants", "auto repair"
    }

    const url = `https://api.yelp.com/v3/businesses/search?${params.toString()}`;

    console.log('🔍 Calling Yelp Fusion API:', url);
    console.log('🔑 API Key configured:', !!YELP_API_KEY);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${YELP_API_KEY}`,
        'Accept': 'application/json'
      }
    });

    console.log('📡 Yelp response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Yelp API error:', errorText);

      // Return friendly error
      return res.status(response.status).json({
        error: 'Yelp API request failed',
        details: errorText,
        status: response.status
      });
    }

    const data = await response.json();

    console.log('✅ Yelp returned', data.businesses?.length || 0, 'businesses');

    // Transform Yelp data to our format
    const businesses = (data.businesses || []).map(biz => ({
      name: biz.name,
      address: biz.location?.address1 || '',
      city: biz.location?.city || '',
      state: biz.location?.state || '',
      zip: (biz.location?.zip_code || '').substring(0, 5),
      phone: biz.display_phone || biz.phone || '',
      website: biz.url || '', // Yelp URL (not actual business website)
      rating: biz.rating || 0,
      review_count: biz.review_count || 0,
      categories: (biz.categories || []).map(cat => cat.title).join(', '),
      lat: biz.coordinates?.latitude || 0,
      lng: biz.coordinates?.longitude || 0,
      yelp_id: biz.id,
      image_url: biz.image_url,
      is_closed: biz.is_closed || false,
      price: biz.price || '',
      source: 'yelp'
    }));

    return res.status(200).json({
      businesses: businesses,
      total: data.total || 0,
      source: 'yelp_fusion',
      cost: 0 // Free tier!
    });

  } catch (error) {
    console.error('Yelp proxy error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
