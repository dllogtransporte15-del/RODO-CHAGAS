import { createClient } from '@supabase/supabase-js';

const url = 'https://gyvnhvnuidrfmqzielmv.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dm5odm51aWRyZm1xemllbG12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTY5ODksImV4cCI6MjA4OTU5Mjk4OX0.dK_l3INxOB9_HVYte43PCXFQLe8DnXgPitcxhNK4x30';
const supabase = createClient(url, key);

async function inspect() {
  const { data, error } = await supabase.from('shipments').select('*').eq('id', 'JAN-2206').single();
  if (error) {
    console.error('Error fetching JAN-2206:', error);
    return;
  }
  console.log('--- JAN-2206 Details ---');
  console.log('ID:', data.id);
  console.log('Driver:', data.driver_name);
  console.log('Plate:', data.horse_plate);
  console.log('Status:', data.status);
  console.log('scheduled_date:', data.scheduled_date);
  console.log('arrival_time:', data.arrival_time);
  console.log('created_at:', data.created_at);
  console.log('status_history:', JSON.stringify(data.status_history, null, 2));
  console.log('history:', JSON.stringify(data.history, null, 2));
}

inspect();
