import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gyvnhvnuidrfmqzielmv.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dm5odm51aWRyZm1xemllbG12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTY5ODksImV4cCI6MjA4OTU5Mjk4OX0.dK_l3INxOB9_HVYte43PCXFQLe8DnXgPitcxhNK4x30';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function testCargoInsert() {
  console.log('=== TENTANDO INSERIR CARGA DE TESTE ===\n');

  const testCargo = {
    id: 'CRG-DIAG-001',
    sequence_id: 9999,
    client_id: 'CLI-004', // Ouro Safra
    product_id: 'PRD-001',
    origin: 'TESTE ORIGEM',
    destination: 'TESTE DESTINO',
    total_volume: 100,
    scheduled_volume: 0,
    loaded_volume: 0,
    company_freight_value_per_ton: 50,
    driver_freight_value_per_ton: 40,
    has_icms: false,
    icms_percentage: 0,
    requires_scheduling: false,
    status: 'EmAndamento',
    type: 'Spot',
    created_by_id: 'USR-001', // Kaique (Admin)
    history: [],
    daily_schedule: [],
    freight_legs: [],
    attachments: []
  };

  const { data, error } = await supabase.from('cargos').insert(testCargo).select();
  
  if (error) {
    console.log('INSERT falhou:', error.code, '-', error.message);
    console.log('Detalhes:', error.details);
    console.log('Hint:', error.hint);
  } else {
    console.log('INSERT FUNCIONOU! Carga inserida:', JSON.stringify(data, null, 2));
    
    // Verify we can read it back
    const { data: readBack, error: readErr } = await supabase.from('cargos').select('*').eq('id', 'CRG-DIAG-001');
    if (readErr) {
      console.log('READ falhou após INSERT:', readErr.message);
    } else {
      console.log('READ FUNCIONOU! Cargas lidas:', readBack?.length);
    }
    
    // Cleanup
    const { error: delErr } = await supabase.from('cargos').delete().eq('id', 'CRG-DIAG-001');
    if (delErr) console.log('DELETE falhou:', delErr.message);
    else console.log('Registro de teste removido com sucesso.');
  }

  // Check what columns exist in cargos table
  console.log('\n=== VERIFICANDO ESTRUTURA DA TABELA cargos ===');
  const { data: colTest, error: colErr } = await supabase
    .from('cargos')
    .select('id, sequence_id, client_id, product_id, origin, destination, status, type, created_by_id, created_at')
    .limit(1);
  
  if (colErr) {
    console.log('Erro ao verificar colunas:', colErr.message);
  } else {
    console.log('Colunas principais acessíveis OK. Resultado:', colTest);
  }

  // Also check RLS by trying with specific user ID
  console.log('\n=== VERIFICANDO RLS na tabela shipments ===');
  const { data: sData, error: sErr } = await supabase.from('shipments').select('*').limit(5);
  console.log('Shipments:', sData?.length ?? 'ERRO', sErr?.message || '');

  // Same for cargos
  const { data: cData, error: cErr } = await supabase.from('cargos').select('*').limit(5);
  console.log('Cargos:', cData?.length ?? 'ERRO', cErr?.message || '');
}

testCargoInsert();
