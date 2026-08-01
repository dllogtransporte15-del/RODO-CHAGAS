import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gyvnhvnuidrfmqzielmv.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dm5odm51aWRyZm1xemllbG12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTY5ODksImV4cCI6MjA4OTU5Mjk4OX0.dK_l3INxOB9_HVYte43PCXFQLe8DnXgPitcxhNK4x30';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function diagnoseHistory() {
  console.log('=== DIAGNÓSTICO COMPLETO DO BANCO DE DADOS ===\n');

  // 1. Check main operational tables
  const tables = ['cargos', 'shipments', 'tickets', 'freight_offers'];
  for (const t of tables) {
    const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
    console.log(`[${t}] Count: ${count ?? 'ERRO'} ${error ? '| Erro: ' + error.message : ''}`);
  }

  console.log('\n=== VERIFICANDO app_settings ===');
  const { data: settings, error: settErr } = await supabase.from('app_settings').select('*');
  if (settErr) console.error('Erro:', settErr.message);
  else console.log('app_settings:', JSON.stringify(settings, null, 2));

  console.log('\n=== VERIFICANDO profile_permissions ===');
  const { data: perms, error: permErr } = await supabase.from('profile_permissions').select('*');
  if (permErr) console.error('Erro:', permErr.message);
  else console.log('Permissões count:', perms?.length);

  // 2. Check if any backup/export files exist in the browser's localStorage via RPC (not possible)
  // But we can check if there are any soft-deleted records or views
  
  // 3. Check created_at ranges for existing tables
  console.log('\n=== VERIFICANDO DATAS DOS MOTORISTAS (drivers) ===');
  const { data: driverDates, error: dErr } = await supabase
    .from('drivers')
    .select('id, name, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
  if (dErr) console.error('Erro drivers:', dErr.message);
  else {
    console.log('Motoristas mais recentes:');
    driverDates?.forEach(d => console.log(`  ${d.id} | ${d.name} | created_at: ${d.created_at || 'NULL'}`));
  }

  // 4. Check the oldest drivers to see when data was migrated
  const { data: oldDrivers, error: oldDErr } = await supabase
    .from('drivers')
    .select('id, name, created_at')
    .order('created_at', { ascending: true })
    .limit(5);
  if (!oldDErr) {
    console.log('\nMotoristas mais antigos:');
    oldDrivers?.forEach(d => console.log(`  ${d.id} | ${d.name} | created_at: ${d.created_at || 'NULL'}`));
  }

  // 5. Check if there's any data in the tables that might have been soft-deleted
  console.log('\n=== ESTRUTURA DA TABELA cargos (primeiras colunas) ===');
  // Try to insert and immediately delete a test record to verify write permissions
  const { data: testInsert, error: testErr } = await supabase
    .from('cargos')
    .insert({
      id: 'TEST-DIAGNOSTICO',
      sequence_id: 9999,
      client_id: '',
      product_id: '',
      origin: 'TESTE',
      destination: 'TESTE',
      total_volume: 0,
      scheduled_volume: 0,
      loaded_volume: 0,
      company_freight_value_per_ton: 0,
      driver_freight_value_per_ton: 0,
      has_icms: false,
      icms_percentage: 0,
      requires_scheduling: false,
      status: 'EmAndamento',
      type: 'Spot'
    })
    .select();
  
  if (testErr) {
    console.log(`INSERT em cargos falhou: ${testErr.code} - ${testErr.message}`);
    console.log('Detalhes:', testErr.details, testErr.hint);
  } else {
    console.log('INSERT em cargos FUNCIONOU! Dados salvos:', testInsert);
    // Clean up the test record
    await supabase.from('cargos').delete().eq('id', 'TEST-DIAGNOSTICO');
    console.log('Registro de teste removido.');
  }
}

diagnoseHistory();
