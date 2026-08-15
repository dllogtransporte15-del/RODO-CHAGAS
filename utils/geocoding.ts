
/**
 * Utility to geocode address strings using OpenStreetMap Nominatim API.
 * Includes a simple local cache to avoid redundant requests.
 */

const geocodeCache: Record<string, { lat: number; lng: number } | null> = {
  'catalão, go': { lat: -18.1691, lng: -47.9463 },
  'catalao, go': { lat: -18.1691, lng: -47.9463 },
  'ouvidor, go': { lat: -18.2325, lng: -47.8389 },
  'araguari, mg': { lat: -18.6472, lng: -48.1872 },
  'uberlândia, mg': { lat: -18.9186, lng: -48.2772 },
  'uberlandia, mg': { lat: -18.9186, lng: -48.2772 },
  'patos de minas, mg': { lat: -18.5789, lng: -46.5181 },
  'santa juliana, mg': { lat: -19.3094, lng: -47.5256 },
  'serra do salitre, mg': { lat: -19.1122, lng: -46.6897 },
  'iguatama, mg': { lat: -20.1739, lng: -45.7111 },
  'patrocínio, mg': { lat: -18.9433, lng: -46.9944 },
  'patrocinio, mg': { lat: -18.9433, lng: -46.9944 },
  'guarda-mor, mg': { lat: -17.7769, lng: -47.1042 },
  'passos, mg': { lat: -20.723, lng: -46.611 },
  'uberaba, mg': { lat: -19.7478, lng: -47.9392 },
  'sinop, mt': { lat: -11.8598, lng: -55.5031 },
  'cuiabá, mt': { lat: -15.6010, lng: -56.0974 },
  'cuiaba, mt': { lat: -15.6010, lng: -56.0974 },
  'sorriso, mt': { lat: -12.5507, lng: -55.7126 },
  'rio verde, go': { lat: -17.7915, lng: -50.9202 },
  'goiânia, go': { lat: -16.6869, lng: -49.2648 },
  'goiania, go': { lat: -16.6869, lng: -49.2648 },
  'campo grande, ms': { lat: -20.4697, lng: -54.6201 },
  'rondonópolis, mt': { lat: -16.4674, lng: -54.6347 },
  'rondonopolis, mt': { lat: -16.4674, lng: -54.6347 },
  'são paulo, sp': { lat: -23.5505, lng: -46.6333 },
  'sao paulo, sp': { lat: -23.5505, lng: -46.6333 },
  'santos, sp': { lat: -23.9608, lng: -46.3339 },
  'paranaguá, pr': { lat: -25.5204, lng: -48.5093 },
  'paranagua, pr': { lat: -25.5204, lng: -48.5093 },
  'cristalina, go': { lat: -16.7686, lng: -47.6133 },
  'anápolis, go': { lat: -16.3267, lng: -48.9528 },
  'anapolis, go': { lat: -16.3267, lng: -48.9528 },
  'rio verde de mato grosso, ms': { lat: -18.9181, lng: -54.8442 },
  'dourados, ms': { lat: -22.2235, lng: -54.8064 },
  'luís eduardo magalhães, ba': { lat: -12.0968, lng: -45.7872 },
  'luis eduardo magalhaes, ba': { lat: -12.0968, lng: -45.7872 },
  'barreiras, ba': { lat: -12.1528, lng: -44.9978 },
  'primavera do leste, mt': { lat: -15.5591, lng: -54.2965 },
  'nova mutum, mt': { lat: -13.8294, lng: -56.0792 },
  'lucas do rio verde, mt': { lat: -13.0645, lng: -55.9103 },
  'guarujá, sp': { lat: -23.993, lng: -46.257 },
  'guaruja, sp': { lat: -23.993, lng: -46.257 },
  'maringá, pr': { lat: -23.4205, lng: -51.9333 },
  'maringa, pr': { lat: -23.4205, lng: -51.9333 },
  'londrina, pr': { lat: -23.3045, lng: -51.1696 },
  'cascavel, pr': { lat: -24.9578, lng: -53.4595 },
  'itumbiara, go': { lat: -18.4194, lng: -49.2172 },
  'ipameri, go': { lat: -17.7219, lng: -48.1597 },
  'jatai, go': { lat: -17.8814, lng: -51.7144 },
  'jataí, go': { lat: -17.8814, lng: -51.7144 },
  'varginha, mg': { lat: -21.5515, lng: -45.4303 },
  'pouso alegre, mg': { lat: -22.2300, lng: -45.9364 },
  'campinas, sp': { lat: -22.9099, lng: -47.0626 },
  'ribeirão preto, sp': { lat: -21.1767, lng: -47.8208 },
  'ribeirao preto, sp': { lat: -21.1767, lng: -47.8208 },
};

export async function geocodeCity(query: string): Promise<{ lat: number; lng: number } | null> {
  if (!query || !query.trim()) return null;
  
  const normalizedQuery = query.trim().toLowerCase();
  
  if (geocodeCache[normalizedQuery] !== undefined) {
    return geocodeCache[normalizedQuery];
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', Brasil')}&countrycodes=br&addressdetails=1&limit=1`,
      {
        headers: {
          'Accept-Language': 'pt-BR',
          'User-Agent': 'Rodochagas-Control/1.0'
        }
      }
    );
    
    if (!response.ok) throw new Error('Network response was not ok');
    
    const data = await response.json();
    if (data && data.length > 0) {
      const result = {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      };
      geocodeCache[normalizedQuery] = result;
      return result;
    }
    
    geocodeCache[normalizedQuery] = null;
    return null;
  } catch (error) {
    console.error(`Error geocoding "${query}":`, error);
    return null;
  }
}

export function getCoordsSync(query: string): { lat: number; lng: number } | null {
  if (!query || !query.trim()) return null;
  const normalizedQuery = query.trim().toLowerCase().replace(/\s*-\s*/, ', ');
  if (geocodeCache[normalizedQuery]) return geocodeCache[normalizedQuery];
  const simpleQuery = query.trim().toLowerCase();
  if (geocodeCache[simpleQuery]) return geocodeCache[simpleQuery];
  // Check partial key
  for (const [key, coords] of Object.entries(geocodeCache)) {
    if (coords && (normalizedQuery.includes(key) || key.includes(normalizedQuery))) {
      return coords;
    }
  }
  return null;
}

export function calculateDistanceKm(
  coord1?: { lat: number; lng: number } | null,
  coord2?: { lat: number; lng: number } | null
): number | null {
  if (!coord1 || !coord2) return null;
  const R = 6371; // km
  const dLat = ((coord2.lat - coord1.lat) * Math.PI) / 180;
  const dLon = ((coord2.lng - coord1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((coord1.lat * Math.PI) / 180) *
      Math.cos((coord2.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`,
      {
        headers: {
          'Accept-Language': 'pt-BR',
          'User-Agent': 'Rodochagas-Control/1.0'
        }
      }
    );
    if (!response.ok) return null;
    const data = await response.json();
    if (data && data.address) {
      const city = data.address.city || data.address.town || data.address.municipality || data.address.village || data.address.county;
      const state = data.address.state_code || data.address.state;
      if (city && state) {
        return `${city}, ${state.toUpperCase()}`;
      } else if (city) {
        return city;
      }
    }
    return null;
  } catch (error) {
    console.error('Error in reverseGeocode:', error);
    return null;
  }
}

