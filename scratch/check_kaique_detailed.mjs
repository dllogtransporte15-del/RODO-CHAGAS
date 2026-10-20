import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gyvnhvnuidrfmqzielmv.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dm5odm51aWRyZm1xemllbG12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTY5ODksImV4cCI6MjA4OTU5Mjk4OX0.dK_l3INxOB9_HVYte43PCXFQLe8DnXgPitcxhNK4x30';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function checkKaiqueDetailed() {
  const { data: shipments, error } = await supabase
    .from('shipments')
    .select('id, order_id, cargo_id, driver_name, horse_plate, status, embarcador_id, created_by_id, created_at')
    .or('embarcador_id.eq.USR-001,created_by_id.eq.USR-001');

  if (error) {
    console.error(error);
    return;
  }

  const createdByKaique = shipments.filter(s => s.created_by_id === 'USR-001');
  console.log(`Shipments with created_by_id == USR-001: ${createdByKaique.length}`);
  console.table(createdByKaique.slice(0, 10));

  const embarcadorKaique = shipments.filter(s => s.embarcador_id === 'USR-001');
  console.log(`Shipments with embarcador_id == USR-001: ${embarcadorKaique.length}`);
  console.table(embarcadorKaique);
}

checkKaiqueDetailed();
