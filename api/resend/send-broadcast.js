/**
 * Send Broadcast Email to Resend Audience
 * POST /api/resend/send-broadcast
 *
 * Sends a marketing email to all contacts in an audience.
 * Includes domain warmup throttling to protect new sending domains.
 */

import { createClient } from '@supabase/supabase-js';
import { checkRateLimit } from '../lib/rate-limit.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_API_BASE = 'https://api.resend.com';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Domain warmup schedule — graduated daily limits for new sending domains
const WARMUP_SCHEDULE = [
  { maxAge: 3,  limit: 20 },
  { maxAge: 7,  limit: 50 },
  { maxAge: 14, limit: 100 },
  { maxAge: 30, limit: 250 },
  { maxAge: 60, limit: 500 },
  { maxAge: 90, limit: 1000 },
];
const WARMUP_MAX_LIMIT = 5000; // 91+ days

// Domains that skip warmup throttling entirely
const GRANDFATHERED_DOMAINS = ['10kpostcards.com'];

function getWarmupDailyLimit(domainAgeDays) {
  for (const tier of WARMUP_SCHEDULE) {
    if (domainAgeDays <= tier.maxAge) return tier.limit;
  }
  return WARMUP_MAX_LIMIT;
}

// Email templates
const TEMPLATES = {
  prospect_outreach: {
    name: 'Prospect Outreach',
    subject: 'Grow Your Business with Local Postcard Marketing',
    buildHtml: (vars) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
        <div style="background: white; border-radius: 12px; padding: 30px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 25px;">
            <h1 style="color: #10B981; margin: 0; font-size: 24px;">Reach Local Customers</h1>
            <p style="color: #6B7280; margin: 5px 0 0;">Direct mail that gets results</p>
          </div>

          <p>Hi there,</p>

          <p>Are you looking to reach more customers in <strong>${vars.location || 'your area'}</strong>?</p>

          <p>We're putting together our next community postcard mailer${vars.mailDate ? ` going out <strong>${vars.mailDate}</strong>` : ''}, and we'd love to feature your business!</p>

          <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center;">
            <h2 style="margin: 0 0 10px; font-size: 20px;">Why Postcard Marketing Works</h2>
            <ul style="text-align: left; margin: 0; padding-left: 20px;">
              <li>98% open rate (vs 20% for email)</li>
              <li>Reach every household in the area</li>
              <li>Stand out from digital noise</li>
              <li>Affordable shared advertising costs</li>
            </ul>
          </div>

          <p>Spots are limited and fill up quickly. Reply to this email or click below to learn more!</p>

          ${vars.ctaUrl ? `
          <div style="text-align: center; margin: 30px 0;">
            <a href="${vars.ctaUrl}" style="background: #10B981; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Reserve My Spot</a>
          </div>
          ` : ''}

          <p style="margin-top: 25px;">
            Best regards,<br>
            <strong>${vars.senderName || '10K Postcards Team'}</strong>
            ${vars.senderPhone ? `<br><span style="color: #6B7280;">${vars.senderPhone}</span>` : ''}
          </p>
        </div>

        <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin-top: 20px;">
          You're receiving this because you're a local business in our service area.<br>
          <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color: #9CA3AF;">Unsubscribe</a>
        </p>
      </body>
      </html>
    `
  },

  customer_renewal: {
    name: 'Customer Renewal',
    subject: 'Ready for Another Successful Campaign?',
    buildHtml: (vars) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
        <div style="background: white; border-radius: 12px; padding: 30px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 25px;">
            <h1 style="color: #10B981; margin: 0; font-size: 24px;">Welcome Back!</h1>
            <p style="color: #6B7280; margin: 5px 0 0;">Your next campaign is coming up</p>
          </div>

          <p>Hi there,</p>

          <p>Thank you for advertising with us previously! We hope your campaign brought great results.</p>

          <p>We're reaching out because our <strong>${vars.campaignName || 'next community mailer'}</strong> is coming up${vars.mailDate ? ` on <strong>${vars.mailDate}</strong>` : ''}.</p>

          <div style="background: #F0FDF4; border-left: 4px solid #10B981; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
            <h3 style="margin: 0 0 10px; color: #059669;">As a Returning Advertiser:</h3>
            <ul style="margin: 0; padding-left: 20px; color: #374151;">
              <li>Priority spot selection</li>
              <li>We already have your artwork on file</li>
              <li>Quick & easy renewal process</li>
              <li>Build on your previous exposure</li>
            </ul>
          </div>

          <p>Repeat advertising builds recognition and trust with local customers. Studies show it takes 7+ touchpoints before someone becomes a customer!</p>

          <p>Reply to this email to reserve your spot, or let us know if you have any questions.</p>

          ${vars.ctaUrl ? `
          <div style="text-align: center; margin: 30px 0;">
            <a href="${vars.ctaUrl}" style="background: #10B981; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Renew My Spot</a>
          </div>
          ` : ''}

          <p style="margin-top: 25px;">
            Best regards,<br>
            <strong>${vars.senderName || '10K Postcards Team'}</strong>
            ${vars.senderPhone ? `<br><span style="color: #6B7280;">${vars.senderPhone}</span>` : ''}
          </p>
        </div>

        <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin-top: 20px;">
          You're receiving this because you previously advertised with us.<br>
          <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color: #9CA3AF;">Unsubscribe</a>
        </p>
      </body>
      </html>
    `
  },

  custom: {
    name: 'Custom Message',
    buildHtml: (vars) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: white; border-radius: 8px; padding: 25px;">
          ${(vars.customHtml || vars.customMessage || '').replace(/\n/g, '<br>')}

          ${vars.senderName ? `
          <p style="margin-top: 30px;">
            Best regards,<br>
            <strong>${vars.senderName}</strong>
            ${vars.senderPhone ? `<br><span style="color: #6B7280;">${vars.senderPhone}</span>` : ''}
          </p>
          ` : ''}
        </div>

        <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin-top: 20px;">
          <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color: #9CA3AF;">Unsubscribe</a>
        </p>
      </body>
      </html>
    `
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rateLimited = checkRateLimit(req, res, { limit: 5, window: 60, keyPrefix: 'resend-broadcast' });
  if (rateLimited) {
    return res.status(rateLimited.status).json(rateLimited.body);
  }

  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'Resend API key not configured' });
  }

  const {
    audienceId,           // Resend audience ID to send to
    templateId,           // 'prospect_outreach' | 'customer_renewal' | 'custom'
    subject,              // Custom subject (overrides template default)
    variables,            // Template variables: { location, mailDate, campaignName, senderName, senderPhone, ctaUrl, customMessage }
    customBody,           // Custom template body (replaces default template)
    fromName,             // Sender name
    fromEmail,            // Must be verified domain email
    replyTo,              // Reply-to email
    bypassWarmup          // User acknowledged warmup warning and wants to send anyway
  } = req.body;

  if (!audienceId) {
    return res.status(400).json({ error: 'audienceId required' });
  }

  const template = TEMPLATES[templateId] || TEMPLATES.prospect_outreach;
  const emailSubject = subject || template.subject || 'A message from 10K Postcards';

  // If custom body provided, use it with variable substitution
  let emailHtml;
  if (customBody) {
    // Replace variables in custom body
    let processedBody = customBody
      .replace(/\{location\}/g, variables?.location || 'your area')
      .replace(/\{mailDate\}/g, variables?.mailDate || '')
      .replace(/\{senderName\}/g, variables?.senderName || '')
      .replace(/\{senderPhone\}/g, variables?.senderPhone || '')
      .replace(/\{campaignName\}/g, variables?.campaignName || '')
      .replace(/\n/g, '<br>');

    // Wrap in HTML template
    emailHtml = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
        <div style="background: white; border-radius: 12px; padding: 30px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          ${processedBody}
        </div>
        <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin-top: 20px;">
          <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color: #9CA3AF;">Unsubscribe</a>
        </p>
      </body>
      </html>
    `;
  } else {
    emailHtml = template.buildHtml(variables || {});
  }

  // Extract sending domain from fromEmail
  const sendingDomain = (fromEmail || 'hello@10kpostcards.com').split('@')[1]?.toLowerCase() || '10kpostcards.com';

  // --- Domain warmup check ---
  let contactCount = 0;
  let warmupInfo = null;

  if (!GRANDFATHERED_DOMAINS.includes(sendingDomain)) {
    // 1. Fetch audience contact count from Resend
    try {
      const contactsRes = await fetch(`${RESEND_API_BASE}/audiences/${audienceId}/contacts`, {
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}` }
      });
      if (contactsRes.ok) {
        const contactsData = await contactsRes.json();
        contactCount = contactsData.data?.length || 0;
      }
    } catch (e) {
      console.warn('Failed to fetch audience contact count:', e.message);
    }

    // 2. Check warmup limits via Supabase
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY && contactCount > 0) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        const { data: info, error } = await supabase.rpc('get_domain_warmup_info', { p_domain: sendingDomain });

        if (!error && info) {
          const firstSendDate = info.first_send_date ? new Date(info.first_send_date) : null;
          const todaySent = info.today_sent || 0;
          const domainAgeDays = firstSendDate
            ? Math.floor((Date.now() - firstSendDate.getTime()) / (1000 * 60 * 60 * 24))
            : 0; // New domain = day 0
          const dailyLimit = getWarmupDailyLimit(domainAgeDays);
          const remaining = Math.max(0, dailyLimit - todaySent);

          warmupInfo = { domain: sendingDomain, domainAgeDays, dailyLimit, todaySent, remaining };

          if (todaySent + contactCount > dailyLimit && !bypassWarmup) {
            return res.status(429).json({
              error: 'Domain warmup limit exceeded',
              warmup: warmupInfo,
              message: `Your domain "${sendingDomain}" can send ${dailyLimit} emails/day (day ${domainAgeDays + 1} of warmup). ${todaySent} already sent today, ${remaining} remaining. This broadcast has ${contactCount} contacts.`
            });
          }
        }
      } catch (e) {
        // Fail-open: if Supabase query fails, allow the send
        console.warn('Warmup check failed (allowing send):', e.message);
      }
    }
  }

  try {
    // Send broadcast via Resend Broadcasts API
    // Resend renamed "audiences" to "segments" — the audienceId works as segment_id
    const response = await fetch(`${RESEND_API_BASE}/broadcasts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        segment_id: audienceId,
        from: `${fromName || '10K Postcards'} <${fromEmail || 'hello@10kpostcards.com'}>`,
        reply_to: replyTo || fromEmail || 'hello@10kpostcards.com',
        subject: emailSubject,
        html: emailHtml,
        send: true  // Send immediately
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Resend broadcast error:', data);
      return res.status(response.status).json({
        error: 'Failed to send broadcast',
        details: data.message || data.error || JSON.stringify(data)
      });
    }

    // Track broadcast in Supabase
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        await supabase.from('email_broadcasts').insert({
          resend_id: data.id,
          audience_id: audienceId,
          template_id: templateId,
          subject: emailSubject,
          sent_at: new Date().toISOString(),
          contact_count: contactCount
        });

        // Record domain send for warmup tracking
        if (contactCount > 0) {
          await supabase.rpc('record_domain_send', { p_domain: sendingDomain, p_count: contactCount });
        }
      } catch (e) {
        console.warn('Failed to track broadcast in Supabase:', e.message);
      }
    }

    // Update warmupInfo with post-send numbers
    if (warmupInfo) {
      warmupInfo.todaySent += contactCount;
      warmupInfo.remaining = Math.max(0, warmupInfo.dailyLimit - warmupInfo.todaySent);
    }

    return res.status(200).json({
      success: true,
      broadcastId: data.id,
      audienceId,
      contactCount,
      template: templateId,
      subject: emailSubject,
      warmup: warmupInfo
    });

  } catch (error) {
    console.error('Send broadcast error:', error);
    return res.status(500).json({ error: 'Failed to send broadcast', message: error.message });
  }
}

// Export templates for preview endpoint
export { TEMPLATES };
