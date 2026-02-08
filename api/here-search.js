// Vercel Serverless Function - HERE Places Search
// FREE: 250,000 searches/month!
// Fast direct API - no scraping
// Docs: https://developer.here.com/documentation/geocoding-search-api/dev_guide/topics/endpoint-discover-brief.html

import { checkRateLimit } from './lib/rate-limit.js';

export default async function handler(req, res) {
  // Allow both GET and POST
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limit: 100 requests per minute
  const rateLimited = checkRateLimit(req, res, { limit: 100, window: 60, keyPrefix: 'here' });
  if (rateLimited) {
    return res.status(rateLimited.status).json(rateLimited.body);
  }

  // Get params from body (POST) or query (GET)
  const { zipCode, category, limit = 20, radiusSearch = false } = req.method === 'POST' ? req.body : req.query;

  if (!zipCode) {
    return res.status(400).json({ error: 'zipCode parameter required' });
  }

  const HERE_API_KEY = process.env.HERE_API_KEY;

  if (!HERE_API_KEY) {
    return res.status(500).json({
      error: 'HERE API key not configured',
      message: 'Please add HERE_API_KEY to Vercel environment variables',
      signupUrl: 'https://platform.here.com/sign-up'
    });
  }

  try {
    // Step 1: Geocode the ZIP code to get coordinates
    const geocodeUrl = `https://geocode.search.hereapi.com/v1/geocode?q=${encodeURIComponent(zipCode + ',USA')}&apiKey=${HERE_API_KEY}`;

    console.log('🔍 HERE geocoding ZIP:', zipCode);

    const geocodeResponse = await fetch(geocodeUrl);
    const geocodeData = await geocodeResponse.json();

    if (!geocodeData.items || geocodeData.items.length === 0) {
      return res.status(400).json({
        error: 'Could not find location for ZIP code',
        zipCode: zipCode
      });
    }

    const location = geocodeData.items[0];
    const lat = location.position.lat;
    const lng = location.position.lng;

    console.log(`📍 ZIP ${zipCode} -> ${lat}, ${lng}`);

    // Step 2: Search for businesses near those coordinates using Discover endpoint
    const searchQuery = category || 'businesses';

    // Use Discover endpoint for text search (finds businesses matching query)
    const searchUrl = `https://discover.search.hereapi.com/v1/discover?at=${lat},${lng}&q=${encodeURIComponent(searchQuery)}&limit=${Math.min(limit, 100)}&apiKey=${HERE_API_KEY}`;

    console.log('🔍 HERE search:', searchQuery, 'near', zipCode);

    const response = await fetch(searchUrl);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('HERE API error:', errorText);

      return res.status(response.status).json({
        error: 'HERE API request failed',
        details: errorText,
        status: response.status
      });
    }

    const data = await response.json();
    console.log('📦 HERE returned', data.items?.length || 0, 'places');

    if (!data.items || data.items.length === 0) {
      return res.status(200).json({
        businesses: [],
        total: 0,
        source: 'here',
        query: searchQuery
      });
    }

    // Transform HERE results to our format
    const businesses = data.items.map(place => {
      const address = place.address || {};
      const contacts = place.contacts || [];

      // Extract phone and website from contacts
      let phone = '';
      let website = '';
      let email = '';

      // Junk domains that HERE sometimes returns instead of real websites
      const junkDomains = [
        'mapquest.com', 'yellowpages.com', 'yelp.com', 'facebook.com',
        'autorepairlocal.com', 'wnypapers.com', 'newspapers.com', 'patch.com',
        'bbb.org', 'manta.com', 'superpages.com', 'citysearch.com',
        'local.com', 'foursquare.com', 'tripadvisor.com', 'angieslist.com',
        'homeadvisor.com', 'thumbtack.com', 'nextdoor.com', 'alignable.com'
      ];

      if (contacts.length > 0) {
        contacts.forEach(contact => {
          if (contact.phone && contact.phone.length > 0) {
            phone = contact.phone[0].value || '';
          }
          if (contact.www && contact.www.length > 0) {
            const rawWebsite = contact.www[0].value || '';
            // Only use website if it's not a junk directory site
            const isJunk = junkDomains.some(junk => rawWebsite.toLowerCase().includes(junk));
            if (!isJunk) {
              website = rawWebsite;
            }
          }
          if (contact.email && contact.email.length > 0) {
            email = contact.email[0].value || '';
          }
        });
      }

      // Get primary category
      const primaryCategory = place.categories?.[0]?.name || category || '';

      // Truncate ZIP to 5 digits (remove ZIP+4 suffix)
      // IMPORTANT: Don't fall back to searchedZipCode - if HERE doesn't have the ZIP, exclude it
      const rawZip = address.postalCode || '';
      const zip5 = rawZip ? rawZip.substring(0, 5) : '';

      return {
        placeId: place.id || `here_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: place.title || '',
        address: address.street || address.label || '',
        fullAddress: address.label || '',
        city: address.city || '',
        state: address.state || address.stateCode || '',
        zip: zip5,
        zipCode: zip5,
        phone: phone,
        website: website,
        email: email,
        rating: 0,
        reviewCount: 0,
        categories: primaryCategory,
        lat: place.position?.lat || 0,
        lng: place.position?.lng || 0,
        isClosed: false,
        source: 'here',
        searchedZipCode: zipCode.substring(0, 5),
        category: category
      };
    });

    const searchedZip5 = zipCode.substring(0, 5);
    const searchedZipPrefix = searchedZip5.substring(0, 3); // First 3 digits = regional area

    // Get the state from the geocoded location for validation
    const searchedState = location.address?.stateCode || location.address?.state || '';

    let filtered;
    if (radiusSearch) {
      // Radius search: include all businesses near coordinates (they're geographically close)
      filtered = businesses.map(biz => ({
        ...biz,
        searchedZipCode: searchedZip5,
        actualZip: biz.zip || searchedZip5
      }));
      console.log(`✅ Returning ${filtered.length} businesses (radius search around ${searchedZip5})`);
    } else {
      // Regular search: smart ZIP filtering
      // 1. Trust businesses with no ZIP (they're geographically close to coordinates)
      // 2. Accept exact ZIP matches
      // 3. Reject clearly wrong ZIPs (different region/state)
      filtered = businesses.filter(biz => {
        // No ZIP? Trust it - HERE found it near our coordinates
        if (!biz.zip) return true;

        // Exact match? Keep it
        if (biz.zip === searchedZip5) return true;

        // Check if ZIP is in same regional area (first 3 digits match)
        const bizZipPrefix = biz.zip.substring(0, 3);
        if (bizZipPrefix === searchedZipPrefix) return true;

        // Check if state matches (catches cross-state errors)
        if (searchedState && biz.state) {
          const bizStateUpper = biz.state.toUpperCase();
          const searchedStateUpper = searchedState.toUpperCase();
          // If states don't match, reject
          if (bizStateUpper !== searchedStateUpper &&
              bizStateUpper.length === 2 && searchedStateUpper.length === 2) {
            return false;
          }
        }

        // ZIP exists but doesn't match region - reject
        return false;
      }).map(biz => ({
        ...biz,
        // Assign searched ZIP to businesses without one
        zip: biz.zip || searchedZip5,
        zipCode: biz.zipCode || searchedZip5,
        searchedZipCode: searchedZip5
      }));

      console.log(`✅ Returning ${filtered.length} businesses (smart filter for ${searchedZip5}, state: ${searchedState})`);
    }

    return res.status(200).json({
      businesses: filtered,
      total: filtered.length,
      source: 'here',
      query: `${searchQuery} near ${zipCode}`,
      cost: 0
    });

  } catch (error) {
    console.error('❌ HERE search error:', error);
    return res.status(500).json({
      error: 'Search failed',
      message: error.message
    });
  }
}
