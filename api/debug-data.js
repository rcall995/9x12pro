/**
 * Debug endpoint to inspect database structure
 */

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const SUPABASE_URL = 'https://kurhsdvxsgkgnfimfqdo.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1cmhzZHZ4c2drZ25maW1mcWRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MDk3NDYsImV4cCI6MjA3ODM4NTc0Nn0.nB_GsE89WJ3eAQrgmNKb-fbCktHTHf-987D-G6lscZA';

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const { data, error } = await supabase
    .from('app_data')
    .select('*')
    .eq('data_type', 'placesCache')
    .limit(1);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const record = data?.[0];
  if (!record) {
    return res.status(200).json({ message: 'No placesCache records found' });
  }

  // Get first key's data
  const dataKeys = Object.keys(record.data || {});
  const firstKey = dataKeys[0];
  const firstValue = record.data?.[firstKey];

  return res.status(200).json({
    recordKeys: Object.keys(record),
    dataType: record.data_type,
    dataKeysCount: dataKeys.length,
    sampleDataKeys: dataKeys.slice(0, 5),
    firstKey,
    firstValueType: typeof firstValue,
    firstValueIsArray: Array.isArray(firstValue),
    firstValueKeys: firstValue && typeof firstValue === 'object' && !Array.isArray(firstValue)
      ? Object.keys(firstValue).slice(0, 5)
      : null,
    firstValueSample: Array.isArray(firstValue)
      ? firstValue.slice(0, 2)
      : (typeof firstValue === 'object' ? JSON.stringify(firstValue).slice(0, 500) : firstValue)
  });
}
