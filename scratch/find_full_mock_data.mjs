import fs from 'fs';

const data = JSON.parse(fs.readFileSync('migrated_prompt_history/prompt_2026-02-19T19_43_46.014Z.json', 'utf8'));

console.log('Total entries:', data.length);

let foundCargos = [];
let foundShipments = [];

function inspectObject(obj, path = '') {
  if (!obj || typeof obj !== 'object') return;

  if (Array.isArray(obj)) {
    if (obj.length > 0 && typeof obj[0] === 'object' && obj[0] !== null) {
      const keys = Object.keys(obj[0]);
      if (keys.includes('origin') && keys.includes('destination') && (keys.includes('total_volume') || keys.includes('totalVolume') || keys.includes('sequence_id'))) {
        console.log(`FOUND CARGOS ARRAY at ${path} with length ${obj.length}`);
        foundCargos.push(obj);
      }
      if (keys.includes('cargo_id') || keys.includes('cargoId') || keys.includes('driver_name') || keys.includes('driverName')) {
        console.log(`FOUND SHIPMENTS ARRAY at ${path} with length ${obj.length}`);
        foundShipments.push(obj);
      }
    }
    obj.forEach((item, idx) => inspectObject(item, `${path}[${idx}]`));
  } else {
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string' && (v.includes('cargos') || v.includes('shipments') || v.includes('CRG-') || v.includes('SHP-') || v.includes('ROB-'))) {
        // search inside string for JSON or code blocks
        const matches = v.match(/\[\s*\{\s*"id":\s*"(?:CRG|SHP|ROB|CARG|SHIP)[^\]]+\]/gs);
        if (matches) {
          console.log(`FOUND IN STRING at ${path}.${k}: ${matches.length} matches`);
        }
      } else {
        inspectObject(v, `${path}.${k}`);
      }
    }
  }
}

// Search last 100 entries first (most recent prompts in history)
console.log('Searching entries...');
for (let i = data.length - 1; i >= 0; i--) {
  inspectObject(data[i], `[${i}]`);
}

console.log(`Total cargo arrays found: ${foundCargos.length}, Total shipment arrays found: ${foundShipments.length}`);
