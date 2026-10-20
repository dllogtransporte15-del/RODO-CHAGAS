import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gyvnhvnuidrfmqzielmv.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dm5odm51aWRyZm1xemllbG12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTY5ODksImV4cCI6MjA4OTU5Mjk4OX0.dK_l3INxOB9_HVYte43PCXFQLe8DnXgPitcxhNK4x30';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

const KAIQUE_ID = 'USR-001';
const MATHEUS_ID = 'USR-1469';

async function updateShipments() {
  console.log("=== Buscando embarques atribuídos ao Kaique (USR-001) solicitados por Matheus Leão ===");
  
  const { data: shipments, error: fetchErr } = await supabase
    .from('shipments')
    .select('id, order_id, cargo_id, driver_name, horse_plate, status, embarcador_id, created_by_id, history')
    .eq('embarcador_id', KAIQUE_ID);

  if (fetchErr) {
    console.error("Erro ao buscar embarques:", fetchErr);
    return;
  }

  console.log(`Encontrados ${shipments.length} embarques com embarcador_id = ${KAIQUE_ID}:`);
  console.table(shipments.map(s => ({
    id: s.id,
    cargo_id: s.cargo_id,
    driver_name: s.driver_name,
    horse_plate: s.horse_plate,
    status: s.status,
    embarcador_id: s.embarcador_id,
    created_by_id: s.created_by_id
  })));

  if (shipments.length === 0) {
    console.log("Nenhum embarque para atualizar.");
    return;
  }

  const nowIso = new Date().toISOString();

  console.log("\n=== Atualizando embarques para Matheus Leão (USR-1469) ===");
  let successCount = 0;

  for (const s of shipments) {
    const existingHistory = Array.isArray(s.history) ? s.history : [];
    const newHistoryEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      userId: MATHEUS_ID,
      timestamp: nowIso,
      description: 'Embarcador responsável corrigido de "Kaique" para "Matheus Leao" (Gestor GO).'
    };

    const updatedHistory = [...existingHistory, newHistoryEntry];

    const { error: updateErr } = await supabase
      .from('shipments')
      .update({
        embarcador_id: MATHEUS_ID,
        history: updatedHistory
      })
      .eq('id', s.id);

    if (updateErr) {
      console.error(`Erro ao atualizar embarque ${s.id}:`, updateErr);
    } else {
      successCount++;
    }
  }

  console.log(`\nAtualização concluída: ${successCount}/${shipments.length} embarques atualizados.`);

  // Verificação pós-atualização
  const { data: verifyData } = await supabase
    .from('shipments')
    .select('id, order_id, cargo_id, driver_name, horse_plate, status, embarcador_id, created_by_id')
    .eq('embarcador_id', MATHEUS_ID);

  console.log(`\nTotal de embarques agora atribuídos a Matheus Leão (USR-1469): ${verifyData ? verifyData.length : 0}`);
  console.table(verifyData);
}

updateShipments();
