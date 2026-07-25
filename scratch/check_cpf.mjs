import fs from 'fs';

const url = 'https://gyvnhvnuidrfmqzielmv.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dm5odm51aWRyZm1xemllbG12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTY5ODksImV4cCI6MjA4OTU5Mjk4OX0.dK_l3INxOB9_HVYte43PCXFQLe8DnXgPitcxhNK4x30';

async function check() {
    try {
        const headers = {
            'apikey': key,
            'Authorization': `Bearer ${key}`
        };

        const res1 = await fetch(`${url}/rest/v1/drivers?name=ilike.*MAURICIO*`, { headers });
        const res1Data = await res1.json();
        console.log('Any MAURICIO:', res1Data.map(d => d.name + ' - ' + d.cpf));

        const res2 = await fetch(`${url}/rest/v1/drivers?phone=ilike.*9630*`, { headers });
        const res2Data = await res2.json();
        console.log('Any phone with 9630:', res2Data.map(d => d.name + ' - ' + d.phone));

    } catch (e) {
        console.error(e);
    }
}
check();
