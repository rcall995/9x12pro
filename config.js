/**
 * Configuration Management for 9x12 Pro
 * This file manages environment variables and API keys securely
 *
 * In production, these will be loaded from Vercel environment variables
 * In development, they can be set via .env.local or defaults
 */

(function() {
  'use strict';

  // Configuration object
  window.APP_CONFIG = {
    // Supabase Configuration
    supabase: {
      url: window.ENV_SUPABASE_URL || "https://kurhsdvxsgkgnfimfqdo.supabase.co",
      anonKey: window.ENV_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1cmhzZHZ4c2drZ25maW1mcWRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MDk3NDYsImV4cCI6MjA3ODM4NTc0Nn0.nB_GsE89WJ3eAQrgmNKb-fbCktHTHf-987D-G6lscZA"
    },

    // Google Maps API Configuration
    googleMaps: {
      apiKey: window.ENV_GOOGLE_MAPS_API_KEY || "AIzaSyCNzXL-8UT-JI1Dy9wBN14KtH-UDMbeOlo"
    },

    // Facebook API Configuration (disabled - not currently in use)
    // If you decide to implement Facebook Login in the future:
    // 1. NEVER put appSecret in client-side code (use server-side only)
    // 2. Only store appId here (safe to expose publicly)
    // 3. Store appSecret in Vercel environment variables for API routes
    facebook: {
      enabled: false,
      appId: "", // Disabled until needed
      version: "v18.0",
      permissions: ['email', 'public_profile']
    },

    // App Configuration
    app: {
      version: "2025-01-21-v3",
      environment: window.ENV_ENVIRONMENT || "production",
      enableDebugLogs: window.ENV_DEBUG === 'true' || false
    },

    // Auto-save intervals (in milliseconds)
    intervals: {
      autoSave: 15000, // 15 seconds
      cloudSync: 30000 // 30 seconds
    },

    // Cache settings
    cache: {
      searchResultsMaxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      retryAttempts: 3,
      retryDelay: 1000 // 1 second
    }
  };

  // Logging helper that respects debug mode
  window.debugLog = function() {
    if (window.APP_CONFIG.app.enableDebugLogs) {
      console.log.apply(console, arguments);
    }
  };

  // Error logging - always enabled
  window.errorLog = function() {
    console.error.apply(console, arguments);
  };

  // Warn logging - always enabled
  window.warnLog = function() {
    console.warn.apply(console, arguments);
  };

  console.log('✅ App configuration loaded - Version:', window.APP_CONFIG.app.version);
})();
