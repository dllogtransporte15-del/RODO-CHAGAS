import fs from 'fs';

const url = 'https://gyvnhvnuidrfmqzielmv.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dm5odm51aWRyZm1xemllbG12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTY5ODksImV4cCI6MjA4OTU5Mjk4OX0.dK_l3INxOB9_HVYte43PCXFQLe8DnXgPitcxhNK4x30';

async function testInsert() {
    try {
        const payload = [{
            id: "DRV-TEST-9999",
            name: "MAURICIO SANTIAGO MENDES TESTE",
            cpf: "011.594.480-00",
            cnh: "",
            phone: "54 9630-9923",
            classification: "Terceiro",
            owner_id: null,
            active: true
        }];

        const headers = {
            'apikey': key,
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        };

        const res = await fetch(`${url}/rest/v1/drivers`, { 
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });
        
        const text = await res.text();
        console.log('Status:', res.status);
        console.log('Response:', text);
        
        // Clean up
        if (res.ok) {
            await fetch(`${url}/rest/v1/drivers?id=eq.DRV-TEST-9999`, {
                method: 'DELETE',
                headers
            });
            console.log('Cleaned up test driver');
        }

    } catch (e) {
        console.error(e);
    }
}
testInsert();
