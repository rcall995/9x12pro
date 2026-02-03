/**
 * Email Validation API
 * Checks if an email address is likely valid
 * - Format validation
 * - MX record check (domain can receive email)
 * - Disposable email detection
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }

  try {
    const result = await validateEmail(email);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Email validation error:', error);
    return res.status(200).json({
      email,
      valid: false,
      error: error.message
    });
  }
}

async function validateEmail(email) {
  const checks = {
    format: false,
    mxRecords: false,
    notDisposable: false,
    notGeneric: false
  };

  // 1. Format check
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  checks.format = emailRegex.test(email);

  if (!checks.format) {
    return {
      email,
      valid: false,
      score: 0,
      checks,
      reason: 'Invalid email format'
    };
  }

  const domain = email.split('@')[1].toLowerCase();

  // 2. Disposable email check
  const disposableDomains = [
    'tempmail.com', 'throwaway.email', 'guerrillamail.com', 'mailinator.com',
    '10minutemail.com', 'temp-mail.org', 'fakeinbox.com', 'trashmail.com',
    'tempail.com', 'dispostable.com', 'yopmail.com', 'getnada.com',
    'maildrop.cc', 'sharklasers.com', 'spam4.me', 'grr.la'
  ];
  checks.notDisposable = !disposableDomains.includes(domain);

  // 3. Generic/role-based email check (these are less valuable for outreach)
  const genericPrefixes = [
    'info', 'contact', 'hello', 'support', 'help', 'sales', 'admin',
    'office', 'mail', 'email', 'general', 'enquiries', 'inquiries'
  ];
  const prefix = email.split('@')[0].toLowerCase();
  checks.notGeneric = !genericPrefixes.includes(prefix);

  // 4. MX record check using DNS-over-HTTPS (Google's public DNS)
  try {
    const dnsResponse = await fetch(
      `https://dns.google/resolve?name=${domain}&type=MX`,
      { headers: { 'Accept': 'application/dns-json' } }
    );
    const dnsData = await dnsResponse.json();

    // Status 0 = NOERROR, and Answer array contains MX records
    checks.mxRecords = dnsData.Status === 0 &&
                       dnsData.Answer &&
                       dnsData.Answer.length > 0;
  } catch (e) {
    console.warn('MX lookup failed for', domain, e.message);
    // If DNS lookup fails, we can't verify - assume it might be valid
    checks.mxRecords = null; // Unknown
  }

  // Calculate score
  let score = 0;
  if (checks.format) score += 25;
  if (checks.mxRecords) score += 35;
  if (checks.notDisposable) score += 20;
  if (checks.notGeneric) score += 20;

  // If MX check was inconclusive, adjust
  if (checks.mxRecords === null) {
    score = Math.round(score * 0.8); // Reduce confidence
  }

  const valid = checks.format && checks.mxRecords !== false && checks.notDisposable;

  return {
    email,
    domain,
    valid,
    score,
    checks,
    isGeneric: !checks.notGeneric,
    reason: !valid ?
      (!checks.format ? 'Invalid format' :
       checks.mxRecords === false ? 'Domain cannot receive email' :
       !checks.notDisposable ? 'Disposable email' : 'Unknown') :
      (score >= 80 ? 'High quality' : score >= 60 ? 'Acceptable' : 'Low confidence')
  };
}
