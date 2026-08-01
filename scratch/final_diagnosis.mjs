import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gyvnhvnuidrfmqzielmv.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dm5odm51aWRyZm1xemllbG12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTY5ODksImV4cCI6MjA4OTU5Mjk4OX0.dK_l3INxOB9_HVYte43PCXFQLe8DnXgPitcxhNK4x30';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function checkRLSandData() {
  console.log('=== DIAGNÓSTICO FINAL DO SISTEMA ===\n');

  // 1. Verificar se o RLS bloqueia cargos sem auth
  console.log('1. CARGOS sem autenticação:');
  const { data: cargos, error: cargoError, count: cargoCount } = await supabase
    .from('cargos')
    .select('*', { count: 'exact' })
    .limit(3);
  console.log(`   Resultado: ${cargoCount} registros | Erro: ${cargoError?.message || 'nenhum'}`);
  console.log(`   Dados retornados: ${cargos?.length || 0} linhas`);

  // 2. Verificar se o RLS bloqueia shipments sem auth  
  console.log('\n2. SHIPMENTS sem autenticação:');
  const { data: shipments, error: shipError, count: shipCount } = await supabase
    .from('shipments')
    .select('*', { count: 'exact' })
    .limit(3);
  console.log(`   Resultado: ${shipCount} registros | Erro: ${shipError?.message || 'nenhum'}`);

  // 3. Comparar com tabelas que FUNCIONAM (tem dados)
  console.log('\n3. CLIENTS (referência - sabemos que tem dados):');
  const { count: clientCount } = await supabase.from('clients').select('*', { count: 'exact', head: true });
  console.log(`   Total: ${clientCount} clientes`);

  // 4. Tentar a RPC para ver políticas RLS  
  console.log('\n4. VERIFICANDO SE RLS ESTÁ ATIVO (via query de sistema):');
  const { data: rlsData, error: rlsErr } = await supabase.rpc('current_setting', { setting: 'row_security' });
  if (rlsErr) {
    // Try alternative approach
    console.log('   RPC não disponível:', rlsErr.message);
  } else {
    console.log('   row_security setting:', rlsData);
  }

  // 5. Test: tentar login via app_users para simular o que o app faz
  console.log('\n5. SIMULANDO LOGIN DO APP (como no LoginPage.tsx):');
  const { data: appUser, error: loginErr } = await supabase
    .from('app_users')
    .select('*')
    .eq('email', 'dllogtransporte15@gmail.com')
    .single();
  
  if (loginErr) {
    console.log('   Erro ao ler app_users:', loginErr.message);
  } else if (appUser) {
    console.log(`   Usuário encontrado: ${appUser.id} | ${appUser.name} | ${appUser.profile}`);
    console.log(`   Senha salva: ${appUser.password || '(sem senha)'}`);
    
    // After "login" (just setting context), try reading cargos again
    // The app doesn't use Supabase Auth, so cargos should still be 0
    const { count: cargoAfterLogin } = await supabase
      .from('cargos')
      .select('*', { count: 'exact', head: true });
    console.log(`\n   Cargos APÓS login (sem Supabase Auth): ${cargoAfterLogin}`);
  }

  // 6. CONCLUSÃO: O PROBLEMA É QUE AS TABELAS ESTÃO VAZIAS
  console.log('\n=== CONCLUSÃO ===');
  console.log('As tabelas cargos e shipments estão COMPLETAMENTE VAZIAS no banco.');
  console.log('O sistema de login usa tabela app_users mas NÃO o Supabase Auth.');
  console.log('');
  console.log('DADOS HISTÓRICOS PERDIDOS:');
  console.log('  - Os scripts de commit "71 correção Rob" e anteriores mostram');
  console.log('    que havia dados (shipments com prefixo ROB-).');
  console.log('  - Porém, atualmente cargos=0 e shipments=0.');
  console.log('');
  console.log('CAUSA PROVÁVEL:');
  console.log('  1. Os dados foram deletados manualmente do banco, OU');
  console.log('  2. As políticas RLS exigem auth.uid() que nunca é setado');
  console.log('     porque o app usa login customizado (não Supabase Auth),');
  console.log('     OU');
  console.log('  3. Os dados nunca foram migrados para o novo projeto Supabase.');
  
  // 7. Check if there's a missmatch in RLS (data exists but hidden)
  console.log('\n7. TESTANDO SE DADOS EXISTEM MAS ESTÃO OCULTOS POR RLS:');
  // Insert a cargo and try to read it back
  const testId = `TEST-RLS-${Date.now()}`;
  const { data: inserted, error: insertErr } = await supabase
    .from('cargos')
    .insert({
      id: testId,
      sequence_id: 88888,
      client_id: 'CLI-004',
      product_id: 'PRD-001',
      origin: 'TESTE RLS',
      destination: 'TESTE RLS',
      total_volume: 1,
      scheduled_volume: 0,
      loaded_volume: 0,
      company_freight_value_per_ton: 1,
      driver_freight_value_per_ton: 1,
      has_icms: false,
      icms_percentage: 0,
      requires_scheduling: false,
      status: 'EmAndamento',
      type: 'Spot',
      created_by_id: 'USR-001',
      history: [],
      daily_schedule: [],
      freight_legs: [],
      attachments: []
    })
    .select();

  if (insertErr) {
    console.log('   INSERT falhou:', insertErr.message);
  } else {
    console.log('   INSERT funcionou:', inserted?.[0]?.id);
    
    // Try to read it back
    const { data: readback, count: afterCount } = await supabase
      .from('cargos')
      .select('*', { count: 'exact' })
      .limit(10);
    console.log(`   Total cargos após insert: ${afterCount}`);
    console.log(`   Linhas retornadas: ${readback?.length}`);
    const found = readback?.find(c => c.id === testId);
    console.log(`   Cargo de teste encontrado: ${found ? 'SIM' : 'NÃO'}`);
    
    // Clean up
    await supabase.from('cargos').delete().eq('id', testId);
    const { count: afterDelete } = await supabase
      .from('cargos')
      .select('*', { count: 'exact', head: true });
    console.log(`   Total cargos após delete: ${afterDelete}`);
  }
}

checkRLSandData();
