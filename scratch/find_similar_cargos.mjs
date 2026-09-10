import { createClient } from '@supabase/supabase-js';

const url = 'https://gyvnhvnuidrfmqzielmv.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dm5odm51aWRyZm1xemllbG12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTY5ODksImV4cCI6MjA4OTU5Mjk4OX0.dK_l3INxOB9_HVYte43PCXFQLe8DnXgPitcxhNK4x30';
const supabase = createClient(url, key);

async function run() {
  const { data: cargos } = await supabase.from('cargos').select('id, origin, destination, client_id, product_id, company_freight_value_per_ton, driver_freight_value_per_ton, status, created_at, created_by_id');
  console.log('Total cargos in DB:', cargos?.length);
  
  const relevant = cargos?.filter(c => 
    c.origin?.toLowerCase().includes('ouro') || 
    c.destination?.toLowerCase().includes('espanha') ||
    c.destination?.toLowerCase().includes('mar')
  );
  console.log('Similar cargos found:', relevant);
}

run();
