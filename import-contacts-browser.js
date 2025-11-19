
// Import Contact Info Script
// Generated: 2025-11-19T01:54:07.158Z
// Run this in the browser console while on the Client Database page

(async function importContactInfo() {
  console.log('🔵 Starting contact info import...');

  const contactData = [
  {
    "businessName": "Adam EL Houssieny",
    "firstName": "Adam's Detailing & Coatings",
    "lastName": "",
    "email": "adamattack417@gmail.com",
    "phone": "+17162453854",
    "contactName": "Adam's Detailing & Coatings"
  },
  {
    "businessName": "Tannen Montea",
    "firstName": "Aerial Insight LLC",
    "lastName": "",
    "email": "aerialinsightllc@protonmail.com",
    "phone": "+12315572870",
    "contactName": "Aerial Insight LLC"
  },
  {
    "businessName": "Animal Kingdom Veterinary Hospital",
    "firstName": "Animal Kingdom Veterinary Hospital",
    "lastName": "Teresa Rupert",
    "email": "vet@animalkingdomvet.com",
    "phone": "+17167735242",
    "contactName": "Animal Kingdom Veterinary Hospital Teresa Rupert"
  },
  {
    "businessName": "Babcock Development",
    "firstName": "Babcock Development",
    "lastName": "Austin Castillo",
    "email": "info@babcock-development.com",
    "phone": "+17163823351",
    "contactName": "Babcock Development Austin Castillo"
  },
  {
    "businessName": "Black Gold Sealer",
    "firstName": "Black Gold Sealer",
    "lastName": "John Faso",
    "email": "fasotwo@gmail.com",
    "phone": "+17165984019",
    "contactName": "Black Gold Sealer John Faso"
  },
  {
    "businessName": "Brass Ring Web Solutions",
    "firstName": "Brass Ring Web Solutions",
    "lastName": "Logan Benjamin",
    "email": "logan@wnythrive.com",
    "phone": "+17167752622",
    "contactName": "Brass Ring Web Solutions Logan Benjamin"
  },
  {
    "businessName": "Brian Castillo",
    "firstName": "CasXteriors",
    "lastName": "",
    "email": "casxteriors@yahoo.com",
    "phone": "+17168604423",
    "contactName": "CasXteriors"
  },
  {
    "businessName": "Cloudberry Cafe",
    "firstName": "Cloudberry Cafe",
    "lastName": "Camille Caraglin",
    "email": "camille@cloudberry.com",
    "phone": "+17163390154",
    "contactName": "Cloudberry Cafe Camille Caraglin"
  },
  {
    "businessName": "Cross Controls & Electric",
    "firstName": "Cross Controls & Electric",
    "lastName": "Jordan Benoit",
    "email": "gifc286benoit@gmail.com",
    "phone": "+17167737720",
    "contactName": "Cross Controls & Electric Jordan Benoit"
  },
  {
    "businessName": "Dana Carver",
    "firstName": "Dana's Stylin Pets",
    "lastName": "",
    "email": "danasstylinpets@gmail.com",
    "phone": "+17169902881",
    "contactName": "Dana's Stylin Pets"
  },
  {
    "businessName": "Amanda",
    "firstName": "Darnley Equipment Rental",
    "lastName": "",
    "email": "darnleyequipmentrental@yahoo.com",
    "phone": "+17165503805",
    "contactName": "Darnley Equipment Rental"
  },
  {
    "businessName": "Dowd Battery",
    "firstName": "Dowd Battery - Justin Dowd",
    "lastName": "",
    "email": "justin@dowdbattery.com",
    "phone": "+17169121721",
    "contactName": "Dowd Battery - Justin Dowd"
  },
  {
    "businessName": "Kimberly Moran",
    "firstName": "Dr. Michael Muto Chiropractic",
    "lastName": "",
    "email": "km.moran1973@gmail.com",
    "phone": "",
    "contactName": "Dr. Michael Muto Chiropractic"
  },
  {
    "businessName": "Fabrics Direct 4 You",
    "firstName": "Fabrics Direct 4 You",
    "lastName": "Nick Kingston",
    "email": "paypal@diyseatskins.com",
    "phone": "+17167252147",
    "contactName": "Fabrics Direct 4 You Nick Kingston"
  },
  {
    "businessName": "GGC Inc.",
    "firstName": "GGC Inc.",
    "lastName": "",
    "email": "ggc.inc@yahoo.com",
    "phone": "+17163001480",
    "contactName": "GGC Inc."
  },
  {
    "businessName": "Brendan Atkins",
    "firstName": "GI Waste Management",
    "lastName": "",
    "email": "info@giwaste.com",
    "phone": "+17167831085",
    "contactName": "GI Waste Management"
  },
  {
    "businessName": "GK Property Maintenance LLC",
    "firstName": "GK Property Maintenance LLC",
    "lastName": "Gary West",
    "email": "gkpmwny@gmail.com",
    "phone": "+17165536883",
    "contactName": "GK Property Maintenance LLC Gary West"
  },
  {
    "businessName": "Diane DeSimone",
    "firstName": "Homes by Kodiak, Inc.",
    "lastName": "",
    "email": "ddesimone@grand-island.ny.us",
    "phone": "",
    "contactName": "Homes by Kodiak, Inc."
  },
  {
    "businessName": "Island Pets and Feed, Inc",
    "firstName": "Island Pets and Feed, Inc",
    "lastName": "Samantha",
    "email": "islandpets07@yahoo.com",
    "phone": "+17167731150",
    "contactName": "Island Pets and Feed, Inc Samantha"
  },
  {
    "businessName": "Kelliann Carney",
    "firstName": "Jack & Jill Community School",
    "lastName": "",
    "email": "kellianncarney@gmail.com",
    "phone": "+17167757003",
    "contactName": "Jack & Jill Community School"
  },
  {
    "businessName": "JBay Exterior Soft Pressure Washing",
    "firstName": "JBay Exterior Soft Pressure Washing",
    "lastName": "James Koslowski",
    "email": "jameswk23@gmail.com",
    "phone": "+17166283288",
    "contactName": "JBay Exterior Soft Pressure Washing James Koslowski"
  },
  {
    "businessName": "Carmen",
    "firstName": "Leaf, Stone & Steel",
    "lastName": "",
    "email": "carmen@leafstoneandsteel.com",
    "phone": "+17168676598",
    "contactName": "Leaf, Stone & Steel"
  },
  {
    "businessName": "Joe Drust",
    "firstName": "LeBoeuf Shoppe",
    "lastName": "",
    "email": "joe@leboeufshoppe.com",
    "phone": "+17162078308",
    "contactName": "LeBoeuf Shoppe"
  },
  {
    "businessName": "David",
    "firstName": "Legendary Landscaping",
    "lastName": "",
    "email": "",
    "phone": "+17169841827",
    "contactName": "Legendary Landscaping"
  },
  {
    "businessName": "Local Crafters Construction LLC",
    "firstName": "Lindsey",
    "lastName": "",
    "email": "info@localcraftersllc.com",
    "phone": "+17169092910",
    "contactName": "Lindsey"
  },
  {
    "businessName": "Mark & Heather",
    "firstName": "Mark's",
    "lastName": "Island Tree Service",
    "email": "marksislandtreeservice@roadrunner.com",
    "phone": "+17165360686",
    "contactName": "Mark's Island Tree Service"
  },
  {
    "businessName": "OCC Concrete Corp",
    "firstName": "OCC Concrete Corp",
    "lastName": "Tony Caruana",
    "email": "tony@occconcretecorp.com",
    "phone": "+17162397774",
    "contactName": "OCC Concrete Corp Tony Caruana"
  },
  {
    "businessName": "Pure Sky Energy",
    "firstName": "Pure Sky Energy",
    "lastName": "Janet Janzen",
    "email": "janet.janzen@pureskyenergy.com",
    "phone": "+14158548567",
    "contactName": "Pure Sky Energy Janet Janzen"
  },
  {
    "businessName": "Roofologists",
    "firstName": "Roofologists",
    "lastName": "Andre",
    "email": "roofologists@gmail.com",
    "phone": "+17168702574",
    "contactName": "Roofologists Andre"
  },
  {
    "businessName": "The Park Buffalo",
    "firstName": "The Park Buffalo",
    "lastName": "Liz Goss",
    "email": "liz@theparkbuffalo.com",
    "phone": "+17169094621",
    "contactName": "The Park Buffalo Liz Goss"
  },
  {
    "businessName": "Jessica Robins",
    "firstName": "Trilogy Physical Therapy",
    "lastName": "",
    "email": "jessica.robins@mytrilogy.org",
    "phone": "+17169090407",
    "contactName": "Trilogy Physical Therapy"
  }
];

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

  console.log(`\n✅ Import Complete!`);
  console.log(`   Updated: ${updatedCount} clients`);
  console.log(`   Not Found: ${notFoundCount} clients`);

  if (notFound.length > 0) {
    console.log('\n⚠️ Clients not found in database:');
    notFound.forEach(name => console.log('   -', name));
  }

  alert(`Contact info imported!\n\nUpdated: ${updatedCount} clients\nNot found: ${notFoundCount} clients\n\nCheck console for details.`);
})();
