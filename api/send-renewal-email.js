/**
 * Send Renewal/Re-engagement Emails via Resend
 * POST /api/send-renewal-email
 *
 * Tier limits:
 * - Free: 0 emails
 * - Starter: 20/day, 100/month
 * - Pro/Enterprise: Unlimited
 */

import { createClient } from '@supabase/supabase-js';
import { checkRateLimit } from './lib/rate-limit.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

// Email limits per plan
const EMAIL_LIMITS = {
  free: { daily: 0, monthly: 0 },
  starter: { daily: 20, monthly: 100 },
  pro: { daily: -1, monthly: -1 },       // -1 = unlimited
  enterprise: { daily: -1, monthly: -1 }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limit: 30 requests per minute
  const rateLimited = checkRateLimit(req, res, { limit: 30, window: 60, keyPrefix: 'send-email' });
  if (rateLimited) {
    return res.status(rateLimited.status).json(rateLimited.body);
  }

  const {
    userEmail,           // The sender's account email (for quota tracking)
    recipientEmail,      // Business email to send to
    recipientName,       // Business name
    subject,             // Email subject
    templateType,        // 'renewal' | 'custom'
    customMessage,       // For custom template
    campaignName,        // e.g., "March 2026 Grand Island"
    nextMailDate,        // e.g., "April 15, 2026"
    fromName             // Sender's business name
  } = req.body;

  // Validation
  if (!userEmail) {
    return res.status(400).json({ error: 'userEmail required for quota tracking' });
  }
  if (!recipientEmail) {
    return res.status(400).json({ error: 'recipientEmail required' });
  }
  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'Resend API key not configured' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // 1. Check user's subscription plan
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan_id, status')
      .eq('user_email', userEmail)
      .eq('status', 'ACTIVE')
      .single();

    const planId = subscription?.plan_id || 'free';
    const limits = EMAIL_LIMITS[planId] || EMAIL_LIMITS.free;

    // 2. Check if plan allows emails
    if (limits.daily === 0) {
      return res.status(403).json({
        error: 'Email feature not available',
        message: 'Upgrade to Starter plan or higher to send renewal emails',
        planId,
        upgradeRequired: true
      });
    }

    // 3. Check daily and monthly quotas
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // Get daily count
    const { count: dailyCount } = await supabase
      .from('email_sends')
      .select('*', { count: 'exact', head: true })
      .eq('sender_email', userEmail)
      .gte('sent_at', todayStart);

    // Get monthly count
    const { count: monthlyCount } = await supabase
      .from('email_sends')
      .select('*', { count: 'exact', head: true })
      .eq('sender_email', userEmail)
      .gte('sent_at', monthStart);

    // Check limits (skip if unlimited)
    if (limits.daily !== -1 && dailyCount >= limits.daily) {
      return res.status(429).json({
        error: 'Daily email limit reached',
        message: `You've sent ${dailyCount}/${limits.daily} emails today. Try again tomorrow or upgrade.`,
        dailyUsed: dailyCount,
        dailyLimit: limits.daily
      });
    }

    if (limits.monthly !== -1 && monthlyCount >= limits.monthly) {
      return res.status(429).json({
        error: 'Monthly email limit reached',
        message: `You've sent ${monthlyCount}/${limits.monthly} emails this month. Upgrade for more.`,
        monthlyUsed: monthlyCount,
        monthlyLimit: limits.monthly
      });
    }

    // 4. Build email content
    const emailSubject = subject || `Continue Your Success with ${campaignName || 'Our Next Postcard'}!`;
    const emailHtml = buildRenewalEmail({
      recipientName: recipientName || 'Valued Customer',
      fromName: fromName || '9x12 Pro',
      campaignName,
      nextMailDate,
      customMessage,
      templateType
    });

    // 5. Send via Resend
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `${fromName || '10K Postcards'} <hello@10kpostcards.com>`,
        to: [recipientEmail],
        subject: emailSubject,
        html: emailHtml
      })
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error('Resend API error:', resendData);
      return res.status(500).json({
        error: 'Failed to send email',
        details: resendData.message || resendData.error
      });
    }

    // 6. Record the send for quota tracking
    await supabase.from('email_sends').insert({
      sender_email: userEmail,
      recipient_email: recipientEmail,
      recipient_name: recipientName,
      subject: emailSubject,
      template_type: templateType || 'renewal',
      resend_id: resendData.id,
      sent_at: new Date().toISOString()
    });

    // 7. Return success with updated quota info
    return res.status(200).json({
      success: true,
      messageId: resendData.id,
      recipient: recipientEmail,
      quota: {
        dailyUsed: (dailyCount || 0) + 1,
        dailyLimit: limits.daily === -1 ? 'unlimited' : limits.daily,
        monthlyUsed: (monthlyCount || 0) + 1,
        monthlyLimit: limits.monthly === -1 ? 'unlimited' : limits.monthly
      }
    });

  } catch (error) {
    console.error('Send email error:', error);
    return res.status(500).json({
      error: 'Failed to send email',
      message: error.message
    });
  }
}

// Build the renewal email HTML
function buildRenewalEmail({ recipientName, fromName, campaignName, nextMailDate, customMessage, templateType }) {
  if (templateType === 'custom' && customMessage) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        ${customMessage.replace(/\n/g, '<br>')}
        <p style="margin-top: 30px; color: #666; font-size: 14px;">
          Best regards,<br>
          <strong>${fromName}</strong>
        </p>
      </body>
      </html>
    `;
  }

  // Default renewal template
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #10B981; margin: 0;">Ready for Round Two?</h1>
      </div>

      <p>Hi <strong>${recipientName}</strong>,</p>

      <p>We hope your last postcard campaign brought great results! We're reaching out because our next community mailer is coming up${nextMailDate ? ` on <strong>${nextMailDate}</strong>` : ' soon'}.</p>

      ${campaignName ? `<p>Campaign: <strong>${campaignName}</strong></p>` : ''}

      <p>As a previous advertiser, you know the value of reaching local customers directly in their homes. We'd love to have you back!</p>

      <div style="background: #F0FDF4; border-left: 4px solid #10B981; padding: 15px; margin: 25px 0;">
        <strong>Why advertise again?</strong>
        <ul style="margin: 10px 0 0 0; padding-left: 20px;">
          <li>Reach thousands of local households</li>
          <li>Build brand recognition with repeat exposure</li>
          <li>Exclusive placement - limited spots available</li>
        </ul>
      </div>

      <p>Reply to this email or give us a call to reserve your spot before they fill up!</p>

      <p style="margin-top: 30px;">
        Best regards,<br>
        <strong>${fromName}</strong>
      </p>

      <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">

      <p style="color: #9CA3AF; font-size: 12px; text-align: center;">
        You're receiving this because you previously advertised with us.<br>
        If you'd prefer not to receive these reminders, just reply and let us know.
      </p>
    </body>
    </html>
  `;
}
