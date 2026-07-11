import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gyvnhvnuidrfmqzielmv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dm5odm51aWRyZm1xemllbG12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTY5ODksImV4cCI6MjA4OTU5Mjk4OX0.dK_l3INxOB9_HVYte43PCXFQLe8DnXgPitcxhNK4x30';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  const { data: users, error: userErr } = await supabase
    .from('app_users')
    .select('id, name, email, profile, active');
  
  if (userErr) {
    console.error("Error fetching users:", userErr);
    return;
  }
  
  console.log("=== All Users ===");
  for (const u of users) {
    console.log(`${u.id} - ${u.name} (${u.email}) - Profile: ${u.profile}`);
  }
}

run();
