import { createClient } from '@supabase/supabase-js';

const url = 'https://gyvnhvnuidrfmqzielmv.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dm5odm51aWRyZm1xemllbG12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTY5ODksImV4cCI6MjA4OTU5Mjk4OX0.dK_l3INxOB9_HVYte43PCXFQLe8DnXgPitcxhNK4x30';
const supabase = createClient(url, key);

function updateTimestampStr(str) {
  if (!str) return str;
  return str.replace('2026-08-01', '2026-07-31');
}

async function dryRun() {
  const { data, error } = await supabase.from('shipments').select('*').eq('status', 'Ag. Adiantamento');
  if (error) {
    console.error(error);
    return;
  }

  console.log(`Processing ${data.length} shipments...\n`);

  for (const s of data) {
    const updates = {};

    // 1. scheduled_date
    if (s.scheduled_date === '2026-08-01') {
      updates.scheduled_date = '2026-07-31';
    }

    // 2. arrival_time
    if (s.arrival_time && s.arrival_time.startsWith('2026-08-01')) {
      updates.arrival_time = updateTimestampStr(s.arrival_time);
    }

    // 3. created_at
    if (s.created_at && s.created_at.startsWith('2026-08-01')) {
      updates.created_at = updateTimestampStr(s.created_at);
    }

    // 4. status_history
    if (Array.isArray(s.status_history)) {
      const newStatusHistory = s.status_history.map(sh => {
        if (sh.timestamp && sh.timestamp.startsWith('2026-08-01')) {
          return { ...sh, timestamp: updateTimestampStr(sh.timestamp) };
        }
        return sh;
      });
      if (JSON.stringify(newStatusHistory) !== JSON.stringify(s.status_history)) {
        updates.status_history = newStatusHistory;
      }
    }

    // 5. history logs
    if (Array.isArray(s.history)) {
      const newHistory = s.history.map(h => {
        let updatedH = { ...h };
        if (updatedH.timestamp && updatedH.timestamp.startsWith('2026-08-01')) {
          updatedH.timestamp = updateTimestampStr(updatedH.timestamp);
        }
        if (updatedH.description && updatedH.description.includes('01/08/2026')) {
          updatedH.description = updatedH.description.replace(/01\/08\/2026/g, '31/07/2026');
        }
        return updatedH;
      });
      if (JSON.stringify(newHistory) !== JSON.stringify(s.history)) {
        updates.history = newHistory;
      }
    }

    console.log(`Shipment ${s.id}:`);
    console.log(`  Original scheduled_date: ${s.scheduled_date} -> New: ${updates.scheduled_date || s.scheduled_date}`);
    console.log(`  Original arrival_time: ${s.arrival_time} -> New: ${updates.arrival_time || s.arrival_time}`);
    console.log(`  Original created_at: ${s.created_at} -> New: ${updates.created_at || s.created_at}`);
    console.log(`  Updated status_history entries count: ${updates.status_history ? updates.status_history.length : 'Unchanged'}`);
    console.log(`  Updated history logs count: ${updates.history ? updates.history.length : 'Unchanged'}`);
    console.log('---');
  }
}

dryRun();
