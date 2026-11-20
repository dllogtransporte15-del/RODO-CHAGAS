const fs = require('fs');

const raw = fs.readFileSync('scratch/mapa_raw.html', 'utf8');

const regex = /<(polygon|path)\s+([^>]+)>/g;
let match;
const centers = {};

const STATE_NAMES = {
  AC: 'Acre',
  AL: 'Alagoas',
  AP: 'Amapá',
  AM: 'Amazonas',
  BA: 'Bahia',
  CE: 'Ceará',
  DF: 'Distrito Federal',
  ES: 'Espírito Santo',
  GO: 'Goiás',
  MA: 'Maranhão',
  MT: 'Mato Grosso',
  MS: 'Mato Grosso do Sul',
  MG: 'Minas Gerais',
  PA: 'Pará',
  PB: 'Paraíba',
  PR: 'Paraná',
  PE: 'Pernambuco',
  PI: 'Piauí',
  RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul',
  RO: 'Rondônia',
  RR: 'Roraima',
  SC: 'Santa Catarina',
  SP: 'São Paulo',
  SE: 'Sergipe',
  TO: 'Tocantins'
};

while ((match = regex.exec(raw)) !== null) {
  const attrs = match[2];
  const idMatch = attrs.match(/\bid="([^"]+)"/);
  if (!idMatch || !STATE_NAMES[idMatch[1]]) continue;
  
  const id = idMatch[1];
  const pointsMatch = attrs.match(/\bpoints="([^"]+)"/);
  const dMatch = attrs.match(/\bd="([^"]+)"/);
  
  const pts = [];
  if (pointsMatch) {
    const pairs = pointsMatch[1].trim().split(/\s+/);
    for (const p of pairs) {
      const [x, y] = p.split(',').map(Number);
      if (!isNaN(x) && !isNaN(y)) pts.push({ x, y });
    }
  } else if (dMatch) {
    // parse svg path
    const tokens = dMatch[1].match(/[a-zA-Z]|[-+]?[0-9]*\.?[0-9]+/g) || [];
    let curX = 0, curY = 0;
    let i = 0;
    while (i < tokens.length) {
      const tok = tokens[i];
      if (/^[a-zA-Z]$/.test(tok)) {
        const cmd = tok;
        i++;
        if (cmd === 'M') {
          curX = parseFloat(tokens[i++]);
          curY = parseFloat(tokens[i++]);
          pts.push({ x: curX, y: curY });
        } else if (cmd === 'm') {
          curX += parseFloat(tokens[i++]);
          curY += parseFloat(tokens[i++]);
          pts.push({ x: curX, y: curY });
        } else if (cmd === 'L') {
          curX = parseFloat(tokens[i++]);
          curY = parseFloat(tokens[i++]);
          pts.push({ x: curX, y: curY });
        } else if (cmd === 'l') {
          curX += parseFloat(tokens[i++]);
          curY += parseFloat(tokens[i++]);
          pts.push({ x: curX, y: curY });
        } else if (cmd === 'H') {
          curX = parseFloat(tokens[i++]);
          pts.push({ x: curX, y: curY });
        } else if (cmd === 'h') {
          curX += parseFloat(tokens[i++]);
          pts.push({ x: curX, y: curY });
        } else if (cmd === 'V') {
          curY = parseFloat(tokens[i++]);
          pts.push({ x: curX, y: curY });
        } else if (cmd === 'v') {
          curY += parseFloat(tokens[i++]);
          pts.push({ x: curX, y: curY });
        }
      } else {
        // default to implicit lineto
        const dx = parseFloat(tok);
        const dy = parseFloat(tokens[++i]);
        i++;
        curX += dx;
        curY += dy;
        pts.push({ x: curX, y: curY });
      }
    }
  }
  
  if (pts.length > 0) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let sumX = 0, sumY = 0;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
      sumX += p.x;
      sumY += p.y;
    }
    const bboxCenterX = (minX + maxX) / 2;
    const bboxCenterY = (minY + maxY) / 2;
    const avgX = sumX / pts.length;
    const avgY = sumY / pts.length;
    // Blend centroid with bbox center
    const cx = Math.round(((bboxCenterX * 0.4 + avgX * 0.6) * 10)) / 10;
    const cy = Math.round(((bboxCenterY * 0.4 + avgY * 0.6) * 10)) / 10;
    centers[id] = {
      id,
      name: STATE_NAMES[id],
      cx,
      cy,
      minX: Math.round(minX),
      maxX: Math.round(maxX),
      minY: Math.round(minY),
      maxY: Math.round(maxY)
    };
  }
}

console.log('Calculated centers for', Object.keys(centers).length, 'states:');
for (const [id, c] of Object.entries(centers)) {
  console.log(`${id}: { name: '${c.name}', cx: ${c.cx}, cy: ${c.cy} },`);
}
