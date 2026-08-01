import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gyvnhvnuidrfmqzielmv.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dm5odm51aWRyZm1xemllbG12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTY5ODksImV4cCI6MjA4OTU5Mjk4OX0.dK_l3INxOB9_HVYte43PCXFQLe8DnXgPitcxhNK4x30';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function checkRLS() {
  console.log('--- Testing RPC or raw table checks ---');
  // Check if we can query app_users
  const { data: users, error: uErr } = await supabase.from('app_users').select('id, name, email, profile, branch_id');
  console.log('Users count:', users?.length, uErr);
  if (users) {
    console.log('Sample users:', users.slice(0, 5));
  }

  // Check drivers
  const { data: drivers, error: dErr } = await supabase.from('drivers').select('id, name, branch_id').limit(5);
  console.log('Drivers sample:', drivers, dErr);

  // Check cargos with different queries
  const { data: cargos, error: cErr } = await supabase.from('cargos').select('id');
  console.log('Cargos select id:', cargos, cErr);

  // Check shipments with different queries
  const { data: shipments, error: sErr } = await supabase.from('shipments').select('id');
  console.log('Shipments select id:', shipments, sErr);
}

checkRLS();
