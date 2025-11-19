// Clear all prospect-related data from browser localStorage
// Run this in the browser console on 9x12pro.com

console.log('🔵 Starting browser cache cleanup...');
console.log('');

// List all items to be cleared
const itemsToRemove = [
  'categorizedProspects',
  'manualProspects',
  'placesCache',
  'notInterestedBusinesses',
  'prospectPoolState',
  'categoryVersion'
];

// Show what's currently stored
console.log('📊 Current localStorage items:');
itemsToRemove.forEach(item => {
  const data = localStorage.getItem(item);
  if (data) {
    console.log(`  - ${item}: ${data.length} characters`);
  } else {
    console.log(`  - ${item}: not found`);
  }
});
console.log('');

// Remove each item
console.log('🗑️ Removing items...');
itemsToRemove.forEach(item => {
  localStorage.removeItem(item);
  console.log(`  ✅ Removed ${item}`);
});

console.log('');
console.log('✅ Browser cache cleanup complete!');
console.log('');
console.log('🔄 Now refresh the page (F5) to see clean state');
