import { createClient } from '@supabase/supabase-js';

const url = 'https://gyvnhvnuidrfmqzielmv.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dm5odm51aWRyZm1xemllbG12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTY5ODksImV4cCI6MjA4OTU5Mjk4OX0.dK_l3INxOB9_HVYte43PCXFQLe8DnXgPitcxhNK4x30';
const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.from('shipments').select('id, scheduled_date, arrival_time, created_at, status_history').eq('status', 'Ag. Adiantamento');
  if (error) {
    console.error(error);
    return;
  }
  console.log('Count:', data.length);
  for (let i = 0; i < 2; i++) {
    const s = data[i];
    console.log(`\n=== #${i+1} [${s.id}] ===`);
    console.log('scheduled_date:', s.scheduled_date);
    console.log('arrival_time:', s.arrival_time);
    console.log('created_at:', s.created_at);
    console.log('status_history:', JSON.stringify(s.status_history));
  }
}
run();
