import fs from 'fs';

const data = JSON.parse(fs.readFileSync('migrated_prompt_history/prompt_2026-02-19T19_43_46.014Z.json', 'utf8'));

console.log('Total entries:', data.length);

let totalCodeBlocks = 0;
let foundArrays = [];

for (let i = 0; i < data.length; i++) {
  const item = data[i];
  const str = JSON.stringify(item);
  if (str.includes('initialCargos') || str.includes('initialShipments') || str.includes('mockCargos') || str.includes('MOCK_') || str.includes('cargosData')) {
    console.log(`Found candidate in entry [${i}]`);
    foundArrays.push(i);
  }
}

console.log('Entries with candidates:', foundArrays);
