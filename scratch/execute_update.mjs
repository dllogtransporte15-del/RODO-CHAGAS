import { createClient } from '@supabase/supabase-js';

const url = 'https://gyvnhvnuidrfmqzielmv.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dm5odm51aWRyZm1xemllbG12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTY5ODksImV4cCI6MjA4OTU5Mjk4OX0.dK_l3INxOB9_HVYte43PCXFQLe8DnXgPitcxhNK4x30';
const supabase = createClient(url, key);

function updateDateStr(str) {
  if (!str) return str;
  return str.replace('2026-08-01', '2026-07-31');
}

async function executeUpdate() {
  const { data, error } = await supabase.from('shipments').select('*').eq('status', 'Ag. Adiantamento');
  if (error) {
    console.error('Error selecting shipments:', error);
    return;
  }

  console.log(`Updating ${data.length} shipments with status 'Ag. Adiantamento'...\n`);

  let updatedCount = 0;

  for (const s of data) {
    const updatePayload = {};

    // 1. scheduled_date
    if (s.scheduled_date === '2026-08-01') {
      updatePayload.scheduled_date = '2026-07-31';
    }

    // 2. arrival_time
    if (s.arrival_time && s.arrival_time.startsWith('2026-08-01')) {
      updatePayload.arrival_time = updateDateStr(s.arrival_time);
    }

    // 3. created_at
    if (s.created_at && s.created_at.startsWith('2026-08-01')) {
      updatePayload.created_at = updateDateStr(s.created_at);
    }

    // 4. status_history
    if (Array.isArray(s.status_history)) {
      const newStatusHistory = s.status_history.map(sh => {
        if (sh.timestamp && sh.timestamp.startsWith('2026-08-01')) {
          return { ...sh, timestamp: updateDateStr(sh.timestamp) };
        }
        return sh;
      });
      if (JSON.stringify(newStatusHistory) !== JSON.stringify(s.status_history)) {
        updatePayload.status_history = newStatusHistory;
      }
    }

    // 5. history logs
    if (Array.isArray(s.history)) {
      const newHistory = s.history.map(h => {
        let updatedH = { ...h };
        if (updatedH.timestamp && updatedH.timestamp.startsWith('2026-08-01')) {
          updatedH.timestamp = updateDateStr(updatedH.timestamp);
        }
        if (updatedH.description && updatedH.description.includes('01/08/2026')) {
          updatedH.description = updatedH.description.replace(/01\/08\/2026/g, '31/07/2026');
        }
        return updatedH;
      });
      if (JSON.stringify(newHistory) !== JSON.stringify(s.history)) {
        updatePayload.history = newHistory;
      }
    }

    if (Object.keys(updatePayload).length > 0) {
      const { error: updateError } = await supabase
        .from('shipments')
        .update(updatePayload)
        .eq('id', s.id);

      if (updateError) {
        console.error(`Failed to update shipment ${s.id}:`, updateError);
      } else {
        console.log(`✅ Successfully updated shipment ${s.id}`);
        updatedCount++;
      }
    } else {
      console.log(`ℹ️ Shipment ${s.id} already had July dates, no update needed.`);
    }
  }

  console.log(`\nFinished. ${updatedCount} / ${data.length} shipments updated successfully.`);
}

executeUpdate();
