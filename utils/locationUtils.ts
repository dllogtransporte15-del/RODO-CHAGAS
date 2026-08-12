/**
 * Utilitários para análise, extração de coordenadas e encurtamento de links de localização.
 */

export interface LocationParsed {
  /** Se o texto é ou contém um link web ou coordenadas */
  isUrl: boolean;
  /** Link extraído ou gerado */
  url: string | null;
  /** Link com protocolo garantido (https://...) para uso em tags <a> */
  href: string | null;
  /** Link limpo/encurtado no formato https://maps.google.com/?q=lat,lng */
  cleanShortUrl: string | null;
  /** Coordenadas numéricas extraídas, se encontradas */
  coordinates: { lat: number; lng: number } | null;
  /** String formatada das coordenadas (ex: "-21.685121, -43.072413") */
  coordString: string | null;
  /** Texto descritivo prefixo antes ou fora do link (ex: "Fazenda Sol Nascente") */
  prefixText: string | null;
  /** Texto de exibição resumido e seguro para o front */
  displayText: string;
}

/**
 * Tenta extrair latitude e longitude de qualquer texto ou URL (Google Maps, Waze, coordenadas diretas).
 */
export function extractCoordinates(text: string | undefined | null): { lat: number; lng: number; formatted: string } | null {
  if (!text || typeof text !== 'string') return null;
  const str = text.trim();

  // 1. Padrão protobuf do Google Maps: !3d-21.6851208!4d-43.0724127
  const protoMatch = str.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (protoMatch) {
    const lat = parseFloat(protoMatch[1]);
    const lng = parseFloat(protoMatch[2]);
    if (isValidLatLng(lat, lng)) {
      return { lat, lng, formatted: `${lat.toFixed(6)}, ${lng.toFixed(6)}` };
    }
  }

  // 2. Padrão /place/lat,lng ou /@lat,lng ou /search/lat,lng
  const placeMatch = str.match(/(?:place|search|@|\/to\/ll\.)\/(-?\d{1,3}(?:\.\d+)?)[,\/](-?\d{1,3}(?:\.\d+)?)/i);
  if (placeMatch) {
    const lat = parseFloat(placeMatch[1]);
    const lng = parseFloat(placeMatch[2]);
    if (isValidLatLng(lat, lng)) {
      return { lat, lng, formatted: `${lat.toFixed(6)}, ${lng.toFixed(6)}` };
    }
  }

  // 3. Padrão query param: ?q=lat,lng ou &q=lat,lng ou ?ll=lat,lng
  const queryMatch = str.match(/[?&](?:q|ll|destination)=(-?\d{1,3}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)/i);
  if (queryMatch) {
    const lat = parseFloat(queryMatch[1]);
    const lng = parseFloat(queryMatch[2]);
    if (isValidLatLng(lat, lng)) {
      return { lat, lng, formatted: `${lat.toFixed(6)}, ${lng.toFixed(6)}` };
    }
  }

  // 4. Padrão coordenadas diretas (ex: "-21.685121, -43.072413" ou "-21.685121,-43.072413")
  const directMatch = str.match(/(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/);
  if (directMatch) {
    const lat = parseFloat(directMatch[1]);
    const lng = parseFloat(directMatch[2]);
    if (isValidLatLng(lat, lng)) {
      return { lat, lng, formatted: `${lat.toFixed(6)}, ${lng.toFixed(6)}` };
    }
  }

  return null;
}

function isValidLatLng(lat: number, lng: number): boolean {
  return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * Analisa qualquer string de localização e retorna seus componentes enriquecidos.
 */
export function parseLocation(text: string | undefined | null): LocationParsed {
  if (!text || typeof text !== 'string' || !text.trim()) {
    return {
      isUrl: false,
      url: null,
      href: null,
      cleanShortUrl: null,
      coordinates: null,
      coordString: null,
      prefixText: null,
      displayText: ''
    };
  }

  const raw = text.trim();
  const coords = extractCoordinates(raw);

  // Regex para detectar URL (com ou sem http/https, ou domínios comuns de mapas)
  const urlRegex = /(?:https?:\/\/|www\.|maps\.google\.|google\.com\/maps|maps\.app\.goo\.gl|goo\.gl\/maps|waze\.com)[^\s)]+/i;
  const urlMatch = raw.match(urlRegex);

  if (urlMatch) {
    const matchedUrl = urlMatch[0];
    let safeHref = matchedUrl;
    if (!safeHref.startsWith('http://') && !safeHref.startsWith('https://')) {
      safeHref = `https://${safeHref}`;
    }

    // Texto ao redor do link
    const beforeUrl = raw.substring(0, urlMatch.index).trim().replace(/[-–—:(]+$/, '').trim();
    const afterUrl = raw.substring((urlMatch.index || 0) + matchedUrl.length).trim().replace(/^[)\]]+/, '').trim();
    const prefixText = beforeUrl || afterUrl || null;

    let cleanShortUrl = safeHref;
    if (coords) {
      cleanShortUrl = `https://maps.google.com/?q=${coords.lat},${coords.lng}`;
    } else if (matchedUrl.includes('maps.app.goo.gl') || matchedUrl.includes('goo.gl/maps')) {
      cleanShortUrl = safeHref;
    }

    return {
      isUrl: true,
      url: matchedUrl,
      href: safeHref,
      cleanShortUrl,
      coordinates: coords ? { lat: coords.lat, lng: coords.lng } : null,
      coordString: coords ? coords.formatted : null,
      prefixText,
      displayText: prefixText ? `${prefixText} (Ver Mapa)` : (coords ? coords.formatted : 'Ver Localização')
    };
  }

  // Se não tem URL mas contém coordenadas brutas
  if (coords) {
    const cleanShortUrl = `https://maps.google.com/?q=${coords.lat},${coords.lng}`;
    const beforeCoords = raw.replace(/(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/, '').trim().replace(/[-–—:(]+$/, '').trim();
    const prefixText = beforeCoords || null;

    return {
      isUrl: true,
      url: cleanShortUrl,
      href: cleanShortUrl,
      cleanShortUrl,
      coordinates: { lat: coords.lat, lng: coords.lng },
      coordString: coords.formatted,
      prefixText,
      displayText: prefixText ? `${prefixText} (${coords.formatted})` : coords.formatted
    };
  }

  // Texto comum sem link
  return {
    isUrl: false,
    url: null,
    href: null,
    cleanShortUrl: null,
    coordinates: null,
    coordString: null,
    prefixText: null,
    displayText: raw
  };
}

/**
 * Limpa ou encurta links longos colados pelo usuário em campos de formulário.
 * Se o usuário colou uma URL do Google Maps gigantesca com dados de rastreamento,
 * converte para link limpo/coordenadas ou link padrão curto.
 */
export function cleanOrShortenLocationInput(value: string | undefined | null): string {
  if (!value || typeof value !== 'string') return '';
  const parsed = parseLocation(value);

  if (parsed.isUrl) {
    // Se temos coordenadas e o link original for muito longo (> 60 caracteres)
    if (parsed.cleanShortUrl && (parsed.url?.length || 0) > 60) {
      if (parsed.prefixText) {
        return `${parsed.prefixText} ${parsed.cleanShortUrl}`;
      }
      return parsed.cleanShortUrl;
    }

    // Garante que se era um link sem protocolo (ex: google.com/maps/...), agora tem https://
    if (parsed.href && !value.startsWith('http://') && !value.startsWith('https://')) {
      if (parsed.prefixText) {
        return `${parsed.prefixText} ${parsed.href}`;
      }
      return parsed.href;
    }
  }

  return value;
}

/**
 * Retorna uma versão compacta e segura para ser impressa em relatórios e PDFs.
 */
export function formatLocationForPrint(location: string | undefined | null): string {
  if (!location) return '';
  const parsed = parseLocation(location);

  if (parsed.isUrl) {
    if (parsed.prefixText && parsed.coordString) {
      return `${parsed.prefixText} (GPS: ${parsed.coordString})`;
    }
    if (parsed.prefixText) {
      return `${parsed.prefixText} (Link de Mapa)`;
    }
    if (parsed.coordString) {
      return `GPS: ${parsed.coordString}`;
    }
    return parsed.cleanShortUrl || parsed.href || 'Link de Localização';
  }

  return location;
}
