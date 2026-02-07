/**
 * Square Checkout API - Create a checkout session for subscription
 * POST /api/square/create-checkout
 *
 * Body: { planId: 'starter' | 'pro' | 'enterprise', userEmail: string }
 */

import { Client, Environment } from 'square';
import { checkRateLimit } from '../lib/rate-limit.js';

const SQUARE_ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN;
const SQUARE_LOCATION_ID = process.env.SQUARE_LOCATION_ID;
const SQUARE_ENVIRONMENT = process.env.SQUARE_ENVIRONMENT || 'sandbox';

// Subscription plans configuration
const PLANS = {
  starter: {
    name: '9x12 Pro Starter',
    priceMonthly: 4900, // $49.00 in cents
    catalogObjectId: process.env.SQUARE_STARTER_PLAN_ID,
    features: {
      aiGenerations: 100,
      enrichments: 500,
      campaigns: 1
    }
  },
  pro: {
    name: '9x12 Pro Professional',
    priceMonthly: 9900, // $99.00 in cents
    catalogObjectId: process.env.SQUARE_PRO_PLAN_ID,
    features: {
      aiGenerations: 500,
      enrichments: 2000,
      campaigns: 5
    }
  },
  enterprise: {
    name: '9x12 Pro Enterprise',
    priceMonthly: 19900, // $199.00 in cents
    catalogObjectId: process.env.SQUARE_ENTERPRISE_PLAN_ID,
    features: {
      aiGenerations: -1, // unlimited
      enrichments: -1, // unlimited
      campaigns: -1 // unlimited
    }
  }
};

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limit: 10 requests per minute (payment creation should be infrequent)
  const rateLimited = checkRateLimit(req, res, { limit: 10, window: 60, keyPrefix: 'checkout' });
  if (rateLimited) {
    return res.status(rateLimited.status).json(rateLimited.body);
  }

  // Check configuration
  if (!SQUARE_ACCESS_TOKEN || !SQUARE_LOCATION_ID) {
    console.error('Square API not configured');
    return res.status(503).json({ error: 'Payment system not configured' });
  }

  const { planId, userEmail } = req.body;

  // Validate inputs
  if (!planId || !PLANS[planId]) {
    return res.status(400).json({ error: 'Invalid plan selected' });
  }

  if (!userEmail || !userEmail.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  const plan = PLANS[planId];

  try {
    const client = new Client({
      accessToken: SQUARE_ACCESS_TOKEN,
      environment: SQUARE_ENVIRONMENT === 'production'
        ? Environment.Production
        : Environment.Sandbox
    });

    // Create checkout session
    const { result } = await client.checkoutApi.createPaymentLink({
      idempotencyKey: `${userEmail}-${planId}-${Date.now()}`,
      order: {
        locationId: SQUARE_LOCATION_ID,
        lineItems: [
          {
            name: plan.name,
            quantity: '1',
            basePriceMoney: {
              amount: BigInt(plan.priceMonthly),
              currency: 'USD'
            },
            note: `Monthly subscription - ${planId} plan`
          }
        ]
      },
      checkoutOptions: {
        redirectUrl: `${process.env.VERCEL_URL || 'https://9x12pro.com'}/payment-success?plan=${planId}`,
        askForShippingAddress: false,
        merchantSupportEmail: 'support@9x12pro.com'
      },
      prePopulatedData: {
        buyerEmail: userEmail
      }
    });

    console.log(`✅ Created checkout for ${userEmail} - Plan: ${planId}`);

    return res.status(200).json({
      success: true,
      checkoutUrl: result.paymentLink.url,
      orderId: result.paymentLink.orderId
    });

  } catch (error) {
    console.error('Square checkout error:', error);
    return res.status(500).json({
      error: 'Failed to create checkout session',
      details: error.message
    });
  }
}
