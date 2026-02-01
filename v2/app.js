/**
 * 9x12 Pro v2 - Simplified Lead Management
 *
 * Core Features:
 * - Prospect search (ZIP + category)
 * - Pipeline management (New → Contacted → Interested → Client)
 * - Contact tracking (Email, Text, FB, IG)
 * - Campaign/postcard spot management
 */

// ============================================
// CONFIGURATION
// ============================================

const SUPABASE_URL = "https://kurhsdvxsgkgnfimfqdo.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1cmhzZHZ4c2drZ25maW1mcWRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MDk3NDYsImV4cCI6MjA3ODM4NTc0Nn0.nB_GsE89WJ3eAQrgmNKb-fbCktHTHf-987D-G6lscZA";

let supabaseClient = null;

function initSupabase() {
  if (!window.supabase) {
    console.error('Supabase library not loaded');
    return false;
  }
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return true;
}

// ============================================
// STATE
// ============================================

let currentUser = null;
let currentTab = 'prospects';
let currentProspect = null;
let templateType = 'email';

// Main data stores
let state = {
  businesses: [],      // All prospects/clients (unified)
  campaigns: [],       // Postcard campaigns
  templates: {
    email: [],
    text: []
  },
  currentCampaign: null
};

// Search state
let searchResults = [];
let selectedResults = new Set();

// ============================================
// INITIALIZATION
// ============================================

async function init() {
  console.log('v2 init starting...');

  try {
    // Initialize Supabase
    if (!initSupabase()) {
      console.error('Failed to init Supabase');
      showLoginScreen();
      return;
    }
    console.log('Supabase initialized');

    // Check auth
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    console.log('Auth check complete', { session: !!session, error });

    if (error || !session) {
      console.log('No session, showing login');
      showLoginScreen();
      return;
    }

    currentUser = session.user;
    console.log('User:', currentUser.email);
    document.getElementById('user-email').textContent = currentUser.email;

    // Load data
    console.log('Loading data...');
    await loadAllData();
    console.log('Data loaded');

    // Show app
    document.getElementById('loading-overlay').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');

    // Render initial view
    renderPipeline();
    loadCampaignTowns();
    updateStats();
    console.log('v2 init complete');

  } catch (err) {
    console.error('Init error:', err);
    showLoginScreen();
  }
}

function showLoginScreen() {
  document.getElementById('loading-overlay').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
}

async function logout() {
  await supabaseClient.auth.signOut();
  window.location.href = '../login.html';
}

// ============================================
// DATA LOADING & SAVING
// ============================================

async function loadAllData() {
  try {
    // Load businesses (prospects + clients unified)
    const bizData = await loadFromCloud('v2_businesses');
    state.businesses = bizData || [];

    // Load campaigns
    const campData = await loadFromCloud('v2_campaigns');
    state.campaigns = campData || [];

    // Load templates
    const tmplData = await loadFromCloud('v2_templates');
    if (tmplData) {
      state.templates = tmplData;
    }

    // Migrate from old app if v2 data is empty
    if (state.businesses.length === 0) {
      await migrateFromV1();
    }

    console.log('Data loaded:', {
      businesses: state.businesses.length,
      campaigns: state.campaigns.length
    });

  } catch (err) {
    console.error('Error loading data:', err);
  }
}

async function loadFromCloud(dataType) {
  try {
    const { data, error } = await supabaseClient
      .from('app_data')
      .select('data')
      .eq('user_email', currentUser.email)
      .eq('data_type', dataType)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data?.data || null;

  } catch (err) {
    console.error(`Error loading ${dataType}:`, err);
    return null;
  }
}

async function saveToCloud(dataType, data) {
  try {
    const { error } = await supabaseClient
      .from('app_data')
      .upsert({
        user_email: currentUser.email,
        data_type: dataType,
        data: data
      }, {
        onConflict: 'user_email,data_type'
      });

    if (error) throw error;
    return true;

  } catch (err) {
    console.error(`Error saving ${dataType}:`, err);
    toast('Error saving data', false);
    return false;
  }
}

async function saveBusinesses() {
  await saveToCloud('v2_businesses', state.businesses);
  updateStats();
}

async function saveCampaigns() {
  await saveToCloud('v2_campaigns', state.campaigns);
}

async function saveTemplates() {
  await saveToCloud('v2_templates', state.templates);
}

// Migrate data from v1 app
async function migrateFromV1() {
  try {
    // Load old manual prospects
    const oldProspects = await loadFromCloud('manualProspects');
    if (oldProspects && oldProspects.length > 0) {
      console.log('Migrating', oldProspects.length, 'prospects from v1...');

      state.businesses = oldProspects.map(p => ({
        id: p.id || p.placeId || generateId(),
        name: p.businessName || p.name || '',
        email: p.email || '',
        phone: p.phone || '',
        address: p.address || '',
        zip: p.zipCode || p.actualZip || p.zip || '',
        category: p.category || '',
        website: p.website || '',
        facebook: p.facebook || '',
        instagram: p.instagram || '',
        status: mapOldStatus(p),
        contacts: mapOldContacts(p),
        notes: p.notes || '',
        spots: [],
        source: p.source || 'migrated',
        addedAt: p.movedToPoolDate || new Date().toISOString(),
        campaignId: p.mailerId || null
      }));

      await saveBusinesses();
      toast('Migrated ' + state.businesses.length + ' prospects from v1');
    }

    // Load old campaigns/mailers
    const oldMailers = await loadFromCloud('mailers');
    if (oldMailers && oldMailers.length > 0) {
      state.campaigns = oldMailers;
      await saveCampaigns();
    }

    // Load old templates
    const oldTemplates = await loadFromCloud('userTemplates');
    if (oldTemplates) {
      // Convert to new format
      Object.values(oldTemplates).forEach(t => {
        if (t.type === 'email') {
          state.templates.email.push({
            id: t.id,
            name: t.name,
            subject: t.subject || '',
            body: t.body || ''
          });
        } else if (t.type === 'sms') {
          state.templates.text.push({
            id: t.id,
            name: t.name,
            body: t.body || ''
          });
        }
      });
      await saveTemplates();
    }

  } catch (err) {
    console.error('Migration error:', err);
  }
}

function mapOldStatus(prospect) {
  // Map old contact tracking to new status
  const ct = prospect.contactTracking || {};
  if (prospect.closeStatus === 'committed' || prospect.isExistingClient) return 'client';
  if (prospect.closeStatus === 'interested' || prospect.closeStatus === 'hot') return 'interested';
  if (ct.emailedAt || ct.textedAt || ct.emailed || ct.texted) return 'contacted';
  return 'new';
}

function mapOldContacts(prospect) {
  const contacts = [];
  const ct = prospect.contactTracking || {};

  if (ct.emailedAt) {
    contacts.push({ type: 'email', date: ct.emailedAt, note: '' });
  }
  if (ct.textedAt) {
    contacts.push({ type: 'text', date: ct.textedAt, note: '' });
  }

  return contacts;
}

// ============================================
// TAB NAVIGATION
// ============================================

function switchTab(tabName) {
  currentTab = tabName;

  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.dataset.tab === tabName) {
      btn.classList.add('bg-blue-100', 'text-blue-700');
      btn.classList.remove('text-gray-600');
    } else {
      btn.classList.remove('bg-blue-100', 'text-blue-700');
      btn.classList.add('text-gray-600');
    }
  });

  // Show/hide tab content
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.remove('active');
  });
  document.getElementById('tab-' + tabName).classList.add('active');

  // Render tab content
  if (tabName === 'pipeline') {
    renderPipeline();
  } else if (tabName === 'campaigns') {
    renderCampaign();
  }
}

// ============================================
// PROSPECTS TAB - SEARCH
// ============================================

async function searchProspects() {
  const zip = document.getElementById('search-zip').value.trim();
  const category = document.getElementById('search-category').value.trim();

  if (!zip || zip.length < 5) {
    toast('Please enter a valid ZIP code', false);
    return;
  }

  const btn = document.getElementById('search-btn');
  btn.disabled = true;
  btn.innerHTML = '<div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Searching...';

  try {
    // Call Outscraper API
    const response = await fetch('/api/outscraper-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zipCode: zip, category: category, limit: 30 })
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    searchResults = (data.businesses || []).map(b => ({
      id: b.placeId || generateId(),
      name: b.name || '',
      email: b.email || '',
      phone: b.phone || '',
      address: b.fullAddress || b.address || '',
      zip: b.zip || b.zipCode || zip,
      category: b.categories || category,
      website: b.website || '',
      facebook: b.facebook || '',
      instagram: b.instagram || '',
      rating: b.rating || 0,
      source: 'outscraper'
    }));

    // Filter out already-added businesses
    const existingIds = new Set(state.businesses.map(b => b.id));
    const existingNames = new Set(state.businesses.map(b => b.name.toLowerCase()));

    searchResults = searchResults.filter(r =>
      !existingIds.has(r.id) && !existingNames.has(r.name.toLowerCase())
    );

    selectedResults.clear();
    renderSearchResults();

  } catch (err) {
    console.error('Search error:', err);
    toast('Search failed: ' + err.message, false);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg> Search';
  }
}

function renderSearchResults() {
  const container = document.getElementById('results-list');
  const resultsSection = document.getElementById('search-results');
  const emptySection = document.getElementById('prospects-empty');

  if (searchResults.length === 0) {
    resultsSection.classList.add('hidden');
    emptySection.classList.remove('hidden');
    emptySection.innerHTML = `
      <div class="text-6xl mb-4">📭</div>
      <h3 class="text-xl font-semibold text-gray-800 mb-2">No New Businesses Found</h3>
      <p class="text-gray-500">Try a different ZIP code or category</p>
    `;
    return;
  }

  emptySection.classList.add('hidden');
  resultsSection.classList.remove('hidden');
  document.getElementById('results-count').textContent = `(${searchResults.length})`;

  container.innerHTML = searchResults.map(r => `
    <div class="bg-white border border-gray-200 rounded-lg p-4 flex items-center gap-4 hover:border-blue-300 transition cursor-pointer"
         onclick="toggleResultSelection('${r.id}')">
      <input type="checkbox" ${selectedResults.has(r.id) ? 'checked' : ''}
             class="w-5 h-5 rounded pointer-events-none">
      <div class="flex-1 min-w-0">
        <div class="font-medium text-gray-800 truncate">${escapeHtml(r.name)}</div>
        <div class="text-sm text-gray-500 truncate">${escapeHtml(r.category)}</div>
      </div>
      <div class="text-right text-sm">
        ${r.email ? `<div class="text-blue-600">${escapeHtml(r.email)}</div>` : '<div class="text-gray-400">No email</div>'}
        ${r.phone ? `<div class="text-gray-600">${escapeHtml(r.phone)}</div>` : ''}
      </div>
    </div>
  `).join('');
}

function toggleResultSelection(id) {
  if (selectedResults.has(id)) {
    selectedResults.delete(id);
  } else {
    selectedResults.add(id);
  }
  renderSearchResults();
}

function selectAllResults() {
  if (selectedResults.size === searchResults.length) {
    selectedResults.clear();
  } else {
    searchResults.forEach(r => selectedResults.add(r.id));
  }
  renderSearchResults();
}

async function addSelectedToPipeline() {
  if (selectedResults.size === 0) {
    toast('Select at least one business', false);
    return;
  }

  const toAdd = searchResults.filter(r => selectedResults.has(r.id));

  toAdd.forEach(r => {
    state.businesses.push({
      ...r,
      status: 'new',
      contacts: [],
      notes: '',
      spots: [],
      addedAt: new Date().toISOString(),
      campaignId: state.currentCampaign?.Mailer_ID || null
    });
  });

  await saveBusinesses();

  // Remove added from search results
  searchResults = searchResults.filter(r => !selectedResults.has(r.id));
  selectedResults.clear();
  renderSearchResults();

  toast(`Added ${toAdd.length} businesses to pipeline`);
}

// ============================================
// PIPELINE TAB
// ============================================

function renderPipeline() {
  const columns = {
    new: [],
    contacted: [],
    interested: [],
    client: []
  };

  // Get filter settings
  const hasEmailOnly = document.getElementById('filter-has-email')?.checked || false;
  const zipFilter = document.getElementById('filter-zip')?.value?.trim() || '';

  // Sort businesses into columns (with filtering)
  state.businesses.forEach(b => {
    // Apply email filter
    if (hasEmailOnly && (!b.email || !b.email.trim())) {
      return;
    }

    // Apply ZIP filter
    if (zipFilter && !(b.zip || '').toString().startsWith(zipFilter)) {
      return;
    }

    if (columns[b.status]) {
      columns[b.status].push(b);
    }
  });

  // Render each column
  Object.keys(columns).forEach(status => {
    const container = document.getElementById('column-' + status);
    const countEl = document.getElementById('count-' + status);

    countEl.textContent = columns[status].length;

    if (columns[status].length === 0) {
      container.innerHTML = `
        <div class="text-center py-8 text-gray-400 text-sm">
          Drop cards here
        </div>
      `;
    } else {
      container.innerHTML = columns[status].map(b => renderPipelineCard(b)).join('');
    }
  });

  // Populate campaign filter
  populateCampaignFilter();
}

function getDaysSinceContact(business) {
  if (!business.contacts || business.contacts.length === 0) return null;
  const lastContact = business.contacts[business.contacts.length - 1];
  if (!lastContact.date) return null;
  const lastDate = new Date(lastContact.date);
  const now = new Date();
  const diffTime = now - lastDate;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

function getCardBorderColor(business) {
  if (business.status === 'new') return 'border-gray-200';
  const days = getDaysSinceContact(business);
  if (days === null) return 'border-gray-200';
  if (days === 0) return 'border-l-4 border-l-green-500 border-gray-200';
  if (days <= 2) return 'border-l-4 border-l-green-300 border-gray-200';
  if (days <= 4) return 'border-l-4 border-l-yellow-400 border-gray-200';
  if (days <= 7) return 'border-l-4 border-l-orange-400 border-gray-200';
  return 'border-l-4 border-l-red-500 border-gray-200';
}

function renderPipelineCard(business) {
  const lastContact = business.contacts.length > 0
    ? business.contacts[business.contacts.length - 1]
    : null;

  const hasEmail = business.email && business.email.trim();
  const hasPhone = business.phone && business.phone.trim();
  const borderColor = getCardBorderColor(business);
  const daysSince = getDaysSinceContact(business);

  return `
    <div class="card bg-white rounded-lg p-3 shadow-sm border ${borderColor} cursor-pointer"
         draggable="true"
         ondragstart="handleDragStart(event, '${business.id}')"
         ondragend="handleDragEnd(event)"
         onclick="openProspectModal('${business.id}')">

      <div class="font-medium text-gray-800 text-sm truncate mb-1">${escapeHtml(business.name)}</div>
      <div class="text-xs text-gray-500 truncate">${escapeHtml(business.category || '')}</div>

      <!-- Contact Info -->
      ${hasEmail ? `
        <div class="text-xs text-blue-600 truncate mt-1" title="${escapeHtml(business.email)}">
          ${escapeHtml(business.email)}
        </div>
      ` : ''}
      ${hasPhone ? `
        <div class="text-xs text-gray-600 truncate">
          ${escapeHtml(business.phone)}
        </div>
      ` : ''}

      <!-- Quick Contact Buttons -->
      <div class="flex gap-2 mt-2 mb-2" onclick="event.stopPropagation()">
        ${hasEmail ? `
          <button onclick="quickEmail('${business.id}')"
                  class="flex-1 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition">
            📧 Email
          </button>
        ` : ''}
        ${hasPhone ? `
          <button onclick="quickText('${business.id}')"
                  class="flex-1 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition">
            💬 Text
          </button>
        ` : ''}
      </div>

      <!-- Engagement Toggles -->
      <div class="flex gap-3 text-xs mb-2" onclick="event.stopPropagation()">
        <label class="flex items-center gap-1 cursor-pointer">
          <input type="checkbox" ${business.fbEngaged ? 'checked' : ''}
                 onchange="toggleQuickEngagement('${business.id}', 'fb', this.checked)"
                 class="w-3.5 h-3.5 rounded">
          <span class="text-gray-600">FB</span>
        </label>
        <label class="flex items-center gap-1 cursor-pointer">
          <input type="checkbox" ${business.igEngaged ? 'checked' : ''}
                 onchange="toggleQuickEngagement('${business.id}', 'ig', this.checked)"
                 class="w-3.5 h-3.5 rounded">
          <span class="text-gray-600">IG</span>
        </label>
      </div>

      <!-- Last Contact -->
      ${lastContact ? `
        <div class="text-xs text-gray-400 truncate">
          ${daysSince === 0 ? 'Today' : daysSince === 1 ? 'Yesterday' : daysSince + ' days ago'} · ${lastContact.type}
        </div>
      ` : ''}
    </div>
  `;
}

function populateCampaignFilter() {
  const select = document.getElementById('pipeline-campaign-filter');
  const current = select.value;

  const towns = [...new Set(state.campaigns.map(c => c.Town))].sort();

  select.innerHTML = '<option value="all">All Campaigns</option>' +
    towns.map(t => `<option value="${t}">${t}</option>`).join('');

  select.value = current || 'all';
}

function filterPipelineByCampaign() {
  // TODO: Filter by selected campaign
  renderPipeline();
}

// Drag and Drop
let draggedId = null;

function handleDragStart(event, id) {
  draggedId = id;
  event.target.classList.add('dragging');
}

function handleDragEnd(event) {
  event.target.classList.remove('dragging');
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
}

function handleDragOver(event) {
  event.preventDefault();
  event.currentTarget.classList.add('drag-over');
}

function handleDrop(event, newStatus) {
  event.preventDefault();
  event.currentTarget.classList.remove('drag-over');

  if (!draggedId) return;

  const business = state.businesses.find(b => b.id === draggedId);
  if (business && business.status !== newStatus) {
    business.status = newStatus;
    saveBusinesses();
    renderPipeline();
    toast(`Moved to ${newStatus}`);
  }

  draggedId = null;
}

// Quick actions from card
async function quickEmail(id) {
  currentProspect = state.businesses.find(b => b.id === id);
  if (!currentProspect) return;

  if (!currentProspect.email) {
    toast('No email address', false);
    return;
  }

  document.getElementById('email-to').value = currentProspect.email;
  populateEmailTemplates();
  openModal('email');
}

async function quickText(id) {
  currentProspect = state.businesses.find(b => b.id === id);
  if (!currentProspect) return;

  if (!currentProspect.phone) {
    toast('No phone number', false);
    return;
  }

  document.getElementById('text-to').value = currentProspect.phone;
  populateTextTemplates();
  openModal('text');
}

async function toggleQuickEngagement(id, type, checked) {
  const business = state.businesses.find(b => b.id === id);
  if (!business) return;

  if (type === 'fb') {
    business.fbEngaged = checked;
    if (checked) {
      business.contacts.push({
        type: 'fb_comment',
        date: new Date().toISOString(),
        note: ''
      });
    }
  } else if (type === 'ig') {
    business.igEngaged = checked;
    if (checked) {
      business.contacts.push({
        type: 'ig_comment',
        date: new Date().toISOString(),
        note: ''
      });
    }
  }

  await saveBusinesses();
}

// ============================================
// PROSPECT MODAL
// ============================================

function openProspectModal(id) {
  currentProspect = state.businesses.find(b => b.id === id);
  if (!currentProspect) return;

  document.getElementById('modal-prospect-name').textContent = currentProspect.name;

  // Email
  const emailEl = document.getElementById('modal-prospect-email');
  if (currentProspect.email) {
    emailEl.textContent = currentProspect.email;
    emailEl.href = 'mailto:' + currentProspect.email;
    emailEl.parentElement.style.display = 'flex';
  } else {
    emailEl.parentElement.style.display = 'none';
  }

  // Phone
  const phoneEl = document.getElementById('modal-prospect-phone');
  if (currentProspect.phone) {
    phoneEl.textContent = currentProspect.phone;
    phoneEl.parentElement.style.display = 'flex';
  } else {
    phoneEl.parentElement.style.display = 'none';
  }

  document.getElementById('modal-prospect-address').textContent = currentProspect.address || currentProspect.zip || 'No address';
  document.getElementById('modal-prospect-category').textContent = currentProspect.category || 'Uncategorized';
  document.getElementById('modal-prospect-notes').value = currentProspect.notes || '';

  document.getElementById('modal-fb-check').checked = currentProspect.fbEngaged || false;
  document.getElementById('modal-ig-check').checked = currentProspect.igEngaged || false;

  // Render contact history
  const historyEl = document.getElementById('modal-contact-history');
  if (currentProspect.contacts.length === 0) {
    historyEl.innerHTML = '<p class="text-gray-400 italic">No contact yet</p>';
  } else {
    historyEl.innerHTML = currentProspect.contacts.map(c => `
      <div class="flex items-center gap-2 text-gray-600">
        <span>${getContactIcon(c.type)}</span>
        <span class="capitalize">${c.type.replace('_', ' ')}</span>
        <span class="text-gray-400">${formatDate(c.date)}</span>
        ${c.note ? `<span class="text-gray-500">- ${c.note}</span>` : ''}
      </div>
    `).join('');
  }

  openModal('prospect');
}

function getContactIcon(type) {
  const icons = {
    email: '📧',
    text: '💬',
    fb_comment: '👍',
    ig_comment: '📸'
  };
  return icons[type] || '📝';
}

async function saveProspect() {
  if (!currentProspect) return;

  currentProspect.notes = document.getElementById('modal-prospect-notes').value;
  currentProspect.fbEngaged = document.getElementById('modal-fb-check').checked;
  currentProspect.igEngaged = document.getElementById('modal-ig-check').checked;

  await saveBusinesses();
  renderPipeline();
  closeModal('prospect');
  toast('Saved');
}

async function deleteProspect() {
  if (!currentProspect) return;
  if (!confirm('Delete this prospect?')) return;

  state.businesses = state.businesses.filter(b => b.id !== currentProspect.id);
  await saveBusinesses();
  renderPipeline();
  closeModal('prospect');
  toast('Deleted');
}

function toggleEngagement(type) {
  // Just update the checkbox - will be saved on close
}

// ============================================
// EMAIL & TEXT SENDING
// ============================================

function sendEmail() {
  if (!currentProspect?.email) {
    toast('No email address', false);
    return;
  }

  document.getElementById('email-to').value = currentProspect.email;
  populateEmailTemplates();
  closeModal('prospect');
  openModal('email');
}

function sendText() {
  if (!currentProspect?.phone) {
    toast('No phone number', false);
    return;
  }

  document.getElementById('text-to').value = currentProspect.phone;
  populateTextTemplates();
  closeModal('prospect');
  openModal('text');
}

function populateEmailTemplates() {
  const select = document.getElementById('email-template');
  select.innerHTML = '<option value="">Select template...</option>' +
    state.templates.email.map(t =>
      `<option value="${t.id}">${escapeHtml(t.name)}</option>`
    ).join('');
}

function populateTextTemplates() {
  const select = document.getElementById('text-template');
  select.innerHTML = '<option value="">Select template...</option>' +
    state.templates.text.map(t =>
      `<option value="${t.id}">${escapeHtml(t.name)}</option>`
    ).join('');
}

function loadEmailTemplate() {
  const id = document.getElementById('email-template').value;
  const template = state.templates.email.find(t => t.id === id);
  if (!template) return;

  document.getElementById('email-subject').value = fillVariables(template.subject);
  document.getElementById('email-body').value = fillVariables(template.body);
}

function loadTextTemplate() {
  const id = document.getElementById('text-template').value;
  const template = state.templates.text.find(t => t.id === id);
  if (!template) return;

  document.getElementById('text-body').value = fillVariables(template.body);
  updateTextCharCount();
}

function fillVariables(text) {
  if (!text || !currentProspect) return text;

  return text
    .replace(/{businessName}/gi, currentProspect.name || '')
    .replace(/{category}/gi, currentProspect.category || '')
    .replace(/{zip}/gi, currentProspect.zip || '');
}

function updateTextCharCount() {
  const body = document.getElementById('text-body').value;
  document.getElementById('text-char-count').textContent = body.length;
}

async function confirmSendEmail() {
  const to = document.getElementById('email-to').value;
  const subject = document.getElementById('email-subject').value;
  const body = document.getElementById('email-body').value;

  // Open in email client
  const mailtoUrl = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.open(mailtoUrl, '_blank');

  // Log contact
  if (currentProspect) {
    currentProspect.contacts.push({
      type: 'email',
      date: new Date().toISOString(),
      note: subject
    });

    // Auto-move to contacted if still new
    if (currentProspect.status === 'new') {
      currentProspect.status = 'contacted';
    }

    await saveBusinesses();
    renderPipeline();
  }

  closeModal('email');
  toast('Email opened - contact logged');
}

async function confirmSendText() {
  const to = document.getElementById('text-to').value;
  const body = document.getElementById('text-body').value;

  // Format phone for SMS link
  const phone = to.replace(/\D/g, '');
  const smsUrl = `sms:${phone}?body=${encodeURIComponent(body)}`;
  window.open(smsUrl, '_blank');

  // Log contact
  if (currentProspect) {
    currentProspect.contacts.push({
      type: 'text',
      date: new Date().toISOString(),
      note: body.substring(0, 50)
    });

    if (currentProspect.status === 'new') {
      currentProspect.status = 'contacted';
    }

    await saveBusinesses();
    renderPipeline();
  }

  closeModal('text');
  toast('Text opened - contact logged');
}

// Text body character counter
document.addEventListener('DOMContentLoaded', () => {
  const textBody = document.getElementById('text-body');
  if (textBody) {
    textBody.addEventListener('input', updateTextCharCount);
  }
});

// ============================================
// TEMPLATES
// ============================================

function openTemplates() {
  templateType = 'email';
  renderTemplateList();
  openModal('templates');
}

function showTemplateType(type) {
  templateType = type;

  // Update tabs
  document.getElementById('tmpl-tab-email').className = type === 'email'
    ? 'px-4 py-2 rounded-lg font-medium bg-blue-100 text-blue-700'
    : 'px-4 py-2 rounded-lg font-medium text-gray-600 hover:bg-gray-100';

  document.getElementById('tmpl-tab-text').className = type === 'text'
    ? 'px-4 py-2 rounded-lg font-medium bg-blue-100 text-blue-700'
    : 'px-4 py-2 rounded-lg font-medium text-gray-600 hover:bg-gray-100';

  // Toggle subject field visibility
  document.getElementById('new-template-subject').style.display = type === 'email' ? 'block' : 'none';

  renderTemplateList();
}

function renderTemplateList() {
  const container = document.getElementById('template-list');
  const templates = state.templates[templateType];

  if (templates.length === 0) {
    container.innerHTML = '<p class="text-gray-500 italic">No templates yet</p>';
    return;
  }

  container.innerHTML = templates.map(t => `
    <div class="bg-gray-50 rounded-lg p-4 flex items-start justify-between">
      <div class="flex-1 min-w-0">
        <div class="font-medium text-gray-800">${escapeHtml(t.name)}</div>
        ${t.subject ? `<div class="text-sm text-gray-600">Subject: ${escapeHtml(t.subject)}</div>` : ''}
        <div class="text-sm text-gray-500 truncate">${escapeHtml(t.body?.substring(0, 100) || '')}</div>
      </div>
      <button onclick="deleteTemplate('${t.id}')" class="text-red-500 hover:text-red-700 ml-3">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
        </svg>
      </button>
    </div>
  `).join('');
}

async function saveNewTemplate() {
  const name = document.getElementById('new-template-name').value.trim();
  const subject = document.getElementById('new-template-subject').value.trim();
  const body = document.getElementById('new-template-body').value.trim();

  if (!name || !body) {
    toast('Name and message are required', false);
    return;
  }

  const template = {
    id: generateId(),
    name,
    body
  };

  if (templateType === 'email') {
    template.subject = subject;
  }

  state.templates[templateType].push(template);
  await saveTemplates();

  // Clear form
  document.getElementById('new-template-name').value = '';
  document.getElementById('new-template-subject').value = '';
  document.getElementById('new-template-body').value = '';

  renderTemplateList();
  toast('Template saved');
}

async function deleteTemplate(id) {
  if (!confirm('Delete this template?')) return;

  state.templates[templateType] = state.templates[templateType].filter(t => t.id !== id);
  await saveTemplates();
  renderTemplateList();
  toast('Template deleted');
}

// ============================================
// CAMPAIGNS TAB
// ============================================

function loadCampaignTowns() {
  const select = document.getElementById('campaign-town');
  const towns = [...new Set(state.campaigns.map(c => c.Town))].sort();

  select.innerHTML = '<option value="">Select Town</option>' +
    towns.map(t => `<option value="${t}">${t}</option>`).join('');
}

function loadCampaignMonths() {
  const town = document.getElementById('campaign-town').value;
  const select = document.getElementById('campaign-month');

  if (!town) {
    select.innerHTML = '<option value="">Select Month</option>';
    return;
  }

  const campaigns = state.campaigns.filter(c => c.Town === town);
  const months = campaigns.map(c => ({
    id: c.Mailer_ID,
    date: c.Mail_Date
  })).sort((a, b) => new Date(b.date) - new Date(a.date));

  select.innerHTML = '<option value="">Select Month</option>' +
    months.map(m => `<option value="${m.id}">${formatMonth(m.date)}</option>`).join('');
}

function loadCampaign() {
  const mailerId = document.getElementById('campaign-month').value;
  if (!mailerId) {
    state.currentCampaign = null;
    document.getElementById('campaign-details').classList.add('hidden');
    document.getElementById('campaigns-empty').classList.remove('hidden');
    return;
  }

  state.currentCampaign = state.campaigns.find(c => c.Mailer_ID === mailerId);
  if (!state.currentCampaign) return;

  document.getElementById('campaigns-empty').classList.add('hidden');
  document.getElementById('campaign-details').classList.remove('hidden');

  renderCampaign();
}

function renderCampaign() {
  if (!state.currentCampaign) return;

  const campaign = state.currentCampaign;
  document.getElementById('campaign-title').textContent = `${campaign.Town} - ${formatMonth(campaign.Mail_Date)}`;

  // Count spots by status
  let available = 0, reserved = 0, paid = 0;

  const grid = document.getElementById('spot-grid');
  let spotsHtml = '';

  for (let i = 1; i <= 18; i++) {
    const spot = campaign[`Spot_${i}`] || { status: 'Available' };
    const status = simplifySpotStatus(spot.status);

    if (status === 'available') available++;
    else if (status === 'reserved') reserved++;
    else paid++;

    const statusColors = {
      available: 'bg-green-100 border-green-300 text-green-700',
      reserved: 'bg-amber-100 border-amber-300 text-amber-700',
      paid: 'bg-blue-100 border-blue-300 text-blue-700'
    };

    spotsHtml += `
      <div class="border-2 ${statusColors[status]} rounded-lg p-4 cursor-pointer hover:shadow-md transition"
           onclick="openSpotModal(${i})">
        <div class="flex items-center justify-between mb-2">
          <span class="font-bold">Spot ${i}</span>
          <span class="text-xs uppercase">${status}</span>
        </div>
        ${spot.businessName ? `<div class="text-sm truncate">${escapeHtml(spot.businessName)}</div>` : ''}
      </div>
    `;
  }

  grid.innerHTML = spotsHtml;

  document.getElementById('spots-available').textContent = available;
  document.getElementById('spots-reserved').textContent = reserved;
  document.getElementById('spots-paid').textContent = paid;
}

function simplifySpotStatus(status) {
  if (!status || status === 'Available') return 'available';
  if (status === 'Paid in Full') return 'paid';
  return 'reserved'; // Everything else is reserved
}

function openSpotModal(spotNum) {
  // TODO: Open spot editor modal
  toast('Spot editor coming soon');
}

function openNewCampaignModal() {
  // TODO: Open new campaign modal
  toast('New campaign form coming soon');
}

// ============================================
// MODALS
// ============================================

function openModal(name) {
  document.getElementById('modal-' + name).classList.remove('hidden');
}

function closeModal(name) {
  document.getElementById('modal-' + name).classList.add('hidden');
}

// Close modals on backdrop click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('fixed') && e.target.classList.contains('bg-black/50')) {
    e.target.classList.add('hidden');
  }
});

// Close modals on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('[id^="modal-"]').forEach(modal => {
      modal.classList.add('hidden');
    });
  }
});

// ============================================
// UTILITIES
// ============================================

function updateStats() {
  const prospects = state.businesses.filter(b => b.status === 'new').length;
  const pipeline = state.businesses.filter(b => ['contacted', 'interested'].includes(b.status)).length;
  const clients = state.businesses.filter(b => b.status === 'client').length;

  document.getElementById('stat-prospects').textContent = prospects;
  document.getElementById('stat-pipeline').textContent = pipeline;
  document.getElementById('stat-clients').textContent = clients;
}

function generateId() {
  return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatMonth(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function toast(message, success = true) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.className = `fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg transform transition-all duration-300 z-50 ${success ? 'bg-green-600' : 'bg-red-600'} text-white`;
  el.style.transform = 'translateY(0)';
  el.style.opacity = '1';

  setTimeout(() => {
    el.style.transform = 'translateY(20px)';
    el.style.opacity = '0';
  }, 3000);
}

async function clearNoEmail() {
  const noEmailCount = state.businesses.filter(b => b.status === 'new' && (!b.email || !b.email.trim())).length;

  if (noEmailCount === 0) {
    toast('No prospects without email in New column');
    return;
  }

  if (!confirm(`Remove ${noEmailCount} prospects without email from the New column?`)) {
    return;
  }

  state.businesses = state.businesses.filter(b => {
    // Keep if not in 'new' status
    if (b.status !== 'new') return true;
    // Keep if has email
    if (b.email && b.email.trim()) return true;
    // Remove (no email and in 'new')
    return false;
  });

  await saveBusinesses();
  renderPipeline();
  toast(`Removed ${noEmailCount} prospects without email`);
}

function exportPipelineCSV() {
  const headers = ['Name', 'Email', 'Phone', 'Address', 'ZIP', 'Category', 'Status', 'Notes'];
  const rows = state.businesses.map(b => [
    b.name,
    b.email,
    b.phone,
    b.address,
    b.zip,
    b.category,
    b.status,
    b.notes
  ]);

  const csv = [
    headers.join(','),
    ...rows.map(r => r.map(c => `"${String(c || '').replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pipeline-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);

  toast('CSV exported');
}

// ============================================
// INIT
// ============================================

init();
