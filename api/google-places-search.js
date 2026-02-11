// Vercel Serverless Function - Google Places Text Search (New) fallback
// Used when HERE API returns < 3 results for a category+ZIP
// Pricing: $32/1K requests (Basic FieldMask), $200/month free credit ≈ 6,250 calls
// Docs: https://developers.google.com/maps/documentation/places/web-service/text-search

import { checkRateLimit } from './lib/rate-limit.js';
import { checkApiQuota, recordApiCall } from './lib/api-usage.js';

// In-memory geocode cache: ZIP -> { lat, lng, timestamp }
const geocodeCache = {};
const GEOCODE_CACHE_TTL = 1000 * 60 * 60; // 1 hour

// Junk domains to filter out (same list as here-search.js)
const JUNK_DOMAINS = [
  'mapquest.com', 'yellowpages.com', 'yelp.com', 'facebook.com',
  'autorepairlocal.com', 'wnypapers.com', 'newspapers.com', 'patch.com',
  'bbb.org', 'manta.com', 'superpages.com', 'citysearch.com',
  'local.com', 'foursquare.com', 'tripadvisor.com', 'angieslist.com',
  'homeadvisor.com', 'thumbtack.com', 'nextdoor.com', 'alignable.com',
  'business.site'
];

function getCachedGeocode(zip5) {
  const entry = geocodeCache[zip5];
  if (entry && (Date.now() - entry.timestamp) < GEOCODE_CACHE_TTL) {
    return entry;
  }
  if (entry) delete geocodeCache[zip5];
  return null;
}

async function geocodeZip(zip5, hereApiKey) {
  const cached = getCachedGeocode(zip5);
  if (cached) return cached;

  // Try HERE geocoding first (we already have the key)
  if (hereApiKey) {
    try {
      const url = `https://geocode.search.hereapi.com/v1/geocode?q=${encodeURIComponent(zip5 + ',USA')}&apiKey=${hereApiKey}`;
      const resp = await fetch(url);
      const data = await resp.json();
      if (data.items && data.items.length > 0) {
        const pos = data.items[0].position;
        const result = { lat: pos.lat, lng: pos.lng, timestamp: Date.now() };
        geocodeCache[zip5] = result;
        return result;
      }
    } catch (e) {
      console.warn('HERE geocode failed, trying Zippopotam.us:', e.message);
    }
  }

  // Fallback: Zippopotam.us (free, no key needed)
  try {
    const resp = await fetch(`https://api.zippopotam.us/us/${zip5}`);
    if (resp.ok) {
      const data = await resp.json();
      const place = data.places?.[0];
      if (place) {
        const result = {
          lat: parseFloat(place.latitude),
          lng: parseFloat(place.longitude),
          timestamp: Date.now()
        };
        geocodeCache[zip5] = result;
        return result;
      }
    }
  } catch (e) {
    console.warn('Zippopotam.us geocode failed:', e.message);
  }

  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limit: 20 requests per minute
  const rateLimited = checkRateLimit(req, res, { limit: 20, window: 60, keyPrefix: 'gplaces' });
  if (rateLimited) {
    return res.status(rateLimited.status).json(rateLimited.body);
  }

  const { zipCode, category, limit = 20 } = req.body || {};

  if (!zipCode || !category) {
    return res.status(400).json({ error: 'zipCode and category parameters required' });
  }

  const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

  // Graceful degradation if key not configured
  if (!GOOGLE_PLACES_API_KEY) {
    console.warn('⚠️ GOOGLE_PLACES_API_KEY not configured - returning empty results');
    return res.status(200).json({
      businesses: [],
      total: 0,
      source: 'google_places',
      query: `${category} near ${zipCode}`,
      message: 'Google Places API key not configured'
    });
  }

  // Check monthly quota
  const quota = await checkApiQuota('google_places');
  if (!quota.allowed) {
    console.warn(`⚠️ Google Places monthly quota exceeded (${quota.used}/${quota.limit})`);
    return res.status(200).json({
      businesses: [],
      total: 0,
      source: 'google_places',
      query: `${category} near ${zipCode}`,
      message: 'Monthly quota exceeded'
    });
  }

  try {
    const zip5 = zipCode.substring(0, 5);

    // Step 1: Geocode the ZIP
    const HERE_API_KEY = process.env.HERE_API_KEY;
    const coords = await geocodeZip(zip5, HERE_API_KEY);

    if (!coords) {
      return res.status(200).json({
        businesses: [],
        total: 0,
        source: 'google_places',
        query: `${category} near ${zipCode}`,
        message: 'Could not geocode ZIP code'
      });
    }

    // Step 2: Call Google Places Text Search (New)
    const searchQuery = `${category} near ${zip5}`;
    const maxResults = Math.min(parseInt(limit) || 20, 20);

    const requestBody = {
      textQuery: searchQuery,
      locationBias: {
        circle: {
          center: { latitude: coords.lat, longitude: coords.lng },
          radius: 16000 // ~10 miles
        }
      },
      maxResultCount: maxResults
    };

    console.log(`🔍 Google Places search: "${searchQuery}" near ${coords.lat},${coords.lng}`);

    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.addressComponents,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.primaryTypeDisplayName,places.location'
      },
      body: JSON.stringify(requestBody)
    });

    // Record the API call
    await recordApiCall('google_places');

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Places API error:', response.status, errorText);
      return res.status(200).json({
        businesses: [],
        total: 0,
        source: 'google_places',
        query: searchQuery,
        message: `API error: ${response.status}`
      });
    }

    const data = await response.json();
    const places = data.places || [];
    console.log(`📦 Google Places returned ${places.length} results`);

    if (places.length === 0) {
      return res.status(200).json({
        businesses: [],
        total: 0,
        source: 'google_places',
        query: searchQuery
      });
    }

    // Transform to our business object format
    const businesses = [];

    for (const place of places) {
      // Extract address components
      const components = place.addressComponents || [];
      let street = '';
      let city = '';
      let state = '';
      let placeZip = '';

      for (const comp of components) {
        const types = comp.types || [];
        if (types.includes('street_number')) {
          street = comp.longText + ' ' + street;
        } else if (types.includes('route')) {
          street = street + comp.longText;
        } else if (types.includes('locality')) {
          city = comp.longText;
        } else if (types.includes('administrative_area_level_1')) {
          state = comp.shortText;
        } else if (types.includes('postal_code')) {
          placeZip = comp.longText;
        }
      }

      street = street.trim();
      const placeZip5 = placeZip ? placeZip.substring(0, 5) : '';

      // Strict ZIP filtering: exact match or no ZIP
      if (placeZip5 && placeZip5 !== zip5) {
        continue;
      }

      // Filter junk websites
      let website = place.websiteUri || '';
      if (website) {
        const isJunk = JUNK_DOMAINS.some(junk => website.toLowerCase().includes(junk));
        if (isJunk) website = '';
      }

      const name = place.displayName?.text || '';
      const primaryCategory = place.primaryTypeDisplayName?.text || category || '';

      businesses.push({
        placeId: place.id || `gp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: name,
        address: street || place.formattedAddress || '',
        fullAddress: place.formattedAddress || '',
        city: city,
        state: state,
        zip: placeZip5 || zip5,
        zipCode: placeZip5 || zip5,
        phone: place.nationalPhoneNumber || '',
        website: website,
        email: '',
        rating: place.rating || 0,
        reviewCount: place.userRatingCount || 0,
        categories: primaryCategory,
        lat: place.location?.latitude || 0,
        lng: place.location?.longitude || 0,
        isClosed: false,
        source: 'google_places',
        searchedZipCode: zip5,
        category: category
      });
    }

    console.log(`✅ Google Places returning ${businesses.length} businesses (${places.length - businesses.length} filtered by ZIP)`);

    return res.status(200).json({
      businesses: businesses,
      total: businesses.length,
      source: 'google_places',
      query: searchQuery
    });

  } catch (error) {
    console.error('❌ Google Places search error:', error);
    return res.status(200).json({
      businesses: [],
      total: 0,
      source: 'google_places',
      query: `${category} near ${zipCode}`,
      message: error.message
    });
  }
}
