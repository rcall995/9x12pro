// Serper.dev Search API - 2,500 FREE searches/month
// Fast Google search results without scraping
// https://serper.dev
// v3 - Enhanced filtering + quota tracking

import { checkRateLimit } from './lib/rate-limit.js';
import { checkApiQuota, recordApiCall } from './lib/api-usage.js';

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

  // Rate limit: 100 requests per minute (supports bulk enrichment)
  const rateLimited = checkRateLimit(req, res, { limit: 100, window: 60, keyPrefix: 'serper' });
  if (rateLimited) {
    return res.status(rateLimited.status).json(rateLimited.body);
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

  // Check monthly quota before making API call
  const quota = await checkApiQuota('serper');
  if (!quota.allowed) {
    console.log(`🔍 Serper quota exceeded: ${quota.used}/${quota.limit} used, falling back to Google`);
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

    // Record successful API call
    await recordApiCall('serper');

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
      'yelp.com', 'yellowpages.com', 'bbb.org', 'tripadvisor.', // catches all TLDs
      'foursquare.com', 'mapquest.com', 'manta.com', 'chamberofcommerce.com',
      'bizapedia.com', 'dnb.com', 'zoominfo.com', 'angi.com', 'thumbtack.com',
      'nextdoor.com', 'linkedin.com/posts', 'twitter.com/search',
      'hotfrog.com', 'cylex.us', 'brownbook.net', 'spoke.com', 'merchantcircle.com',
      'superpages.com', 'local.com', 'citysearch.com', 'kudzu.com', 'dexknows.com',
      'whitepages.com', 'porch.com', 'homeadvisor.com', 'expertise.com',
      'buildzoom.com', 'alignable.com', 'getfave.com', 'showmelocal.com',
      'dandb.com', 'buzzfile.com', 'chamberorganizer.com', 'findglocal.com',

      // Menu aggregators (NOT business websites!)
      'menuweb.menu', 'zmenu.com', 'menupix.com', 'allmenus.com',
      'restaurantji.com', 'sirved.com', 'menuism.com', 'zomato.com',
      'wheree.com', 'restaurantguru.com', 'openmenu.com', 'locu.com',
      'singleplatform.com', 'yext.com', 'roadtrippers.com', 'menuvenue.com',
      'menufy.com', 'beyondmenu.com', 'clover.com/online-ordering', 'menulog.com',

      // Food delivery / ordering sites (NOT business websites!)
      'grubhub.com', 'doordash.com', 'ubereats.com', 'postmates.com',
      'seamless.com', 'eat24.com', 'delivery.com', 'slice.com',
      'menulog.com', 'justeat.com', 'caviar.com', 'favor.com',
      'toast.com', 'toasttab.com', 'chownow.com', 'olo.com',
      'order.online', 'ordering.app',

      // Vacation rentals / real estate (NOT business websites!)
      'vrbo.com', 'airbnb.com', 'booking.com', 'hotels.com', 'expedia.com',
      'tripadvisor.com/Hotel', 'zillow.com', 'realtor.com', 'redfin.com',
      'trulia.com', 'apartments.com', 'rent.com', 'hotpads.com',

      // Local news / blogs (articles about businesses, not the business)
      'stepoutbuffalo.com', 'buffalorising.com', 'buffaloeats.org',
      'ediblewny.com', 'buffalonews.com', 'wivb.com', 'wgrz.com', 'wkbw.com',
      'rochesterfirst.com', 'democratandchronicle.com', 'newyorkupstate.com',
      'onlyinyourstate.com', 'thrillist.com', 'eater.com', 'timeout.com',
      'localmagazine', 'citypaper', 'metromix', 'citysearch',

      // News and media sites (comprehensive list)
      'wnypapers.com', 'newspapers.com', 'news.google.com', 'patch.com',
      'cnn.com', 'foxnews.com', 'nbcnews.com', 'abcnews.go.com', 'cbsnews.com',
      'nytimes.com', 'washingtonpost.com', 'usatoday.com', 'reuters.com',
      'apnews.com', 'newsweek.com', 'usnews.com', 'thehill.com', 'politico.com',
      'huffpost.com', 'buzzfeed.com', 'vox.com', 'vice.com', 'slate.com',
      'msn.com', 'yahoo.com/news', 'aol.com', 'news.yahoo.com',

      // Local news patterns (partial matches)
      'localnews', 'gazette', 'tribune', 'herald', 'journal',
      'dispatch', 'register', 'sentinel', 'observer', 'examiner', 'chronicle',

      // Social media
      'facebook.com', 'instagram.com', 'twitter.com', 'tiktok.com',
      'youtube.com', 'pinterest.com', 'reddit.com', 'tumblr.com',

      // Legal / law firms (often match partial business names)
      'avvo.com', 'findlaw.com', 'justia.com', 'lawyers.com', 'martindale.com',
      'law.com', 'nolo.com', 'legalmatch.com', 'superlawyers.com', 'lawinfo.com',

      // Financial advisor/professional directories
      'brokercheck.finra.org', 'wealthminder.com', 'advisorhub.com',
      'smartasset.com', 'nerdwallet.com', 'bankrate.com', 'thebalance.com',
      'wiseradvisor.com', 'brightscope.com', 'adviserinfo.sec.gov',
      'paladin-investorregistry.com', 'letsmakeaplan.org', 'napfa.org',
      'money.usnews.com', 'forbes.com/advisor', 'investopedia.com',
      'indyfin.com', 'advisorinfo.com', 'advisorfinder.com',

      // Insurance/agent directories (NOT actual business sites)
      'agents.mutualofomaha.com', 'agent.amfam.com', 'agents.allstate.com',
      'agent.statefarm.com', 'localagent.com', 'insuranceagentlocator.com',
      'agentpronto.com', 'trustedchoice.com', 'agents.farmers.com',

      // Insurance corporate sites (not individual agent sites)
      'mutualofomaha.com', 'statefarm.com', 'allstate.com', 'farmers.com',
      'amfam.com', 'nationwide.com', 'libertymutual.com', 'progressive.com',
      'geico.com', 'usaa.com', 'travelers.com', 'thehartford.com',
      'metlife.com', 'prudential.com', 'newyorklife.com', 'massmutual.com',
      'northwesternmutual.com', 'principal.com', 'lincolnfinancial.com',
      'transamerica.com', 'aig.com', 'aflac.com', 'cigna.com', 'aetna.com',
      'humana.com', 'anthem.com', 'bluecrossblue', 'uhc.com', 'unitedhealth',

      // Healthcare directories
      'healthgrades.com', 'vitals.com', 'zocdoc.com', 'webmd.com',
      'findatopdoc.com', 'ratemds.com', 'wellness.com', 'doctoroogle.com',
      'sharecare.com', 'castleconnolly.com', 'ucomparehealth.com',

      // Accounting directories
      'cpaverify.org', 'cpafinder.com', 'accountant-finder.com',

      // Generic platforms that host businesses but aren't the business
      'wix.com', 'squarespace.com', 'weebly.com', 'godaddy.com',
      'wordpress.com', 'blogspot.com', 'medium.com', 'substack.com',
      'eventbrite.com', 'meetup.com', 'alignable.com',
      'groupon.com', 'livingsocial.com', 'retailmenot.com', 'coupons.com',
      'comparably.com', 'citysquares.com', 'chamberorganizer.com',

      // Job sites
      'indeed.com', 'glassdoor.com', 'ziprecruiter.com', 'monster.com',
      'careerbuilder.com', 'linkedin.com/jobs',

      // Government and education
      '.gov', '.edu', '.ny.us', '.ca.us', '.tx.us',

      // Tourism directories
      'iloveny.com', 'visitbuffaloniagara.com',

      // Hosting providers / spam domains
      'giecom.net', '.com-place.com', 'dot-reviews.org', 'rateclubs.com',

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

      // Skip spam/redirect URLs
      if (urlLower.includes('?domain=') || urlLower.includes('&domain=') ||
          urlLower.includes('?oref=') || urlLower.includes('&oref=') ||
          urlLower.includes('?redirect=') || urlLower.includes('psystem=')) continue;

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
          // Skip generic pages
          if (['groups', 'pages', 'events', 'marketplace', 'gaming', 'watch'].includes(fbPageName)) {
            continue;
          }

          // Filter out common words that cause false matches
          const commonWords = ['the', 'and', 'inc', 'llc', 'restaurant', 'cafe', 'pizza', 'bar', 'grill', 'house', 'island', 'grand', 'new', 'york', 'buffalo'];
          const bizWords = businessName.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !commonWords.includes(w));
          const pageNameLower = fbPageName.replace(/[-_]/g, '').toLowerCase();

          if (bizWords.length === 0) {
            // If no meaningful words, require exact match of first word
            const firstWord = businessName.toLowerCase().split(/\s+/)[0];
            if (firstWord.length > 3 && !pageNameLower.includes(firstWord)) {
              console.log(`🔍 Skipping unrelated FB page "${fbPageName}" for "${businessName}" (no match for "${firstWord}")`);
              continue;
            }
          } else {
            const hasMatch = bizWords.some(word => pageNameLower.includes(word));
            if (!hasMatch) {
              console.log(`🔍 Skipping unrelated FB page "${fbPageName}" for "${businessName}"`);
              continue;
            }
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
          // Filter out common words that cause false matches
          const commonWords = ['the', 'and', 'inc', 'llc', 'restaurant', 'cafe', 'pizza', 'bar', 'grill', 'house', 'island', 'grand', 'new', 'york', 'buffalo'];
          const bizWords = businessName.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !commonWords.includes(w));

          if (bizWords.length === 0) {
            // If no meaningful words, require exact match of first word
            const firstWord = businessName.toLowerCase().split(/\s+/)[0];
            if (firstWord.length > 3 && !igUsername.toLowerCase().includes(firstWord)) {
              console.log(`🔍 Skipping unrelated IG profile "${igUsername}" for "${businessName}" (no match for "${firstWord}")`);
              continue;
            }
          } else {
            const usernameLower = igUsername.replace(/[-_\.]/g, '').toLowerCase();
            const hasMatch = bizWords.some(word => usernameLower.includes(word));
            if (!hasMatch) {
              console.log(`🔍 Skipping unrelated IG profile "${igUsername}" for "${businessName}"`);
              continue;
            }
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
      'nextdoor.com', 'hotfrog.com', 'cylex.us', 'brownbook.net', 'superpages.com',
      'wnypapers.com', 'newspapers.com', 'news.google.com', 'patch.com',
      // Social media
      'facebook.com', 'instagram.com', 'twitter.com', 'tiktok.com',
      'youtube.com', 'pinterest.com', 'reddit.com', 'linkedin.com',
      // Coupon/deal sites
      'groupon.com', 'livingsocial.com', 'retailmenot.com',
      // More directories
      'comparably.com', 'citysquares.com', 'chamberorganizer.com',
      // News sites
      'usnews.com', 'forbes.com', 'bloomberg.com', 'cnbc.com', 'cnn.com',
      'wsj.com', 'nytimes.com', 'washingtonpost.com', 'businessinsider.com',
      'investopedia.com', 'marketwatch.com', 'yahoo.com', 'msn.com',
      // Financial/professional directories
      'brokercheck.finra.org', 'smartasset.com', 'nerdwallet.com', 'bankrate.com',
      'wealthminder.com', 'advisorhub.com', 'brightscope.com',
      // Insurance corporate sites (not individual agent sites)
      'mutualofomaha.com', 'statefarm.com', 'allstate.com', 'farmers.com',
      'amfam.com', 'nationwide.com', 'libertymutual.com', 'progressive.com',
      'geico.com', 'usaa.com', 'metlife.com', 'prudential.com', 'newyorklife.com',
      'northwesternmutual.com', 'transamerica.com', 'aflac.com', 'cigna.com',
      // Healthcare directories
      'healthgrades.com', 'vitals.com', 'zocdoc.com', 'webmd.com',
      // Legal directories
      'avvo.com', 'findlaw.com', 'justia.com', 'lawyers.com', 'martindale.com',
      // Spam/redirect sites
      'dot-reviews.org', 'rateclubs.com',
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

      // Skip spam/redirect URLs
      if (urlLower.includes('?domain=') || urlLower.includes('&domain=') ||
          urlLower.includes('?oref=') || urlLower.includes('&oref=') ||
          urlLower.includes('?redirect=') || urlLower.includes('psystem=')) continue;

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
