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

// Initialize IndexedDB
function initIndexedDB() {
  return new Promise((resolve, reject) => {
    if (idbInstance) {
      resolve(idbInstance);
      return;
    }

    const request = indexedDB.open(IDB_NAME, IDB_VERSION);

    request.onerror = (event) => {
      console.error('IndexedDB error:', event.target.error);
      reject(event.target.error);
    };

    request.onsuccess = (event) => {
      idbInstance = event.target.result;
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
  });
}

// Save data to IndexedDB
async function idbSet(key, value) {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([IDB_STORE], 'readwrite');
      const store = transaction.objectStore(IDB_STORE);
      const request = store.put({ key, value, timestamp: Date.now() });

      request.onsuccess = () => resolve(true);
      request.onerror = (event) => {
        console.error(`IndexedDB save error for ${key}:`, event.target.error);
        reject(event.target.error);
      };
    });
  } catch (err) {
    console.error('IndexedDB set failed:', err);
    return false;
  }
}

// Get data from IndexedDB
async function idbGet(key) {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([IDB_STORE], 'readonly');
      const store = transaction.objectStore(IDB_STORE);
      const request = store.get(key);

      request.onsuccess = (event) => {
        const result = event.target.result;
        resolve(result ? result.value : null);
      };
      request.onerror = (event) => {
        console.error(`IndexedDB get error for ${key}:`, event.target.error);
        reject(event.target.error);
      };
    });
  } catch (err) {
    console.error('IndexedDB get failed:', err);
    return null;
  }
}

// Delete data from IndexedDB
async function idbDelete(key) {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([IDB_STORE], 'readwrite');
      const store = transaction.objectStore(IDB_STORE);
      const request = store.delete(key);

      request.onsuccess = () => resolve(true);
      request.onerror = (event) => reject(event.target.error);
    });
  } catch (err) {
    console.error('IndexedDB delete failed:', err);
    return false;
  }
}

// Migrate data from localStorage to IndexedDB (one-time migration)
async function migrateLocalStorageToIDB() {
  const migrationKey = 'idb-migration-complete';
  if (localStorage.getItem(migrationKey)) return; // Already migrated

  console.log('Migrating localStorage to IndexedDB...');

  const keysToMigrate = ['mailslot-kanban', 'mailslot-places-cache', 'mailslot-prospect-cache'];

  for (const key of keysToMigrate) {
    try {
      const data = localStorage.getItem(key);
      if (data) {
        await idbSet(key, JSON.parse(data));
        localStorage.removeItem(key); // Free up localStorage space
        console.log(`Migrated ${key} to IndexedDB`);
      }
    } catch (err) {
      console.warn(`Failed to migrate ${key}:`, err);
    }
  }

  localStorage.setItem(migrationKey, 'true');
  console.log('IndexedDB migration complete');
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

// Also expose constants for other modules
window.IDB_NAME = IDB_NAME;
window.IDB_VERSION = IDB_VERSION;
window.IDB_STORE = IDB_STORE;
