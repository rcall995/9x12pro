/**
 * Script to add auth.js to all HTML pages in 10k-files folder
 * This is a one-time setup script
 */

const fs = require('fs');
const path = require('path');

const folderPath = path.join(__dirname, '10k-files');

// Pages to exclude from authentication
const excludePages = ['login.html', 'register.html', 'forgot-password.html', 'reset-password.html'];

// Get all HTML files
const files = fs.readdirSync(folderPath).filter(file =>
  file.endsWith('.html') && !excludePages.includes(file)
);

console.log(`Found ${files.length} HTML files to update:`);

files.forEach(file => {
  const filePath = path.join(folderPath, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Check if auth.js is already included
  if (content.includes('auth.js')) {
    console.log(`  ✓ ${file} - already has auth.js`);
    return;
  }

  // Find the line with @supabase/supabase-js script
  const supabaseScriptPattern = /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2"><\/script>/;

  if (supabaseScriptPattern.test(content)) {
    // Add auth.js right after the Supabase script
    content = content.replace(
      supabaseScriptPattern,
      '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>\n  <script src="auth.js"></script>'
    );

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  ✓ ${file} - added auth.js after Supabase script`);
  } else {
    // If no Supabase script found, add both before closing body tag
    const bodyClosePattern = /<\/body>/;

    if (bodyClosePattern.test(content)) {
      content = content.replace(
        bodyClosePattern,
        '\n  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>\n  <script src="auth.js"></script>\n</body>'
      );

      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`  ✓ ${file} - added Supabase and auth.js scripts`);
    } else {
      console.log(`  ✗ ${file} - could not find insertion point`);
    }
  }
});

console.log('\nDone! Authentication has been added to all protected pages.');
