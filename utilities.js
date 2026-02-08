/**
 * Utilities Module - Common helper functions
 * Extracted from app-main.js for modularization
 */

/* ========= UTILITIES ========= */
const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ensureHttps = url => {
  if (!url) return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return 'https://' + trimmed;
};
const show = (el, on=true) => el && el.classList.toggle("hidden", !on);
const toast = (msg, ok=true, durationMs=null) => {
  // Calculate duration based on message length if not specified
  // Base: 3000ms, +60ms per character over 20 chars, max 8000ms
  const duration = durationMs || Math.min(3000 + Math.max(0, msg.length - 20) * 60, 8000);

  // Use unified ToastManager if available (stacks toasts properly)
  if (window.toastManager) {
    window.toastManager.show(msg, ok ? 'success' : 'warning', duration);
    return;
  }

  // Fallback to old toast element
  const t = document.getElementById("toast");
  if (t) {
    t.textContent = msg;
    t.className = `toast ${ok ? "toast-ok" : "toast-warn"}`;
    t.classList.remove("hidden");
    t.removeAttribute("aria-hidden");
    setTimeout(()=>{ t.classList.add("hidden"); t.setAttribute("aria-hidden","true"); }, duration);
  }
};

function formatDate(dateStr) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(dateStr));
}

function isOverdue(dateStr) {
  // Parse date in LOCAL timezone (not UTC) to avoid timezone issues
  const parts = dateStr.split('-');
  const due = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today; // Only overdue if BEFORE today (not today itself)
}

// Expose all functions globally
window.$ = $;
window.esc = esc;
window.ensureHttps = ensureHttps;
window.show = show;
window.toast = toast;
window.formatDate = formatDate;
window.isOverdue = isOverdue;
