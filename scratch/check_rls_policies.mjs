import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gyvnhvnuidrfmqzielmv.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dm5odm51aWRyZm1xemllbG12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTY5ODksImV4cCI6MjA4OTU5Mjk4OX0.dK_l3INxOB9_HVYte43PCXFQLe8DnXgPitcxhNK4x30';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

// Query pg_policies directly to check RLS
async function checkRLS() {
  console.log('=== VERIFICANDO POLÍTICAS RLS ===\n');
  
  // Check via information_schema
  const { data: policies, error } = await supabase.rpc('get_rls_policies');
  if (error) {
    console.log('RPC não disponível:', error.message);
  } else {
    console.log('Políticas:', policies);
  }
  
  // Check if RLS is enabled by trying to read without auth
  const tables = ['cargos', 'shipments', 'app_users', 'clients', 'drivers'];
  console.log('\n=== TESTE DE ACESSO SEM AUTH ===');
  for (const t of tables) {
    const { count, error: e } = await supabase.from(t).select('*', { count: 'exact', head: true });
    console.log(`${t}: count=${count}, error=${e?.message || 'none'}`);
  }
  
  // Try to understand the App.tsx auth flow
  console.log('\n=== VERIFICANDO COMO O APP FAZ LOGIN ===');
  
  // The app uses custom auth (not Supabase Auth) -- let's check
  // In App.tsx, the login is done via app_users table directly
  const { data: loginTest, error: loginErr } = await supabase
    .from('app_users')
    .select('*')
    .eq('email', 'dllogtransporte15@gmail.com')
    .single();
  
  if (loginErr) {
    console.log('Erro ao buscar usuário por email:', loginErr.message);
  } else {
    console.log('Usuário encontrado:', loginTest?.id, loginTest?.email, loginTest?.profile);
    console.log('Auth User ID:', loginTest?.auth_user_id);
  }
  
  // After finding the user, can we read cargos?
  console.log('\n=== VERIFICANDO SE AS POLÍTICAS RLS BLOQUEIAM LEITURA ===');
  
  // Try rpc to check if table has RLS
  const { data: rlsCheck, error: rlsErr } = await supabase
    .rpc('check_table_rls', { table_name: 'cargos' });
  
  if (rlsErr) {
    console.log('RPC check_table_rls não disponível:', rlsErr.message);
    
    // Direct test: does cargos have data?
    console.log('\nTentando ler cargos com diferentes abordagens...');
    
    // 1. Without any filter
    const { data: all } = await supabase.from('cargos').select('id').limit(1);
    console.log('1. SELECT id FROM cargos LIMIT 1:', all?.length, 'rows');
    
    // 2. With count
    const { count } = await supabase.from('cargos').select('*', { count: 'exact', head: true });
    console.log('2. COUNT(*) FROM cargos:', count);
  }
}

checkRLS();
