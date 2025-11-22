/**
 * Unified Business Modal Component
 *
 * Consolidates three separate modals into one context-aware component:
 * 1. Edit spot modal (spot editing)
 * 2. Client modal (add/edit client)
 * 3. Prospect detail modal (prospect details)
 *
 * Features:
 * - Context-aware field display
 * - Progressive disclosure (tabs for advanced fields)
 * - Real-time duplicate detection
 * - Quick add inline option
 * - Link business to postcard spots
 */

class BusinessModal {
  constructor() {
    this.currentContext = null; // 'spot', 'client', 'prospect'
    this.currentData = null;
    this.onSaveCallback = null;
    this.onCloseCallback = null;
    this.selectedSpots = [];
    this.duplicateCheckTimeout = null;

    this.init();
  }

  /**
   * Initialize the modal
   */
  init() {
    this.createModal();
    this.attachEventListeners();
  }

  /**
   * Create the modal HTML structure
   */
  createModal() {
    const modalHTML = `
      <div id="unifiedBusinessModal" class="modal-backdrop" role="dialog" aria-modal="true" aria-hidden="true">
        <div class="modal" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
          <!-- Header -->
          <div class="flex justify-between items-center mb-4">
            <h3 id="businessModalTitle" class="text-lg font-bold">Edit Business</h3>
            <button id="businessModalClose" class="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
          </div>

          <!-- Tabs (for client/advanced mode) -->
          <div id="businessModalTabs" class="hidden border-b mb-4">
            <div class="flex gap-4">
              <button class="tab-button active pb-2 px-1 border-b-2 border-blue-600 font-semibold text-blue-600" data-tab="info">Info</button>
              <button class="tab-button pb-2 px-1 border-b-2 border-transparent text-gray-500 hover:text-gray-700" data-tab="contract">Contract</button>
              <button class="tab-button pb-2 px-1 border-b-2 border-transparent text-gray-500 hover:text-gray-700" data-tab="history">History</button>
            </div>
          </div>

          <!-- Duplicate Warning -->
          <div id="duplicateWarning" class="hidden bg-yellow-50 border border-yellow-300 rounded-lg p-3 mb-4">
            <div class="flex items-start gap-2">
              <span class="text-yellow-600 text-xl">⚠</span>
              <div class="flex-1">
                <div class="font-semibold text-yellow-800">Similar business found</div>
                <div id="duplicateMessage" class="text-sm text-yellow-700 mt-1"></div>
                <button id="mergeDuplicate" class="text-sm text-blue-600 hover:underline mt-2">Merge with existing</button>
              </div>
            </div>
          </div>

          <!-- Tab: Info -->
          <div id="tabInfo" class="tab-content">
            <div class="space-y-4">
              <!-- Link to existing client (for spot context) -->
              <div id="linkClientSection" class="hidden">
                <label class="text-sm font-medium text-gray-700 block mb-1">Link to Existing Client</label>
                <div class="flex gap-2">
                  <select id="linkClientSelect" class="border rounded-md flex-1 p-2 bg-white">
                    <option value="">— Select existing client —</option>
                  </select>
                  <button type="button" id="createNewClientBtn" class="px-3 py-2 bg-gray-100 border rounded-md hover:bg-gray-200 text-sm">
                    + New
                  </button>
                </div>
                <p class="text-xs text-gray-500 mt-1">Select a client to auto-fill business information</p>
              </div>

              <!-- Basic Info -->
              <div class="grid grid-cols-2 gap-4">
                <div class="col-span-2">
                  <label class="text-sm font-medium text-gray-700 block mb-1">Business Name *</label>
                  <input id="businessName" type="text" class="border rounded-md w-full p-2" placeholder="Adam's Pizza" required />
                </div>

                <div>
                  <label class="text-sm font-medium text-gray-700 block mb-1">Category</label>
                  <select id="businessCategory" class="border rounded-md w-full p-2 bg-white">
                    <option value="">Select category...</option>
                    <!-- Categories populated dynamically from businessCategories array -->
                  </select>
                </div>

                <div>
                  <label class="text-sm font-medium text-gray-700 block mb-1">Contact Name</label>
                  <input id="contactName" type="text" class="border rounded-md w-full p-2" placeholder="Adam Smith" />
                </div>

                <div>
                  <label class="text-sm font-medium text-gray-700 block mb-1">Phone</label>
                  <input id="businessPhone" type="tel" class="border rounded-md w-full p-2" placeholder="(555) 123-4567" />
                </div>

                <div>
                  <label class="text-sm font-medium text-gray-700 block mb-1">Email</label>
                  <input id="businessEmail" type="email" class="border rounded-md w-full p-2" placeholder="adam@adamspizza.com" />
                </div>

                <div class="col-span-2">
                  <label class="text-sm font-medium text-gray-700 block mb-1">Website</label>
                  <input id="businessWebsite" type="url" class="border rounded-md w-full p-2" placeholder="https://adamspizza.com" />
                </div>

                <div class="col-span-2">
                  <label class="text-sm font-medium text-gray-700 block mb-1">Address</label>
                  <input id="businessAddress" type="text" class="border rounded-md w-full p-2" placeholder="123 Main St, City, ST 12345" />
                </div>
              </div>

              <!-- Spot-specific fields (only in spot context) -->
              <div id="spotFields" class="hidden border-t pt-4 mt-4">
                <h4 class="font-semibold text-gray-700 mb-3">Spot Details</h4>
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="text-sm font-medium text-gray-700 block mb-1">Status</label>
                    <select id="spotStatus" class="border rounded-md w-full p-2 bg-white">
                      <option value="AVAIL">Available</option>
                      <option value="INVOICE">Invoice Sent</option>
                      <option value="DEPOSIT">Deposit Paid</option>
                      <option value="PROOF">Proof In Progress</option>
                      <option value="APPROVED">Ad Approved</option>
                      <option value="PAID">Paid In Full</option>
                      <option value="RESERVED">Reserved</option>
                    </select>
                  </div>

                  <div>
                    <label class="text-sm font-medium text-gray-700 block mb-1">Spot Price</label>
                    <div class="relative">
                      <span class="absolute left-3 top-2 text-gray-500">$</span>
                      <input id="spotPrice" type="number" step="50" class="border rounded-md w-full p-2 pl-7" placeholder="500" />
                    </div>
                    <p class="text-xs text-gray-500 mt-1">Price for this specific ad spot</p>
                  </div>
                </div>
              </div>

              <!-- Notes -->
              <div>
                <label class="text-sm font-medium text-gray-700 block mb-1">Notes</label>
                <textarea id="businessNotes" rows="3" class="border rounded-md w-full p-2" placeholder="Special requests, preferences, etc."></textarea>
              </div>
            </div>
          </div>

          <!-- Tab: Contract -->
          <div id="tabContract" class="tab-content hidden">
            <div class="space-y-4">
              <div class="flex justify-between items-center">
                <h4 class="font-semibold text-gray-700">Multi-Month Contract</h4>
                <label class="flex items-center gap-2">
                  <input type="checkbox" id="hasContract" />
                  <span class="text-sm">Enable Contract</span>
                </label>
              </div>

              <div id="contractFields" class="hidden space-y-3">
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="text-sm font-medium text-gray-700 block mb-1">Contract Start Date</label>
                    <input id="contractStartDate" type="date" class="border rounded-md w-full p-2" />
                  </div>
                  <div>
                    <label class="text-sm font-medium text-gray-700 block mb-1">Contract Length</label>
                    <select id="contractLength" class="border rounded-md w-full p-2 bg-white">
                      <option value="1">1 month</option>
                      <option value="3">3 months</option>
                      <option value="6" selected>6 months</option>
                      <option value="12">12 months</option>
                    </select>
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="text-sm font-medium text-gray-700 block mb-1">Monthly Rate</label>
                    <div class="relative">
                      <span class="absolute left-3 top-2 text-gray-500">$</span>
                      <input id="contractMonthlyRate" type="number" step="50" class="border rounded-md w-full p-2 pl-7" placeholder="500" />
                    </div>
                  </div>
                  <div>
                    <label class="text-sm font-medium text-gray-700 block mb-1">Total Contract Value</label>
                    <div id="contractTotalValue" class="text-2xl font-bold text-green-600 mt-1">$0</div>
                  </div>
                </div>

                <div class="bg-gray-50 p-3 rounded-md">
                  <div class="text-sm text-gray-700 mb-1">Contract End Date: <span id="contractEndDate" class="font-semibold">—</span></div>
                  <label class="flex items-center gap-2 mt-2">
                    <input type="checkbox" id="contractAutoRenew" />
                    <span class="text-sm">Auto-renew contract</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <!-- Tab: History -->
          <div id="tabHistory" class="tab-content hidden">
            <div class="space-y-3">
              <h4 class="font-semibold text-gray-700">Client History</h4>
              <div id="historyList" class="text-sm text-gray-500">
                <p>No history available</p>
              </div>
            </div>
          </div>

          <!-- Footer Actions -->
          <div class="flex justify-between items-center mt-6 pt-4 border-t">
            <div id="spotSelection" class="text-sm text-gray-600 hidden">
              <span id="selectedSpotsCount">0 spots selected</span>
            </div>
            <div class="flex gap-2 ml-auto">
              <button id="businessModalCancel" class="px-4 py-2 border rounded-md bg-gray-100 hover:bg-gray-200">Cancel</button>
              <button id="businessModalSave" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Save</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Add to DOM
    const container = document.createElement('div');
    container.innerHTML = modalHTML;
    document.body.appendChild(container.firstElementChild);
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Close button
    document.getElementById('businessModalClose').addEventListener('click', () => this.close());
    document.getElementById('businessModalCancel').addEventListener('click', () => this.close());

    // Save button
    document.getElementById('businessModalSave').addEventListener('click', () => this.save());

    // Tab switching
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
    });

    // Category change (show custom input)
    document.getElementById('businessCategory').addEventListener('change', (e) => {
      const customInput = document.getElementById('customCategory');
      if (e.target.value === 'Other') {
        customInput.classList.remove('hidden');
      } else {
        customInput.classList.add('hidden');
      }
    });

    // Contract checkbox
    document.getElementById('hasContract').addEventListener('change', (e) => {
      const fields = document.getElementById('contractFields');
      if (e.target.checked) {
        fields.classList.remove('hidden');
        this.calculateContractEnd();
      } else {
        fields.classList.add('hidden');
      }
    });

    // Contract calculations
    document.getElementById('contractStartDate').addEventListener('change', () => this.calculateContractEnd());
    document.getElementById('contractLength').addEventListener('change', () => this.calculateContractEnd());
    document.getElementById('contractMonthlyRate').addEventListener('input', () => this.calculateContractTotal());

    // Link to client (auto-fill)
    document.getElementById('linkClientSelect').addEventListener('change', (e) => this.linkToClient(e.target.value));

    // Create new client button
    document.getElementById('createNewClientBtn').addEventListener('click', () => {
      document.getElementById('linkClientSelect').value = '';
      this.clearFields();
      document.getElementById('businessName').focus();
    });

    // Duplicate detection on business name change
    document.getElementById('businessName').addEventListener('input', () => this.checkDuplicates());

    // Close on backdrop click
    document.getElementById('unifiedBusinessModal').addEventListener('click', (e) => {
      if (e.target.id === 'unifiedBusinessModal') {
        this.close();
      }
    });

    // ESC key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) {
        this.close();
      }
    });
  }

  /**
   * Open modal in specific context
   * @param {string} context - 'spot', 'client', or 'prospect'
   * @param {Object} data - Business data
   * @param {Function} onSave - Callback when saved
   * @param {Array} selectedSpots - Array of selected spot numbers (for spot context)
   */
  open(context, data = {}, onSave = null, selectedSpots = []) {
    this.currentContext = context;
    this.currentData = data;
    this.onSaveCallback = onSave;
    this.selectedSpots = selectedSpots || [];

    // Update title based on context
    const title = document.getElementById('businessModalTitle');
    if (context === 'spot') {
      title.textContent = selectedSpots.length > 1 ? `Edit ${selectedSpots.length} Spots` : 'Edit Spot';
    } else if (context === 'client') {
      title.textContent = data.id ? 'Edit Client' : 'Add New Client';
    } else if (context === 'prospect') {
      title.textContent = 'Prospect Details';
    }

    // Show/hide sections based on context
    this.configureLayout(context);

    // Populate fields with data
    this.populateFields(data);

    // Load client list for linking (if spot context)
    if (context === 'spot') {
      this.loadClientList();
    }

    // Show modal
    const modal = document.getElementById('unifiedBusinessModal');
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');

    // Focus first input
    setTimeout(() => {
      const firstInput = modal.querySelector('input:not([type="checkbox"]):not([type="hidden"])');
      if (firstInput) firstInput.focus();
    }, 100);
  }

  /**
   * Configure layout based on context
   */
  configureLayout(context) {
    const tabs = document.getElementById('businessModalTabs');
    const linkSection = document.getElementById('linkClientSection');
    const spotFields = document.getElementById('spotFields');
    const spotSelection = document.getElementById('spotSelection');

    if (context === 'spot') {
      // Show link client section and spot fields
      linkSection.classList.remove('hidden');
      spotFields.classList.remove('hidden');
      tabs.classList.add('hidden');

      // Show selected spots count
      if (this.selectedSpots.length > 0) {
        spotSelection.classList.remove('hidden');
        document.getElementById('selectedSpotsCount').textContent =
          `${this.selectedSpots.length} spot${this.selectedSpots.length > 1 ? 's' : ''} selected`;
      }
    } else if (context === 'client') {
      // Show tabs for advanced client editing
      linkSection.classList.add('hidden');
      spotFields.classList.add('hidden');
      tabs.classList.remove('hidden');
      spotSelection.classList.add('hidden');
    } else if (context === 'prospect') {
      // Simple view for prospects
      linkSection.classList.add('hidden');
      spotFields.classList.add('hidden');
      tabs.classList.add('hidden');
      spotSelection.classList.add('hidden');
    }
  }

  /**
   * Populate fields with data
   */
  populateFields(data) {
    document.getElementById('businessName').value = data.name || data.businessName || '';
    document.getElementById('businessCategory').value = data.category || '';
    document.getElementById('contactName').value = data.contactName || data.owner || '';
    document.getElementById('businessPhone').value = data.phone || '';
    document.getElementById('businessEmail').value = data.email || '';
    document.getElementById('businessWebsite').value = data.website || '';
    document.getElementById('businessAddress').value = data.address || '';
    document.getElementById('businessNotes').value = data.notes || '';

    // Spot fields
    if (this.currentContext === 'spot') {
      document.getElementById('spotStatus').value = data.status || 'AVAIL';
      document.getElementById('spotPrice').value = data.price || '';
    }

    // Contract fields
    if (data.hasContract) {
      document.getElementById('hasContract').checked = true;
      document.getElementById('contractFields').classList.remove('hidden');
      document.getElementById('contractStartDate').value = data.contractStart || '';
      document.getElementById('contractLength').value = data.contractLength || '6';
      document.getElementById('contractMonthlyRate').value = data.contractRate || '';
      document.getElementById('contractAutoRenew').checked = data.autoRenew || false;
      this.calculateContractEnd();
      this.calculateContractTotal();
    }
  }

  /**
   * Clear all fields
   */
  clearFields() {
    document.getElementById('businessName').value = '';
    document.getElementById('businessCategory').value = '';
    document.getElementById('customCategory').value = '';
    document.getElementById('customCategory').classList.add('hidden');
    document.getElementById('contactName').value = '';
    document.getElementById('businessPhone').value = '';
    document.getElementById('businessEmail').value = '';
    document.getElementById('businessWebsite').value = '';
    document.getElementById('businessAddress').value = '';
    document.getElementById('businessNotes').value = '';
    document.getElementById('spotStatus').value = 'AVAIL';
    document.getElementById('spotPrice').value = '';

    document.getElementById('hasContract').checked = false;
    document.getElementById('contractFields').classList.add('hidden');

    this.hideDuplicateWarning();
  }

  /**
   * Load client list for dropdown
   */
  loadClientList() {
    const select = document.getElementById('linkClientSelect');
    select.innerHTML = '<option value="">— Select existing client —</option>';

    // Get clients from storage (assumes global clients array exists)
    if (window.clientsState && window.clientsState.clients) {
      window.clientsState.clients
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        .forEach(client => {
          const option = document.createElement('option');
          option.value = client.id;
          option.textContent = client.name;
          select.appendChild(option);
        });
    }
  }

  /**
   * Link to existing client (auto-fill fields)
   */
  linkToClient(clientId) {
    if (!clientId) return;

    // Find client in storage
    const client = window.clientsState?.clients?.find(c => c.id === clientId);
    if (client) {
      this.populateFields(client);
      this.currentData.linkedClientId = clientId;
    }
  }

  /**
   * Check for duplicate businesses
   */
  checkDuplicates() {
    clearTimeout(this.duplicateCheckTimeout);

    this.duplicateCheckTimeout = setTimeout(() => {
      const name = document.getElementById('businessName').value.trim().toLowerCase();

      if (name.length < 3) {
        this.hideDuplicateWarning();
        return;
      }

      // Check in clients
      if (window.clientsState && window.clientsState.clients) {
        const similar = window.clientsState.clients.find(c => {
          return c.id !== this.currentData.id &&
                 c.name &&
                 c.name.toLowerCase().includes(name);
        });

        if (similar) {
          this.showDuplicateWarning(similar);
        } else {
          this.hideDuplicateWarning();
        }
      }
    }, 500);
  }

  /**
   * Show duplicate warning
   */
  showDuplicateWarning(duplicate) {
    const warning = document.getElementById('duplicateWarning');
    const message = document.getElementById('duplicateMessage');

    message.textContent = `Found: "${duplicate.name}" ${duplicate.phone ? `(${duplicate.phone})` : ''}`;
    warning.classList.remove('hidden');

    // Set up merge button
    document.getElementById('mergeDuplicate').onclick = () => {
      this.populateFields(duplicate);
      this.hideDuplicateWarning();
      showInfo('Fields populated from existing client');
    };
  }

  /**
   * Hide duplicate warning
   */
  hideDuplicateWarning() {
    document.getElementById('duplicateWarning').classList.add('hidden');
  }

  /**
   * Switch tab
   */
  switchTab(tabName) {
    // Update button styles
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.remove('active', 'border-blue-600', 'text-blue-600');
      btn.classList.add('border-transparent', 'text-gray-500');
    });
    const activeBtn = document.querySelector(`[data-tab="${tabName}"]`);
    activeBtn.classList.add('active', 'border-blue-600', 'text-blue-600');
    activeBtn.classList.remove('border-transparent', 'text-gray-500');

    // Show correct content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.add('hidden');
    });
    document.getElementById(`tab${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`).classList.remove('hidden');
  }

  /**
   * Calculate contract end date
   */
  calculateContractEnd() {
    const startDate = document.getElementById('contractStartDate').value;
    const length = parseInt(document.getElementById('contractLength').value);

    if (!startDate) {
      document.getElementById('contractEndDate').textContent = '—';
      return;
    }

    const start = new Date(startDate);
    const end = new Date(start);
    end.setMonth(end.getMonth() + length);

    document.getElementById('contractEndDate').textContent = end.toLocaleDateString();
    this.calculateContractTotal();
  }

  /**
   * Calculate contract total value
   */
  calculateContractTotal() {
    const rate = parseFloat(document.getElementById('contractMonthlyRate').value) || 0;
    const length = parseInt(document.getElementById('contractLength').value) || 0;
    const total = rate * length;

    document.getElementById('contractTotalValue').textContent = `$${total.toLocaleString()}`;
  }

  /**
   * Save business data
   */
  save() {
    // Validate required fields
    const businessName = document.getElementById('businessName').value.trim();
    if (!businessName) {
      showError('Business name is required');
      document.getElementById('businessName').focus();
      return;
    }

    // Collect data
    const data = {
      id: this.currentData.id || this.generateId(),
      name: businessName,
      category: document.getElementById('businessCategory').value === 'Other'
        ? document.getElementById('customCategory').value
        : document.getElementById('businessCategory').value,
      contactName: document.getElementById('contactName').value.trim(),
      phone: document.getElementById('businessPhone').value.trim(),
      email: document.getElementById('businessEmail').value.trim(),
      website: document.getElementById('businessWebsite').value.trim(),
      address: document.getElementById('businessAddress').value.trim(),
      notes: document.getElementById('businessNotes').value.trim(),
      updatedAt: new Date().toISOString()
    };

    // Add spot-specific data
    if (this.currentContext === 'spot') {
      data.status = document.getElementById('spotStatus').value;
      data.price = parseFloat(document.getElementById('spotPrice').value) || 0;
      data.linkedClientId = document.getElementById('linkClientSelect').value;
    }

    // Add contract data
    if (document.getElementById('hasContract').checked) {
      data.hasContract = true;
      data.contractStart = document.getElementById('contractStartDate').value;
      data.contractLength = parseInt(document.getElementById('contractLength').value);
      data.contractRate = parseFloat(document.getElementById('contractMonthlyRate').value) || 0;
      data.contractTotal = data.contractRate * data.contractLength;
      data.autoRenew = document.getElementById('contractAutoRenew').checked;
    }

    // Determine success message before closing (preserve context)
    const isUpdate = this.currentData.id ? true : false;
    const context = this.currentContext;

    // Call save callback
    if (this.onSaveCallback) {
      this.onSaveCallback(data, this.selectedSpots);
    }

    // Close modal
    this.close();

    // Show success message (after close, so use saved context)
    if (typeof showSuccess !== 'undefined') {
      showSuccess(context === 'spot'
        ? 'Spot updated successfully'
        : `Client ${isUpdate ? 'updated' : 'added'} successfully`);
    }
  }

  /**
   * Close modal
   */
  close() {
    const modal = document.getElementById('unifiedBusinessModal');
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');

    // Clear data
    this.currentContext = null;
    this.currentData = null;
    this.onSaveCallback = null;
    this.selectedSpots = [];

    // Call close callback
    if (this.onCloseCallback) {
      this.onCloseCallback();
    }
  }

  /**
   * Check if modal is open
   */
  isOpen() {
    const modal = document.getElementById('unifiedBusinessModal');
    return modal && modal.style.display === 'flex';
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return 'bus_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}

// Initialize when DOM is ready
function initBusinessModal() {
  window.businessModal = new BusinessModal();
  console.log('✅ Unified Business Modal loaded');
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBusinessModal);
} else {
  // DOM already loaded
  initBusinessModal();
}
