const fs = require('fs');

const content = fs.readFileSync('scratch/mapa_raw.html', 'utf8');

// Parse SVG viewBox
const viewBoxMatch = content.match(/viewBox="([^"]+)"/);
const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 353.845 367.766';

// Extract all polygon and path tags
const regex = /<(polygon|path)\s+([^>]+)>/g;
let match;
const elements = [];

while ((match = regex.exec(content)) !== null) {
  const tag = match[1];
  const attrsStr = match[2];
  
  const idMatch = attrsStr.match(/id="([^"]+)"/);
  const pointsMatch = attrsStr.match(/points="([^"]+)"/);
  const dMatch = attrsStr.match(/d="([^"]+)"/);
  
  const id = idMatch ? idMatch[1] : undefined;
  const points = pointsMatch ? pointsMatch[1].replace(/\s+/g, ' ').trim() : undefined;
  const d = dMatch ? dMatch[1].replace(/\s+/g, ' ').trim() : undefined;
  
  elements.push({
    tag,
    id,
    points,
    d
  });
}

console.log(`Total elements: ${elements.length}`);
const withId = elements.filter(e => e.id);
console.log(`With ID: ${withId.length}`);
console.log('State IDs:', withId.map(e => e.id).join(', '));
