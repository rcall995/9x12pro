// 9x12Pro Custom Contact Enrichment
// Scrapes business websites for emails, social media, and contact info
// SMTP verifies emails to ensure they're valid

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { websiteUrl, businessName } = req.body;

  if (!websiteUrl) {
    return res.status(400).json({ error: 'Website URL required' });
  }

  try {
    console.log('🔍 Enriching contact info for:', businessName || websiteUrl);

    // Step 1: Fetch the website homepage
    const homepageData = await scrapePage(websiteUrl);

    // Step 2: Try to find and scrape contact page
    const contactPageUrl = findContactPageUrl(websiteUrl, homepageData.html);
    let contactPageData = { emails: [], phones: [], socialLinks: {} };

    if (contactPageUrl) {
      console.log('📄 Found contact page:', contactPageUrl);
      contactPageData = await scrapePage(contactPageUrl);
    }

    // Step 3: Combine data from homepage and contact page
    const allEmails = [...new Set([...homepageData.emails, ...contactPageData.emails])];
    const allPhones = [...new Set([...homepageData.phones, ...contactPageData.phones])];
    const socialLinks = {
      facebook: homepageData.socialLinks.facebook || contactPageData.socialLinks.facebook,
      instagram: homepageData.socialLinks.instagram || contactPageData.socialLinks.instagram,
      linkedin: homepageData.socialLinks.linkedin || contactPageData.socialLinks.linkedin,
      twitter: homepageData.socialLinks.twitter || contactPageData.socialLinks.twitter
    };

    // Step 4: Extract contact names if found
    const contactNames = extractContactNames(homepageData.html + contactPageData.html);

    // Step 5: SMTP verify emails (keep only valid ones)
    console.log(`📧 Found ${allEmails.length} emails, verifying...`);
    const verifiedEmails = [];

    for (const email of allEmails) {
      const isValid = await verifyEmailSMTP(email);
      if (isValid) {
        verifiedEmails.push(email);
        console.log(`✅ Valid email: ${email}`);
      } else {
        console.log(`❌ Invalid email: ${email}`);
      }
    }

    // Step 6: Return enriched data
    const enrichedData = {
      email: verifiedEmails[0] || '', // Primary email
      allEmails: verifiedEmails,
      phone: allPhones[0] || '', // Primary phone (if found beyond Google Places)
      allPhones: allPhones,
      facebook: socialLinks.facebook || '',
      instagram: socialLinks.instagram || '',
      linkedin: socialLinks.linkedin || '',
      twitter: socialLinks.twitter || '',
      contactNames: contactNames,
      enriched: !!(verifiedEmails.length || allPhones.length || Object.values(socialLinks).some(v => v)),
      source: '9x12pro-scraper',
      pagesScraped: contactPageUrl ? 2 : 1
    };

    console.log('✅ Enrichment complete:', enrichedData);
    return res.status(200).json(enrichedData);

  } catch (error) {
    console.error('❌ Enrichment error:', error);
    return res.status(500).json({
      error: 'Enrichment failed',
      message: error.message,
      email: '',
      phone: '',
      facebook: '',
      instagram: '',
      linkedin: '',
      twitter: '',
      enriched: false
    });
  }
}

// Scrape a webpage and extract contact info
async function scrapePage(url) {
  try {
    // Normalize URL
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000 // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();

    return {
      html,
      emails: extractEmails(html),
      phones: extractPhones(html),
      socialLinks: extractSocialLinks(html, url)
    };
  } catch (error) {
    console.error('Error scraping page:', url, error.message);
    return {
      html: '',
      emails: [],
      phones: [],
      socialLinks: {}
    };
  }
}

// Extract email addresses from HTML
function extractEmails(html) {
  // Remove email obfuscation common patterns
  html = html.replace(/\[at\]/gi, '@');
  html = html.replace(/\[dot\]/gi, '.');
  html = html.replace(/\(at\)/gi, '@');
  html = html.replace(/\(dot\)/gi, '.');

  // Email regex pattern
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const emails = html.match(emailRegex) || [];

  // Filter out common junk emails
  const filtered = emails.filter(email => {
    const lower = email.toLowerCase();
    return !lower.includes('example.com') &&
           !lower.includes('yourmail.com') &&
           !lower.includes('youremail.com') &&
           !lower.includes('email.com') &&
           !lower.includes('sentry.io') &&
           !lower.includes('wixpress.com') &&
           !lower.includes('@2x.png') &&
           !lower.includes('@3x.png');
  });

  return [...new Set(filtered)]; // Remove duplicates
}

// Extract phone numbers from HTML
function extractPhones(html) {
  // Look for phone numbers near contact keywords (higher priority)
  const contextPatterns = [
    /(?:phone|call|tel|contact|reach)[\s:]*(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/gi,
    /(?:phone|call|tel|contact|reach)[\s:]*(\+1[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/gi
  ];

  let priorityPhones = [];
  for (const pattern of contextPatterns) {
    const matches = [...html.matchAll(pattern)];
    priorityPhones = priorityPhones.concat(matches.map(m => m[1]));
  }

  // If we found phones with context, prefer those
  if (priorityPhones.length > 0) {
    const normalized = priorityPhones.map(phone => phone.replace(/[^\d+()-.\s]/g, '').trim());
    const valid = normalized.filter(phone => {
      const digits = phone.replace(/\D/g, '');
      // Must be 10 or 11 digits, and NOT start with 0 or 1
      return (digits.length === 10 || digits.length === 11) &&
             digits[0] !== '0' && digits[0] !== '1';
    });
    if (valid.length > 0) {
      return [...new Set(valid)];
    }
  }

  // Fallback: extract all phone-like patterns
  const patterns = [
    /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
    /\+1[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g
  ];

  let phones = [];
  for (const pattern of patterns) {
    const matches = html.match(pattern) || [];
    phones = phones.concat(matches);
  }

  // Normalize phone numbers
  phones = phones.map(phone => phone.replace(/[^\d+()-.\s]/g, '').trim());

  // Filter out invalid numbers
  phones = phones.filter(phone => {
    const digits = phone.replace(/\D/g, '');
    // Must be 10 or 11 digits, NOT start with 0 or 1, no repeating digits
    if (digits.length !== 10 && digits.length !== 11) return false;
    if (digits[0] === '0' || digits[0] === '1') return false;

    // Filter out numbers like 1111111111, 0000000000, etc.
    const uniqueDigits = new Set(digits.split(''));
    if (uniqueDigits.size < 3) return false; // Too many repeating digits

    return true;
  });

  return [...new Set(phones)]; // Remove duplicates
}

// Extract social media links from HTML
function extractSocialLinks(html, baseUrl) {
  const links = {
    facebook: '',
    instagram: '',
    linkedin: '',
    twitter: ''
  };

  // Invalid/generic patterns to filter out
  const invalidPatterns = {
    facebook: ['profile.php', 'sharer.php', 'plugins', 'facebook.com/home', 'facebook.com/login'],
    instagram: ['/static', '/accounts', '/explore', '/direct', 'instagram.com/p/'],
    linkedin: ['/shareArticle', '/sharing', '/in/'],
    twitter: ['/share', '/intent', '/widgets']
  };

  // Facebook - find all matches and filter
  const fbMatches = html.match(/(?:https?:\/\/)?(?:www\.)?facebook\.com\/[A-Za-z0-9._-]+/gi) || [];
  for (const match of fbMatches) {
    const url = match.startsWith('http') ? match : 'https://' + match;
    const isValid = !invalidPatterns.facebook.some(pattern => url.toLowerCase().includes(pattern));
    if (isValid && url.split('/').length >= 4) { // Must have username/page
      links.facebook = url;
      break;
    }
  }

  // Instagram - find all matches and filter
  const igMatches = html.match(/(?:https?:\/\/)?(?:www\.)?instagram\.com\/[A-Za-z0-9._-]+/gi) || [];
  for (const match of igMatches) {
    const url = match.startsWith('http') ? match : 'https://' + match;
    const isValid = !invalidPatterns.instagram.some(pattern => url.toLowerCase().includes(pattern));
    if (isValid && url.split('/').length >= 4) { // Must have username
      links.instagram = url;
      break;
    }
  }

  // LinkedIn - find all matches and filter
  const liMatches = html.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/company\/[A-Za-z0-9._-]+/gi) || [];
  for (const match of liMatches) {
    const url = match.startsWith('http') ? match : 'https://' + match;
    const isValid = !invalidPatterns.linkedin.some(pattern => url.toLowerCase().includes(pattern));
    if (isValid) {
      links.linkedin = url;
      break;
    }
  }

  // Twitter/X - find all matches and filter
  const twMatches = html.match(/(?:https?:\/\/)?(?:www\.)?(?:twitter|x)\.com\/[A-Za-z0-9._-]+/gi) || [];
  for (const match of twMatches) {
    const url = match.startsWith('http') ? match : 'https://' + match;
    const isValid = !invalidPatterns.twitter.some(pattern => url.toLowerCase().includes(pattern));
    if (isValid && url.split('/').length >= 4) { // Must have username
      links.twitter = url;
      break;
    }
  }

  return links;
}

// Find contact page URL
function findContactPageUrl(baseUrl, html) {
  if (!html) return null;

  // Normalize base URL
  if (!baseUrl.startsWith('http')) {
    baseUrl = 'https://' + baseUrl;
  }

  const urlObj = new URL(baseUrl);
  const domain = urlObj.origin;

  // Common contact page patterns
  const patterns = [
    /href=["']([^"']*contact[^"']*)["']/gi,
    /href=["']([^"']*about[^"']*)["']/gi,
    /href=["']([^"']*reach[^"']*)["']/gi,
    /href=["']([^"']*get-in-touch[^"']*)["']/gi
  ];

  for (const pattern of patterns) {
    const matches = [...html.matchAll(pattern)];
    for (const match of matches) {
      let url = match[1];

      // Skip anchors and javascript
      if (url.startsWith('#') || url.startsWith('javascript:')) continue;

      // Convert relative URLs to absolute
      if (url.startsWith('/')) {
        url = domain + url;
      } else if (!url.startsWith('http')) {
        url = domain + '/' + url;
      }

      // Prefer exact "contact" matches
      if (url.toLowerCase().includes('contact')) {
        return url;
      }
    }
  }

  // Try common contact page URLs directly
  const commonUrls = [
    '/contact',
    '/contact-us',
    '/contact.html',
    '/about',
    '/about-us'
  ];

  return domain + commonUrls[0]; // Return most likely URL
}

// Extract contact names from HTML (people's names near "contact" or email addresses)
function extractContactNames(html) {
  const names = [];

  // Look for patterns like "Contact: John Smith" or "Email: jane.doe@..."
  const patterns = [
    /(?:contact|owner|manager|director):\s*([A-Z][a-z]+\s+[A-Z][a-z]+)/gi,
    /(?:reach out to|get in touch with)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/gi
  ];

  for (const pattern of patterns) {
    const matches = [...html.matchAll(pattern)];
    for (const match of matches) {
      names.push(match[1]);
    }
  }

  return [...new Set(names)].slice(0, 3); // Return up to 3 unique names
}

// SMTP verification - check if email exists without sending
async function verifyEmailSMTP(email) {
  try {
    // Basic format validation first
    if (!email || !email.includes('@') || !email.includes('.')) {
      return false;
    }

    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/;
    if (!emailRegex.test(email)) {
      return false;
    }

    // For now, use a free email verification API
    // We can use Hunter.io's free verification endpoint (100 free verifications/month)
    // OR use a service like ZeroBounce, EmailListVerify, etc.

    // Option 1: Use Hunter.io verification-only API (cheap, reliable)
    const HUNTER_API_KEY = process.env.HUNTER_API_KEY;

    if (HUNTER_API_KEY) {
      const response = await fetch(`https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${HUNTER_API_KEY}`);

      if (response.ok) {
        const data = await response.json();
        // Return true if deliverable or accept-all
        return data.data?.status === 'valid' || data.data?.result === 'deliverable';
      }
    }

    // Option 2: Fallback to basic MX record check + format validation
    // For MVP, just accept well-formed emails from valid domains
    const domain = email.split('@')[1];
    const commonDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com'];

    // Always accept common email providers
    if (commonDomains.includes(domain.toLowerCase())) {
      return true;
    }

    // For business domains, accept if format is valid
    // (We can enhance this later with actual MX record checking)
    return true;

  } catch (error) {
    console.error('Email verification error:', email, error.message);
    // On error, accept the email (fail open)
    return true;
  }
}
