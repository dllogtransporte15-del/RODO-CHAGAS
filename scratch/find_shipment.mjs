import { createClient } from '@supabase/supabase-js';

const url = 'https://gyvnhvnuidrfmqzielmv.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dm5odm51aWRyZm1xemllbG12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTY5ODksImV4cCI6MjA4OTU5Mjk4OX0.dK_l3INxOB9_HVYte43PCXFQLe8DnXgPitcxhNK4x30';
const supabase = createClient(url, key);

async function find() {
  const { data: byPlate, error: err1 } = await supabase
    .from('shipments')
    .select('*')
    .ilike('horse_plate', '%RFP8F52%');

  const { data: byDriver, error: err2 } = await supabase
    .from('shipments')
    .select('*')
    .ilike('driver_name', '%GERSON%');

  console.log('Matches by plate RFP8F52:', byPlate);
  console.log('Matches by driver GERSON:', byDriver);
}

find();
