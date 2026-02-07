/**
 * Input Validation & Security Utilities
 * Provides SSRF protection, URL validation, and input sanitization
 */

/**
 * Validate and sanitize a URL, blocking private/internal IPs (SSRF protection)
 * @param {string} url - URL to validate
 * @returns {{ valid: boolean, url?: string, error?: string }}
 */
export function validateUrl(url) {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required' };
  }

  // Trim and normalize
  let normalizedUrl = url.trim();

  // Add protocol if missing
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = 'https://' + normalizedUrl;
  }

  // Parse URL
  let parsed;
  try {
    parsed = new URL(normalizedUrl);
  } catch (e) {
    return { valid: false, error: 'Invalid URL format' };
  }

  // Only allow http/https protocols
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { valid: false, error: 'Only HTTP/HTTPS URLs are allowed' };
  }

  // Block private/internal IP ranges (SSRF protection)
  const hostname = parsed.hostname.toLowerCase();

  // Block localhost and common internal hostnames
  const blockedHostnames = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
    'metadata.google.internal',
    'metadata',
    'instance-data',
    '169.254.169.254', // AWS/GCP metadata
    'metadata.internal'
  ];

  if (blockedHostnames.includes(hostname)) {
    return { valid: false, error: 'Internal URLs are not allowed' };
  }

  // Block private IP ranges
  if (isPrivateIP(hostname)) {
    return { valid: false, error: 'Private IP addresses are not allowed' };
  }

  // Block URLs with credentials
  if (parsed.username || parsed.password) {
    return { valid: false, error: 'URLs with credentials are not allowed' };
  }

  // Block file:// and other dangerous protocols (double-check)
  if (normalizedUrl.toLowerCase().startsWith('file:') ||
      normalizedUrl.toLowerCase().startsWith('ftp:') ||
      normalizedUrl.toLowerCase().startsWith('gopher:')) {
    return { valid: false, error: 'Protocol not allowed' };
  }

  return { valid: true, url: normalizedUrl };
}

/**
 * Check if an IP address is in a private range
 * @param {string} ip - IP address or hostname
 * @returns {boolean}
 */
function isPrivateIP(ip) {
  // Check if it looks like an IP address
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = ip.match(ipv4Regex);

  if (!match) {
    // Check for IPv6 loopback
    if (ip === '::1' || ip.startsWith('fe80:') || ip.startsWith('fc') || ip.startsWith('fd')) {
      return true;
    }
    return false; // Not an IP address (probably a hostname)
  }

  const parts = match.slice(1).map(Number);

  // Validate IP octets
  if (parts.some(p => p > 255)) {
    return true; // Invalid IP, treat as blocked
  }

  const [a, b, c, d] = parts;

  // 10.0.0.0/8 - Private
  if (a === 10) return true;

  // 172.16.0.0/12 - Private
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.168.0.0/16 - Private
  if (a === 192 && b === 168) return true;

  // 127.0.0.0/8 - Loopback
  if (a === 127) return true;

  // 169.254.0.0/16 - Link-local
  if (a === 169 && b === 254) return true;

  // 0.0.0.0/8 - Current network
  if (a === 0) return true;

  // 224.0.0.0/4 - Multicast
  if (a >= 224 && a <= 239) return true;

  // 240.0.0.0/4 - Reserved
  if (a >= 240) return true;

  return false;
}

/**
 * Sanitize a string to prevent XSS when used in HTML
 * @param {string} str - String to sanitize
 * @returns {string}
 */
export function escapeHtml(str) {
  if (!str || typeof str !== 'string') return '';

  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' };
  }

  const trimmed = email.trim().toLowerCase();

  // Basic format check
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: 'Invalid email format' };
  }

  // Length check
  if (trimmed.length > 254) {
    return { valid: false, error: 'Email too long' };
  }

  return { valid: true, email: trimmed };
}

/**
 * Validate ZIP code format
 * @param {string} zip - ZIP code to validate
 * @returns {{ valid: boolean, zip?: string, error?: string }}
 */
export function validateZipCode(zip) {
  if (!zip || typeof zip !== 'string') {
    return { valid: false, error: 'ZIP code is required' };
  }

  const cleaned = zip.trim().replace(/\D/g, '');

  // Must be 5 digits
  if (!/^\d{5}$/.test(cleaned)) {
    return { valid: false, error: 'Invalid ZIP code format (must be 5 digits)' };
  }

  return { valid: true, zip: cleaned };
}

/**
 * Validate and limit string length
 * @param {string} str - String to validate
 * @param {number} maxLength - Maximum allowed length
 * @returns {{ valid: boolean, value?: string, error?: string }}
 */
export function validateStringLength(str, maxLength = 1000) {
  if (str === undefined || str === null) {
    return { valid: true, value: '' };
  }

  if (typeof str !== 'string') {
    return { valid: false, error: 'Invalid input type' };
  }

  const trimmed = str.trim();

  if (trimmed.length > maxLength) {
    return { valid: false, error: `Input exceeds maximum length of ${maxLength} characters` };
  }

  return { valid: true, value: trimmed };
}

/**
 * Validate request body size
 * @param {Object} req - Request object
 * @param {number} maxSizeBytes - Maximum body size in bytes
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateRequestSize(req, maxSizeBytes = 100000) { // 100KB default
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);

  if (contentLength > maxSizeBytes) {
    return { valid: false, error: `Request body too large (max ${Math.round(maxSizeBytes / 1024)}KB)` };
  }

  return { valid: true };
}

export default {
  validateUrl,
  escapeHtml,
  validateEmail,
  validateZipCode,
  validateStringLength,
  validateRequestSize
};
