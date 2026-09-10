import { createClient } from '@supabase/supabase-js';

const url = 'https://gyvnhvnuidrfmqzielmv.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dm5odm51aWRyZm1xemllbG12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTY5ODksImV4cCI6MjA4OTU5Mjk4OX0.dK_l3INxOB9_HVYte43PCXFQLe8DnXgPitcxhNK4x30';
const supabase = createClient(url, key);

async function verify() {
  const ids = ['BRU-2635', 'BRU-2414', 'BRU-2413', 'BRU-2322'];
  const { data: shipments } = await supabase.from('shipments').select('id, cargo_id, driver_name, status, shipment_tonnage').in('id', ids);
  
  for (const s of shipments || []) {
    const { data: cargo } = await supabase.from('cargos').select('id, origin, destination, status').eq('id', s.cargo_id).single();
    console.log(`Shipment ${s.id} -> Cargo ${s.cargo_id}: ${cargo?.origin} → ${cargo?.destination} (${cargo?.status})`);
  }
}

verify();
