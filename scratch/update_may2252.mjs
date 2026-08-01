import { createClient } from '@supabase/supabase-js';

const url = 'https://gyvnhvnuidrfmqzielmv.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dm5odm51aWRyZm1xemllbG12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTY5ODksImV4cCI6MjA4OTU5Mjk4OX0.dK_l3INxOB9_HVYte43PCXFQLe8DnXgPitcxhNK4x30';
const supabase = createClient(url, key);

function updateDateStr(str) {
  if (!str) return str;
  return str.replace('2026-08-01', '2026-07-31');
}

async function update() {
  const { data: s, error: fetchErr } = await supabase
    .from('shipments')
    .select('*')
    .eq('id', 'MAY-2252')
    .single();

  if (fetchErr) {
    console.error('Error fetching MAY-2252:', fetchErr);
    return;
  }

  const updatePayload = {
    scheduled_date: '2026-07-31',
    arrival_time: updateDateStr(s.arrival_time),
    created_at: updateDateStr(s.created_at),
    status_history: (s.status_history || []).map(sh => ({
      ...sh,
      timestamp: updateDateStr(sh.timestamp)
    })),
    history: (s.history || []).map(h => ({
      ...h,
      timestamp: updateDateStr(h.timestamp),
      description: h.description ? h.description.replace(/01\/08\/2026/g, '31/07/2026') : h.description
    }))
  };

  const { error: updateErr } = await supabase
    .from('shipments')
    .update(updatePayload)
    .eq('id', 'MAY-2252');

  if (updateErr) {
    console.error('Error updating MAY-2252:', updateErr);
  } else {
    console.log('✅ Successfully updated MAY-2252 to 31/07/2026!');
  }
}

update();
