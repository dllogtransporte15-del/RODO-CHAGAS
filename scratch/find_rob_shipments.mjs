import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gyvnhvnuidrfmqzielmv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dm5odm51aWRyZm1xemllbG12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTY5ODksImV4cCI6MjA4OTU5Mjk4OX0.dK_l3INxOB9_HVYte43PCXFQLe8DnXgPitcxhNK4x30';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  console.log("=== Fetching all ongoing shipments starting with ROB- ===");
  const { data: shipments, error: shipErr } = await supabase
    .from('shipments')
    .select('id, order_id, driver_name, status, embarcador_id, created_by_id, created_at');

  if (shipErr) {
    console.error("Error fetching shipments:", shipErr);
    return;
  }

  const robOngoing = shipments.filter(s => 
    s.id.startsWith('ROB-') && 
    s.status !== 'Finalizado' && 
    s.status !== 'Cancelado'
  );

  console.log(`Found ${robOngoing.length} ongoing shipments starting with ROB-:`);
  console.table(robOngoing);
}

run();
