// Vercel Serverless Function - Foursquare Places Search
// FREE: $200/month in credits (~10,000+ searches)
// Returns: name, address, phone, website, categories
// Docs: https://docs.foursquare.com/developer/reference/place-search

import { checkRateLimit } from './lib/rate-limit.js';

export default async function handler(req, res) {
  // Allow both GET and POST
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limit: 50 requests per minute
  const rateLimited = checkRateLimit(req, res, { limit: 50, window: 60, keyPrefix: 'foursquare' });
  if (rateLimited) {
    return res.status(rateLimited.status).json(rateLimited.body);
  }

  // Get params from body (POST) or query (GET)
  const { zipCode, category, limit = 20 } = req.method === 'POST' ? req.body : req.query;

  if (!zipCode) {
    return res.status(400).json({ error: 'zipCode parameter required' });
  }

  const FOURSQUARE_API_KEY = process.env.FOURSQUARE_API_KEY;

  if (!FOURSQUARE_API_KEY) {
    return res.status(500).json({
      error: 'Foursquare API key not configured',
      message: 'Please add FOURSQUARE_API_KEY to Vercel environment variables',
      signupUrl: 'https://foursquare.com/developers/signup'
    });
  }

  try {
    // Build search query
    const searchQuery = category || 'businesses';

    // Foursquare Place Search API v3
    // Using 'near' parameter with ZIP code for location
    const params = new URLSearchParams({
      query: searchQuery,
      near: `${zipCode}, USA`,
      limit: Math.min(limit, 50) // Max 50 per request
    });

    const url = `https://api.foursquare.com/v3/places/search?${params.toString()}`;

    console.log('🔍 Foursquare search:', searchQuery, 'near', zipCode);
    console.log('🔗 Foursquare URL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': FOURSQUARE_API_KEY,
        'Accept': 'application/json'
      }
    });

    console.log('📡 Foursquare response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Foursquare API error:', errorText);

      let errorMessage = 'Foursquare API request failed';
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorJson.error || errorMessage;
      } catch (e) {}

      return res.status(response.status).json({
        error: errorMessage,
        details: errorText,
        status: response.status
      });
    }

    const data = await response.json();
    console.log('📦 Foursquare raw response:', JSON.stringify(data).substring(0, 500));
    console.log('📦 Foursquare returned', data.results?.length || 0, 'places');

    if (!data.results || data.results.length === 0) {
      console.log('📭 No businesses found');
      return res.status(200).json({
        businesses: [],
        total: 0,
        source: 'foursquare',
        query: `${searchQuery} near ${zipCode}`
      });
    }

    // Transform Foursquare results to our format
    const businesses = data.results.map(place => {
      const location = place.location || {};

      // Extract social media links
      const socialMedia = place.social_media || {};
      const facebook = socialMedia.facebook_id
        ? `https://facebook.com/${socialMedia.facebook_id}`
        : '';
      const instagram = socialMedia.instagram
        ? `https://instagram.com/${socialMedia.instagram}`
        : '';
      const twitter = socialMedia.twitter
        ? `https://twitter.com/${socialMedia.twitter}`
        : '';

      // Get primary category
      const primaryCategory = place.categories?.[0]?.name || category || '';

      return {
        placeId: place.fsq_id || `fsq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: place.name || '',
        address: location.address || '',
        fullAddress: formatFullAddress(location),
        city: location.locality || location.region || '',
        state: location.region || '',
        zip: (location.postcode || '').substring(0, 5),
        zipCode: (location.postcode || '').substring(0, 5),
        phone: formatPhone(place.tel),
        website: place.website || '',
        email: place.email || '',
        facebook: facebook,
        instagram: instagram,
        twitter: twitter,
        rating: place.rating ? place.rating / 2 : 0, // Foursquare uses 0-10, convert to 0-5
        reviewCount: 0, // Not provided in search results
        categories: primaryCategory,
        lat: location.latitude || 0,
        lng: location.longitude || 0,
        isClosed: false,
        verified: place.verified || false,
        source: 'foursquare',
        searchedZipCode: zipCode,
        category: category,
        // Mark as enriched if we have contact info
        enriched: !!(place.email || facebook || instagram)
      };
    });

    // Filter to exact ZIP code match only
    // Foursquare's 'near' parameter is fuzzy and returns nearby businesses
    const searchedZip5 = zipCode.substring(0, 5);
    const zipFiltered = businesses.filter(biz => {
      if (!biz.zip) return false; // Exclude if no ZIP from Foursquare
      return biz.zip === searchedZip5; // Exact 5-digit match only
    });

    // Log enrichment stats
    const withEmail = zipFiltered.filter(b => b.email).length;
    const withWebsite = zipFiltered.filter(b => b.website).length;
    const withFacebook = zipFiltered.filter(b => b.facebook).length;
    const withInstagram = zipFiltered.filter(b => b.instagram).length;

    console.log(`📊 Enrichment: ${withEmail} emails, ${withWebsite} websites, ${withFacebook} FB, ${withInstagram} IG`);
    console.log(`✅ Returning ${zipFiltered.length} businesses`);

    return res.status(200).json({
      businesses: zipFiltered,
      total: zipFiltered.length,
      source: 'foursquare',
      query: `${searchQuery} near ${zipCode}`,
      cost: 0 // FREE with $200/month credits
    });

  } catch (error) {
    console.error('❌ Foursquare search error:', error);
    return res.status(500).json({
      error: 'Search failed',
      message: error.message
    });
  }
}

// Helper: Format full address from Foursquare location object
function formatFullAddress(location) {
  const parts = [];
  if (location.address) parts.push(location.address);
  if (location.locality) parts.push(location.locality);
  if (location.region && location.postcode) {
    parts.push(`${location.region} ${location.postcode}`);
  } else if (location.region) {
    parts.push(location.region);
  }
  if (location.country && location.country !== 'US' && location.country !== 'USA') {
    parts.push(location.country);
  }
  return parts.join(', ');
}

// Helper: Format phone number
function formatPhone(phone) {
  if (!phone) return '';
  // Remove non-digits except +
  const cleaned = phone.replace(/[^\d+]/g, '');
  // Format as (XXX) XXX-XXXX if 10 digits
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0,3)}) ${cleaned.slice(3,6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `(${cleaned.slice(1,4)}) ${cleaned.slice(4,7)}-${cleaned.slice(7)}`;
  }
  return phone; // Return original if can't format
}
