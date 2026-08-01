import fs from 'fs';

const content = fs.readFileSync('migrated_prompt_history/prompt_2026-02-19T19_43_46.014Z.json', 'utf8');

try {
  const parsed = JSON.parse(content);
  console.log('JSON structure keys:', Object.keys(parsed));
  // Print preview if array or object
  if (Array.isArray(parsed)) {
    console.log('Top level is array of length:', parsed.length);
  }
} catch (e) {
  console.log('JSON parse error:', e.message);
}

// Search for patterns like 'cargos = [' or 'initialCargos' or 'INSERT INTO cargos' or 'shipments = ['
const regexes = [
  /cargos\s*=\s*\[[^\]]+\]/gs,
  /shipments\s*=\s*\[[^\]]+\]/gs,
  /INSERT INTO\s+cargos[^\n;]+/gi,
  /INSERT INTO\s+shipments[^\n;]+/gi,
  /\[\s*\{\s*"id":\s*"[^"]+",\s*"origin"/gs
];

for (const r of regexes) {
  const match = content.match(r);
  console.log(`Regex ${r}: ${match ? match.length + ' matches' : 'no match'}`);
}
