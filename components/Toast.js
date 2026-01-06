/**
 * Toast Notification System
 *
 * Replaces alert() calls with non-blocking toast notifications.
 * Supports success, warning, error, and info types.
 * Auto-dismisses after configurable duration.
 * Stacks multiple toasts vertically without overlap.
 */

class ToastManager {
  constructor() {
    this.toasts = [];
    this.container = null;
    this.initContainer();
  }

  /**
   * Initialize toast container
   */
  initContainer() {
    // Check if container already exists
    this.container = document.getElementById('toast-container');

    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'toast-container';
      this.container.style.cssText = `
        position: fixed;
        bottom: 22px;
        right: 22px;
        z-index: 10000;
        pointer-events: none;
      `;
      document.body.appendChild(this.container);
    }
  }

  /**
   * Reposition all toasts to stack properly
   */
  repositionToasts() {
    let offset = 0;
    // Iterate through visible toasts and stack them
    this.toasts.forEach((toast) => {
      if (toast.element && toast.element.parentNode) {
        toast.element.style.bottom = offset + 'px';
        offset += toast.element.offsetHeight + 10; // 10px gap
      }
    });
  }

  /**
   * Show a toast notification
   * @param {string} message - The message to display
   * @param {string} type - Type: 'success', 'warning', 'error', 'info'
   * @param {number} duration - Duration in ms (default: 3000)
   */
  show(message, type = 'success', duration = 3000) {
    const toast = this.createToast(message, type, duration);
    this.toasts.push(toast);
    this.container.appendChild(toast.element);

    // Trigger animation after a tiny delay (allows CSS to apply)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        toast.element.classList.add('toast-show');
        this.repositionToasts();
      });
    });

    // Auto-dismiss
    if (duration > 0) {
      toast.timeout = setTimeout(() => {
        this.dismiss(toast);
      }, duration);
    }

    return toast;
  }

  /**
   * Create toast element
   * @private
   */
  createToast(message, type, duration) {
    const element = document.createElement('div');
    element.className = `toast toast-${type}`;
    element.style.cssText = `
      position: absolute;
      right: 0;
      bottom: 0;
      padding: 0.75rem 1rem;
      border-radius: 0.5rem;
      color: #fff;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
      min-width: 250px;
      max-width: 400px;
      font-size: 0.875rem;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      pointer-events: all;
      cursor: pointer;
      opacity: 0;
      transform: translateX(100%);
      transition: all 0.3s ease-out;
    `;

    // Set background color based on type
    const colors = {
      success: '#059669', // green-600
      warning: '#d97706', // amber-600
      error: '#dc2626',   // red-600
      info: '#2563eb'     // blue-600
    };
    element.style.backgroundColor = colors[type] || colors.success;

    // Add icon based on type
    const icons = {
      success: '✓',
      warning: '⚠',
      error: '✕',
      info: 'ℹ'
    };
    const icon = icons[type] || icons.info;

    element.innerHTML = `
      <span style="font-size: 1.25rem; font-weight: 700;">${icon}</span>
      <span style="flex: 1;">${this.escapeHtml(message)}</span>
      <span style="opacity: 0.7; font-size: 0.75rem; margin-left: 8px;">✕</span>
    `;

    const toast = {
      element,
      type,
      message,
      timeout: null
    };

    // Click to dismiss
    element.addEventListener('click', () => {
      this.dismiss(toast);
    });

    return toast;
  }

  /**
   * Dismiss a toast
   * @param {Object} toast - Toast object to dismiss
   */
  dismiss(toast) {
    if (!toast || !toast.element) return;

    // Clear timeout if exists
    if (toast.timeout) {
      clearTimeout(toast.timeout);
    }

    // Animate out
    toast.element.style.opacity = '0';
    toast.element.style.transform = 'translateX(100%)';

    // Remove from array immediately to update positions
    const index = this.toasts.indexOf(toast);
    if (index > -1) {
      this.toasts.splice(index, 1);
    }

    // Reposition remaining toasts
    setTimeout(() => {
      this.repositionToasts();
    }, 50);

    // Remove from DOM after animation
    setTimeout(() => {
      if (toast.element && toast.element.parentNode) {
        toast.element.parentNode.removeChild(toast.element);
      }
    }, 300);
  }

  /**
   * Dismiss all toasts
   */
  dismissAll() {
    [...this.toasts].forEach(toast => this.dismiss(toast));
  }

  /**
   * Escape HTML to prevent XSS
   * @private
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize when DOM is ready
function initToastSystem() {
  // Add show class animation
  const style = document.createElement('style');
  style.textContent = `
    .toast-show {
      opacity: 1 !important;
      transform: translateX(0) !important;
    }
  `;
  document.head.appendChild(style);

  // Create global instance
  window.toastManager = new ToastManager();

  /**
   * Global convenience functions
   */
  window.showToast = (message, type = 'success', duration = 3000) => {
    return window.toastManager.show(message, type, duration);
  };

  window.showSuccess = (message, duration = 3000) => {
    return window.toastManager.show(message, 'success', duration);
  };

  window.showWarning = (message, duration = 3000) => {
    return window.toastManager.show(message, 'warning', duration);
  };

  window.showError = (message, duration = 4000) => {
    return window.toastManager.show(message, 'error', duration);
  };

  window.showInfo = (message, duration = 3000) => {
    return window.toastManager.show(message, 'info', duration);
  };

  window.dismissAllToasts = () => {
    window.toastManager.dismissAll();
  };

  console.log('✅ Toast notification system loaded');
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initToastSystem);
} else {
  // DOM already loaded
  initToastSystem();
}
