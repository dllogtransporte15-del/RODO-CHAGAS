import { createClient } from '@supabase/supabase-js';

const url = 'https://gyvnhvnuidrfmqzielmv.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dm5odm51aWRyZm1xemllbG12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTY5ODksImV4cCI6MjA4OTU5Mjk4OX0.dK_l3INxOB9_HVYte43PCXFQLe8DnXgPitcxhNK4x30';
const supabase = createClient(url, key);

async function run() {
  const { data: allShipmentsWith747 } = await supabase
    .from('shipments')
    .select('id, cargo_id, driver_name, horse_plate, status, shipment_tonnage, driver_freight_value, history')
    .eq('cargo_id', 'CRG-747');

  console.log('Shipments with CRG-747:', allShipmentsWith747?.length);
  for (const s of allShipmentsWith747 || []) {
    console.log(`- ${s.id}: ${s.driver_name} (${s.horse_plate}) - ${s.status} - Ton: ${s.shipment_tonnage}`);
    console.log('  Log 0:', s.history?.[0]?.description);
  }

  const { data: allShipmentsWith790 } = await supabase
    .from('shipments')
    .select('id, cargo_id, driver_name, horse_plate, status, shipment_tonnage, driver_freight_value, history')
    .eq('cargo_id', 'CRG-790');

  console.log('\nShipments with CRG-790:', allShipmentsWith790?.length);
  for (const s of allShipmentsWith790 || []) {
    console.log(`- ${s.id}: ${s.driver_name} (${s.horse_plate}) - ${s.status} - Ton: ${s.shipment_tonnage}`);
    console.log('  Log 0:', s.history?.[0]?.description);
  }

  // Check if we can find clients or products or similar cargos
  const { data: clients } = await supabase.from('clients').select('id, nome_fantasia, razao_social');
  console.log('\nClients:', clients?.map(c => `${c.id}: ${c.nome_fantasia || c.razao_social}`));

  const { data: products } = await supabase.from('products').select('id, name');
  console.log('\nProducts:', products?.map(p => `${p.id}: ${p.name}`));
}

run();
