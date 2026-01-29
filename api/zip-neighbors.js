// Vercel Serverless Function - Find neighboring ZIP codes
// Uses the Zippopotam.us API (free, no key required) to get ZIP info
// Then calculates nearby ZIPs based on geographic proximity

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { zipCode, radius = 20 } = req.body;
  const maxRadius = Math.min(Math.max(parseInt(radius) || 20, 1), 50); // Clamp between 1-50 miles

  if (!zipCode || !/^\d{5}$/.test(zipCode)) {
    return res.status(400).json({ error: 'Valid 5-digit ZIP code required' });
  }

  try {
    // Get info about the input ZIP code
    const response = await fetch(`https://api.zippopotam.us/us/${zipCode}`);

    if (!response.ok) {
      return res.status(404).json({
        error: 'ZIP code not found',
        zipCode: zipCode
      });
    }

    const data = await response.json();
    const place = data.places?.[0];

    if (!place) {
      return res.status(404).json({ error: 'ZIP code data not available' });
    }

    const centerLat = parseFloat(place.latitude);
    const centerLng = parseFloat(place.longitude);
    const city = place['place name'];
    const state = place['state abbreviation'];

    // Generate potential nearby ZIP codes using multiple strategies
    const baseZip = parseInt(zipCode);
    const prefix3 = zipCode.substring(0, 3); // First 3 digits (SCF - Sectional Center Facility)
    const potentialZips = new Set();

    // Strategy 1: All ZIPs with the same 3-digit prefix (00-99 suffix)
    for (let suffix = 0; suffix <= 99; suffix++) {
      const nearbyZip = prefix3 + suffix.toString().padStart(2, '0');
      if (nearbyZip !== zipCode) {
        potentialZips.add(nearbyZip);
      }
    }

    // Strategy 2: Adjacent 3-digit prefixes (e.g., if 140xx, also check 139xx and 141xx)
    const prefix3Num = parseInt(prefix3);
    for (const prefixOffset of [-1, 1]) {
      const adjacentPrefix = (prefix3Num + prefixOffset).toString().padStart(3, '0');
      if (adjacentPrefix.length === 3 && parseInt(adjacentPrefix) >= 0) {
        for (let suffix = 0; suffix <= 99; suffix++) {
          const nearbyZip = adjacentPrefix + suffix.toString().padStart(2, '0');
          potentialZips.add(nearbyZip);
        }
      }
    }

    // Strategy 3: ZIPs very close numerically (±50)
    for (let offset = -50; offset <= 50; offset++) {
      const nearbyZip = (baseZip + offset).toString().padStart(5, '0');
      if (nearbyZip !== zipCode && nearbyZip.length === 5 && parseInt(nearbyZip) > 0) {
        potentialZips.add(nearbyZip);
      }
    }

    // Check ZIPs in parallel (batch of concurrent requests)
    const allPotentialZips = Array.from(potentialZips);
    const neighbors = [];

    // Process in batches to avoid overwhelming the API
    const batchSize = 20;
    const maxBatches = 8; // Check up to 160 ZIPs

    for (let batchIndex = 0; batchIndex < maxBatches && neighbors.length < 20; batchIndex++) {
      const batchStart = batchIndex * batchSize;
      const batch = allPotentialZips.slice(batchStart, batchStart + batchSize);

      if (batch.length === 0) break;

      // Fetch all ZIPs in this batch concurrently
      const batchPromises = batch.map(async (testZip) => {
        try {
          const testResponse = await fetch(`https://api.zippopotam.us/us/${testZip}`);
          if (testResponse.ok) {
            const testData = await testResponse.json();
            const testPlace = testData.places?.[0];

            if (testPlace) {
              const testLat = parseFloat(testPlace.latitude);
              const testLng = parseFloat(testPlace.longitude);
              const distance = calculateDistance(centerLat, centerLng, testLat, testLng);

              // Only include ZIPs within specified radius
              if (distance <= maxRadius) {
                return {
                  zipCode: testZip,
                  city: testPlace['place name'],
                  state: testPlace['state abbreviation'],
                  distance: Math.round(distance * 10) / 10
                };
              }
            }
          }
        } catch (e) {
          // Skip invalid ZIPs
        }
        return null;
      });

      const batchResults = await Promise.all(batchPromises);

      // Add valid results to neighbors
      for (const result of batchResults) {
        if (result && !neighbors.some(n => n.zipCode === result.zipCode)) {
          neighbors.push(result);
        }
      }
    }

    // Sort by distance and return all within radius (up to 20)
    neighbors.sort((a, b) => a.distance - b.distance);
    const topNeighbors = neighbors.slice(0, 20);

    return res.status(200).json({
      centerZip: {
        zipCode: zipCode,
        city: city,
        state: state
      },
      neighbors: topNeighbors
    });

  } catch (error) {
    console.error('ZIP neighbor lookup error:', error);
    return res.status(500).json({
      error: 'Failed to lookup ZIP code',
      message: error.message
    });
  }
}

// Haversine formula to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}
