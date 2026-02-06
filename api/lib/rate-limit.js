/**
 * Simple rate limiter for Vercel serverless functions
 * Uses in-memory storage (resets on cold start, but still provides protection)
 *
 * Usage:
 *   import { rateLimit } from './lib/rate-limit.js';
 *
 *   export default async function handler(req, res) {
 *     const rateLimitResult = rateLimit(req, { limit: 20, window: 60 });
 *     if (!rateLimitResult.success) {
 *       return res.status(429).json({ error: 'Too many requests', retryAfter: rateLimitResult.retryAfter });
 *     }
 *     // ... rest of handler
 *   }
 */

// In-memory store (resets on cold start)
const requests = new Map();

// Clean up old entries periodically
const CLEANUP_INTERVAL = 60000; // 1 minute
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;

  lastCleanup = now;
  const cutoff = now - 300000; // 5 minutes ago

  for (const [key, data] of requests.entries()) {
    if (data.windowStart < cutoff) {
      requests.delete(key);
    }
  }
}

/**
 * Rate limit a request
 * @param {Object} req - Request object
 * @param {Object} options - Rate limit options
 * @param {number} options.limit - Max requests per window (default: 30)
 * @param {number} options.window - Window size in seconds (default: 60)
 * @param {string} options.keyPrefix - Optional prefix for the rate limit key
 * @returns {Object} { success: boolean, remaining: number, retryAfter?: number }
 */
export function rateLimit(req, options = {}) {
  const {
    limit = 30,
    window = 60,
    keyPrefix = ''
  } = options;

  // Clean up old entries
  cleanup();

  // Get identifier (user email > IP > fallback)
  const userEmail = req.headers['x-user-email'] ||
                    req.body?.userEmail ||
                    req.query?.email;
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
             req.headers['x-real-ip'] ||
             'unknown';

  const identifier = userEmail || ip;
  const key = `${keyPrefix}:${identifier}`;

  const now = Date.now();
  const windowMs = window * 1000;

  // Get or create request tracking
  let data = requests.get(key);

  if (!data || (now - data.windowStart) >= windowMs) {
    // New window
    data = {
      count: 0,
      windowStart: now
    };
  }

  data.count++;
  requests.set(key, data);

  const remaining = Math.max(0, limit - data.count);
  const resetTime = data.windowStart + windowMs;

  if (data.count > limit) {
    const retryAfter = Math.ceil((resetTime - now) / 1000);
    return {
      success: false,
      remaining: 0,
      retryAfter,
      limit,
      reset: resetTime
    };
  }

  return {
    success: true,
    remaining,
    limit,
    reset: resetTime
  };
}

/**
 * Apply rate limit headers to response
 */
export function setRateLimitHeaders(res, result) {
  res.setHeader('X-RateLimit-Limit', result.limit);
  res.setHeader('X-RateLimit-Remaining', result.remaining);
  res.setHeader('X-RateLimit-Reset', Math.ceil(result.reset / 1000));

  if (!result.success) {
    res.setHeader('Retry-After', result.retryAfter);
  }
}

/**
 * Middleware-style rate limiter
 * Returns null if allowed, or a response object if rate limited
 */
export function checkRateLimit(req, res, options = {}) {
  const result = rateLimit(req, options);
  setRateLimitHeaders(res, result);

  if (!result.success) {
    return {
      status: 429,
      body: {
        error: 'Too many requests',
        message: `Rate limit exceeded. Try again in ${result.retryAfter} seconds.`,
        retryAfter: result.retryAfter
      }
    };
  }

  return null;
}

export default rateLimit;
