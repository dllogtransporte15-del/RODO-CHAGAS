import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gyvnhvnuidrfmqzielmv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dm5odm51aWRyZm1xemllbG12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTY5ODksImV4cCI6MjA4OTU5Mjk4OX0.dK_l3INxOB9_HVYte43PCXFQLe8DnXgPitcxhNK4x30';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  console.log("=== Querying shipments to be updated ===");
  const { data: shipments, error: fetchErr } = await supabase
    .from('shipments')
    .select('id, order_id, driver_name, status, embarcador_id, created_by_id')
    .eq('created_by_id', 'USR-133')
    .eq('embarcador_id', 'USR-116');

  if (fetchErr) {
    console.error("Error fetching shipments:", fetchErr);
    return;
  }

  if (shipments.length === 0) {
    console.log("No shipments found matching the criteria (created by USR-133 and assigned to USR-116).");
    return;
  }

  console.log(`Found ${shipments.length} shipments to update:`);
  console.table(shipments);

  console.log("\n=== Updating shipments ===");
  const shipmentIds = shipments.map(s => s.id);
  const { data: updatedData, error: updateErr } = await supabase
    .from('shipments')
    .update({ embarcador_id: 'USR-133' })
    .in('id', shipmentIds)
    .select();

  if (updateErr) {
    console.error("Error updating shipments:", updateErr);
  } else {
    console.log(`Successfully updated ${shipmentIds.length} shipments!`);
    console.log("Updated shipments details:");
    console.table(updatedData.map(s => ({
      id: s.id,
      order_id: s.order_id,
      driver_name: s.driver_name,
      status: s.status,
      embarcador_id: s.embarcador_id,
      created_by_id: s.created_by_id
    })));
  }
}

run();
