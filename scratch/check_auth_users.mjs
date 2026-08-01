import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gyvnhvnuidrfmqzielmv.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dm5odm51aWRyZm1xemllbG12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTY5ODksImV4cCI6MjA4OTU5Mjk4OX0.dK_l3INxOB9_HVYte43PCXFQLe8DnXgPitcxhNK4x30';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

// List Supabase auth users through the API to understand who is registered
async function listAuthUsers() {
  console.log('=== VERIFICANDO USUÁRIOS DO SUPABASE AUTH ===\n');

  // Check app_users table to see what users exist
  const { data: appUsers, error: appErr } = await supabase.from('app_users').select('*');
  if (appErr) {
    console.log('Erro ao ler app_users:', appErr.message);
  } else {
    console.log('Usuários no app_users:', appUsers?.length);
    appUsers?.forEach(u => {
      console.log(`  ID: ${u.id} | Email: ${u.email} | Profile: ${u.profile} | Auth: ${u.auth_user_id || 'SEM AUTH'}`);
    });
  }

  // Try to login with the real Davis email
  const credentials = [
    { email: 'dllogtransporte15@gmail.com', password: 'mauricio15' },
    { email: 'dllogtransporte@gmail.com', password: 'mauricio15' },
    { email: 'dllogtransporte@gmail.com', password: 'Davis2024' },
    { email: 'dllogtransporte@gmail.com', password: 'rodo2024' },
    { email: 'kaiquerfs2003@gmail.com', password: 'Kaique2003' },
  ];
  
  console.log('\n=== TESTANDO CREDENCIAIS ===');
  for (const cred of credentials) {
    const { data, error } = await supabase.auth.signInWithPassword(cred);
    if (!error && data.session) {
      console.log(`✅ Login OK: ${cred.email} / ${cred.password}`);
      console.log('   Auth User ID:', data.user?.id);
      
      // Test data access after login
      const { data: cargos } = await supabase.from('cargos').select('id').limit(5);
      const { data: ships } = await supabase.from('shipments').select('id').limit(5);
      console.log(`   Cargos visíveis: ${cargos?.length}`);
      console.log(`   Shipments visíveis: ${ships?.length}`);
      
      await supabase.auth.signOut();
      break;
    } else {
      console.log(`❌ Falhou: ${cred.email} - ${error?.message}`);
    }
  }
}

listAuthUsers();
