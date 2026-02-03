/**
 * Hunter.io Email Finder API - 25 FREE lookups/month
 * Finds and verifies email addresses for a domain
 * Much more accurate than scraping
 * https://hunter.io/api
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { domain, businessName } = req.body;

  if (!domain) {
    return res.status(400).json({ error: 'Domain required' });
  }

  const HUNTER_API_KEY = process.env.HUNTER_API_KEY;

  if (!HUNTER_API_KEY) {
    console.log('⚠️ Hunter.io API key not configured');
    return res.status(200).json({
      success: false,
      source: 'hunter',
      error: 'not_configured',
      emails: []
    });
  }

  try {
    // Clean domain - remove protocol and path
    let cleanDomain = domain.toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0];

    console.log(`🎯 Hunter.io lookup: ${cleanDomain}`);

    // Use domain search to find all emails at the domain
    const response = await fetch(
      `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(cleanDomain)}&api_key=${HUNTER_API_KEY}`,
      {
        headers: { 'Accept': 'application/json' }
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Hunter.io error:', errorData);

      // Check if it's a quota error
      if (response.status === 429 || errorData.errors?.[0]?.code === 'quota_exceeded') {
        return res.status(200).json({
          success: false,
          source: 'hunter',
          error: 'quota_exceeded',
          emails: []
        });
      }

      throw new Error(errorData.errors?.[0]?.details || `Hunter returned ${response.status}`);
    }

    const data = await response.json();
    const domainData = data.data || {};
    const emails = domainData.emails || [];

    if (emails.length === 0) {
      console.log(`🎯 Hunter.io found no emails for ${cleanDomain}`);
      return res.status(200).json({
        success: true,
        source: 'hunter',
        domain: cleanDomain,
        emails: [],
        organization: domainData.organization,
        pattern: domainData.pattern
      });
    }

    // Sort by confidence and filter
    const validEmails = emails
      .filter(e => e.confidence >= 50) // Only high confidence
      .sort((a, b) => b.confidence - a.confidence)
      .map(e => ({
        email: e.value,
        type: e.type, // 'personal' or 'generic'
        confidence: e.confidence,
        firstName: e.first_name,
        lastName: e.last_name,
        position: e.position,
        verified: e.verification?.status === 'valid'
      }));

    // Prefer generic emails (info@, contact@) for business outreach
    // Or the highest confidence personal email
    const genericEmails = validEmails.filter(e => e.type === 'generic');
    const personalEmails = validEmails.filter(e => e.type === 'personal');

    const primaryEmail = genericEmails[0] || personalEmails[0] || null;

    console.log(`🎯 Hunter.io found ${validEmails.length} emails for ${cleanDomain}, primary: ${primaryEmail?.email || 'none'}`);

    return res.status(200).json({
      success: true,
      source: 'hunter',
      domain: cleanDomain,
      organization: domainData.organization,
      emails: validEmails,
      primaryEmail: primaryEmail?.email || null,
      primaryEmailConfidence: primaryEmail?.confidence || 0,
      primaryEmailVerified: primaryEmail?.verified || false,
      pattern: domainData.pattern // e.g., "{first}.{last}"
    });

  } catch (error) {
    console.error('🎯 Hunter.io error:', error);
    return res.status(200).json({
      success: false,
      source: 'hunter',
      error: error.message,
      emails: []
    });
  }
}
