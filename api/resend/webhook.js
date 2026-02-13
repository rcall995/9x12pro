/**
 * Resend Webhook Handler
 * POST /api/resend/webhook
 *
 * Receives email events from Resend (via Svix) and increments
 * engagement counters in the broadcast_stats table.
 *
 * Events: email.sent, email.delivered, email.opened, email.clicked,
 *         email.bounced, email.complained
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET;

// Map Resend event types to broadcast_stats column names
const EVENT_TO_STAT = {
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.opened': 'opened',
  'email.clicked': 'clicked',
  'email.bounced': 'bounced',
  'email.complained': 'complained'
};

/**
 * Verify Svix webhook signature
 * https://docs.svix.com/receiving/verifying-payloads/how
 */
function verifyWebhookSignature(payload, headers) {
  if (!WEBHOOK_SECRET) {
    console.warn('RESEND_WEBHOOK_SECRET not set — skipping signature verification');
    return true;
  }

  const msgId = headers['svix-id'];
  const msgTimestamp = headers['svix-timestamp'];
  const msgSignature = headers['svix-signature'];

  if (!msgId || !msgTimestamp || !msgSignature) {
    return false;
  }

  // Replay protection: reject timestamps > 5 minutes old
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(msgTimestamp, 10);
  if (Math.abs(now - ts) > 300) {
    console.warn('Webhook timestamp too old:', msgTimestamp);
    return false;
  }

  // Svix secret is base64-encoded with "whsec_" prefix
  const secretBytes = Buffer.from(WEBHOOK_SECRET.replace('whsec_', ''), 'base64');
  const toSign = `${msgId}.${msgTimestamp}.${typeof payload === 'string' ? payload : JSON.stringify(payload)}`;
  const expectedSignature = crypto
    .createHmac('sha256', secretBytes)
    .update(toSign)
    .digest('base64');

  // Svix sends multiple signatures separated by spaces: "v1,<sig1> v1,<sig2>"
  const signatures = msgSignature.split(' ');
  for (const sig of signatures) {
    const sigValue = sig.split(',')[1];
    if (sigValue === expectedSignature) {
      return true;
    }
  }

  return false;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify signature
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  if (!verifyWebhookSignature(rawBody, req.headers)) {
    console.error('Webhook signature verification failed');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const eventType = event.type;
  const statName = EVENT_TO_STAT[eventType];

  if (!statName) {
    // Unhandled event type — acknowledge so Resend doesn't retry
    return res.status(200).json({ received: true, skipped: eventType });
  }

  // Extract broadcast_id from event data
  // Resend includes tags in the event; broadcast emails include broadcast_id in headers
  const data = event.data || {};

  // The broadcast_id can come from:
  // 1. data.tags.broadcast_id (if tags are set)
  // 2. data.email_id (the Resend email ID, which maps to our resend_id in email_broadcasts)
  // For broadcasts, Resend includes the broadcast_id in the event data
  let broadcastId = data.broadcast_id || data.tags?.broadcast_id;

  // If no explicit broadcast_id, try to find it from email headers
  if (!broadcastId && data.headers) {
    const bcHeader = data.headers.find(h => h.name === 'X-Broadcast-Id');
    if (bcHeader) broadcastId = bcHeader.value;
  }

  // Last resort: use email_id as identifier
  if (!broadcastId) {
    broadcastId = data.email_id;
  }

  if (!broadcastId) {
    // Can't attribute this event — acknowledge anyway
    return res.status(200).json({ received: true, skipped: 'no_broadcast_id' });
  }

  // Increment the stat in Supabase
  if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      const { error } = await supabase.rpc('increment_broadcast_stat', {
        p_broadcast_id: broadcastId,
        p_stat: statName,
        p_amount: 1
      });

      if (error) {
        console.error('Failed to increment broadcast stat:', error.message);
        // Return 200 anyway to prevent Resend retries that would keep failing
      }
    } catch (e) {
      console.error('Webhook DB error:', e.message);
      // Return 200 anyway
    }
  }

  return res.status(200).json({ received: true, event: eventType, broadcast_id: broadcastId });
}
