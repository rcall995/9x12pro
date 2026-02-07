/**
 * Storage Module - IndexedDB and localStorage utilities
 * Extracted from app-main.js for modularization
 */

/* ========= LOCALSTORAGE UTILITY ========= */

// Safe localStorage wrapper with quota exceeded handling
function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    // Check if this is a quota exceeded error
    const isQuotaExceeded = err.name === 'QuotaExceededError' ||
                            err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
                            err.code === 22 || // Chrome
                            err.code === 1014; // Firefox

    if (isQuotaExceeded) {
      console.error('localStorage quota exceeded:', {
        key,
        valueSize: value.length,
        error: err.message
      });

      // Show user-friendly warning (only once per session)
      if (!window._localStorageQuotaWarningShown) {
        if (typeof toast === 'function') {
          toast('Local storage is full. Some data may not be saved offline. Consider clearing old cached data.', false);
        }
        window._localStorageQuotaWarningShown = true;
      }

      // Try to free up space by clearing old cache data
      try {
        // Clear places cache (largest non-critical data)
        localStorage.removeItem('mailslot-places-cache');

        // Retry the save after clearing cache
        localStorage.setItem(key, value);
        if (typeof toast === 'function') {
          toast('Freed up space and saved successfully', true);
        }
        return true;
      } catch (retryErr) {
        console.error('Failed to save even after clearing cache:', retryErr);
        return false;
      }
    } else {
      // Other localStorage error
      console.error('localStorage error:', err);
      return false;
    }
  }
}

function safeGetItem(key) {
  try {
    return localStorage.getItem(key);
  } catch (err) {
    console.error('localStorage getItem error:', err);
    return null;
  }
}

function safeRemoveItem(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (err) {
    console.error('localStorage removeItem error:', err);
    return false;
  }
}

/* ========= INDEXEDDB STORAGE ========= */
// IndexedDB for large data storage (50MB+ vs localStorage's 5MB)
const IDB_NAME = '9x12pro-db';
const IDB_VERSION = 1;
const IDB_STORE = 'appData';

let idbInstance = null;
let idbUnavailable = false; // Track if IndexedDB is broken to avoid error spam

// Initialize IndexedDB
function initIndexedDB() {
  return new Promise((resolve, reject) => {
    // If IndexedDB was previously detected as broken, don't keep trying
    if (idbUnavailable) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }

    if (idbInstance) {
      resolve(idbInstance);
      return;
    }

    // Check if IndexedDB exists at all
    if (typeof indexedDB === 'undefined' || !indexedDB) {
      idbUnavailable = true;
      console.log('⚠️ IndexedDB not available - using cloud sync only');
      reject(new Error('IndexedDB not available'));
      return;
    }

    try {
      const request = indexedDB.open(IDB_NAME, IDB_VERSION);

      request.onerror = (event) => {
        // Mark as unavailable to prevent further attempts
        idbUnavailable = true;
        console.log('⚠️ IndexedDB error - will use cloud sync only');
        reject(event.target.error);
      };

      request.onsuccess = (event) => {
        idbInstance = event.target.result;

        // Handle connection errors (can happen after successful open)
        idbInstance.onerror = (e) => {
          console.log('⚠️ IndexedDB connection error - switching to cloud sync');
          idbUnavailable = true;
          idbInstance = null;
        };

        console.log('IndexedDB initialized');
        resolve(idbInstance);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: 'key' });
          console.log('IndexedDB store created');
        }
      };

      // Handle blocked upgrades (another tab has the DB open)
      request.onblocked = () => {
        console.log('⚠️ IndexedDB blocked - using cloud sync');
        idbUnavailable = true;
        reject(new Error('IndexedDB blocked'));
      };
    } catch (err) {
      // Catch synchronous errors (corrupted browser state)
      idbUnavailable = true;
      console.log('⚠️ IndexedDB not functional - using cloud sync only');
      reject(err);
    }
  });
}

// Save data to IndexedDB (fails silently if IndexedDB is broken)
async function idbSet(key, value) {
  // Skip if IndexedDB is known to be broken
  if (idbUnavailable) return false;

  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([IDB_STORE], 'readwrite');
        const store = transaction.objectStore(IDB_STORE);
        const request = store.put({ key, value, timestamp: Date.now() });

        request.onsuccess = () => resolve(true);
        request.onerror = () => {
          // Silent fail - cloud sync is the primary storage
          resolve(false);
        };

        transaction.onerror = () => resolve(false);
        transaction.onabort = () => resolve(false);
      } catch (txErr) {
        // Transaction creation failed - mark as unavailable
        idbUnavailable = true;
        resolve(false);
      }
    });
  } catch (err) {
    // Silent fail - IndexedDB initialization failed
    return false;
  }
}

// Get data from IndexedDB (returns null if IndexedDB is broken)
async function idbGet(key) {
  // Skip if IndexedDB is known to be broken
  if (idbUnavailable) return null;

  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([IDB_STORE], 'readonly');
        const store = transaction.objectStore(IDB_STORE);
        const request = store.get(key);

        request.onsuccess = (event) => {
          const result = event.target.result;
          resolve(result ? result.value : null);
        };
        request.onerror = () => {
          // Silent fail - return null to trigger cloud fallback
          resolve(null);
        };

        transaction.onerror = () => resolve(null);
        transaction.onabort = () => resolve(null);
      } catch (txErr) {
        // Transaction creation failed - mark as unavailable
        idbUnavailable = true;
        resolve(null);
      }
    });
  } catch (err) {
    // Silent fail - let caller use cloud fallback
    return null;
  }
}

// Delete data from IndexedDB (fails silently if IndexedDB is broken)
async function idbDelete(key) {
  // Skip if IndexedDB is known to be broken
  if (idbUnavailable) return false;

  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([IDB_STORE], 'readwrite');
        const store = transaction.objectStore(IDB_STORE);
        const request = store.delete(key);

        request.onsuccess = () => resolve(true);
        request.onerror = () => resolve(false);
      } catch (txErr) {
        idbUnavailable = true;
        resolve(false);
      }
    });
  } catch (err) {
    return false;
  }
}

// Migrate data from localStorage to IndexedDB (one-time migration)
async function migrateLocalStorageToIDB() {
  // Skip migration if IndexedDB is broken
  if (idbUnavailable) return;

  const migrationKey = 'idb-migration-complete';
  if (localStorage.getItem(migrationKey)) return; // Already migrated

  console.log('Migrating localStorage to IndexedDB...');

  const keysToMigrate = ['mailslot-kanban', 'mailslot-places-cache', 'mailslot-prospect-cache'];

  for (const key of keysToMigrate) {
    try {
      const data = localStorage.getItem(key);
      if (data) {
        const success = await idbSet(key, JSON.parse(data));
        if (success) {
          localStorage.removeItem(key); // Free up localStorage space
          console.log(`Migrated ${key} to IndexedDB`);
        }
      }
    } catch (err) {
      // Silent fail - migration is optional
    }
  }

  localStorage.setItem(migrationKey, 'true');
  console.log('IndexedDB migration complete');
}

// Check if IndexedDB is available
function isIndexedDBAvailable() {
  return !idbUnavailable && idbInstance !== null;
}

// Reset IndexedDB availability flag (useful after user clears browser data)
function resetIndexedDB() {
  idbUnavailable = false;
  idbInstance = null;
  console.log('🔄 IndexedDB reset - will try to reinitialize on next use');
}

// Expose all functions globally
window.safeSetItem = safeSetItem;
window.safeGetItem = safeGetItem;
window.safeRemoveItem = safeRemoveItem;
window.initIndexedDB = initIndexedDB;
window.idbSet = idbSet;
window.idbGet = idbGet;
window.idbDelete = idbDelete;
window.migrateLocalStorageToIDB = migrateLocalStorageToIDB;
window.isIndexedDBAvailable = isIndexedDBAvailable;
window.resetIndexedDB = resetIndexedDB;

// Also expose constants for other modules
window.IDB_NAME = IDB_NAME;
window.IDB_VERSION = IDB_VERSION;
window.IDB_STORE = IDB_STORE;
