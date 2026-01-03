// Vercel Serverless Function - Outscraper Business Search
// Replaces Yelp API - searches Google Maps for businesses by ZIP + category
// Returns: name, address, phone, website, email, Facebook, Instagram
// Docs: https://app.outscraper.com/api-docs#tag/Google-Maps

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { zipCode, category, limit = 20 } = req.body;

  if (!zipCode) {
    return res.status(400).json({ error: 'zipCode parameter required' });
  }

  const OUTSCRAPER_API_KEY = process.env.OUTSCRAPER_API_KEY;

  if (!OUTSCRAPER_API_KEY) {
    return res.status(500).json({
      error: 'Outscraper API key not configured',
      message: 'Please add OUTSCRAPER_API_KEY to Vercel environment variables'
    });
  }

  try {
    // Build search query: "category near ZIP" or just "businesses in ZIP"
    const searchQuery = category
      ? `${category} ${zipCode}`
      : `businesses ${zipCode}`;

    // Outscraper Google Maps Search API
    // Using search-v3 with enrichment to get emails and social media
    // Fields: name, address, phone, website, emails, social links
    const params = new URLSearchParams({
      query: searchQuery,
      limit: Math.min(limit, 50), // Max 50 per request
      language: 'en',
      region: 'us',
      async: 'false', // Wait for results (sync mode)
      fields: [
        'name',
        'full_address',
        'phone',
        'site',
        'email',
        'facebook',
        'instagram',
        'rating',
        'reviews',
        'place_id',
        'latitude',
        'longitude',
        'business_status',
        'type',
        'postal_code'
      ].join(',')
    });

    // Add enrichments to get emails from websites
    const url = `https://api.app.outscraper.com/maps/search-v3?${params.toString()}&enrichments=["domains_service"]`;

    console.log('🔍 Outscraper search:', searchQuery);
    console.log('🔗 API URL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-API-KEY': OUTSCRAPER_API_KEY,
        'Accept': 'application/json'
      }
    });

    console.log('📡 Outscraper response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Outscraper API error:', errorText);

      // Parse error for better messaging
      let errorMessage = 'Outscraper API request failed';
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorJson.message || errorMessage;
      } catch (e) {}

      return res.status(response.status).json({
        error: errorMessage,
        details: errorText,
        status: response.status
      });
    }

    const data = await response.json();
    console.log('📦 Outscraper raw response type:', typeof data);
    console.log('📦 Outscraper data keys:', Object.keys(data || {}));

    // Handle async response (task pending)
    if (data.status === 'Pending' && data.results_location) {
      console.log('⏳ Task pending, polling for results...');

      // Poll for results (max 5 attempts, 3 seconds each)
      for (let attempt = 1; attempt <= 5; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 3000));

        console.log(`🔄 Poll attempt ${attempt}/5...`);

        const pollResponse = await fetch(data.results_location, {
          headers: {
            'X-API-KEY': OUTSCRAPER_API_KEY,
            'Accept': 'application/json'
          }
        });

        if (pollResponse.ok) {
          const pollData = await pollResponse.json();

          if (pollData.status === 'Success' && pollData.data) {
            console.log('✅ Got results from polling');
            return processAndReturnResults(pollData.data, zipCode, category, res);
          }
        }
      }

      // Timeout
      console.log('⏱️ Polling timeout');
      return res.status(200).json({
        businesses: [],
        total: 0,
        source: 'outscraper',
        error: 'Search timed out, please try again'
      });
    }

    // Handle direct response (sync mode worked)
    if (data.data) {
      return processAndReturnResults(data.data, zipCode, category, res);
    }

    // Handle array response (sometimes Outscraper returns array directly)
    if (Array.isArray(data)) {
      return processAndReturnResults(data, zipCode, category, res);
    }

    // No data found
    console.log('📭 No businesses found');
    return res.status(200).json({
      businesses: [],
      total: 0,
      source: 'outscraper',
      query: searchQuery
    });

  } catch (error) {
    console.error('❌ Outscraper search error:', error);
    return res.status(500).json({
      error: 'Search failed',
      message: error.message
    });
  }
}

// Process Outscraper results and return formatted businesses
function processAndReturnResults(rawData, zipCode, category, res) {
  try {
    // Outscraper returns nested array: [[{business1}, {business2}]]
    let businesses = [];

    if (Array.isArray(rawData)) {
      if (Array.isArray(rawData[0])) {
        // Nested array format
        businesses = rawData[0];
      } else if (rawData[0] && typeof rawData[0] === 'object') {
        // Flat array format
        businesses = rawData;
      }
    }

    console.log(`📊 Processing ${businesses.length} raw businesses`);

    // Debug: Log first business to see actual field names
    if (businesses.length > 0) {
      console.log('🔍 Sample business fields:', Object.keys(businesses[0]));
      console.log('🔍 Sample business data:', JSON.stringify(businesses[0], null, 2).substring(0, 1000));
    }

    // Filter to exact ZIP matches
    const zipFiltered = businesses.filter(biz => {
      const bizZip = (biz.postal_code || '').toString().trim().substring(0, 5);
      const searchZip = zipCode.toString().trim().substring(0, 5);
      return bizZip === searchZip;
    });

    console.log(`📍 Filtered to ${zipFiltered.length} businesses in ZIP ${zipCode}`);

    // Transform to our format
    // Note: Outscraper field names: emails (array), facebook_url, instagram_url
    const transformed = zipFiltered.map(biz => {
      // Extract email from various possible field names
      const email = extractEmail(biz.emails || biz.email);
      const website = biz.site || biz.website || '';
      const facebook = biz.facebook_url || biz.facebook || '';
      const instagram = biz.instagram_url || biz.instagram || '';

      return {
        placeId: biz.place_id || `outscraper_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: biz.name || '',
        address: extractStreetAddress(biz.full_address),
        fullAddress: biz.full_address || '',
        city: extractCity(biz.full_address),
        state: extractState(biz.full_address),
        zip: biz.postal_code || zipCode,
        zipCode: biz.postal_code || zipCode,
        phone: formatPhone(biz.phone),
        website: website,
        email: email,
        facebook: facebook,
        instagram: instagram,
        rating: biz.rating || 0,
        reviewCount: biz.reviews || 0,
        categories: biz.type || category,
        lat: biz.latitude || 0,
        lng: biz.longitude || 0,
        isClosed: biz.business_status === 'CLOSED_PERMANENTLY',
        source: 'outscraper',
        searchedZipCode: zipCode,
        category: category,
        // Mark as enriched if we have email or social
        enriched: !!(email || facebook || instagram)
      };
    });

    console.log(`✅ Returning ${transformed.length} businesses with enrichment data`);

    // Log sample for debugging
    if (transformed.length > 0) {
      console.log('📋 Sample business:', JSON.stringify(transformed[0], null, 2));
    }

    return res.status(200).json({
      businesses: transformed,
      total: transformed.length,
      source: 'outscraper',
      query: `${category} ${zipCode}`,
      cost: Math.ceil(businesses.length / 25) // ~1 credit per 25 results
    });

  } catch (error) {
    console.error('Error processing results:', error);
    return res.status(200).json({
      businesses: [],
      total: 0,
      source: 'outscraper',
      error: 'Error processing results: ' + error.message
    });
  }
}

// Helper: Extract street address from full address
function extractStreetAddress(fullAddress) {
  if (!fullAddress) return '';
  // Full address format: "123 Main St, City, ST 12345, USA"
  const parts = fullAddress.split(',');
  return parts[0]?.trim() || fullAddress;
}

// Helper: Extract city from full address
function extractCity(fullAddress) {
  if (!fullAddress) return '';
  const parts = fullAddress.split(',');
  return parts[1]?.trim() || '';
}

// Helper: Extract state from full address
function extractState(fullAddress) {
  if (!fullAddress) return '';
  const parts = fullAddress.split(',');
  if (parts.length >= 3) {
    // "City, ST 12345" -> "ST"
    const stateZip = parts[2]?.trim() || '';
    const state = stateZip.split(' ')[0];
    return state.length === 2 ? state : '';
  }
  return '';
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

// Helper: Extract first valid email
function extractEmail(emailField) {
  if (!emailField) return '';

  // Could be string or array
  if (Array.isArray(emailField)) {
    return emailField[0] || '';
  }

  // Could be comma-separated
  if (typeof emailField === 'string') {
    const emails = emailField.split(',').map(e => e.trim());
    return emails[0] || '';
  }

  return '';
}
