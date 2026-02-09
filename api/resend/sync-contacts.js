/**
 * Sync Contacts to Resend Audience
 * POST /api/resend/sync-contacts
 *
 * Syncs prospects or past customers to a Resend audience for broadcast emails.
 * Free for up to 1,000 contacts!
 */

import { createClient } from '@supabase/supabase-js';
import { checkRateLimit } from '../lib/rate-limit.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_API_BASE = 'https://api.resend.com';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rateLimited = checkRateLimit(req, res, { limit: 10, window: 60, keyPrefix: 'resend-sync' });
  if (rateLimited) {
    return res.status(rateLimited.status).json(rateLimited.body);
  }

  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'Resend API key not configured' });
  }

  const {
    audienceId,           // Resend audience ID
    audienceName,         // Or create new audience with this name
    contacts,             // Array of { email, firstName, lastName, businessName, category, ... }
    contactType           // 'prospects' | 'customers' (for tracking)
  } = req.body;

  if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
    return res.status(400).json({ error: 'contacts array required' });
  }

  try {
    let targetAudienceId = audienceId;

    // Create audience if name provided but no ID
    if (!audienceId && audienceName) {
      console.log('📧 Creating/finding audience:', audienceName);

      // First, try to find existing audience
      const listResponse = await fetch(`${RESEND_API_BASE}/audiences`, {
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}` }
      });

      if (!listResponse.ok) {
        const listError = await listResponse.text();
        console.error('Failed to list audiences:', listError);
        return res.status(400).json({ error: 'Failed to list audiences', details: listError });
      }

      const audiences = await listResponse.json();
      console.log('📧 Found audiences:', audiences.data?.length || 0);

      const existing = audiences.data?.find(a => a.name === audienceName);

      if (existing) {
        console.log('📧 Using existing audience:', existing.id);
        targetAudienceId = existing.id;
      } else {
        // Create new audience
        console.log('📧 Creating new audience...');
        const createResponse = await fetch(`${RESEND_API_BASE}/audiences`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ name: audienceName })
        });

        if (!createResponse.ok) {
          const createError = await createResponse.text();
          console.error('Failed to create audience:', createError);
          return res.status(400).json({ error: 'Failed to create audience', details: createError });
        }

        const newAudience = await createResponse.json();
        console.log('📧 Created audience:', newAudience.id);
        targetAudienceId = newAudience.id;
      }
    }

    if (!targetAudienceId) {
      return res.status(400).json({ error: 'audienceId or audienceName required' });
    }

    // Filter contacts with valid emails
    const validContacts = contacts.filter(c => {
      if (!c.email) return false;
      const email = String(c.email).trim().toLowerCase();
      return email.includes('@') && email.includes('.');
    });

    if (validContacts.length === 0) {
      return res.status(400).json({
        error: 'No valid email addresses found',
        totalProvided: contacts.length
      });
    }

    // Add contacts to audience (batch)
    const results = {
      added: 0,
      skipped: 0,
      errors: []
    };

    // Resend API accepts individual contact adds
    // Rate limit: 2 requests per second, so we add 600ms delay between each
    console.log('📧 Starting to sync', validContacts.length, 'contacts to audience', targetAudienceId);

    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    for (let i = 0; i < validContacts.length; i++) {
      const contact = validContacts[i];

      // Add delay after first request to respect rate limit (2 req/sec)
      if (i > 0) {
        await delay(600);
      }
      try {
        const contactData = {
          email: contact.email.trim().toLowerCase(),
          first_name: contact.firstName || contact.businessName?.split(' ')[0] || '',
          last_name: contact.lastName || contact.businessName?.split(' ').slice(1).join(' ') || '',
          unsubscribed: false
        };

        console.log('📧 Adding contact:', contactData.email);

        const response = await fetch(`${RESEND_API_BASE}/audiences/${targetAudienceId}/contacts`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(contactData)
        });

        const responseText = await response.text();
        console.log('📧 Response for', contactData.email, ':', response.status, responseText);

        if (response.ok) {
          results.added++;
        } else {
          let error;
          try {
            error = JSON.parse(responseText);
          } catch {
            error = { message: responseText };
          }
          if (error.message?.includes('already exists')) {
            results.skipped++;
          } else {
            console.error('📧 Error adding contact:', contactData.email, error);
            results.errors.push({ email: contact.email, error: error.message || responseText });
          }
        }
      } catch (err) {
        console.error('📧 Exception adding contact:', contact.email, err.message);
        results.errors.push({ email: contact.email, error: err.message });
      }
    }

    console.log('📧 Sync complete. Added:', results.added, 'Skipped:', results.skipped, 'Errors:', results.errors.length);

    // Track sync in Supabase if available
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        await supabase.from('audience_syncs').insert({
          audience_id: targetAudienceId,
          contact_type: contactType || 'unknown',
          contacts_added: results.added,
          contacts_skipped: results.skipped,
          contacts_total: validContacts.length,
          synced_at: new Date().toISOString()
        });
      } catch (e) {
        console.warn('Failed to track sync in Supabase:', e.message);
      }
    }

    return res.status(200).json({
      success: true,
      audienceId: targetAudienceId,
      results: {
        totalProvided: contacts.length,
        validEmails: validContacts.length,
        added: results.added,
        skipped: results.skipped,
        errors: results.errors.length > 0 ? results.errors.slice(0, 10) : [] // Limit error details
      }
    });

  } catch (error) {
    console.error('Sync contacts error:', error);
    return res.status(500).json({ error: 'Failed to sync contacts', message: error.message });
  }
}
