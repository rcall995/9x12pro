/**
 * Global Error Handler for 9x12 Pro
 * Catches and logs errors gracefully
 */

(function() {
  'use strict';

  // Error logging queue
  const errorQueue = [];
  const MAX_ERROR_QUEUE = 50;

  /**
   * Log error to console and optionally to remote service
   */
  function logError(error, context = {}) {
    const errorInfo = {
      timestamp: new Date().toISOString(),
      message: error.message || String(error),
      stack: error.stack || '',
      context: context,
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    // Add to queue
    errorQueue.push(errorInfo);
    if (errorQueue.length > MAX_ERROR_QUEUE) {
      errorQueue.shift();
    }

    // Log to console
    console.error('❌ Error caught:', errorInfo);

    // TODO: Send to error tracking service (Sentry, LogRocket, etc.)
    // sendToErrorTracking(errorInfo);
  }

  /**
   * Show user-friendly error message
   */
  function showUserError(message, isWarning = false) {
    // Use toast if available
    if (typeof window.toast === 'function') {
      window.toast(message, !isWarning);
    } else {
      // Fallback to console
      if (isWarning) {
        console.warn(message);
      } else {
        console.error(message);
      }
    }
  }

  /**
   * Handle uncaught errors
   */
  window.addEventListener('error', function(event) {
    event.preventDefault();
    logError(event.error || new Error(event.message), {
      type: 'uncaught',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
    showUserError('An unexpected error occurred. Please refresh the page if problems persist.');
  });

  /**
   * Handle unhandled promise rejections
   */
  window.addEventListener('unhandledrejection', function(event) {
    event.preventDefault();
    logError(event.reason || new Error('Unhandled Promise Rejection'), {
      type: 'promise',
      promise: event.promise
    });
    showUserError('An unexpected error occurred. Please refresh the page if problems persist.');
  });

  /**
   * Wrap async functions with error handling
   */
  window.asyncErrorHandler = function(fn, context = '') {
    return async function(...args) {
      try {
        return await fn.apply(this, args);
      } catch(error) {
        logError(error, { function: context, args });
        showUserError(`Error in ${context || 'operation'}: ${error.message}`);
        throw error; // Re-throw so caller can handle if needed
      }
    };
  };

  /**
   * Wrap sync functions with error handling
   */
  window.errorHandler = function(fn, context = '') {
    return function(...args) {
      try {
        return fn.apply(this, args);
      } catch(error) {
        logError(error, { function: context, args });
        showUserError(`Error in ${context || 'operation'}: ${error.message}`);
        throw error; // Re-throw so caller can handle if needed
      }
    };
  };

  /**
   * Safe function execution with fallback
   */
  window.safeTry = function(fn, fallback = null, context = '') {
    try {
      return fn();
    } catch(error) {
      logError(error, { function: context });
      return fallback;
    }
  };

  /**
   * Get error queue (for debugging)
   */
  window.getErrorLog = function() {
    return [...errorQueue];
  };

  /**
   * Clear error queue
   */
  window.clearErrorLog = function() {
    errorQueue.length = 0;
  };

  // Expose error logging function
  window.logError = logError;
  window.showUserError = showUserError;

  console.log('✅ Global error handler initialized');
})();
