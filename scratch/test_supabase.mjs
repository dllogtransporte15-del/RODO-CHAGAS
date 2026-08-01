import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gyvnhvnuidrfmqzielmv.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dm5odm51aWRyZm1xemllbG12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTY5ODksImV4cCI6MjA4OTU5Mjk4OX0.dK_l3INxOB9_HVYte43PCXFQLe8DnXgPitcxhNK4x30';
const PUB_KEY = 'sb_publishable_JlXJwxsqvqmPdt3BvZQt-A_kVWa-3br';

console.log('--- Testing with ANON_KEY ---');
const supabaseAnon = createClient(SUPABASE_URL, ANON_KEY);

async function testAll() {
  const tables = ['clients', 'owners', 'drivers', 'vehicles', 'products', 'cargos', 'shipments', 'app_users', 'tickets', 'freight_offers', 'branches'];
  
  for (const t of tables) {
    const { data, error, count } = await supabaseAnon.from(t).select('*', { count: 'exact', head: false });
    if (error) {
      console.error(`Table [${t}] ERROR:`, error.message, error.code, error.details);
    } else {
      console.log(`Table [${t}] SUCCESS: ${data?.length} rows returned. Total count: ${count}`);
    }
  }

  console.log('\n--- Testing with PUBLISHABLE_KEY ---');
  const supabasePub = createClient(SUPABASE_URL, PUB_KEY);
  for (const t of ['clients', 'cargos']) {
    const { data, error } = await supabasePub.from(t).select('*');
    if (error) {
      console.error(`PUB KEY Table [${t}] ERROR:`, error.message, error.code);
    } else {
      console.log(`PUB KEY Table [${t}] SUCCESS: ${data?.length} rows returned.`);
    }
  }
}

testAll();
