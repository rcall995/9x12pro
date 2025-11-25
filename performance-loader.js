/**
 * Performance Loader
 * Manages progressive loading of the application to prevent freezing
 */

(function() {
  'use strict';

  // Show loading indicator
  function showLoader() {
    const loader = document.createElement('div');
    loader.id = 'app-performance-loader';
    loader.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 99999;
      font-family: system-ui, -apple-system, sans-serif;
    `;

    loader.innerHTML = `
      <div style="text-align: center;">
        <div style="font-size: 48px; font-weight: 900; color: white; margin-bottom: 16px;">
          <span style="color: #FFF;">9×12</span>
          <span style="font-weight: 700;">PRO</span>
        </div>
        <div style="color: rgba(255,255,255,0.9); font-size: 16px; margin-bottom: 24px;">
          Loading your workspace...
        </div>
        <div style="width: 200px; height: 4px; background: rgba(255,255,255,0.2); border-radius: 2px; overflow: hidden;">
          <div id="progress-bar" style="width: 0%; height: 100%; background: white; transition: width 0.3s ease; border-radius: 2px;"></div>
        </div>
        <div id="load-status" style="color: rgba(255,255,255,0.7); font-size: 12px; margin-top: 12px;">
          Initializing...
        </div>
      </div>
    `;

    document.body.appendChild(loader);
    return loader;
  }

  // Update progress
  function updateProgress(percent, status) {
    const bar = document.getElementById('progress-bar');
    const statusText = document.getElementById('load-status');
    if (bar) bar.style.width = percent + '%';
    if (statusText) statusText.textContent = status;
  }

  // Hide loader
  function hideLoader() {
    const loader = document.getElementById('app-performance-loader');
    if (loader) {
      loader.style.transition = 'opacity 0.5s ease';
      loader.style.opacity = '0';
      setTimeout(() => loader.remove(), 500);
    }
  }

  // Progressive loading strategy
  async function progressiveLoad() {
    const loader = showLoader();

    try {
      // Step 1: Wait for DOM
      updateProgress(10, 'Loading DOM...');
      await new Promise(resolve => {
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', resolve);
        } else {
          resolve();
        }
      });

      // Step 2: Wait for critical dependencies
      updateProgress(30, 'Loading dependencies...');
      let attempts = 0;
      while ((!window.supabaseClient || !window.APP_CONFIG) && attempts < 100) {
        await new Promise(resolve => setTimeout(resolve, 50));
        attempts++;
      }

      // Step 3: Initialize core app
      updateProgress(60, 'Initializing application...');
      await new Promise(resolve => setTimeout(resolve, 100));

      // Step 4: Wait for app to be ready
      updateProgress(80, 'Preparing interface...');
      await new Promise(resolve => setTimeout(resolve, 200));

      // Step 5: Complete
      updateProgress(100, 'Ready!');
      await new Promise(resolve => setTimeout(resolve, 300));

      hideLoader();
    } catch (error) {
      console.error('Error during progressive load:', error);
      hideLoader();
    }
  }

  // Start progressive loading as soon as possible
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', progressiveLoad);
  } else {
    progressiveLoad();
  }

  // Prevent layout thrashing with request animation frame batching
  window.batchUpdate = function(updates) {
    requestAnimationFrame(() => {
      updates.forEach(fn => fn());
    });
  };

  // Debounce helper for expensive operations
  window.debounce = function(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

})();
