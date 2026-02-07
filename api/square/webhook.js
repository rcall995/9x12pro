/**
 * Square Webhook Handler
 * POST /api/square/webhook
 *
 * Handles payment events from Square:
 * - payment.completed
 * - subscription.created
 * - subscription.updated
 * - invoice.payment_made
 */

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const SQUARE_WEBHOOK_SIGNATURE_KEY = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Initialize Supabase with service role for admin operations
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Verify Square webhook signature
function verifySignature(body, signature) {
  if (!SQUARE_WEBHOOK_SIGNATURE_KEY) {
    console.warn('Webhook signature key not configured - skipping verification');
    return true; // Skip in development
  }

  const hmac = crypto.createHmac('sha256', SQUARE_WEBHOOK_SIGNATURE_KEY);
  hmac.update(body);
  const expectedSignature = hmac.digest('base64');

  return signature === expectedSignature;
}

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get raw body for signature verification
  const rawBody = JSON.stringify(req.body);
  const signature = req.headers['x-square-signature'];

  // Verify webhook signature
  if (!verifySignature(rawBody, signature)) {
    console.error('Invalid webhook signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = req.body;
  const eventType = event.type;

  console.log(`📥 Square webhook received: ${eventType}`);

  try {
    switch (eventType) {
      case 'payment.completed':
        await handlePaymentCompleted(event.data.object.payment);
        break;

      case 'subscription.created':
        await handleSubscriptionCreated(event.data.object.subscription);
        break;

      case 'subscription.updated':
        await handleSubscriptionUpdated(event.data.object.subscription);
        break;

      case 'invoice.payment_made':
        await handleInvoicePayment(event.data.object.invoice);
        break;

      default:
        console.log(`Unhandled event type: ${eventType}`);
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}

async function handlePaymentCompleted(payment) {
  console.log(`💰 Payment completed: ${payment.id} - $${payment.amountMoney.amount / 100}`);

  const customerEmail = payment.buyerEmailAddress;
  if (!customerEmail) {
    console.warn('No customer email in payment');
    return;
  }

  // Record payment in database
  const { error } = await supabase
    .from('payments')
    .insert({
      square_payment_id: payment.id,
      user_email: customerEmail,
      amount_cents: Number(payment.amountMoney.amount),
      currency: payment.amountMoney.currency,
      status: payment.status,
      created_at: payment.createdAt
    });

  if (error) {
    console.error('Failed to record payment:', error);
  }
}

async function handleSubscriptionCreated(subscription) {
  console.log(`🎉 Subscription created: ${subscription.id}`);

  const customerId = subscription.customerId;

  // Look up customer email
  // Note: You may need to store customer mapping when creating checkout

  // Update user's subscription status
  const { error } = await supabase
    .from('subscriptions')
    .upsert({
      square_subscription_id: subscription.id,
      square_customer_id: customerId,
      plan_id: subscription.planId,
      status: subscription.status,
      start_date: subscription.startDate,
      updated_at: new Date().toISOString()
    });

  if (error) {
    console.error('Failed to record subscription:', error);
  }
}

async function handleSubscriptionUpdated(subscription) {
  console.log(`🔄 Subscription updated: ${subscription.id} - Status: ${subscription.status}`);

  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: subscription.status,
      updated_at: new Date().toISOString()
    })
    .eq('square_subscription_id', subscription.id);

  if (error) {
    console.error('Failed to update subscription:', error);
  }
}

async function handleInvoicePayment(invoice) {
  console.log(`📄 Invoice payment: ${invoice.id}`);

  // Record invoice payment
  const { error } = await supabase
    .from('invoices')
    .upsert({
      square_invoice_id: invoice.id,
      subscription_id: invoice.subscriptionId,
      amount_cents: Number(invoice.paymentRequests?.[0]?.computedAmountMoney?.amount || 0),
      status: invoice.status,
      due_date: invoice.paymentRequests?.[0]?.dueDate,
      paid_at: new Date().toISOString()
    });

  if (error) {
    console.error('Failed to record invoice:', error);
  }
}
