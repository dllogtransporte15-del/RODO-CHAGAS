import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gyvnhvnuidrfmqzielmv.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dm5odm51aWRyZm1xemllbG12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTY5ODksImV4cCI6MjA4OTU5Mjk4OX0.dK_l3INxOB9_HVYte43PCXFQLe8DnXgPitcxhNK4x30';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function listAllUsers() {
  const { data: users, error } = await supabase.from('app_users').select('*');
  if (error) console.error(error);
  else {
    console.table(users.map(u => ({ id: u.id, name: u.name, email: u.email, profile: u.profile, active: u.active, branch_id: u.branch_id, client_id: u.client_id })));
  }
}

listAllUsers();
