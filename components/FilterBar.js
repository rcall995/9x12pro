/**
 * FilterBar Component
 *
 * Standardized search/filter component used across all tabs.
 * Provides consistent UI for filtering data by:
 * - Text search
 * - Date range
 * - Categories
 * - Status
 * - Custom filters
 */

class FilterBar {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.options = {
      showSearch: options.showSearch !== false, // default true
      showDate: options.showDate || false,
      showCategory: options.showCategory || false,
      showStatus: options.showStatus || false,
      showCustomFilters: options.showCustomFilters || false,
      placeholder: options.placeholder || 'Search...',
      categories: options.categories || [],
      statuses: options.statuses || [],
      customFilters: options.customFilters || [], // [{id, label, options}]
      onFilter: options.onFilter || (() => {})
    };

    this.currentFilters = {
      search: '',
      dateRange: 'all',
      dateStart: null,
      dateEnd: null,
      category: 'all',
      status: 'all',
      custom: {}
    };

    this.init();
  }

  /**
   * Initialize filter bar
   */
  init() {
    this.render();
    this.attachEventListeners();
    this.loadSavedFilters();
  }

  /**
   * Render filter bar HTML
   */
  render() {
    const container = document.getElementById(this.containerId);
    if (!container) {
      console.error(`FilterBar: Container #${this.containerId} not found`);
      return;
    }

    let html = '<div class="filter-bar bg-white border rounded-lg p-4 mb-4">';
    html += '<div class="flex flex-wrap gap-3 items-center">';

    // Search input
    if (this.options.showSearch) {
      html += `
        <div class="flex-1 min-w-[200px]">
          <div class="relative">
            <span class="absolute left-3 top-2.5 text-gray-400">🔍</span>
            <input
              type="text"
              id="${this.containerId}_search"
              class="filter-search border rounded-md w-full p-2 pl-10"
              placeholder="${this.options.placeholder}"
            />
          </div>
        </div>
      `;
    }

    // Date range filter
    if (this.options.showDate) {
      html += `
        <div class="flex gap-2 items-center">
          <label class="text-sm font-medium text-gray-700">📅</label>
          <select id="${this.containerId}_dateRange" class="filter-date border rounded-md p-2 bg-white text-sm">
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>
        <div id="${this.containerId}_customDate" class="hidden flex gap-2">
          <input type="date" id="${this.containerId}_dateStart" class="border rounded-md p-2 text-sm" />
          <span class="text-gray-400">to</span>
          <input type="date" id="${this.containerId}_dateEnd" class="border rounded-md p-2 text-sm" />
        </div>
      `;
    }

    // Category filter
    if (this.options.showCategory && this.options.categories.length > 0) {
      html += `
        <div class="flex gap-2 items-center">
          <label class="text-sm font-medium text-gray-700">🏷️</label>
          <select id="${this.containerId}_category" class="filter-category border rounded-md p-2 bg-white text-sm">
            <option value="all">All Categories</option>
            ${this.options.categories.map(cat =>
              `<option value="${cat.value || cat}">${cat.label || cat}</option>`
            ).join('')}
          </select>
        </div>
      `;
    }

    // Status filter
    if (this.options.showStatus && this.options.statuses.length > 0) {
      html += `
        <div class="flex gap-2 items-center">
          <label class="text-sm font-medium text-gray-700">🎯</label>
          <select id="${this.containerId}_status" class="filter-status border rounded-md p-2 bg-white text-sm">
            <option value="all">All Statuses</option>
            ${this.options.statuses.map(status =>
              `<option value="${status.value || status}">${status.label || status}</option>`
            ).join('')}
          </select>
        </div>
      `;
    }

    // Custom filters
    if (this.options.showCustomFilters && this.options.customFilters.length > 0) {
      this.options.customFilters.forEach(filter => {
        html += `
          <div class="flex gap-2 items-center">
            <label class="text-sm font-medium text-gray-700">${filter.label}</label>
            <select id="${this.containerId}_${filter.id}" class="filter-custom border rounded-md p-2 bg-white text-sm" data-filter-id="${filter.id}">
              <option value="all">All</option>
              ${filter.options.map(opt =>
                `<option value="${opt.value || opt}">${opt.label || opt}</option>`
              ).join('')}
            </select>
          </div>
        `;
      });
    }

    // Clear filters button
    html += `
      <button id="${this.containerId}_clear" class="filter-clear px-3 py-2 text-sm border rounded-md hover:bg-gray-50 text-gray-600">
        Clear
      </button>
    `;

    // Active filters count
    html += `
      <div id="${this.containerId}_activeCount" class="hidden text-sm font-medium text-blue-600 ml-auto">
        <span id="${this.containerId}_count">0</span> filter(s) active
      </div>
    `;

    html += '</div></div>';

    container.innerHTML = html;
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Search input (debounced)
    if (this.options.showSearch) {
      const searchInput = document.getElementById(`${this.containerId}_search`);
      let searchTimeout;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          this.currentFilters.search = e.target.value.trim().toLowerCase();
          this.applyFilters();
        }, 300);
      });
    }

    // Date range
    if (this.options.showDate) {
      const dateRange = document.getElementById(`${this.containerId}_dateRange`);
      dateRange.addEventListener('change', (e) => {
        this.currentFilters.dateRange = e.target.value;

        // Show/hide custom date inputs
        const customDate = document.getElementById(`${this.containerId}_customDate`);
        if (e.target.value === 'custom') {
          customDate.classList.remove('hidden');
        } else {
          customDate.classList.add('hidden');
          this.applyFilters();
        }
      });

      // Custom date inputs
      const dateStart = document.getElementById(`${this.containerId}_dateStart`);
      const dateEnd = document.getElementById(`${this.containerId}_dateEnd`);

      dateStart.addEventListener('change', (e) => {
        this.currentFilters.dateStart = e.target.value;
        if (this.currentFilters.dateEnd) {
          this.applyFilters();
        }
      });

      dateEnd.addEventListener('change', (e) => {
        this.currentFilters.dateEnd = e.target.value;
        if (this.currentFilters.dateStart) {
          this.applyFilters();
        }
      });
    }

    // Category
    if (this.options.showCategory) {
      document.getElementById(`${this.containerId}_category`).addEventListener('change', (e) => {
        this.currentFilters.category = e.target.value;
        this.applyFilters();
      });
    }

    // Status
    if (this.options.showStatus) {
      document.getElementById(`${this.containerId}_status`).addEventListener('change', (e) => {
        this.currentFilters.status = e.target.value;
        this.applyFilters();
      });
    }

    // Custom filters
    if (this.options.showCustomFilters) {
      document.querySelectorAll('.filter-custom').forEach(select => {
        select.addEventListener('change', (e) => {
          const filterId = e.target.dataset.filterId;
          this.currentFilters.custom[filterId] = e.target.value;
          this.applyFilters();
        });
      });
    }

    // Clear button
    document.getElementById(`${this.containerId}_clear`).addEventListener('click', () => {
      this.clearFilters();
    });
  }

  /**
   * Apply current filters
   */
  applyFilters() {
    // Update active count
    const activeCount = this.getActiveFilterCount();
    const countEl = document.getElementById(`${this.containerId}_activeCount`);
    const countNum = document.getElementById(`${this.containerId}_count`);

    if (activeCount > 0) {
      countEl.classList.remove('hidden');
      countNum.textContent = activeCount;
    } else {
      countEl.classList.add('hidden');
    }

    // Save filters to localStorage
    this.saveFilters();

    // Call filter callback
    this.options.onFilter(this.currentFilters);
  }

  /**
   * Clear all filters
   */
  clearFilters() {
    // Reset filters
    this.currentFilters = {
      search: '',
      dateRange: 'all',
      dateStart: null,
      dateEnd: null,
      category: 'all',
      status: 'all',
      custom: {}
    };

    // Reset UI
    if (this.options.showSearch) {
      document.getElementById(`${this.containerId}_search`).value = '';
    }
    if (this.options.showDate) {
      document.getElementById(`${this.containerId}_dateRange`).value = 'all';
      document.getElementById(`${this.containerId}_customDate`).classList.add('hidden');
    }
    if (this.options.showCategory) {
      document.getElementById(`${this.containerId}_category`).value = 'all';
    }
    if (this.options.showStatus) {
      document.getElementById(`${this.containerId}_status`).value = 'all';
    }
    if (this.options.showCustomFilters) {
      this.options.customFilters.forEach(filter => {
        document.getElementById(`${this.containerId}_${filter.id}`).value = 'all';
      });
    }

    // Apply (will trigger callback with cleared filters)
    this.applyFilters();
  }

  /**
   * Get count of active filters
   */
  getActiveFilterCount() {
    let count = 0;

    if (this.currentFilters.search) count++;
    if (this.currentFilters.dateRange !== 'all') count++;
    if (this.currentFilters.category !== 'all') count++;
    if (this.currentFilters.status !== 'all') count++;

    Object.values(this.currentFilters.custom).forEach(val => {
      if (val !== 'all') count++;
    });

    return count;
  }

  /**
   * Save filters to localStorage
   */
  saveFilters() {
    try {
      localStorage.setItem(`filterBar_${this.containerId}`, JSON.stringify(this.currentFilters));
    } catch (e) {
      console.warn('FilterBar: Could not save filters to localStorage', e);
    }
  }

  /**
   * Load saved filters from localStorage
   */
  loadSavedFilters() {
    try {
      const saved = localStorage.getItem(`filterBar_${this.containerId}`);
      if (saved) {
        const filters = JSON.parse(saved);

        // Apply saved filters to UI
        if (this.options.showSearch && filters.search) {
          document.getElementById(`${this.containerId}_search`).value = filters.search;
          this.currentFilters.search = filters.search;
        }

        if (this.options.showDate && filters.dateRange) {
          document.getElementById(`${this.containerId}_dateRange`).value = filters.dateRange;
          this.currentFilters.dateRange = filters.dateRange;

          if (filters.dateRange === 'custom' && filters.dateStart && filters.dateEnd) {
            document.getElementById(`${this.containerId}_customDate`).classList.remove('hidden');
            document.getElementById(`${this.containerId}_dateStart`).value = filters.dateStart;
            document.getElementById(`${this.containerId}_dateEnd`).value = filters.dateEnd;
            this.currentFilters.dateStart = filters.dateStart;
            this.currentFilters.dateEnd = filters.dateEnd;
          }
        }

        if (this.options.showCategory && filters.category) {
          document.getElementById(`${this.containerId}_category`).value = filters.category;
          this.currentFilters.category = filters.category;
        }

        if (this.options.showStatus && filters.status) {
          document.getElementById(`${this.containerId}_status`).value = filters.status;
          this.currentFilters.status = filters.status;
        }

        if (this.options.showCustomFilters && filters.custom) {
          Object.entries(filters.custom).forEach(([key, value]) => {
            const el = document.getElementById(`${this.containerId}_${key}`);
            if (el) {
              el.value = value;
              this.currentFilters.custom[key] = value;
            }
          });
        }

        // Trigger filter callback with loaded filters
        this.applyFilters();
      }
    } catch (e) {
      console.warn('FilterBar: Could not load saved filters', e);
    }
  }

  /**
   * Get current filter values
   */
  getFilters() {
    return { ...this.currentFilters };
  }

  /**
   * Set filters programmatically
   */
  setFilters(filters) {
    Object.assign(this.currentFilters, filters);
    this.applyFilters();
  }

  /**
   * Utility: Filter array of items based on current filters
   * @param {Array} items - Array of objects to filter
   * @param {Object} config - Configuration for what fields to check
   * @returns {Array} Filtered items
   */
  filterItems(items, config = {}) {
    const {
      searchFields = ['name', 'email', 'phone'], // fields to search in
      dateField = 'createdAt', // field containing date
      categoryField = 'category',
      statusField = 'status'
    } = config;

    return items.filter(item => {
      // Search filter
      if (this.currentFilters.search) {
        const searchTerm = this.currentFilters.search.toLowerCase();
        const matches = searchFields.some(field => {
          const value = item[field];
          return value && String(value).toLowerCase().includes(searchTerm);
        });
        if (!matches) return false;
      }

      // Date filter
      if (this.currentFilters.dateRange !== 'all') {
        const itemDate = new Date(item[dateField]);
        const now = new Date();

        if (this.currentFilters.dateRange === 'today') {
          if (itemDate.toDateString() !== now.toDateString()) return false;
        } else if (this.currentFilters.dateRange === 'custom') {
          if (this.currentFilters.dateStart && this.currentFilters.dateEnd) {
            const start = new Date(this.currentFilters.dateStart);
            const end = new Date(this.currentFilters.dateEnd);
            if (itemDate < start || itemDate > end) return false;
          }
        } else {
          const days = parseInt(this.currentFilters.dateRange);
          const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
          if (itemDate < cutoff) return false;
        }
      }

      // Category filter
      if (this.currentFilters.category !== 'all') {
        if (item[categoryField] !== this.currentFilters.category) return false;
      }

      // Status filter
      if (this.currentFilters.status !== 'all') {
        if (item[statusField] !== this.currentFilters.status) return false;
      }

      // Custom filters
      for (const [key, value] of Object.entries(this.currentFilters.custom)) {
        if (value !== 'all' && item[key] !== value) return false;
      }

      return true;
    });
  }
}

// Export for global use
window.FilterBar = FilterBar;

console.log('✅ FilterBar component loaded');
