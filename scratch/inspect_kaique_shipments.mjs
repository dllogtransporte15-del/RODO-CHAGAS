import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gyvnhvnuidrfmqzielmv.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dm5odm51aWRyZm1xemllbG12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTY5ODksImV4cCI6MjA4OTU5Mjk4OX0.dK_l3INxOB9_HVYte43PCXFQLe8DnXgPitcxhNK4x30';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function checkKaiqueShipments() {
  const { data: shipments, error } = await supabase
    .from('shipments')
    .select('id, order_id, cargo_id, driver_name, horse_plate, trailer1_plate, status, embarcador_id, created_by_id, created_at')
    .or('embarcador_id.eq.USR-001,created_by_id.eq.USR-001');

  if (error) {
    console.error('Error fetching shipments:', error);
    return;
  }

  console.log(`Found ${shipments.length} shipments with USR-001:`);
  console.table(shipments);
  
  // Also check cargos #1055, #1048, #1041, #1039
  const { data: cargos, error: cargoErr } = await supabase
    .from('cargos')
    .select('id, sequence_id, origin, destination, created_by_id')
    .in('sequence_id', [1055, 1048, 1041, 1039, 1032, 1046, 1050]);
  
  console.log('Cargos found:');
  console.table(cargos);
}

checkKaiqueShipments();
