import fs from 'fs';
import path from 'path';

const file = 'migrated_prompt_history/prompt_2026-02-19T19_43_46.014Z.json';
if (fs.existsSync(file)) {
  const content = fs.readFileSync(file, 'utf8');
  console.log('File size:', content.length);
  
  // Search for keywords
  const keywords = ['cargos', 'shipments', 'drivers', 'clients', 'tickets', 'freight_offers'];
  for (const kw of keywords) {
    const matches = (content.match(new RegExp(kw, 'gi')) || []).length;
    console.log(`Keyword "${kw}": ${matches} occurrences`);
  }

  // Look for JSON structures containing cargos or shipments
  const cargoMatches = content.match(/"id"\s*:\s*"CARG-[^"]+"/g);
  console.log('Found CARG IDs in prompt history:', cargoMatches?.length || 0);

  const shipMatches = content.match(/"id"\s*:\s*"(?:SHIP|ROB)-[^"]+"/g);
  console.log('Found SHIP/ROB IDs in prompt history:', shipMatches?.length || 0);
} else {
  console.log('File not found');
}
