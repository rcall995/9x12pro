// Vercel Serverless Function - Find neighboring ZIP codes
// Uses the Zippopotam.us API (free, no key required) to get ZIP info
// Then calculates nearby ZIPs based on geographic proximity

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { zipCode } = req.body;

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

    // Generate potential nearby ZIP codes by trying adjacent numbers
    // This is a simple heuristic - ZIPs near each other often have similar numbers
    const baseZip = parseInt(zipCode);
    const potentialZips = new Set();

    // Add ZIPs within +/- 20 of the base ZIP
    for (let offset = -20; offset <= 20; offset++) {
      const nearbyZip = (baseZip + offset).toString().padStart(5, '0');
      if (nearbyZip !== zipCode && nearbyZip.length === 5 && parseInt(nearbyZip) > 0) {
        potentialZips.add(nearbyZip);
      }
    }

    // Check each potential ZIP and calculate distance
    const neighbors = [];
    const checkedZips = Array.from(potentialZips).slice(0, 30); // Limit API calls

    for (const testZip of checkedZips) {
      try {
        const testResponse = await fetch(`https://api.zippopotam.us/us/${testZip}`);
        if (testResponse.ok) {
          const testData = await testResponse.json();
          const testPlace = testData.places?.[0];

          if (testPlace) {
            const testLat = parseFloat(testPlace.latitude);
            const testLng = parseFloat(testPlace.longitude);

            // Calculate distance in miles using Haversine formula
            const distance = calculateDistance(centerLat, centerLng, testLat, testLng);

            // Only include ZIPs within 15 miles
            if (distance <= 15) {
              neighbors.push({
                zipCode: testZip,
                city: testPlace['place name'],
                state: testPlace['state abbreviation'],
                distance: Math.round(distance * 10) / 10
              });
            }
          }
        }
      } catch (e) {
        // Skip invalid ZIPs
      }
    }

    // Sort by distance and return top 5
    neighbors.sort((a, b) => a.distance - b.distance);
    const topNeighbors = neighbors.slice(0, 5);

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
