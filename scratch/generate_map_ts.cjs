const fs = require('fs');

const content = fs.readFileSync('scratch/mapa_raw.html', 'utf8');

const regex = /<(polygon|path)\s+([^>]+)>/g;
let match;
const states = {};
const otherElements = [];

const REGION_MAP = {
  SP: 'Sudeste', RJ: 'Sudeste', MG: 'Sudeste', ES: 'Sudeste',
  PR: 'Sul', SC: 'Sul', RS: 'Sul',
  BA: 'Nordeste', PE: 'Nordeste', CE: 'Nordeste', MA: 'Nordeste',
  PB: 'Nordeste', RN: 'Nordeste', AL: 'Nordeste', SE: 'Nordeste', PI: 'Nordeste',
  MT: 'Centro-Oeste', MS: 'Centro-Oeste', GO: 'Centro-Oeste', DF: 'Centro-Oeste',
  AM: 'Norte', PA: 'Norte', RO: 'Norte', AC: 'Norte', RR: 'Norte', AP: 'Norte', TO: 'Norte'
};

while ((match = regex.exec(content)) !== null) {
  const tag = match[1];
  const attrsStr = match[2];
  
  const idMatch = attrsStr.match(/\bid="([^"]+)"/);
  const pointsMatch = attrsStr.match(/\bpoints="([^"]+)"/);
  const dMatch = attrsStr.match(/\bd="([^"]+)"/);
  
  const id = idMatch ? idMatch[1] : undefined;
  const points = pointsMatch ? pointsMatch[1].replace(/\s+/g, ' ').trim() : undefined;
  const d = dMatch ? dMatch[1].replace(/\s+/g, ' ').trim() : undefined;
  
  if (id && REGION_MAP[id]) {
    states[id] = {
      tag,
      id,
      region: REGION_MAP[id],
      points,
      d
    };
  } else {
    otherElements.push({
      tag,
      points,
      d
    });
  }
}

console.log('Processed states:', Object.keys(states).length);
console.log('MT d length:', states['MT']?.d?.length);
console.log('PA d length:', states['PA']?.d?.length);
console.log('Other elements (islands/details):', otherElements.length);

// Generate typescript file
let tsCode = `// Brazil SVG map data
// ViewBox: 0 0 353.845 367.766

export type RegionKey = 'Sudeste' | 'Sul' | 'Nordeste' | 'Norte' | 'Centro-Oeste';

export interface StateShape {
  id: string;
  region: RegionKey;
  tag: 'polygon' | 'path';
  points?: string;
  d?: string;
}

export interface MapShape {
  tag: 'polygon' | 'path';
  points?: string;
  d?: string;
}

export const BRAZIL_VIEWBOX = '0 0 353.845 367.766';

export const BRAZIL_STATES: StateShape[] = ${JSON.stringify(Object.values(states), null, 2)};

export const BRAZIL_ISLANDS: MapShape[] = ${JSON.stringify(otherElements, null, 2)};
`;

fs.writeFileSync('components/brazilMapData.ts', tsCode);
console.log('Wrote components/brazilMapData.ts successfully!');
