/**
 * Utility Functions for 9x12 Pro
 * Provides sanitization, validation, and helper functions
 */

(function() {
  'use strict';

  window.Utils = {
    /**
     * Sanitize HTML to prevent XSS attacks
     * @param {string} html - The HTML string to sanitize
     * @returns {string} - Sanitized HTML
     */
    sanitizeHTML: function(html) {
      if (typeof html !== 'string') return '';

      const div = document.createElement('div');
      div.textContent = html;
      return div.innerHTML;
    },

    /**
     * Escape HTML entities
     * @param {string} text - Text to escape
     * @returns {string} - Escaped text
     */
    escapeHTML: function(text) {
      if (typeof text !== 'string') return '';

      const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      };
      return text.replace(/[&<>"']/g, m => map[m]);
    },

    /**
     * Safely set innerHTML with sanitization
     * @param {HTMLElement} element - The element to update
     * @param {string} html - The HTML to set
     */
    safeSetHTML: function(element, html) {
      if (!element) return;
      element.textContent = ''; // Clear existing content

      // If html is a simple string, just set textContent
      if (typeof html === 'string' && !html.includes('<')) {
        element.textContent = html;
        return;
      }

      // For complex HTML, sanitize it
      const sanitized = this.sanitizeHTML(html);
      element.innerHTML = sanitized;
    },

    /**
     * Validate email address
     * @param {string} email - Email to validate
     * @returns {boolean} - True if valid
     */
    isValidEmail: function(email) {
      const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return regex.test(email);
    },

    /**
     * Validate phone number (US format)
     * @param {string} phone - Phone to validate
     * @returns {boolean} - True if valid
     */
    isValidPhone: function(phone) {
      const cleaned = phone.replace(/\D/g, '');
      return cleaned.length === 10 || cleaned.length === 11;
    },

    /**
     * Validate URL
     * @param {string} url - URL to validate
     * @returns {boolean} - True if valid
     */
    isValidURL: function(url) {
      try {
        new URL(url);
        return true;
      } catch(e) {
        return false;
      }
    },

    /**
     * Validate ZIP code (US)
     * @param {string} zip - ZIP code to validate
     * @returns {boolean} - True if valid
     */
    isValidZipCode: function(zip) {
      const regex = /^\d{5}(-\d{4})?$/;
      return regex.test(zip);
    },

    /**
     * Format currency
     * @param {number} amount - Amount to format
     * @returns {string} - Formatted currency
     */
    formatCurrency: function(amount) {
      if (typeof amount !== 'number') amount = parseFloat(amount) || 0;
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(amount);
    },

    /**
     * Format phone number
     * @param {string} phone - Phone to format
     * @returns {string} - Formatted phone
     */
    formatPhone: function(phone) {
      const cleaned = phone.replace(/\D/g, '');
      const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
      if (match) {
        return '(' + match[1] + ') ' + match[2] + '-' + match[3];
      }
      return phone;
    },

    /**
     * Debounce function calls
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in ms
     * @returns {Function} - Debounced function
     */
    debounce: function(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    },

    /**
     * Deep clone an object
     * @param {*} obj - Object to clone
     * @returns {*} - Cloned object
     */
    deepClone: function(obj) {
      if (obj === null || typeof obj !== 'object') return obj;
      return JSON.parse(JSON.stringify(obj));
    },

    /**
     * Generate unique ID
     * @returns {string} - Unique ID
     */
    generateId: function() {
      return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    /**
     * Safe JSON parse
     * @param {string} json - JSON string to parse
     * @param {*} defaultValue - Default value if parse fails
     * @returns {*} - Parsed object or default value
     */
    safeJSONParse: function(json, defaultValue = null) {
      try {
        return JSON.parse(json);
      } catch(e) {
        window.errorLog('JSON parse error:', e);
        return defaultValue;
      }
    },

    /**
     * Safe localStorage get
     * @param {string} key - Storage key
     * @param {*} defaultValue - Default value if not found
     * @returns {*} - Stored value or default
     */
    getLocalStorage: function(key, defaultValue = null) {
      try {
        const item = localStorage.getItem(key);
        return item ? this.safeJSONParse(item, defaultValue) : defaultValue;
      } catch(e) {
        window.errorLog('localStorage get error:', e);
        return defaultValue;
      }
    },

    /**
     * Safe localStorage set
     * @param {string} key - Storage key
     * @param {*} value - Value to store
     * @returns {boolean} - True if successful
     */
    setLocalStorage: function(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch(e) {
        window.errorLog('localStorage set error (quota exceeded?):', e);
        return false;
      }
    },

    /**
     * Check localStorage quota
     * @returns {object} - {used, total, available} in MB
     */
    checkStorageQuota: function() {
      try {
        let total = 0;
        for (let key in localStorage) {
          if (localStorage.hasOwnProperty(key)) {
            total += localStorage[key].length + key.length;
          }
        }
        const usedMB = (total / 1024 / 1024).toFixed(2);
        const totalMB = 5; // Typical browser limit
        return {
          used: parseFloat(usedMB),
          total: totalMB,
          available: totalMB - parseFloat(usedMB)
        };
      } catch(e) {
        window.errorLog('Storage quota check error:', e);
        return null;
      }
    },

    /**
     * Show confirmation dialog (better than alert)
     * @param {string} message - Message to show
     * @param {Function} onConfirm - Callback if confirmed
     * @param {Function} onCancel - Callback if cancelled
     */
    confirm: function(message, onConfirm, onCancel) {
      // For now, use native confirm, but this can be replaced with a modal
      if (confirm(message)) {
        if (typeof onConfirm === 'function') onConfirm();
        return true;
      } else {
        if (typeof onCancel === 'function') onCancel();
        return false;
      }
    },

    /**
     * Retry a function with exponential backoff
     * @param {Function} fn - Function to retry
     * @param {number} maxAttempts - Maximum attempts
     * @param {number} delay - Initial delay in ms
     * @returns {Promise} - Promise that resolves when successful or rejects after max attempts
     */
    retry: async function(fn, maxAttempts = 3, delay = 1000) {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          return await fn();
        } catch(error) {
          if (attempt === maxAttempts) {
            throw error;
          }
          await new Promise(resolve => setTimeout(resolve, delay * attempt));
        }
      }
    }
  };

  console.log('✅ Utility functions loaded');
})();
