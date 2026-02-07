/**
 * Search API Comparison Test
 * Compares Serper vs Scrapingdog vs Brave for finding business websites
 */

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Test businesses - mix of types and locations
  const defaultTests = [
    { name: "Adams Heating & Cooling", location: "Buffalo NY" },
    { name: "Joe's Pizza", location: "Buffalo NY" },
    { name: "Anchor Bar", location: "Buffalo NY" },
    { name: "Wegmans", location: "Buffalo NY" },
    { name: "Lloyd Taco Factory", location: "Buffalo NY" }
  ];

  const tests = req.body?.tests || defaultTests;
  const results = [];

  for (const test of tests) {
    const query = `${test.name} ${test.location} official website`;
    const businessName = test.name;

    console.log(`\n🧪 Testing: "${test.name}" in ${test.location}`);

    const testResult = {
      business: test.name,
      location: test.location,
      query,
      serper: null,
      scrapingdog: null,
      brave: null
    };

    // Test Serper
    try {
      const serperStart = Date.now();
      const serperRes = await fetch(`https://${req.headers.host}/api/serper-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, businessName })
      });
      const serperData = await serperRes.json();
      testResult.serper = {
        website: serperData.topUrl || null,
        responseTime: Date.now() - serperStart,
        source: serperData.source,
        error: serperData.error || null
      };
    } catch (e) {
      testResult.serper = { error: e.message };
    }

    // Test Scrapingdog
    try {
      const sdStart = Date.now();
      const sdRes = await fetch(`https://${req.headers.host}/api/scrapingdog-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, businessName })
      });
      const sdData = await sdRes.json();
      testResult.scrapingdog = {
        website: sdData.website || null,
        responseTime: sdData.responseTime || (Date.now() - sdStart),
        error: sdData.error || null
      };
    } catch (e) {
      testResult.scrapingdog = { error: e.message };
    }

    // Test Brave
    try {
      const braveStart = Date.now();
      const braveRes = await fetch(`https://${req.headers.host}/api/brave-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, businessName })
      });
      const braveData = await braveRes.json();
      testResult.brave = {
        website: braveData.website || null,
        responseTime: Date.now() - braveStart,
        error: braveData.error || null
      };
    } catch (e) {
      testResult.brave = { error: e.message };
    }

    results.push(testResult);
  }

  // Summary
  const summary = {
    serper: { found: 0, avgTime: 0, errors: 0 },
    scrapingdog: { found: 0, avgTime: 0, errors: 0 },
    brave: { found: 0, avgTime: 0, errors: 0 }
  };

  for (const r of results) {
    if (r.serper?.website) summary.serper.found++;
    if (r.serper?.responseTime) summary.serper.avgTime += r.serper.responseTime;
    if (r.serper?.error) summary.serper.errors++;

    if (r.scrapingdog?.website) summary.scrapingdog.found++;
    if (r.scrapingdog?.responseTime) summary.scrapingdog.avgTime += r.scrapingdog.responseTime;
    if (r.scrapingdog?.error) summary.scrapingdog.errors++;

    if (r.brave?.website) summary.brave.found++;
    if (r.brave?.responseTime) summary.brave.avgTime += r.brave.responseTime;
    if (r.brave?.error) summary.brave.errors++;
  }

  const count = results.length;
  summary.serper.avgTime = Math.round(summary.serper.avgTime / count);
  summary.scrapingdog.avgTime = Math.round(summary.scrapingdog.avgTime / count);
  summary.brave.avgTime = Math.round(summary.brave.avgTime / count);

  return res.status(200).json({
    testCount: count,
    summary,
    results
  });
}
