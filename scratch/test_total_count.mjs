import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gyvnhvnuidrfmqzielmv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dm5odm51aWRyZm1xemllbG12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTY5ODksImV4cCI6MjA4OTU5Mjk4OX0.dK_l3INxOB9_HVYte43PCXFQLe8DnXgPitcxhNK4x30';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  let allShipments = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;
  
  while (hasMore) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    
    console.log(`Fetching from ${from} to ${to}...`);
    const { data, error } = await supabase
      .from('shipments')
      .select('id, created_at')
      .order('created_at', { ascending: false })
      .range(from, to);
      
    if (error) {
      console.error("Error at page", page, error);
      break;
    }
    
    allShipments = allShipments.concat(data);
    console.log(`Fetched ${data.length} rows. Total so far: ${allShipments.length}`);
    
    if (data.length < pageSize) {
      hasMore = false;
    } else {
      page++;
    }
  }
  
  console.log("Final total shipments fetched in chunks:", allShipments.length);
}

run();
