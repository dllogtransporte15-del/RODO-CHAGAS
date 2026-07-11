import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gyvnhvnuidrfmqzielmv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dm5odm51aWRyZm1xemllbG12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTY5ODksImV4cCI6MjA4OTU5Mjk4OX0.dK_l3INxOB9_HVYte43PCXFQLe8DnXgPitcxhNK4x30';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  console.log("=== Fetching all users ===");
  const { data: users, error: userErr } = await supabase
    .from('app_users')
    .select('id, name, email, profile, active');
  
  if (userErr) {
    console.error("Error fetching users:", userErr);
    return;
  }
  console.table(users);

  console.log("\n=== Fetching all ongoing (active) shipments ===");
  const { data: activeShipments, error: shipErr } = await supabase
    .from('shipments')
    .select('id, order_id, driver_name, status, embarcador_id, created_by_id, created_at')
    .not('status', 'in', '("Finalizado","Cancelado")');

  if (shipErr) {
    console.error("Error fetching active shipments:", shipErr);
  } else {
    console.log(`Found ${activeShipments.length} active shipments:`);
    console.table(activeShipments);
  }
}

run();
