import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gyvnhvnuidrfmqzielmv.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dm5odm51aWRyZm1xemllbG12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTY5ODksImV4cCI6MjA4OTU5Mjk4OX0.dK_l3INxOB9_HVYte43PCXFQLe8DnXgPitcxhNK4x30';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function listAllTables() {
  const commonNames = [
    'cargos', 'shipments', 'clients', 'owners', 'drivers', 'vehicles', 'products',
    'app_users', 'tickets', 'freight_offers', 'branches', 'app_settings',
    'profile_permissions', 'shipment_locks', 'tool_clients', 'tool_stays', 'tool_quotes',
    'loads', 'embarques', 'cargas', 'pedidos', 'ordens', 'users', 'auth_users'
  ];

  for (const name of commonNames) {
    const { data, error, count } = await supabase.from(name).select('*', { count: 'exact', head: true });
    if (error) {
      if (error.code !== '42P01') {
        console.log(`Table [${name}] ERROR:`, error.message, error.code);
      }
    } else {
      console.log(`Table [${name}] EXISTS -> Count: ${count}`);
    }
  }
}

listAllTables();
