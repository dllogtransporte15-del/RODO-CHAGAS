import { createClient } from '@supabase/supabase-js';

const url = 'https://gyvnhvnuidrfmqzielmv.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dm5odm51aWRyZm1xemllbG12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTY5ODksImV4cCI6MjA4OTU5Mjk4OX0.dK_l3INxOB9_HVYte43PCXFQLe8DnXgPitcxhNK4x30';
const supabase = createClient(url, key);

async function run() {
  const ids = ['BRU-2635', 'BRU-2414', 'BRU-2413', 'BRU-2322'];
  const { data: shipments, error } = await supabase
    .from('shipments')
    .select('*')
    .in('id', ids);

  if (error) {
    console.error('Shipments error:', error);
    return;
  }

  console.log('Found shipments:', shipments.length);
  for (const s of shipments) {
    console.log('--------------------------------------------------');
    console.log('ID:', s.id);
    console.log('cargo_id:', s.cargo_id);
    console.log('driver_name:', s.driver_name);
    console.log('horse_plate:', s.horse_plate);
    console.log('status:', s.status);
    console.log('shipment_tonnage:', s.shipment_tonnage);
    console.log('driver_freight_value:', s.driver_freight_value);
    console.log('history:', JSON.stringify(s.history, null, 2));
    console.log('status_history:', JSON.stringify(s.status_history, null, 2));
    
    // Check if cargo exists
    if (s.cargo_id) {
      const { data: cargo } = await supabase.from('cargos').select('*').eq('id', s.cargo_id).maybeSingle();
      console.log('Cargo in DB:', cargo ? 'EXISTS' : 'NOT FOUND');
      if (cargo) {
        console.log('Cargo details:', cargo);
      }
    }
  }

  // Also check if there are any other cargos in the table or similar cargo names/sequences
  const cargoIds = shipments.map(s => s.cargo_id).filter(Boolean);
  console.log('\nAll missing cargo_ids:', cargoIds);
}

run();
