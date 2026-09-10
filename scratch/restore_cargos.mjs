import { createClient } from '@supabase/supabase-js';

const url = 'https://gyvnhvnuidrfmqzielmv.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dm5odm51aWRyZm1xemllbG12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTY5ODksImV4cCI6MjA4OTU5Mjk4OX0.dK_l3INxOB9_HVYte43PCXFQLe8DnXgPitcxhNK4x30';
const supabase = createClient(url, key);

async function getNextCargoId() {
  const { data, error } = await supabase
    .from('cargos')
    .select('sequence_id')
    .order('sequence_id', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) {
    return { id: `CRG-${Date.now()}`, seq: 9999 };
  }
  const nextSeq = (data[0].sequence_id || 1000) + 1;
  return { id: `CRG-${nextSeq}`, seq: nextSeq };
}

async function restore() {
  console.log('--- Starting Cargo Restoration ---');

  // 1. CARGO 747
  let cargo747Id = 'CRG-747';
  let cargo747Seq = 747;

  const { data: existing747 } = await supabase
    .from('cargos')
    .select('id, origin, destination')
    .eq('id', 'CRG-747')
    .maybeSingle();

  if (existing747) {
    console.log(`CRG-747 already exists (${existing747.origin} -> ${existing747.destination}). Generating new ID...`);
    const next = await getNextCargoId();
    cargo747Id = next.id;
    cargo747Seq = next.seq;
  } else {
    console.log('CRG-747 is free. Restoring with original ID: CRG-747');
  }

  const cargo747Data = {
    id: cargo747Id,
    sequence_id: cargo747Seq,
    client_id: 'CLI-126', // Calcario Ouro Branco
    product_id: 'PRD-105', // Calcario
    origin: 'Ouro Branco, MG',
    destination: 'Mar de Espanha, MG',
    total_volume: 87.33,
    scheduled_volume: 87.33,
    loaded_volume: 87.33,
    company_freight_value_per_ton: 145,
    driver_freight_value_per_ton: 135,
    has_icms: false,
    requires_scheduling: false,
    type: 'Fixa',
    status: 'Fechada',
    created_at: '2026-08-09T23:49:00.000Z',
    created_by_id: 'USR-123',
    history: [
      {
        id: `log_${Date.now()}_restore`,
        userId: 'USR-001',
        timestamp: new Date().toISOString(),
        description: 'Carga restaurada para recuperar histórico dos embarques BRU-2413, BRU-2414, BRU-2635.'
      }
    ],
    branch_id: 'FIL-010'
  };

  const { error: errInsert747 } = await supabase.from('cargos').insert(cargo747Data);
  if (errInsert747) {
    console.error('Error inserting cargo 747:', errInsert747);
  } else {
    console.log(`✓ Cargo ${cargo747Id} created successfully!`);
    
    if (cargo747Id !== 'CRG-747') {
      const { error: errUpdateShipments } = await supabase
        .from('shipments')
        .update({ cargo_id: cargo747Id })
        .in('id', ['BRU-2413', 'BRU-2414', 'BRU-2635']);
      if (errUpdateShipments) {
        console.error('Error updating shipments for 747:', errUpdateShipments);
      } else {
        console.log(`✓ Updated shipments BRU-2413, BRU-2414, BRU-2635 to cargo ${cargo747Id}`);
      }
    }
  }

  // 2. CARGO 790
  let cargo790Id = 'CRG-790';
  let cargo790Seq = 790;

  const { data: existing790 } = await supabase
    .from('cargos')
    .select('id, origin, destination')
    .eq('id', 'CRG-790')
    .maybeSingle();

  if (existing790) {
    console.log(`CRG-790 already exists (${existing790.origin} -> ${existing790.destination}). Generating new ID...`);
    const next = await getNextCargoId();
    cargo790Id = next.id;
    cargo790Seq = next.seq;
  } else {
    console.log('CRG-790 is free. Restoring with original ID: CRG-790');
  }

  const cargo790Data = {
    id: cargo790Id,
    sequence_id: cargo790Seq,
    client_id: 'CLI-126', // Calcario Ouro Branco
    product_id: 'PRD-105', // Calcario
    origin: 'Ouro Branco, MG',
    destination: 'Lima Duarte, MG',
    total_volume: 17.46,
    scheduled_volume: 17.46,
    loaded_volume: 17.46,
    company_freight_value_per_ton: 200,
    driver_freight_value_per_ton: 180,
    has_icms: false,
    requires_scheduling: false,
    type: 'Fixa',
    status: 'Fechada',
    created_at: '2026-08-04T14:32:00.000Z',
    created_by_id: 'USR-123',
    history: [
      {
        id: `log_${Date.now()}_restore2`,
        userId: 'USR-001',
        timestamp: new Date().toISOString(),
        description: 'Carga restaurada para recuperar histórico do embarque BRU-2322.'
      }
    ],
    branch_id: 'FIL-010'
  };

  const { error: errInsert790 } = await supabase.from('cargos').insert(cargo790Data);
  if (errInsert790) {
    console.error('Error inserting cargo 790:', errInsert790);
  } else {
    console.log(`✓ Cargo ${cargo790Id} created successfully!`);
    
    if (cargo790Id !== 'CRG-790') {
      const { error: errUpdateShipments } = await supabase
        .from('shipments')
        .update({ cargo_id: cargo790Id })
        .eq('id', 'BRU-2322');
      if (errUpdateShipments) {
        console.error('Error updating shipment BRU-2322 for 790:', errUpdateShipments);
      } else {
        console.log(`✓ Updated shipment BRU-2322 to cargo ${cargo790Id}`);
      }
    }
  }

  console.log('--- Restoration Complete ---');
}

restore();
