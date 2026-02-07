/**
 * Scrapingdog GWS (General Web Scraping) Test
 * Uses rotating proxy at 1 credit per request vs 5-10 for SERP API
 */

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const query = req.body?.query || req.query?.query || 'Adams Heating Buffalo NY official website';
  const businessName = req.body?.businessName || req.query?.businessName || 'Adams Heating';

  const SCRAPINGDOG_API_KEY = process.env.SCRAPINGDOG_API_KEY;

  if (!SCRAPINGDOG_API_KEY) {
    return res.status(200).json({ error: 'API key not configured' });
  }

  try {
    const startTime = Date.now();

    // Test different search engines with GWS (1 credit each)
    // Google is blocked, but DuckDuckGo/Bing might work
    const engine = req.query?.engine || req.body?.engine || 'duckduckgo';

    let searchUrl;
    if (engine === 'duckduckgo') {
      searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    } else if (engine === 'bing') {
      searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
    } else if (engine === 'yahoo') {
      searchUrl = `https://search.yahoo.com/search?p=${encodeURIComponent(query)}`;
    } else {
      searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=10`;
    }

    const useDynamic = req.query?.dynamic === 'true' || req.body?.dynamic === true;
    const apiUrl = `https://api.scrapingdog.com/scrape?api_key=${SCRAPINGDOG_API_KEY}&url=${encodeURIComponent(searchUrl)}&dynamic=${useDynamic}`;

    console.log(`🐕 GWS scraping Google for: "${query}"`);

    const response = await fetch(apiUrl);
    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(200).json({
        success: false,
        error: `Scrapingdog GWS error: ${response.status}`,
        errorDetails: errorText.slice(0, 500),
        responseTime
      });
    }

    const html = await response.text();

    // Parse URLs based on search engine
    let allUrls = [];

    if (engine === 'bing') {
      // Bing encodes URLs in tracking links: /ck/a?...&u=a1BASE64ENCODED
      // The real URL is base64 encoded after "a1" prefix
      const bingMatches = html.match(/&amp;u=a1([^&"]+)/g) || [];
      for (const match of bingMatches) {
        try {
          const encoded = match.replace('&amp;u=a1', '');
          const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
          if (decoded.startsWith('http')) {
            allUrls.push(decoded);
          }
        } catch {
          // Skip invalid base64
        }
      }

      // Also look for cite tags (Bing shows URLs in <cite> elements)
      const citeMatches = html.match(/<cite[^>]*>([^<]+)<\/cite>/g) || [];
      for (const match of citeMatches) {
        const url = match.replace(/<\/?cite[^>]*>/g, '').trim();
        if (url.includes('.') && !url.includes(' ')) {
          allUrls.push(url.startsWith('http') ? url : 'https://' + url);
        }
      }
    } else if (engine === 'duckduckgo') {
      // DuckDuckGo HTML version: look for result links
      // Format: <a rel="nofollow" class="result__a" href="URL">
      const ddgMatches = html.match(/class="result__a"[^>]*href="([^"]+)"/g) || [];
      for (const match of ddgMatches) {
        const urlMatch = match.match(/href="([^"]+)"/);
        if (urlMatch && urlMatch[1]) {
          let url = urlMatch[1];
          // DuckDuckGo sometimes wraps URLs
          if (url.includes('uddg=')) {
            const uddg = url.match(/uddg=([^&]+)/);
            if (uddg) url = decodeURIComponent(uddg[1]);
          }
          if (url.startsWith('http')) {
            allUrls.push(url);
          }
        }
      }

      // Also check for snippet URLs
      const snippetUrls = html.match(/class="result__url"[^>]*href="([^"]+)"/g) || [];
      for (const match of snippetUrls) {
        const urlMatch = match.match(/href="([^"]+)"/);
        if (urlMatch && urlMatch[1].startsWith('http')) {
          allUrls.push(urlMatch[1]);
        }
      }
    } else {
      // Google (blocked) or other
      const urlMatches = html.match(/\/url\?q=([^&"]+)/g) || [];
      for (const match of urlMatches) {
        try {
          const url = decodeURIComponent(match.replace('/url?q=', ''));
          if (url.startsWith('http')) allUrls.push(url);
        } catch {}
      }
    }

    // Also try generic direct links as fallback
    const directLinks = html.match(/href="(https?:\/\/[^"]+)"/g) || [];
    for (const match of directLinks) {
      const url = match.replace('href="', '').replace('"', '');
      if (!url.includes('google.com') && !url.includes('gstatic.com') &&
          !url.includes('bing.com') && !url.includes('duckduckgo.com')) {
        allUrls.push(url);
      }
    }

    allUrls = [...new Set(allUrls)];

    // Filter out junk domains (same as other APIs)
    const skipDomains = [
      'yelp.com', 'yellowpages.com', 'bbb.org', 'tripadvisor.com',
      'facebook.com', 'instagram.com', 'twitter.com', 'youtube.com',
      'linkedin.com', 'pinterest.com', 'reddit.com',
      'mapquest.com', 'manta.com', 'foursquare.com',
      'wikipedia.org', 'google.com', 'gstatic.com', 'googleapis.com'
    ];

    const filteredUrls = allUrls.filter(url => {
      const urlLower = url.toLowerCase();
      return !skipDomains.some(domain => urlLower.includes(domain));
    });

    // Find best match for business
    let website = null;
    if (businessName) {
      const bizWords = businessName.toLowerCase().split(/\s+/).filter(w => w.length > 2);

      for (const url of filteredUrls) {
        try {
          const hostname = new URL(url).hostname.toLowerCase().replace('www.', '');
          const domainMatch = bizWords.some(word => hostname.includes(word));
          if (domainMatch) {
            website = url;
            break;
          }
        } catch {
          continue;
        }
      }

      // If no domain match, take first filtered URL
      if (!website && filteredUrls.length > 0) {
        website = filteredUrls[0];
      }
    } else {
      website = filteredUrls[0] || null;
    }

    return res.status(200).json({
      success: true,
      source: 'scrapingdog-gws',
      engine,
      creditsUsed: useDynamic ? 5 : 1,
      dynamic: useDynamic,
      query,
      website,
      responseTime,
      urlsFound: allUrls.length,
      filteredUrls: filteredUrls.slice(0, 5),
      htmlLength: html.length,
      htmlPreview: html.slice(0, 500)
    });

  } catch (error) {
    console.error('GWS test error:', error);
    return res.status(200).json({
      success: false,
      error: error.message
    });
  }
}
