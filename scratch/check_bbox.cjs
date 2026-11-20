const fs = require('fs');
const content = fs.readFileSync('scratch/mapa_raw.html', 'utf8');

const regex = /<(polygon|path)\s+([^>]+)>/g;
let match;
let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

while ((match = regex.exec(content)) !== null) {
  const attrs = match[2];
  const pointsMatch = attrs.match(/\bpoints="([^"]+)"/);
  const dMatch = attrs.match(/\bd="([^"]+)"/);

  if (pointsMatch) {
    const pairs = pointsMatch[1].trim().split(/\s+/);
    for (const p of pairs) {
      const [x, y] = p.split(',').map(Number);
      if (!isNaN(x) && !isNaN(y)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  } else if (dMatch) {
    const tokens = dMatch[1].match(/[0-9]+\.?[0-9]*/g) || [];
    for (let i = 0; i < tokens.length; i += 2) {
      const x = parseFloat(tokens[i]);
      const y = parseFloat(tokens[i + 1]);
      if (!isNaN(x) && !isNaN(y)) {
        // approximate
      }
    }
  }
}

console.log('Points bounding box:', { minX, maxX, minY, maxY });
console.log('Current viewBox: 0 0 353.845 367.766');
