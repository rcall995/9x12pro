const fs = require('fs');
const path = require('path');

// Read the CSV file
const csvPath = path.join(__dirname, 'export-20251119-014949.csv');
const csvData = fs.readFileSync(csvPath, 'utf-8');

// Parse CSV (simple parser for this format)
const lines = csvData.split('\n');
const headers = lines[0].split(',');

console.log('📊 Parsing CSV data...');
console.log('Headers:', headers);

// Extract contact data from CSV
const contactData = [];
for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  // Parse CSV line (handling quoted fields)
  const fields = [];
  let currentField = '';
  let inQuotes = false;

  for (let char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      fields.push(currentField.trim());
      currentField = '';
    } else {
      currentField += char;
    }
  }
  fields.push(currentField.trim());

  // Extract relevant fields
  const referenceId = fields[0] || ''; // This might be the business name
  const firstName = fields[1] || '';
  const lastName = fields[2] || '';
  const email = fields[3] || '';
  const phone = fields[4] || '';
  const companyName = fields[6] || ''; // Company Name is the primary business name

  // Use Company Name as the business name (this matches your Client Database)
  if (companyName) {
    contactData.push({
      businessName: companyName, // This will match your database
      firstName: firstName,
      lastName: lastName,
      email: email,
      phone: phone.replace(/'/g, ''), // Remove leading quote from phone numbers
      contactName: `${firstName} ${lastName}`.trim() || referenceId
    });
  }
}

console.log(`\n✅ Parsed ${contactData.length} contacts from CSV\n`);

// Now read the app.html to extract current client data
console.log('📖 Reading app.html to find client database structure...');

// Since we can't directly read from app.html's JavaScript state, we'll create a JSON file
// that can be loaded into the browser to update clients

// Create update script
const updateScript = `
// Import Contact Info Script
// Generated: ${new Date().toISOString()}
// Run this in the browser console while on the Client Database page

(async function importContactInfo() {
  console.log('🔵 Starting contact info import...');

  const contactData = ${JSON.stringify(contactData, null, 2)};

  let updatedCount = 0;
  let notFoundCount = 0;
  const notFound = [];

  // Iterate through contact data and update matching clients
  contactData.forEach(contact => {
    // Find matching client by business name (case-insensitive)
    const matchingClient = Object.values(crmState.clients || {}).find(client =>
      client.businessName.toLowerCase() === contact.businessName.toLowerCase()
    );

    if (matchingClient) {
      console.log('🔵 Updating:', contact.businessName);

      // Ensure contact object exists
      if (!matchingClient.contact) {
        matchingClient.contact = {};
      }

      // Update contact info if available in CSV
      if (contact.email) {
        matchingClient.contact.email = contact.email;
      }
      if (contact.phone) {
        matchingClient.contact.phone = contact.phone;
      }
      if (contact.contactName) {
        matchingClient.contact.name = contact.contactName;
      }

      updatedCount++;
    } else {
      console.warn('⚠️ Not found in database:', contact.businessName);
      notFound.push(contact.businessName);
      notFoundCount++;
    }
  });

  // Save updated clients
  console.log('💾 Saving updated clients...');
  await saveClients();

  // Re-render client list to show new buttons
  console.log('🎨 Re-rendering client list...');
  renderClientList();

  console.log(\`\\n✅ Import Complete!\`);
  console.log(\`   Updated: \${updatedCount} clients\`);
  console.log(\`   Not Found: \${notFoundCount} clients\`);

  if (notFound.length > 0) {
    console.log('\\n⚠️ Clients not found in database:');
    notFound.forEach(name => console.log('   -', name));
  }

  alert(\`Contact info imported!\\n\\nUpdated: \${updatedCount} clients\\nNot found: \${notFoundCount} clients\\n\\nCheck console for details.\`);
})();
`;

// Write the update script
const scriptPath = path.join(__dirname, 'import-contacts-browser.js');
fs.writeFileSync(scriptPath, updateScript);

console.log('✅ Created browser script: import-contacts-browser.js\n');
console.log('📋 INSTRUCTIONS:\n');
console.log('1. Open your app at https://9x12pro.com');
console.log('2. Go to the Client Database tab');
console.log('3. Open browser console (F12)');
console.log('4. Copy the contents of import-contacts-browser.js');
console.log('5. Paste into console and press Enter');
console.log('6. The script will update all matching clients\n');

// Also create a summary report
console.log('📊 PREVIEW - Contacts to Import:\n');
console.log('Business Name | Phone | Email | Contact Name');
console.log('─'.repeat(80));
contactData.slice(0, 10).forEach(c => {
  console.log(`${c.businessName.padEnd(30)} | ${c.phone.padEnd(15)} | ${c.email.substring(0,25).padEnd(25)} | ${c.contactName}`);
});
if (contactData.length > 10) {
  console.log(`... and ${contactData.length - 10} more`);
}
