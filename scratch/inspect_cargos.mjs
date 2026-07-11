import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gyvnhvnuidrfmqzielmv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dm5odm51aWRyZm1xemllbG12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTY5ODksImV4cCI6MjA4OTU5Mjk4OX0.dK_l3INxOB9_HVYte43PCXFQLe8DnXgPitcxhNK4x30';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  console.log("=== Fetching all cargos containing 'Robson' ===");
  const { data: cargos, error: cargoErr } = await supabase
    .from('cargos')
    .select('*');

  if (cargoErr) {
    console.error("Error fetching cargos:", cargoErr);
    return;
  }

  const robsonCargos = cargos.filter(c => {
    const commercial = c.salesperson_name || '';
    return commercial.toLowerCase().includes('robson');
  });

  console.log(`Found ${robsonCargos.length} cargos associated with Robson:`);
  console.table(robsonCargos.map(c => ({
    id: c.id,
    origin: c.origin,
    destination: c.destination,
    salesperson_name: c.salesperson_name,
    status: c.status
  })));

  if (robsonCargos.length > 0) {
    const cargoIds = robsonCargos.map(c => c.id);
    console.log(`\n=== Fetching shipments for these cargo IDs ===`);
    const { data: shipments, error: shipErr } = await supabase
      .from('shipments')
      .select('id, order_id, cargo_id, driver_name, status, embarcador_id, created_by_id, created_at')
      .in('cargo_id', cargoIds);

    if (shipErr) {
      console.error("Error fetching shipments:", shipErr);
    } else {
      console.log(`Found ${shipments.length} shipments related to Robson's cargos:`);
      console.table(shipments);
    }
  }
}

run();
