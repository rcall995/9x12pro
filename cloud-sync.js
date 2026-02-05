/**
 * Cloud Sync Module - Supabase cloud sync and offline support
 * Extracted from app-main.js for modularization
 * Dependencies: storage.js (idbSet, idbGet), utilities.js (toast)
 */

/* ========= CLOUD SYNC STATE ========= */
const cloudSyncState = {
  syncing: false,
  lastSync: null,
  pendingSaves: new Set(), // Track which data types need saving (temporary failures)
  permanentlyFailedSaves: new Set(), // Track data types that are too large (permanent failures)
  syncErrors: {},
  userNotified: new Set(), // Track which errors we've already notified user about
  inProgressSaves: new Map(), // Track saves currently in progress (dataType -> Promise)
  debouncedSaves: new Map() // Track debounced save timers (dataType -> timeoutId)
};

/* ========= OFFLINE SUPPORT ========= */
// Track online/offline state and queue failed syncs
const offlineState = {
  isOnline: navigator.onLine,
  syncQueue: [], // Queue of {dataType, data, timestamp} for offline saves
  retryInProgress: false
};

// Initialize offline sync queue from localStorage
function initOfflineSupport() {
  // Load any queued saves from localStorage
  try {
    const savedQueue = localStorage.getItem('offlineSyncQueue');
    if (savedQueue) {
      offlineState.syncQueue = JSON.parse(savedQueue);
      updateOfflineUI();
    }
  } catch (e) {
    console.warn('Failed to load offline sync queue:', e);
  }

  // Listen for online/offline events
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Initial UI update
  updateOfflineUI();
}

// Handle going online - retry queued syncs
async function handleOnline() {
  console.log('🌐 Back online!');
  offlineState.isOnline = true;
  updateOfflineUI();

  // Retry queued syncs
  if (offlineState.syncQueue.length > 0 && !offlineState.retryInProgress) {
    await retryQueuedSyncs();
  }
}

// Handle going offline
function handleOffline() {
  console.log('📴 Gone offline');
  offlineState.isOnline = false;
  updateOfflineUI();
}

// Update offline/sync UI indicators
function updateOfflineUI() {
  const offlineBanner = document.getElementById('offlineBanner');
  const syncQueueBanner = document.getElementById('syncQueueBanner');
  const pendingSyncCount = document.getElementById('pendingSyncCount');
  const syncingCount = document.getElementById('syncingCount');

  if (!offlineBanner) return; // Not loaded yet

  if (!offlineState.isOnline) {
    // Show offline banner
    offlineBanner.classList.remove('hidden');
    if (offlineState.syncQueue.length > 0) {
      pendingSyncCount.textContent = `${offlineState.syncQueue.length} pending`;
      pendingSyncCount.classList.remove('hidden');
    } else {
      pendingSyncCount.classList.add('hidden');
    }
    syncQueueBanner.classList.add('hidden');
  } else {
    // Hide offline banner
    offlineBanner.classList.add('hidden');

    // Show sync banner if retrying
    if (offlineState.retryInProgress && offlineState.syncQueue.length > 0) {
      syncQueueBanner.classList.remove('hidden');
      syncingCount.textContent = offlineState.syncQueue.length;
    } else {
      syncQueueBanner.classList.add('hidden');
    }
  }
}

// Queue a save for later when offline
function queueOfflineSave(dataType, data) {
  // Remove any existing entry for this dataType (keep latest only)
  offlineState.syncQueue = offlineState.syncQueue.filter(q => q.dataType !== dataType);

  // Add to queue
  offlineState.syncQueue.push({
    dataType,
    data,
    timestamp: Date.now()
  });

  // Persist to localStorage
  try {
    localStorage.setItem('offlineSyncQueue', JSON.stringify(offlineState.syncQueue));
  } catch (e) {
    console.warn('Failed to save offline sync queue:', e);
  }

  updateOfflineUI();
}

// Retry all queued syncs when back online
async function retryQueuedSyncs() {
  if (offlineState.retryInProgress || offlineState.syncQueue.length === 0) return;

  offlineState.retryInProgress = true;
  updateOfflineUI();

  console.log(`🔄 Retrying ${offlineState.syncQueue.length} queued syncs...`);

  const failedItems = [];

  for (const item of offlineState.syncQueue) {
    try {
      await saveToCloud(item.dataType, item.data);
      console.log(`✅ Synced queued ${item.dataType}`);
    } catch (e) {
      console.warn(`❌ Failed to sync queued ${item.dataType}:`, e);
      failedItems.push(item);
    }
  }

  // Update queue with only failed items
  offlineState.syncQueue = failedItems;

  // Persist updated queue
  try {
    if (failedItems.length > 0) {
      localStorage.setItem('offlineSyncQueue', JSON.stringify(failedItems));
    } else {
      localStorage.removeItem('offlineSyncQueue');
    }
  } catch (e) {
    console.warn('Failed to update offline sync queue:', e);
  }

  offlineState.retryInProgress = false;
  updateOfflineUI();

  if (failedItems.length === 0) {
    toast('All changes synced successfully!', true);
  } else {
    toast(`${failedItems.length} changes failed to sync. Will retry later.`, false);
  }
}

/* ========= CLOUD SYNC FUNCTIONS ========= */

// Unified function to load data from Supabase
async function loadFromCloud(dataType) {
  try {
    // Wait for auth if ACTIVE_USER not yet available (race condition fix)
    let userEmail = ACTIVE_USER;
    if (!userEmail) {
      // Try to get it from window.currentAuthUser
      if (window.currentAuthUser?.email) {
        userEmail = window.currentAuthUser.email;
        ACTIVE_USER = userEmail;
      } else {
        // Wait up to 3 seconds for auth to complete
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 100));
          if (window.currentAuthUser?.email) {
            userEmail = window.currentAuthUser.email;
            ACTIVE_USER = userEmail;
            break;
          }
        }
      }
    }

    // If still no user, fall back to IndexedDB cache
    if (!userEmail) {
      console.warn(`⚠️ No auth user for ${dataType}, using IndexedDB cache`);
      const cached = await idbGet(`mailslot-${dataType}`);
      return cached || null;
    }

    // Query Supabase app_data table for this data type
    const { data, error } = await supabaseClient
      .from('app_data')
      .select('data')
      .eq('user_email', userEmail)
      .eq('data_type', dataType)
      .single();

    if (error) {
      // If no data found (404), return null (not an error)
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    const appData = data?.data || null;

    // Cache to IndexedDB (async, don't block)
    if (appData !== null && appData !== undefined) {
      idbSet(`mailslot-${dataType}`, appData).catch(e => console.warn('IDB cache failed:', e));
    }

    return appData;
  } catch (err) {
    console.warn(`⚠️ Failed to load ${dataType} from cloud, using IndexedDB cache:`, err);
    cloudSyncState.syncErrors[dataType] = err.message;

    // Fallback to IndexedDB
    const cached = await idbGet(`mailslot-${dataType}`);
    return cached || null;
  }
}

// Unified function to save data to Supabase
async function saveToCloud(dataType, data, options = {}) {
  // Always save to IndexedDB first (local backup)
  await idbSet(`mailslot-${dataType}`, data).catch(e => console.warn('IDB backup failed:', e));

  // If offline, queue for later sync and return success (data is safe in IndexedDB)
  if (!navigator.onLine) {
    console.log(`📴 Offline - queuing ${dataType} for later sync`);
    queueOfflineSave(dataType, data);
    return { success: true, queued: true };
  }

  try {
    // Use upsert to insert or update
    const { error } = await supabaseClient
      .from('app_data')
      .upsert({
        user_email: ACTIVE_USER,
        data_type: dataType,
        data: data
      }, {
        onConflict: 'user_email,data_type'
      });

    if (error) throw error;

    cloudSyncState.lastSync = Date.now();
    delete cloudSyncState.syncErrors[dataType];

    return { success: true };

  } catch (err) {
    console.error(`❌ Failed to save ${dataType} to cloud:`, err);
    cloudSyncState.syncErrors[dataType] = err.message;

    // Check if this is a permanent failure (data too large)
    if (err.message && err.message.includes('Data too large')) {
      // Mark as permanently failed (don't retry)
      cloudSyncState.permanentlyFailedSaves.add(dataType);

      // Show user notification once
      if (!cloudSyncState.userNotified.has(dataType)) {
        toast(`⚠️ ${dataType} data is too large for cloud sync. Saved locally only.`, false);
        cloudSyncState.userNotified.add(dataType);
      }

      console.warn(`📦 ${dataType} marked as localStorage-only (too large for cloud sync)`);
    } else if (err.message && (err.message.includes('network') || err.message.includes('fetch') || err.message.includes('Failed to fetch'))) {
      // Network error - queue for retry
      console.log(`🔄 Network error - queuing ${dataType} for later sync`);
      queueOfflineSave(dataType, data);
      return { success: true, queued: true };
    } else {
      // Other temporary failure - add to retry queue
      cloudSyncState.pendingSaves.add(dataType);
    }

    throw err;
  }
}

// Optimized cloud sync wrapper - prevents duplicate simultaneous saves
// Optional debouncing for non-critical saves (set debounceMs > 0)
async function saveToCloudOptimized(dataType, data, debounceMs = 0) {
  // If this dataType is already being saved, wait for that save to complete
  // then trigger a new save with the latest data
  if (cloudSyncState.inProgressSaves.has(dataType)) {
    try {
      await cloudSyncState.inProgressSaves.get(dataType);
    } catch (err) {
      // Ignore errors from previous save, we'll try again
    }
  }

  // Clear any pending debounced save for this dataType (update to latest data)
  if (cloudSyncState.debouncedSaves.has(dataType)) {
    clearTimeout(cloudSyncState.debouncedSaves.get(dataType));
    cloudSyncState.debouncedSaves.delete(dataType);
  }

  // For non-critical saves with debouncing, delay the save
  if (debounceMs > 0) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(async () => {
        cloudSyncState.debouncedSaves.delete(dataType);

        const savePromise = saveToCloud(dataType, data)
          .finally(() => {
            cloudSyncState.inProgressSaves.delete(dataType);
          });

        cloudSyncState.inProgressSaves.set(dataType, savePromise);

        try {
          const result = await savePromise;
          resolve(result);
        } catch (err) {
          reject(err);
        }
      }, debounceMs);

      cloudSyncState.debouncedSaves.set(dataType, timeoutId);
    });
  }

  // For immediate/critical saves, execute right away
  const savePromise = saveToCloud(dataType, data)
    .finally(() => {
      cloudSyncState.inProgressSaves.delete(dataType);
    });

  cloudSyncState.inProgressSaves.set(dataType, savePromise);
  return savePromise;
}

// Auto-retry failed syncs (but not permanently failed ones)
// Uses CLOUD_SYNC_RETRY_INTERVAL from app config (default 60000ms)
setInterval(() => {
  // Remove any permanently failed saves from the retry queue
  cloudSyncState.permanentlyFailedSaves.forEach(dataType => {
    cloudSyncState.pendingSaves.delete(dataType);
  });

  if (cloudSyncState.pendingSaves.size > 0 && !cloudSyncState.syncing) {
    // Will be handled by individual save functions
  }
}, typeof CLOUD_SYNC_RETRY_INTERVAL !== 'undefined' ? CLOUD_SYNC_RETRY_INTERVAL : 60000);

// Expose all functions globally
window.cloudSyncState = cloudSyncState;
window.offlineState = offlineState;
window.initOfflineSupport = initOfflineSupport;
window.handleOnline = handleOnline;
window.handleOffline = handleOffline;
window.updateOfflineUI = updateOfflineUI;
window.queueOfflineSave = queueOfflineSave;
window.retryQueuedSyncs = retryQueuedSyncs;
window.loadFromCloud = loadFromCloud;
window.saveToCloud = saveToCloud;
window.saveToCloudOptimized = saveToCloudOptimized;
