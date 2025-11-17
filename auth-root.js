/**
 * Authentication JavaScript for 9x12 Pro root pages
 * Simplified version for app.html and index.html
 */

// This file expects supabaseClient to already be defined in the page

// Make these global so app.html can access them
window.currentAuthUser = null;
window.authReady = false;
var currentAuthUser = null;
var authReady = false;

/**
 * Initialize authentication check
 */
function initRootAuth() {
  console.log('🔐 initRootAuth called');
  // Get current session
  supabaseClient.auth.getSession().then(function(result) {
    console.log('📋 Session result:', result);
    if (result.error) {
      console.error('Auth error:', result.error);
      redirectToRootLogin();
      return;
    }

    if (!result.data.session) {
      // No session, redirect to login
      console.log('❌ No session found, redirecting to login');
      redirectToRootLogin();
      return;
    }

    console.log('✅ Session found, checking user approval');
    // Check if user is approved
    var userId = result.data.session.user.id;
    checkRootUserApproval(userId, result.data.session.user);
  });

  // Listen for auth state changes
  supabaseClient.auth.onAuthStateChange(function(event, session) {
    if (event === 'SIGNED_OUT') {
      redirectToRootLogin();
    }
  });
}

/**
 * Check if user is approved
 */
function checkRootUserApproval(userId, user, retryCount) {
  retryCount = retryCount || 0;
  console.log('🔍 Checking approval for user:', userId, 'attempt:', retryCount + 1);

  supabaseClient
    .from('user_approvals')
    .select('approved, full_name')
    .eq('user_id', userId)
    .single()
    .then(function(result) {
      console.log('📊 Approval check result:', result);
      if (result.error) {
        console.error('Approval check error:', result.error);

        // Retry on network errors or temporary failures (max 3 attempts)
        if (retryCount < 2 && (result.error.code === 'PGRST116' || result.error.message.includes('Failed to fetch'))) {
          console.log('⏳ Retrying approval check...');
          setTimeout(function() {
            checkRootUserApproval(userId, user, retryCount + 1);
          }, 1000);
          return;
        }

        // Only sign out and redirect if it's a real approval issue
        supabaseClient.auth.signOut().then(function() {
          alert('Access denied. Your account is pending approval or not configured properly.');
          redirectToRootLogin();
        });
        return;
      }

      if (!result.data.approved) {
        console.log('⛔ User not approved');
        supabaseClient.auth.signOut().then(function() {
          alert('Your account is pending approval. Please contact an administrator.');
          redirectToRootLogin();
        });
        return;
      }

      // User is approved
      console.log('✅ User approved, showing page');
      currentAuthUser = {
        id: userId,
        email: user.email,
        fullName: result.data.full_name || user.user_metadata?.full_name || user.email
      };
      window.currentAuthUser = currentAuthUser; // Make available globally
      authReady = true;
      window.authReady = true;

      // Show the page content
      console.log('🎨 Setting body display to block');
      document.body.style.display = 'block';

      // Add logout button if needed
      addLogoutButton();
    })
    .catch(function(err) {
      console.error('Error checking approval:', err);
      supabaseClient.auth.signOut().then(function() {
        alert('An error occurred. Please try logging in again.');
        redirectToRootLogin();
      });
    });
}

/**
 * Redirect to login page
 */
function redirectToRootLogin() {
  window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.pathname);
}

/**
 * Add logout button to navigation
 */
function addLogoutButton() {
  // Check if logout button already exists
  if (document.getElementById('rootLogoutBtn')) {
    return;
  }

  if (!currentAuthUser) {
    return;
  }

  // Try to find nav area - works for index.html
  var nav = document.querySelector('header .flex.gap-4');

  // If not found, try to find header directly - works for app.html
  if (!nav) {
    nav = document.querySelector('header');
  }

  if (nav) {
    // Create container for user info and logout
    var userContainer = document.createElement('div');
    userContainer.className = 'flex items-center gap-3';
    userContainer.style.cssText = 'margin-left: auto;';

    // Add user name
    var userName = document.createElement('span');
    userName.id = 'rootUserName';
    userName.className = 'text-sm font-medium text-gray-600';
    userName.textContent = currentAuthUser.fullName;

    // Create logout button
    var logoutBtn = document.createElement('button');
    logoutBtn.id = 'rootLogoutBtn';
    logoutBtn.textContent = 'Logout';
    logoutBtn.className = 'px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition shadow-md';
    logoutBtn.onclick = function() {
      if (confirm('Are you sure you want to log out?')) {
        supabaseClient.auth.signOut().then(function() {
          redirectToRootLogin();
        });
      }
    };

    userContainer.appendChild(userName);
    userContainer.appendChild(logoutBtn);

    // Append to nav
    nav.appendChild(userContainer);
  }
}

// Hide page initially
console.log('🚀 auth-root.js loaded');
console.log('🔍 Checking for window.supabaseClient:', typeof window.supabaseClient);
document.body.style.display = 'none';

// Initialize auth when page loads
if (typeof window.supabaseClient !== 'undefined') {
  console.log('✅ supabaseClient found, initializing auth');
  var supabaseClient = window.supabaseClient;
  initRootAuth();
} else {
  console.log('⏳ Waiting for supabaseClient...');
  // Wait for supabaseClient to be defined
  var checkSupabase = setInterval(function() {
    if (typeof window.supabaseClient !== 'undefined') {
      console.log('✅ supabaseClient now available');
      clearInterval(checkSupabase);
      var supabaseClient = window.supabaseClient;
      initRootAuth();
    }
  }, 100);
}
