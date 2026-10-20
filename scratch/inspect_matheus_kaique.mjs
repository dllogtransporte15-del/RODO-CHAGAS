import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gyvnhvnuidrfmqzielmv.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dm5odm51aWRyZm1xemllbG12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTY5ODksImV4cCI6MjA4OTU5Mjk4OX0.dK_l3INxOB9_HVYte43PCXFQLe8DnXgPitcxhNK4x30';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function inspectMatheusAndKaique() {
  const { data: shipments, error } = await supabase
    .from('shipments')
    .select('id, order_id, cargo_id, driver_name, horse_plate, status, embarcador_id, created_by_id, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  const matheusCreatedWithKaique = shipments.filter(s => s.created_by_id === 'USR-1469' && s.embarcador_id === 'USR-001');
  console.log(`Shipments created by Matheus (USR-1469) with Kaique (USR-001) as embarcador: ${matheusCreatedWithKaique.length}`);
  console.table(matheusCreatedWithKaique);

  const allMatheusShipments = shipments.filter(s => s.created_by_id === 'USR-1469' || s.embarcador_id === 'USR-1469');
  console.log(`All shipments involving Matheus: ${allMatheusShipments.length}`);
  console.table(allMatheusShipments);

  const allKaiqueShipments = shipments.filter(s => s.embarcador_id === 'USR-001');
  console.log(`All shipments with Kaique as embarcador: ${allKaiqueShipments.length}`);
  console.table(allKaiqueShipments);
}

inspectMatheusAndKaique();
