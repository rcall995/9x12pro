/**
 * Website Validation API
 * Checks if a website URL is valid and belongs to the business
 * - URL loads (not 404/500)
 * - Business name appears on page
 * - Not a directory/social media page
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { website, businessName } = req.body;

  if (!website) {
    return res.status(400).json({ error: 'Website required' });
  }

  try {
    const result = await validateWebsite(website, businessName);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Website validation error:', error);
    return res.status(200).json({
      website,
      valid: false,
      error: error.message
    });
  }
}

async function validateWebsite(website, businessName) {
  const checks = {
    urlFormat: false,
    loads: false,
    businessNameFound: false,
    notDirectory: false,
    hasHttps: false
  };

  // Normalize URL
  let url = website.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  // 1. URL format check
  try {
    new URL(url);
    checks.urlFormat = true;
  } catch {
    return {
      website,
      valid: false,
      score: 0,
      checks,
      reason: 'Invalid URL format'
    };
  }

  // 2. HTTPS check
  checks.hasHttps = url.startsWith('https://');

  // 3. Directory/social check
  const directoryDomains = [
    'facebook.com', 'yelp.com', 'yellowpages.com', 'bbb.org',
    'tripadvisor.com', 'mapquest.com', 'linkedin.com', 'twitter.com',
    'instagram.com', 'tiktok.com', 'youtube.com', 'pinterest.com',
    'foursquare.com', 'manta.com', 'angi.com', 'thumbtack.com',
    'nextdoor.com', 'google.com/maps'
  ];

  const urlLower = url.toLowerCase();
  checks.notDirectory = !directoryDomains.some(d => urlLower.includes(d));

  if (!checks.notDirectory) {
    return {
      website,
      url,
      valid: false,
      score: 20,
      checks,
      reason: 'Directory/social media page - not a real business website'
    };
  }

  // 4. Try to load the page
  let pageContent = '';
  let statusCode = 0;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      redirect: 'follow'
    });

    clearTimeout(timeout);
    statusCode = response.status;
    checks.loads = response.ok;

    if (response.ok) {
      pageContent = await response.text();
    }
  } catch (e) {
    checks.loads = false;
    return {
      website,
      url,
      valid: false,
      score: 25,
      checks,
      statusCode,
      reason: `Website failed to load: ${e.message}`
    };
  }

  // 5. Check if business name appears on page
  if (businessName && pageContent) {
    const pageLower = pageContent.toLowerCase();
    const bizWords = businessName.toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 2 && !['the', 'and', 'inc', 'llc', 'corp'].includes(w));

    // Check if any significant word from business name appears
    const matchedWords = bizWords.filter(word => pageLower.includes(word));
    checks.businessNameFound = matchedWords.length >= Math.min(2, bizWords.length);

    // Also check title tag
    const titleMatch = pageContent.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (titleMatch) {
      const title = titleMatch[1].toLowerCase();
      const titleMatches = bizWords.filter(word => title.includes(word));
      if (titleMatches.length > 0) {
        checks.businessNameFound = true;
      }
    }
  } else {
    // Can't verify without business name
    checks.businessNameFound = null;
  }

  // Calculate score
  let score = 0;
  if (checks.urlFormat) score += 15;
  if (checks.loads) score += 30;
  if (checks.notDirectory) score += 20;
  if (checks.hasHttps) score += 10;
  if (checks.businessNameFound) score += 25;
  if (checks.businessNameFound === null) score += 10; // Partial credit if can't verify

  const valid = checks.urlFormat && checks.loads && checks.notDirectory;

  return {
    website,
    url,
    valid,
    score,
    checks,
    statusCode,
    businessNameFound: checks.businessNameFound,
    reason: valid ?
      (score >= 80 ? 'Verified business website' :
       score >= 60 ? 'Website loads but business name not confirmed' :
       'Website loads') :
      (!checks.loads ? 'Website not loading' : 'Invalid website')
  };
}
