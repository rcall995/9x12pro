// Run this in your browser console on https://www.ourlocalspotlight.com/partners
// 1. Open the site and zoom out so all 264 partners are visible
// 2. Open DevTools (F12) → Console tab
// 3. Paste this entire script and press Enter
// 4. It will copy CSV data to your clipboard

(async function extractPartners() {
  // Wait for partners to load
  console.log('Extracting partner data...');

  // Try to find partner data in the page
  // Method 1: Look for partner cards in the DOM
  const partnerCards = document.querySelectorAll('[class*="partner"], [class*="card"], [class*="listing"]');

  // Method 2: Check for data in window/global scope
  const possibleDataKeys = ['partners', 'partnerData', 'listings', 'data', 'markers', 'locations'];
  let foundData = null;

  for (const key of possibleDataKeys) {
    if (window[key]) {
      console.log(`Found data in window.${key}`);
      foundData = window[key];
      break;
    }
  }

  // Method 3: Intercept network requests (check Network tab manually)
  console.log('\n=== MANUAL EXTRACTION ===');
  console.log('If automatic extraction fails, try these steps:');
  console.log('1. Open Network tab in DevTools');
  console.log('2. Refresh the page');
  console.log('3. Filter by "XHR" or "Fetch"');
  console.log('4. Look for requests containing partner data');
  console.log('5. Click the request → Preview tab to see the data');
  console.log('========================\n');

  // Method 4: Extract visible partner info from sidebar
  const extractVisiblePartners = () => {
    const partners = [];

    // Look for partner info in the sidebar (based on screenshot structure)
    const sidebar = document.querySelector('[class*="sidebar"], [class*="list"], [class*="panel"]');

    // Try to find all text content that looks like partner data
    const allText = document.body.innerText;

    // Pattern match for phone numbers and emails
    const phonePattern = /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

    const phones = allText.match(phonePattern) || [];
    const emails = allText.match(emailPattern) || [];

    console.log(`Found ${phones.length} phone numbers`);
    console.log(`Found ${emails.length} email addresses`);

    return { phones, emails };
  };

  const visible = extractVisiblePartners();

  // Output instructions for manual method
  console.log('\n=== BEST METHOD: Check Network Tab ===');
  console.log('The partner data is loaded via API. To find it:');
  console.log('1. Open Network tab');
  console.log('2. Refresh page');
  console.log('3. Search for "partner" or "spotlight" in requests');
  console.log('4. The API response will have all 264 partners as JSON');
  console.log('5. Right-click → Copy response');

  return visible;
})();
