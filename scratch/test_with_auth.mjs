import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gyvnhvnuidrfmqzielmv.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dm5odm51aWRyZm1xemllbG12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTY5ODksImV4cCI6MjA4OTU5Mjk4OX0.dK_l3INxOB9_HVYte43PCXFQLe8DnXgPitcxhNK4x30';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

// Login as admin user to test if data appears after authentication
async function testWithAuth() {
  console.log('=== TESTANDO COM AUTENTICAÇÃO (Login como Admin) ===\n');
  
  // Try to sign in with Kaique's credentials (admin user)
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'kaiquerfs2003@gmail.com',
    password: 'Kaique2003@'
  });

  if (authErr) {
    console.log('Erro de login (Kaique):', authErr.message);
    
    // Try other common emails
    const { data: auth2, error: auth2Err } = await supabase.auth.signInWithPassword({
      email: 'dllogtransporte@gmail.com',
      password: 'Davis@2024'
    });
    
    if (auth2Err) {
      console.log('Erro de login (Davis):', auth2Err.message);
      console.log('\nNão foi possível autenticar. Testando sem auth para verificar políticas RLS...\n');
    } else {
      console.log('Login como Davis OK! User ID:', auth2.user?.id);
    }
  } else {
    console.log('Login como Kaique OK! User ID:', authData.user?.id);
  }

  // Now try to read cargos and shipments
  console.log('\n=== LENDO DADOS APÓS AUTENTICAÇÃO ===');
  
  const { data: cargos, error: cargoErr } = await supabase.from('cargos').select('id, status, created_at').limit(10);
  console.log('Cargos:', cargos?.length ?? 'ERRO', cargoErr?.message || '');
  if (cargos?.length > 0) {
    console.log('Primeiros cargos:', cargos.map(c => `${c.id} (${c.status})`));
  }

  const { data: shipments, error: shipErr } = await supabase.from('shipments').select('id, status, created_at').limit(10);
  console.log('Shipments:', shipments?.length ?? 'ERRO', shipErr?.message || '');
  if (shipments?.length > 0) {
    console.log('Primeiros shipments:', shipments.map(s => `${s.id} (${s.status})`));
  }

  // Check total counts with authentication
  const { count: cargoCount } = await supabase.from('cargos').select('*', { count: 'exact', head: true });
  const { count: shipmentCount } = await supabase.from('shipments').select('*', { count: 'exact', head: true });
  
  console.log(`\nTotal cargos (autenticado): ${cargoCount}`);
  console.log(`Total shipments (autenticado): ${shipmentCount}`);

  // Sign out
  await supabase.auth.signOut();
  console.log('\n=== FIM DO TESTE ===');
}

testWithAuth();
