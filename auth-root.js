/**
 * Authentication JavaScript for 9x12 Pro root pages
 * Simplified version for app.html and index.html
 */

// This file expects supabaseClient to already be defined in the page

var currentAuthUser = null;
var authReady = false;

/**
 * Initialize authentication check
 */
function initRootAuth() {
  // Get current session
  supabaseClient.auth.getSession().then(function(result) {
    if (result.error) {
      console.error('Auth error:', result.error);
      redirectToRootLogin();
      return;
    }

    if (!result.data.session) {
      // No session, redirect to login
      redirectToRootLogin();
      return;
    }

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
function checkRootUserApproval(userId, user) {
  supabaseClient
    .from('user_approvals')
    .select('approved, full_name')
    .eq('user_id', userId)
    .single()
    .then(function(result) {
      if (result.error) {
        console.error('Approval check error:', result.error);
        supabaseClient.auth.signOut().then(function() {
          alert('Access denied. Your account is pending approval or not configured properly.');
          redirectToRootLogin();
        });
        return;
      }

      if (!result.data.approved) {
        supabaseClient.auth.signOut().then(function() {
          alert('Your account is pending approval. Please contact an administrator.');
          redirectToRootLogin();
        });
        return;
      }

      // User is approved
      currentAuthUser = {
        id: userId,
        email: user.email,
        fullName: result.data.full_name || user.user_metadata?.full_name || user.email
      };
      authReady = true;

      // Show the page content
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
  window.location.href = '10k-files/login.html?redirect=' + encodeURIComponent(window.location.pathname);
}

/**
 * Add logout button to navigation
 */
function addLogoutButton() {
  // Check if logout button already exists
  if (document.getElementById('rootLogoutBtn')) {
    return;
  }

  // Find the header nav area
  var nav = document.querySelector('header .flex.gap-4');
  if (nav && currentAuthUser) {
    // Create logout button
    var logoutBtn = document.createElement('button');
    logoutBtn.id = 'rootLogoutBtn';
    logoutBtn.textContent = 'Logout';
    logoutBtn.className = 'px-4 py-2 text-sm font-medium text-gray-700 hover:text-red-600 transition';
    logoutBtn.onclick = function() {
      if (confirm('Are you sure you want to log out?')) {
        supabaseClient.auth.signOut().then(function() {
          redirectToRootLogin();
        });
      }
    };

    // Add user name
    var userName = document.createElement('span');
    userName.className = 'px-4 py-2 text-sm font-medium text-gray-600';
    userName.textContent = currentAuthUser.fullName;

    // Clear existing nav and add new elements
    nav.innerHTML = '';
    nav.appendChild(userName);
    nav.appendChild(logoutBtn);
  }
}

// Hide page initially
document.body.style.display = 'none';

// Initialize auth when page loads
if (typeof supabaseClient !== 'undefined') {
  initRootAuth();
} else {
  // Wait for supabaseClient to be defined
  var checkSupabase = setInterval(function() {
    if (typeof supabaseClient !== 'undefined') {
      clearInterval(checkSupabase);
      initRootAuth();
    }
  }, 100);
}
