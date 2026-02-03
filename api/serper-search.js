// Serper.dev Search API - 2,500 FREE searches/month
// Fast Google search results without scraping
// https://serper.dev
// v2 - Enhanced filtering for business websites

/**
 * Check if a URL/domain could plausibly belong to the business
 * Returns true if it looks related, false if clearly unrelated
 */
function isPlausiblyRelated(url, businessName) {
  if (!businessName) return true; // Can't validate without name

  try {
    const hostname = new URL(url).hostname.toLowerCase();
    const bizName = businessName.toLowerCase()
      .replace(/[^a-z0-9]/g, '') // Remove non-alphanumeric
      .replace(/llc|inc|corp|company|co|ltd/g, ''); // Remove business suffixes

    // Extract meaningful words from business name (ignore short words)
    const bizWords = businessName.toLowerCase().split(/\s+/).filter(w => w.length > 2);

    // Check if domain contains any significant business name words
    const domainWithoutTLD = hostname.replace(/\.(com|net|org|biz|us|io|co)$/, '');

    // If domain contains a significant word from business name, it's likely related
    for (const word of bizWords) {
      if (domainWithoutTLD.includes(word)) return true;
    }

    // If the full condensed business name is in the domain
    if (domainWithoutTLD.includes(bizName.substring(0, 6))) return true;

    // Check if title/snippet mentions the business (passed through result object)
    // For now, just be permissive for short business names
    if (bizName.length < 6) return true;

    return false;
  } catch {
    return true; // If URL parsing fails, be permissive
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query, businessName } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Query required' });
  }

  const SERPER_API_KEY = process.env.SERPER_API_KEY;

  if (!SERPER_API_KEY) {
    console.log('⚠️ Serper API key not configured, falling back to Google');
    return fallbackToGoogle(req, res, query, businessName);
  }

  try {
    console.log(`🔍 Serper search: "${query}"`);

    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: query,
        num: 10
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Serper API error:', response.status, errorText);

      // If quota exceeded or error, fall back to Google
      if (response.status === 429 || response.status === 403) {
        console.log('🔍 Serper quota/auth issue, falling back to Google');
        return fallbackToGoogle(req, res, query, businessName);
      }

      throw new Error(`Serper returned ${response.status}`);
    }

    const data = await response.json();
    const organic = data.organic || [];

    if (organic.length === 0) {
      return res.status(200).json({
        success: true,
        source: 'serper',
        query,
        results: [],
        topUrl: null
      });
    }

    // Filter out directory sites and bad results
    let topUrl = null;

    // Skip patterns for all searches
    const skipDomains = [
      // Directories and review sites
      'yelp.com', 'yellowpages.com', 'bbb.org', 'tripadvisor.com',
      'foursquare.com', 'mapquest.com', 'manta.com', 'chamberofcommerce.com',
      'bizapedia.com', 'dnb.com', 'zoominfo.com', 'angi.com', 'thumbtack.com',
      'nextdoor.com', 'linkedin.com/posts', 'twitter.com/search',
      'hotfrog.com', 'cylex.us', 'brownbook.net', 'spoke.com', 'merchantcircle.com',
      'superpages.com', 'local.com', 'citysearch.com', 'kudzu.com', 'dexknows.com',
      'whitepages.com', 'porch.com', 'homeadvisor.com', 'expertise.com',
      'buildzoom.com', 'alignable.com', 'getfave.com', 'showmelocal.com',
      'dandb.com', 'buzzfile.com', 'chamberorganizer.com', 'findglocal.com',

      // News and media sites (comprehensive list)
      'wnypapers.com', 'newspapers.com', 'news.google.com', 'patch.com',
      'buffalonews.com', 'wivb.com', 'wgrz.com', 'wkbw.com',
      'cnn.com', 'foxnews.com', 'nbcnews.com', 'abcnews.go.com', 'cbsnews.com',
      'nytimes.com', 'washingtonpost.com', 'usatoday.com', 'reuters.com',
      'apnews.com', 'newsweek.com', 'usnews.com', 'thehill.com', 'politico.com',
      'huffpost.com', 'buzzfeed.com', 'vox.com', 'vice.com', 'slate.com',
      'msn.com', 'yahoo.com/news', 'aol.com', 'news.yahoo.com',
      // Local news patterns
      'localnews', 'gazette', 'tribune', 'herald', 'times', 'journal', 'press',
      'dispatch', 'register', 'sentinel', 'observer', 'examiner', 'chronicle',
      'democrat', 'republican', 'post', 'courier', 'daily', 'weekly',

      // Government and education
      '.gov', '.edu',

      // Search engines
      'google.com', 'bing.com', 'duckduckgo.com', 'ask.com'
    ];

    // Skip file extensions that aren't websites
    const skipExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.jpg', '.jpeg', '.png', '.gif', '.mp4', '.mp3', '.wav', '.zip', '.rar'];

    // Skip URL patterns that look like news articles (dates, article paths)
    const skipUrlPatterns = [
      /\/\d{4}\/\d{2}\//, // Date patterns like /2024/06/
      /\/news\//i,
      /\/article\//i,
      /\/story\//i,
      /\/stories\//i,
      /\/blog\//i,
      /\/press-release/i,
      /\/press\//i,
      /\/media\//i,
      /\/archive\//i,
      /-\d{6,}/, // Long numeric IDs typical of articles
      /\.html\?/, // HTML with query params (usually articles)
      /\/tag\//i,
      /\/category\//i,
      /\/author\//i,
      /\/search\?/i,
      /issuu\.com/,
      /scribd\.com/
    ];

    // For Facebook searches, ONLY accept business page URLs (reject everything else)
    const isFacebookSearch = query.includes('site:facebook.com');
    // Skip these patterns - they're not business pages
    const fbSkipPatterns = ['/groups/', '/share.php', '/events/', '/marketplace/', '/watch/', '/posts/', '/photos/', '/videos/', '/story.php', '/permalink.php', '/notes/'];

    // For Instagram searches, ONLY accept profile URLs (reject posts/reels)
    const isInstagramSearch = query.includes('site:instagram.com');
    // Skip these patterns - they're posts, not profiles
    const igSkipPatterns = ['/p/', '/reel/', '/reels/', '/stories/', '/tv/', '/explore/', '/s/', '/live/'];

    for (const result of organic) {
      const url = result.link || '';
      const urlLower = url.toLowerCase();

      // Skip directory sites
      if (skipDomains.some(domain => urlLower.includes(domain))) continue;

      // Skip PDFs and other non-website files
      if (skipExtensions.some(ext => urlLower.endsWith(ext))) continue;

      // For Facebook: validate it's a real business page URL AND related to the business
      if (isFacebookSearch) {
        // Skip bad patterns
        if (fbSkipPatterns.some(p => url.includes(p))) continue;
        // Skip personal profiles
        if (url.includes('profile.php')) continue;
        // Must be a simple page URL like facebook.com/businessname
        // Valid: facebook.com/adamshvac or facebook.com/Adams-Heating-123456
        const fbMatch = url.match(/facebook\.com\/([^\/\?]+)\/?$/);
        if (!fbMatch || !fbMatch[1]) continue;
        // Skip if the "page name" is a generic word
        const fbPageName = fbMatch[1].toLowerCase();
        if (['home', 'watch', 'marketplace', 'gaming', 'login', 'help'].includes(fbPageName)) continue;

        // IMPORTANT: Verify the page name is related to the business name
        // This prevents returning unrelated pages like "DavidCrisafulliMP" for "Wheelfind Auto"
        if (businessName) {
          const bizWords = businessName.toLowerCase().split(/\s+/).filter(w => w.length > 2);
          const pageNameLower = fbPageName.replace(/[-_]/g, '').toLowerCase();
          const hasMatch = bizWords.some(word => pageNameLower.includes(word));
          if (!hasMatch) {
            console.log(`🔍 Skipping unrelated FB page "${fbPageName}" for "${businessName}"`);
            continue;
          }
        }

        // This looks like a valid business page
        topUrl = url;
        break;
      }

      // For Instagram: validate it's a profile URL, not a post, AND related to business
      if (isInstagramSearch) {
        let igUsername = null;

        if (igSkipPatterns.some(p => url.includes(p))) {
          // Try to extract profile from post URL
          const match = url.match(/instagram\.com\/([^\/\?]+)/);
          if (match && match[1] && !['p', 'reel', 'reels', 'stories', 'tv', 'explore', 's', 'live', 'accounts'].includes(match[1])) {
            igUsername = match[1];
          } else {
            continue;
          }
        } else {
          // Validate it's a profile URL (instagram.com/username with no extra path)
          const igMatch = url.match(/instagram\.com\/([^\/\?]+)\/?$/);
          if (igMatch && igMatch[1] && !['p', 'reel', 'reels', 'stories', 'tv', 'explore', 's', 'live', 'accounts'].includes(igMatch[1].toLowerCase())) {
            igUsername = igMatch[1];
          } else {
            continue;
          }
        }

        // IMPORTANT: Verify the username is related to the business name
        if (igUsername && businessName) {
          const bizWords = businessName.toLowerCase().split(/\s+/).filter(w => w.length > 2);
          const usernameLower = igUsername.replace(/[-_\.]/g, '').toLowerCase();
          const hasMatch = bizWords.some(word => usernameLower.includes(word));
          if (!hasMatch) {
            console.log(`🔍 Skipping unrelated IG profile "${igUsername}" for "${businessName}"`);
            continue;
          }
        }

        if (igUsername) {
          topUrl = `https://www.instagram.com/${igUsername}`;
          break;
        }
        continue;
      }

      // For website searches: additional validation
      if (url) {
        // Skip URLs that look like news articles or blog posts
        const isArticle = skipUrlPatterns.some(pattern => pattern.test(url));
        if (isArticle) {
          console.log(`🔍 Skipping article-like URL: ${url}`);
          continue;
        }

        // Prefer simpler URLs (likely homepages) - count path segments
        try {
          const parsedUrl = new URL(url);
          const pathname = parsedUrl.pathname;
          const pathSegments = pathname.split('/').filter(s => s.length > 0);

          // URLs with many path segments are usually articles, not business homepages
          // Business homepages are typically domain.com/ or domain.com/page
          if (pathSegments.length > 3) {
            console.log(`🔍 Skipping deeply nested URL (${pathSegments.length} segments): ${url}`);
            continue;
          }

          // IMPORTANT: For website searches, verify domain relates to business name
          // This prevents returning random websites that just mention the business
          if (businessName) {
            const hostname = parsedUrl.hostname.toLowerCase().replace('www.', '');
            const domainBase = hostname.split('.')[0]; // e.g., "wheelfindauto" from "wheelfindauto.com"
            const bizWords = businessName.toLowerCase().split(/\s+/).filter(w => w.length > 2);

            // Check if domain contains any business name word
            const domainMatchesBiz = bizWords.some(word => domainBase.includes(word));

            // Also check if result title/snippet contains business name (from search result)
            const resultTitle = (result.title || '').toLowerCase();
            const titleMatchesBiz = bizWords.some(word => resultTitle.includes(word));

            if (!domainMatchesBiz && !titleMatchesBiz) {
              console.log(`🔍 Skipping unrelated website "${hostname}" for "${businessName}"`);
              continue;
            }
          }
        } catch (e) {
          continue; // Invalid URL
        }

        // This looks like a valid business website
        topUrl = url;
        break;
      }
    }

    // If no good result found, return null rather than bad data
    if (!topUrl) {
      topUrl = null;
    }

    console.log(`🔍 Serper found ${organic.length} results, top: ${topUrl}`);

    return res.status(200).json({
      success: true,
      source: 'serper',
      query,
      results: organic.slice(0, 5).map(r => ({
        title: r.title,
        url: r.link,
        description: r.snippet
      })),
      topUrl
    });

  } catch (error) {
    console.error('🔍 Serper search error:', error);
    return fallbackToGoogle(req, res, query, businessName);
  }
}

// Fallback to Google Custom Search (100/day free)
async function fallbackToGoogle(req, res, query, businessName) {
  try {
    const GOOGLE_API_KEY = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
    const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID;

    if (!GOOGLE_API_KEY || !GOOGLE_CSE_ID) {
      console.log('⚠️ Google Custom Search not configured either');
      return res.status(200).json({
        success: false,
        query,
        error: 'No search API configured',
        results: [],
        topUrl: null
      });
    }

    console.log('🔍 Using Google Custom Search fallback...');

    const googleUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CSE_ID}&q=${encodeURIComponent(query)}&num=10`;
    const googleResponse = await fetch(googleUrl);

    if (!googleResponse.ok) {
      throw new Error(`Google API error: ${googleResponse.status}`);
    }

    const googleData = await googleResponse.json();
    const items = googleData.items || [];

    if (items.length === 0) {
      return res.status(200).json({
        success: true,
        source: 'google',
        query,
        results: [],
        topUrl: null
      });
    }

    // Enhanced filtering (same as Serper path)
    let topUrl = null;

    // Skip patterns - reuse similar logic to Serper
    const skipDomains = [
      'yelp.com', 'yellowpages.com', 'bbb.org', 'tripadvisor.com',
      'foursquare.com', 'mapquest.com', 'manta.com', 'chamberofcommerce.com',
      'bizapedia.com', 'dnb.com', 'zoominfo.com', 'angi.com', 'thumbtack.com',
      'nextdoor.com', 'linkedin.com/posts', 'twitter.com/search',
      'hotfrog.com', 'cylex.us', 'brownbook.net', 'superpages.com',
      'wnypapers.com', 'newspapers.com', 'news.google.com', 'patch.com',
      '.gov', '.edu', 'google.com', 'bing.com'
    ];

    const skipExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.jpg', '.png', '.gif'];

    const skipUrlPatterns = [
      /\/\d{4}\/\d{2}\//,
      /\/news\//i,
      /\/article\//i,
      /\/story\//i,
      /\/blog\//i,
      /\/press/i,
      /-\d{6,}/
    ];

    for (const item of items) {
      const url = item.link || '';
      const urlLower = url.toLowerCase();

      // Skip directories and news sites
      if (skipDomains.some(domain => urlLower.includes(domain))) continue;

      // Skip files
      if (skipExtensions.some(ext => urlLower.endsWith(ext))) continue;

      // Skip article-like URLs
      if (skipUrlPatterns.some(pattern => pattern.test(url))) continue;

      // Skip deeply nested URLs
      try {
        const pathname = new URL(url).pathname;
        const pathSegments = pathname.split('/').filter(s => s.length > 0);
        if (pathSegments.length > 3) continue;
      } catch {
        continue;
      }

      // This looks valid
      topUrl = url;
      break;
    }

    console.log(`🔍 Google fallback found: ${topUrl || 'none (all filtered)'}`);

    return res.status(200).json({
      success: true,
      source: 'google',
      query,
      results: items.slice(0, 5).map(item => ({
        title: item.title,
        url: item.link,
        description: item.snippet
      })),
      topUrl
    });

  } catch (error) {
    console.error('🔍 Google fallback error:', error);
    return res.status(200).json({
      success: false,
      query,
      error: error.message,
      results: [],
      topUrl: null
    });
  }
}
