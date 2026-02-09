/**
 * Email Templates Preview
 * GET /api/resend/templates - List available templates
 * POST /api/resend/templates/preview - Generate preview HTML
 */

import { checkRateLimit } from '../lib/rate-limit.js';

// Import templates from send-broadcast
const TEMPLATES = {
  prospect_outreach: {
    id: 'prospect_outreach',
    name: 'Prospect Outreach',
    description: 'Introduce your postcard service to new prospects',
    subject: 'Grow Your Business with Local Postcard Marketing',
    variables: ['location', 'mailDate', 'senderName', 'senderPhone', 'ctaUrl'],
    buildHtml: (vars) => `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
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
          ${vars.ctaUrl ? `<div style="text-align: center; margin: 30px 0;"><a href="${vars.ctaUrl}" style="background: #10B981; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Reserve My Spot</a></div>` : ''}
          <p style="margin-top: 25px;">Best regards,<br><strong>${vars.senderName || '10K Postcards Team'}</strong>${vars.senderPhone ? `<br><span style="color: #6B7280;">${vars.senderPhone}</span>` : ''}</p>
        </div>
        <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin-top: 20px;">You're receiving this because you're a local business in our service area.<br><a href="#" style="color: #9CA3AF;">Unsubscribe</a></p>
      </body>
      </html>
    `
  },

  customer_renewal: {
    id: 'customer_renewal',
    name: 'Customer Renewal',
    description: 'Re-engage past customers for repeat business',
    subject: 'Ready for Another Successful Campaign?',
    variables: ['campaignName', 'mailDate', 'senderName', 'senderPhone', 'ctaUrl'],
    buildHtml: (vars) => `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
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
          ${vars.ctaUrl ? `<div style="text-align: center; margin: 30px 0;"><a href="${vars.ctaUrl}" style="background: #10B981; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Renew My Spot</a></div>` : ''}
          <p style="margin-top: 25px;">Best regards,<br><strong>${vars.senderName || '10K Postcards Team'}</strong>${vars.senderPhone ? `<br><span style="color: #6B7280;">${vars.senderPhone}</span>` : ''}</p>
        </div>
        <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin-top: 20px;">You're receiving this because you previously advertised with us.<br><a href="#" style="color: #9CA3AF;">Unsubscribe</a></p>
      </body>
      </html>
    `
  },

  custom: {
    id: 'custom',
    name: 'Custom Message',
    description: 'Write your own email content',
    subject: '',
    variables: ['customMessage', 'senderName', 'senderPhone'],
    buildHtml: (vars) => `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: white; border-radius: 8px; padding: 25px;">
          ${(vars.customMessage || 'Your message here...').replace(/\n/g, '<br>')}
          ${vars.senderName ? `<p style="margin-top: 30px;">Best regards,<br><strong>${vars.senderName}</strong>${vars.senderPhone ? `<br><span style="color: #6B7280;">${vars.senderPhone}</span>` : ''}</p>` : ''}
        </div>
        <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin-top: 20px;"><a href="#" style="color: #9CA3AF;">Unsubscribe</a></p>
      </body>
      </html>
    `
  }
};

export default async function handler(req, res) {
  const rateLimited = checkRateLimit(req, res, { limit: 60, window: 60, keyPrefix: 'resend-templates' });
  if (rateLimited) {
    return res.status(rateLimited.status).json(rateLimited.body);
  }

  if (req.method === 'GET') {
    // List available templates
    const templates = Object.values(TEMPLATES).map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      subject: t.subject,
      variables: t.variables
    }));

    return res.status(200).json({ templates });
  }

  if (req.method === 'POST') {
    // Generate preview HTML
    const { templateId, variables } = req.body;

    const template = TEMPLATES[templateId];
    if (!template) {
      return res.status(400).json({ error: 'Invalid template ID', available: Object.keys(TEMPLATES) });
    }

    const html = template.buildHtml(variables || {});
    const subject = variables?.subject || template.subject;

    return res.status(200).json({
      templateId,
      subject,
      html
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
