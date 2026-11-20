const fs = require('fs');
const content = fs.readFileSync('scratch/mapa_raw.html', 'utf8');

const regex = /<(polygon|path)\s+([^>]+)>/g;
let match;
let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

const STATE_NAMES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

while ((match = regex.exec(content)) !== null) {
  const attrs = match[2];
  const idMatch = attrs.match(/\bid="([^"]+)"/);
  if (!idMatch || !STATE_NAMES.includes(idMatch[1])) continue;

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
    const tokens = dMatch[1].match(/[a-zA-Z]|[-+]?[0-9]*\.?[0-9]+/g) || [];
    let curX = 0, curY = 0;
    let i = 0;
    while (i < tokens.length) {
      const tok = tokens[i];
      if (/^[a-zA-Z]$/.test(tok)) {
        const cmd = tok;
        i++;
        if (cmd === 'M' || cmd === 'L') {
          curX = parseFloat(tokens[i++]);
          curY = parseFloat(tokens[i++]);
        } else if (cmd === 'm' || cmd === 'l') {
          curX += parseFloat(tokens[i++]);
          curY += parseFloat(tokens[i++]);
        }
      } else {
        curX += parseFloat(tok);
        curY += parseFloat(tokens[++i]);
        i++;
      }
      if (!isNaN(curX) && !isNaN(curY)) {
        if (curX < minX) minX = curX;
        if (curX > maxX) maxX = curX;
        if (curY < minY) minY = curY;
        if (curY > maxY) maxY = curY;
      }
    }
  }
}

console.log('States actual bounding box:');
console.log({ minX, maxX, minY, maxY });
console.log('Width:', maxX - minX, 'Height:', maxY - minY);
