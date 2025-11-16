/**
 * Authentication JavaScript for 10k Postcards
 * Include this file in all protected pages to require login
 */

var SUPABASE_URL = "https://kurhsdvxsgkgnfimfqdo.supabase.co";
var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1cmhzZHZ4c2drZ25maW1mcWRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MDk3NDYsImV4cCI6MjA3ODM4NTc0Nn0.nB_GsE89WJ3eAQrgmNKb-fbCktHTHf-987D-G6lscZA";

var supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Global auth state
var currentUser = null;
var authInitialized = false;

/**
 * Initialize authentication and check if user is logged in
 * This function runs automatically when the script loads
 */
function initAuth() {
  supabaseClient.auth.getSession().then(function(result) {
    if (result.error) {
      console.error('Auth error:', result.error);
      redirectToLogin();
      return;
    }

    if (!result.data.session) {
      // No session, redirect to login
      redirectToLogin();
      return;
    }

    // Check if user is approved
    var userId = result.data.session.user.id;
    checkUserApproval(userId, result.data.session.user);
  });

  // Listen for auth state changes
  supabaseClient.auth.onAuthStateChange(function(event, session) {
    if (event === 'SIGNED_OUT') {
      redirectToLogin();
    } else if (event === 'SIGNED_IN' && session) {
      checkUserApproval(session.user.id, session.user);
    }
  });
}

/**
 * Check if user is approved to access the system
 */
function checkUserApproval(userId, user) {
  supabaseClient
    .from('user_approvals')
    .select('approved, full_name')
    .eq('user_id', userId)
    .single()
    .then(function(result) {
      if (result.error) {
        console.error('Approval check error:', result.error);
        // If table doesn't exist or no approval record found, block access
        supabaseClient.auth.signOut().then(function() {
          alert('Access denied. Your account is pending approval or the system is not properly configured.');
          redirectToLogin();
        });
        return;
      }

      if (!result.data.approved) {
        // User not approved yet
        supabaseClient.auth.signOut().then(function() {
          alert('Your account is pending approval. Please contact an administrator.');
          redirectToLogin();
        });
        return;
      }

      // User is approved, set global state
      currentUser = {
        id: userId,
        email: user.email,
        fullName: result.data.full_name || user.user_metadata?.full_name || user.email
      };
      authInitialized = true;

      // Show the page content
      document.body.style.display = 'block';

      // Trigger custom event that pages can listen to
      var event = new CustomEvent('authReady', { detail: currentUser });
      document.dispatchEvent(event);

      // Update UI to show logged-in state
      updateAuthUI();
    })
    .catch(function(err) {
      console.error('Error checking approval:', err);
      supabaseClient.auth.signOut().then(function() {
        alert('An error occurred. Please try logging in again.');
        redirectToLogin();
      });
    });
}

/**
 * Redirect to login page
 */
function redirectToLogin() {
  // Save current page to redirect back after login
  var currentPage = window.location.pathname;
  window.location.href = 'login.html?redirect=' + encodeURIComponent(currentPage);
}

/**
 * Sign out the current user
 */
function signOut() {
  supabaseClient.auth.signOut().then(function() {
    redirectToLogin();
  }).catch(function(error) {
    console.error('Sign out error:', error);
    redirectToLogin();
  });
}

/**
 * Update UI elements to show user is logged in
 * This adds a logout button to the navigation if it exists
 */
function updateAuthUI() {
  // Check if there's a nav element
  var nav = document.querySelector('nav');
  if (nav && currentUser) {
    // Check if logout button already exists
    if (!document.getElementById('logoutBtn')) {
      // Create user menu
      var userMenu = document.createElement('div');
      userMenu.style.cssText = 'display: flex; align-items: center; gap: 1rem;';

      var userName = document.createElement('span');
      userName.textContent = currentUser.fullName;
      userName.style.cssText = 'color: var(--text-gray); font-size: 0.9rem;';

      var logoutLink = document.createElement('a');
      logoutLink.href = '#';
      logoutLink.textContent = 'Logout';
      logoutLink.id = 'logoutBtn';
      logoutLink.style.cssText = 'color: var(--text-gray); text-decoration: none; font-weight: 500; font-size: 0.95rem; transition: color 0.2s;';
      logoutLink.addEventListener('click', function(e) {
        e.preventDefault();
        if (confirm('Are you sure you want to log out?')) {
          signOut();
        }
      });

      userMenu.appendChild(userName);
      userMenu.appendChild(logoutLink);
      nav.appendChild(userMenu);
    }
  }
}

/**
 * Get current authenticated user
 * Returns null if not authenticated
 */
function getCurrentUser() {
  return currentUser;
}

/**
 * Check if auth is ready
 */
function isAuthReady() {
  return authInitialized;
}

// Initialize auth when script loads
// Only run if we're not on the login or register page
if (!window.location.pathname.includes('login.html') &&
    !window.location.pathname.includes('register.html') &&
    !window.location.pathname.includes('forgot-password.html')) {

  // Hide page content until authentication is verified
  document.body.style.display = 'none';

  // Initialize authentication
  initAuth();
}
