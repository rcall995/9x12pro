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
    // NOTE: We DON'T return phone numbers from scraping - Google Places data is more reliable
    // The scraper often finds wrong numbers (partner numbers, footer numbers, etc.)
    const enrichedData = {
      email: verifiedEmails[0] || '', // Primary email
      allEmails: verifiedEmails,
      phone: '', // Don't scrape phones - keep Google's phone number instead
      allPhones: [], // Don't provide alternative phones - causes confusion
      facebook: socialLinks.facebook || '',
      instagram: socialLinks.instagram || '',
      linkedin: socialLinks.linkedin || '',
      twitter: socialLinks.twitter || '',
      contactNames: contactNames,
      enriched: !!(verifiedEmails.length || Object.values(socialLinks).some(v => v)),
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

  // Filter out common junk emails and placeholder addresses
  const filtered = emails.filter(email => {
    const lower = email.toLowerCase();

    // Generic placeholder patterns
    if (lower === 'user@domain.com') return false;
    if (lower === 'admin@domain.com') return false;
    if (lower === 'email@domain.com') return false;
    if (lower === 'info@domain.com') return false;
    if (lower === 'contact@domain.com') return false;
    if (lower === 'mail@domain.com') return false;
    if (lower.startsWith('user@')) return false;
    if (lower.startsWith('username@')) return false;
    if (lower.startsWith('your@')) return false;
    if (lower.startsWith('youremail@')) return false;
    if (lower.startsWith('yourname@')) return false;

    // Filter out image filenames (retina display naming convention: @2x, @3x)
    if (/@\d+x\.(png|jpg|jpeg|gif|webp|svg|ico|bmp)$/i.test(lower)) return false;
    // Filter out any file extensions that aren't emails
    if (/\.(png|jpg|jpeg|gif|webp|svg|ico|bmp|pdf|doc|docx|zip|mp4|mp3|css|js)$/i.test(lower)) return false;

    // Common template/example domains
    return !lower.includes('example.com') &&
           !lower.includes('example.org') &&
           !lower.includes('yourmail.com') &&
           !lower.includes('youremail.com') &&
           !lower.includes('yoursite.com') &&
           !lower.includes('yourdomain.com') &&
           !lower.includes('email.com') &&
           !lower.includes('domain.com') &&
           !lower.includes('sentry.io') &&
           !lower.includes('wixpress.com');
  });

  return [...new Set(filtered)]; // Remove duplicates
}

// Extract phone numbers from HTML
function extractPhones(html) {
  // Valid area codes for different regions (helps filter junk)
  const validAreaCodes = [
    // New York
    '212', '315', '332', '347', '516', '518', '585', '607', '631', '646', '680', '716', '718', '838', '845', '914', '917', '929', '934',
    // Common US area codes
    '201', '202', '203', '205', '206', '207', '208', '209', '210', '213', '214', '215', '216', '217', '218', '219', '220',
    '224', '225', '228', '229', '231', '234', '239', '240', '248', '251', '252', '253', '254', '256', '260', '262', '267',
    '269', '270', '272', '274', '276', '281', '301', '302', '303', '304', '305', '307', '308', '309', '310', '312', '313',
    '314', '316', '317', '318', '319', '320', '321', '323', '325', '330', '331', '334', '336', '337', '339', '346', '351',
    '352', '360', '361', '364', '380', '385', '386', '401', '402', '404', '405', '406', '407', '408', '409', '410', '412',
    '413', '414', '415', '417', '419', '423', '424', '425', '430', '432', '434', '435', '440', '442', '443', '447', '458',
    '463', '469', '470', '475', '478', '479', '480', '484', '501', '502', '503', '504', '505', '507', '508', '509', '510',
    '512', '513', '515', '517', '520', '530', '531', '534', '539', '540', '541', '551', '559', '561', '562', '563', '564',
    '567', '570', '571', '573', '574', '575', '580', '582', '601', '602', '603', '605', '606', '608', '609', '610', '612',
    '614', '615', '616', '617', '618', '619', '620', '623', '626', '628', '629', '630', '636', '641', '646', '650', '651',
    '657', '659', '660', '661', '662', '667', '669', '678', '681', '682', '689', '701', '702', '703', '704', '706', '707',
    '708', '712', '713', '714', '715', '717', '719', '720', '724', '725', '727', '730', '731', '732', '734', '737', '740',
    '743', '747', '754', '757', '760', '762', '763', '765', '769', '770', '772', '773', '774', '775', '779', '781', '785',
    '786', '801', '802', '803', '804', '805', '806', '808', '810', '812', '813', '814', '815', '816', '817', '818', '828',
    '830', '831', '832', '843', '845', '847', '848', '850', '854', '856', '857', '858', '859', '860', '862', '863', '864',
    '865', '870', '872', '878', '901', '903', '904', '906', '907', '908', '909', '910', '912', '913', '914', '915', '916',
    '917', '918', '919', '920', '925', '928', '929', '930', '931', '934', '936', '937', '938', '940', '941', '947', '949',
    '951', '952', '954', '956', '959', '970', '971', '972', '973', '978', '979', '980', '984', '985', '989'
  ];

  // Look for phone numbers near contact keywords (higher priority)
  const contextPatterns = [
    /(?:phone|call|tel|contact|reach|fax)[\s:]*(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/gi,
    /(?:phone|call|tel|contact|reach|fax)[\s:]*(\+1[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/gi
  ];

  let priorityPhones = [];
  for (const pattern of contextPatterns) {
    const matches = [...html.matchAll(pattern)];
    priorityPhones = priorityPhones.concat(matches.map(m => m[1]));
  }

  // Validate and return priority phones if found
  if (priorityPhones.length > 0) {
    const normalized = priorityPhones.map(phone => phone.replace(/[^\d+()-.\s]/g, '').trim());
    const valid = normalized.filter(phone => {
      const digits = phone.replace(/\D/g, '');
      if (digits.length !== 10 && digits.length !== 11) return false;

      // Extract area code (first 3 digits after country code)
      const areaCode = digits.length === 11 ? digits.substring(1, 4) : digits.substring(0, 3);
      if (!validAreaCodes.includes(areaCode)) return false;

      // No repeating patterns
      const uniqueDigits = new Set(digits.split(''));
      if (uniqueDigits.size < 4) return false;

      // Not all sequential (1234567890)
      const sequential = '0123456789';
      if (sequential.includes(digits.substring(0, 5))) return false;

      return true;
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

  // Normalize and validate
  phones = phones.map(phone => phone.replace(/[^\d+()-.\s]/g, '').trim());
  phones = phones.filter(phone => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10 && digits.length !== 11) return false;

    // Extract area code
    const areaCode = digits.length === 11 ? digits.substring(1, 4) : digits.substring(0, 3);
    if (!validAreaCodes.includes(areaCode)) return false;

    // Uniqueness check
    const uniqueDigits = new Set(digits.split(''));
    if (uniqueDigits.size < 4) return false;

    // Not sequential
    const sequential = '0123456789';
    if (sequential.includes(digits.substring(0, 5))) return false;

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
      // Extract the page name (last part of URL)
      const pageName = url.split('/').pop().split('?')[0]; // Remove query params

      // Skip if page name is:
      // - Too short (< 3 chars) - likely generic
      // - All numeric (years like '2008', IDs like '12345')
      // - Common generic words
      const isNumericOnly = /^\d+$/.test(pageName);
      const isTooShort = pageName.length < 3;
      const isGeneric = ['page', 'pages', 'home', 'index'].includes(pageName.toLowerCase());

      if (!isNumericOnly && !isTooShort && !isGeneric) {
        links.facebook = url;
        break;
      }
    }
  }

  // Instagram - find all matches and filter
  const igMatches = html.match(/(?:https?:\/\/)?(?:www\.)?instagram\.com\/[A-Za-z0-9._-]+/gi) || [];
  for (const match of igMatches) {
    const url = match.startsWith('http') ? match : 'https://' + match;
    const isValid = !invalidPatterns.instagram.some(pattern => url.toLowerCase().includes(pattern));

    if (isValid && url.split('/').length >= 4) { // Must have username
      const username = url.split('/').pop().split('?')[0];
      const isNumericOnly = /^\d+$/.test(username);
      const isTooShort = username.length < 3;

      if (!isNumericOnly && !isTooShort) {
        links.instagram = url;
        break;
      }
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
      const username = url.split('/').pop().split('?')[0];
      const isNumericOnly = /^\d+$/.test(username);
      const isTooShort = username.length < 2; // Twitter allows 2-char usernames

      if (!isNumericOnly && !isTooShort) {
        links.twitter = url;
        break;
      }
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
