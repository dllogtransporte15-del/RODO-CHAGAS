import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gyvnhvnuidrfmqzielmv.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dm5odm51aWRyZm1xemllbG12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTY5ODksImV4cCI6MjA4OTU5Mjk4OX0.dK_l3INxOB9_HVYte43PCXFQLe8DnXgPitcxhNK4x30';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function fetchAllRows(tableName, orderColumn, orderOptions) {
  let allData = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .order(orderColumn, orderOptions)
      .range(from, to);

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      break;
    }

    allData = allData.concat(data);

    if (data.length < pageSize) {
      hasMore = false;
    } else {
      page++;
    }
  }

  return allData;
}

async function testFetchFunctions() {
  const tests = [
    { name: 'clients', fn: () => fetchAllRows('clients', 'nome_fantasia') },
    { name: 'owners', fn: () => fetchAllRows('owners', 'name') },
    { name: 'drivers', fn: () => fetchAllRows('drivers', 'name') },
    { name: 'vehicles', fn: () => fetchAllRows('vehicles', 'plate') },
    { name: 'products', fn: () => fetchAllRows('products', 'name') },
    { name: 'cargos', fn: () => fetchAllRows('cargos', 'created_at', { ascending: false }) },
    { name: 'shipments', fn: () => fetchAllRows('shipments', 'created_at', { ascending: false }) },
    { name: 'app_users', fn: () => fetchAllRows('app_users', 'name') },
    { name: 'tickets', fn: () => fetchAllRows('tickets', 'created_at', { ascending: false }) },
    { name: 'profile_permissions', fn: () => supabase.from('profile_permissions').select('permissions').eq('id', 1).single() },
    { name: 'app_settings', fn: () => supabase.from('app_settings').select('company_logo, theme_image').eq('id', 1).single() },
    { name: 'shipment_locks', fn: () => supabase.from('shipment_locks').select('*') },
    { name: 'branches', fn: () => fetchAllRows('branches', 'name') },
    { name: 'tool_stays', fn: () => supabase.from('tool_stays').select('*') },
    { name: 'freight_offers', fn: () => fetchAllRows('freight_offers', 'created_at', { ascending: true }) }
  ];

  for (const t of tests) {
    try {
      const res = await t.fn();
      console.log(`[PASS] ${t.name}:`, Array.isArray(res) ? `${res.length} rows` : (res?.data || 'single object'));
    } catch (err) {
      console.error(`[FAIL] ${t.name} THREW ERROR:`, err.message || err);
    }
  }
}

testFetchFunctions();
