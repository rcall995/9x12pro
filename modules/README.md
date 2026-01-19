# Module Architecture Roadmap

## Current Structure

The main application logic is in `app-main.js` (24,697 lines). This file contains all major features.

## Recommended Module Split

When time permits, `app-main.js` should be split into these modules:

### 1. `modules/kanban.js` (~5,000 lines)
- Kanban state management
- Column rendering
- Drag and drop
- Selection state
- Card actions

### 2. `modules/crm.js` (~3,000 lines)
- Client management
- Client modal
- Pricing data
- Client actions

### 3. `modules/sequences.js` (~1,000 lines)
- Outreach sequence management
- assignSequence, advanceSequence, pauseSequence, cancelSequence
- Sequence auto-scheduling
- executeSequenceStep

### 4. `modules/dashboards.js` (~800 lines)
- Follow-up Dashboard
- Contact Status Dashboard
- Daily Goal tracking

### 5. `modules/prospecting.js` (~2,000 lines)
- Prospect Pool
- Search functionality
- Business enrichment
- Import/Export

### 6. `modules/outreach.js` (~2,000 lines)
- Template management
- Quick send functionality
- Bulk actions

### 7. `modules/spark.js` (~700 lines)
- AI pitch generator
- Comment engagement system

### 8. `modules/onboarding.js` (~100 lines)
- Getting started checklist
- Onboarding wizard

## Section Markers in app-main.js

Major sections are marked with:
```javascript
// ========== SECTION NAME ==========
```

Or:
```javascript
// ============================================
// SECTION NAME
// ============================================
```

## How to Split (When Ready)

1. Create module file in `/modules/`
2. Copy relevant functions
3. Remove from app-main.js
4. Add script tag to app.html BEFORE app-main.js
5. Ensure all window.* exports are maintained
6. Test thoroughly

## Dependencies to Watch

- `kanbanState` - used by many modules
- `crmState` - used by CRM functions
- `toast()` - used everywhere
- `esc()` - HTML escaping helper
- `saveKanban()` - data persistence
- `renderKanban()` - UI updates
