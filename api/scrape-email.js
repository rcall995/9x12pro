/**
 * Website Email Scraper API
 * Fetches a website and extracts email addresses from the page
 *
 * FREE - no external API costs
 */

import { checkRateLimit } from './lib/rate-limit.js';
import { validateUrl } from './lib/validation.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limit: 100 requests per minute (supports bulk enrichment)
  const rateLimited = checkRateLimit(req, res, { limit: 100, window: 60, keyPrefix: 'scrape-email' });
  if (rateLimited) {
    return res.status(rateLimited.status).json(rateLimited.body);
  }

  const { website, url, businessName } = req.body;
  const targetUrl = website || url;

  if (!targetUrl) {
    return res.status(400).json({ error: 'Website URL required' });
  }

  // Validate URL (SSRF protection)
  const urlValidation = validateUrl(targetUrl);
  if (!urlValidation.valid) {
    return res.status(400).json({ error: urlValidation.error });
  }

  try {
    // Normalize the URL
    let normalizedUrl = targetUrl.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    // Remove trailing slashes for consistency
    normalizedUrl = normalizedUrl.replace(/\/+$/, '');

    console.log(`📧 Scraping email from: ${normalizedUrl}`);

    // Pages to check for email addresses
    const pagesToCheck = [
      normalizedUrl,
      normalizedUrl + '/contact',
      normalizedUrl + '/contact-us',
      normalizedUrl + '/about',
      normalizedUrl + '/about-us'
    ];

    const emails = new Set();
    const domainMatchEmails = new Set(); // Emails matching the website domain (high confidence)
    const checkedPages = [];

    // Extract the main domain from the website URL for matching
    let websiteDomain = '';
    try {
      const urlObj = new URL(normalizedUrl);
      websiteDomain = urlObj.hostname.toLowerCase().replace('www.', '');
    } catch (e) {
      // URL parsing failed, continue without domain matching
    }

    // Email regex pattern - matches common email formats
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;

    // Domains to ignore (generic, third-party services, fonts, analytics, etc.)
    const ignoreDomains = [
      'example.com', 'email.com', 'domain.com', 'yoursite.com',
      'company.com', 'website.com', 'sentry.io', 'wixpress.com',
      'squarespace.com', 'wordpress.com', 'shopify.com', 'godaddy.com',
      // Font services
      'latofonts.com', 'fonts.com', 'typekit.com', 'google.com', 'googlefonts.com',
      'fontawesome.com', 'fontsquirrel.com', 'myfonts.com', 'typography.com',
      // Analytics/tracking
      'google-analytics.com', 'hotjar.com', 'mixpanel.com', 'segment.com',
      'amplitude.com', 'heap.io', 'fullstory.com', 'crazyegg.com',
      // Social/platforms
      'facebook.com', 'instagram.com', 'twitter.com', 'linkedin.com',
      'youtube.com', 'tiktok.com', 'pinterest.com', 'yelp.com',
      // Website builders/hosting
      'weebly.com', 'wix.com', 'squarespace-mail.com', 'hover.com',
      'namecheap.com', 'bluehost.com', 'hostgator.com', 'dreamhost.com',
      // Payment/booking
      'stripe.com', 'paypal.com', 'square.com', 'toast.com', 'opentable.com',
      'resy.com', 'yelp-support.com', 'grubhub.com', 'doordash.com',
      // Other third-party
      'mailchimp.com', 'constantcontact.com', 'sendinblue.com', 'hubspot.com',
      'zendesk.com', 'intercom.com', 'freshdesk.com', 'crisp.chat',
      'recaptcha.net', 'gstatic.com', 'cloudflare.com', 'jsdelivr.net'
    ];

    // Common junk email patterns to ignore
    const ignorePatterns = [
      /^support@/i, /^help@/i, /^noreply@/i, /^no-reply@/i,
      /^admin@/i, /^webmaster@/i, /^postmaster@/i,
      /\.png$/i, /\.jpg$/i, /\.gif$/i, /\.svg$/i,
      /@2x\./i, /@3x\./i
    ];

    for (const pageUrl of pagesToCheck) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        const response = await fetch(pageUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          },
          redirect: 'follow'
        });

        clearTimeout(timeout);

        if (!response.ok) {
          continue; // Skip this page, try next
        }

        const html = await response.text();
        checkedPages.push(pageUrl);

        // Find all email addresses in the HTML
        const matches = html.match(emailRegex) || [];

        for (const email of matches) {
          const lowerEmail = email.toLowerCase();
          const domain = lowerEmail.split('@')[1];

          // Skip ignored domains
          if (ignoreDomains.some(d => domain === d || domain.endsWith('.' + d))) {
            continue;
          }

          // Skip junk patterns
          if (ignorePatterns.some(pattern => pattern.test(lowerEmail))) {
            continue;
          }

          // Skip if it looks like a file extension was captured
          if (/\.(png|jpg|jpeg|gif|svg|css|js)$/i.test(lowerEmail)) {
            continue;
          }

          // Check if email domain matches website domain (high confidence)
          if (websiteDomain && domain.includes(websiteDomain.split('.')[0])) {
            domainMatchEmails.add(lowerEmail);
          }
          emails.add(lowerEmail);
        }

        // Also look for mailto: links which are more reliable
        const mailtoRegex = /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
        const mailtoMatches = html.matchAll(mailtoRegex);
        for (const match of mailtoMatches) {
          const email = match[1].toLowerCase();
          const domain = email.split('@')[1];

          if (!ignoreDomains.some(d => domain === d || domain.endsWith('.' + d))) {
            // Check if email domain matches website domain (high confidence)
            if (websiteDomain && domain.includes(websiteDomain.split('.')[0])) {
              domainMatchEmails.add(email);
            }
            emails.add(email);
          }
        }

        // If we found domain-matching emails, that's ideal - stop looking
        if (domainMatchEmails.size > 0) {
          break;
        }

        // If we found any emails on homepage, check one more page for better matches
        if (emails.size > 0 && checkedPages.length >= 2) {
          break;
        }

      } catch (e) {
        // Page failed to load, continue to next
        continue;
      }
    }

    // STRICT MODE: Only return emails that match the website domain
    // This prevents returning random emails scraped from wrong websites
    const domainMatchList = Array.from(domainMatchEmails);
    const allEmailList = Array.from(emails);

    // ONLY use domain-matching emails - don't return random emails from the page
    // Random emails are often from fonts, analytics, or if we scraped the wrong site
    const emailList = domainMatchList;

    console.log(`📧 Found ${emailList.length} email(s) from ${normalizedUrl}: ${emailList.join(', ') || 'none'}`);
    if (domainMatchList.length > 0) {
      console.log(`✨ Domain match: ${domainMatchList.join(', ')}`);
    }

    return res.status(200).json({
      emails: emailList,
      primaryEmail: emailList[0] || null,
      checkedPages: checkedPages.length,
      domainMatch: domainMatchList.length > 0,
      source: 'website_scrape'
    });

  } catch (error) {
    console.error('Email scrape error:', error);
    return res.status(200).json({
      emails: [],
      primaryEmail: null,
      error: error.message
    });
  }
}
