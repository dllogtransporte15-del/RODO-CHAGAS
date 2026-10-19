export const formatCPF = (value: string): string => {
  const numeric = value.replace(/\D/g, '').slice(0, 11);
  return numeric.replace(/(\d{3})(\d{3})?(\d{3})?(\d{2})?/, (_, p1, p2, p3, p4) => {
    let res = p1;
    if (p2) res += `.${p2}`;
    if (p3) res += `.${p3}`;
    if (p4) res += `-${p4}`;
    return res;
  });
};

export const formatPhone = (value: string): string => {
  const numeric = value.replace(/\D/g, '').slice(0, 11);
  if (numeric.length === 0) return '';
  if (numeric.length <= 2) return `(${numeric}`;
  if (numeric.length <= 6) return `(${numeric.slice(0, 2)}) ${numeric.slice(2)}`;
  if (numeric.length <= 10) return `(${numeric.slice(0, 2)}) ${numeric.slice(2, 6)}-${numeric.slice(6)}`;
  return `(${numeric.slice(0, 2)}) ${numeric.slice(2, 7)}-${numeric.slice(7)}`;
};

export const formatName = (value: string): string => {
  const prepositions = ['da', 'de', 'do', 'dos', 'das', 'e'];
  return value
    .split(' ')
    .map((word, index) => {
      if (word.length === 0) return '';
      const lower = word.toLowerCase();
      if (index > 0 && prepositions.includes(lower)) {
        return lower;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
};

import { formatCityState, validateCityFormat, isValidCity, BRAZILIAN_UFS } from './cityUtils';
export { formatCityState, validateCityFormat, isValidCity, BRAZILIAN_UFS };
export type { BrazilianUF, CityValidationResult } from './cityUtils';

export const formatCpfCnpj = (value: string): string => {
  const numeric = value.replace(/\D/g, '').slice(0, 14);
  if (numeric.length <= 11) {
    return formatCPF(numeric);
  }
  return numeric.replace(/(\d{2})(\d{3})?(\d{3})?(\d{4})?(\d{2})?/, (_, p1, p2, p3, p4, p5) => {
    let res = p1;
    if (p2) res += `.${p2}`;
    if (p3) res += `.${p3}`;
    if (p4) res += `/${p4}`;
    if (p5) res += `-${p5}`;
    return res;
  });
};

import { cleanOrShortenLocationInput } from './locationUtils';
export * from './locationUtils';

export const autoFormatInput = (name: string, value: string): string => {
  if (!value) return value;
  
  const lowerName = name.toLowerCase();
  
  if (lowerName.includes('location') || lowerName.includes('maplink')) {
    return cleanOrShortenLocationInput(value);
  }

  if (lowerName === 'cpf' || lowerName === 'drivercpf' || lowerName === 'ownercpf') {
    return formatCPF(value);
  }
  if (lowerName.includes('cpfcnpj') || lowerName.includes('cnpj')) {
    return formatCpfCnpj(value);
  }
  if (lowerName.includes('phone') || lowerName.includes('telefone')) {
    return formatPhone(value);
  }
  if (lowerName.includes('origem') || lowerName.includes('destino') || lowerName.includes('origin') || lowerName.includes('destination') || lowerName === 'city') {
    // If user pasted a link into origin/destination by accident, don't format as city/state
    if (value.includes('http://') || value.includes('https://') || value.includes('google.com') || value.includes('maps.')) {
      return cleanOrShortenLocationInput(value);
    }
    return formatCityState(value);
  }
  return value;
};

export const FRETEBRAS_VEHICLE_MAP: Record<string, string | null> = {
  'LS Simples': null,
  'Cavalo 4e': null,
  'Bitrem 8e': null,
  'Rodotrem (3x3)': 'Bitrem 9 eixos',
  'Carreta 4e': 'Carreta 4º eixo',
  'Bitrem 7e': 'Bitrem 7 eixos',
  'LS Trucada': 'Carreta LS',
  'Vanderleia': 'Vanderléia',
  'Caminhão Truck': 'Truck',
};

export const formatFretebrasVehicleTypes = (allowed?: { setType: string }[]): string => {
  if (!allowed || allowed.length === 0) return '';
  const mapped = allowed
    .map(t => {
      const typeStr = t.setType;
      if (Object.prototype.hasOwnProperty.call(FRETEBRAS_VEHICLE_MAP, typeStr)) {
        return FRETEBRAS_VEHICLE_MAP[typeStr];
      }
      return typeStr;
    })
    .filter((t): t is string => t !== null && t !== undefined && t !== '');

  return [...new Set(mapped)].join(', ');
};

export const isValidCPF = (cpf: string): boolean => {
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i), 10) * (10 - i);
  }
  let rev = (sum * 10) % 11;
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(9), 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i), 10) * (11 - i);
  }
  rev = (sum * 10) % 11;
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(10), 10)) return false;

  return true;
};

export const isValidCNPJ = (cnpj: string): boolean => {
  const clean = cnpj.replace(/\D/g, '');
  if (clean.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(clean)) return false;

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(clean.charAt(i), 10) * weights1[i];
  }
  let rev = sum % 11;
  const digit1 = rev < 2 ? 0 : 11 - rev;
  if (digit1 !== parseInt(clean.charAt(12), 10)) return false;

  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(clean.charAt(i), 10) * weights2[i];
  }
  rev = sum % 11;
  const digit2 = rev < 2 ? 0 : 11 - rev;
  if (digit2 !== parseInt(clean.charAt(13), 10)) return false;

  return true;
};

export const isValidCpfCnpj = (val: string): boolean => {
  const clean = val.replace(/\D/g, '');
  if (clean.length === 11) return isValidCPF(clean);
  if (clean.length === 14) return isValidCNPJ(clean);
  return false;
};

export const isValidPlate = (plate: string): boolean => {
  const clean = plate.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (clean.length !== 7) return false;
  // Traditional (AAA9999) or Mercosul (AAA9A99)
  const traditionalRegex = /^[A-Z]{3}[0-9]{4}$/;
  const mercosulRegex = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;
  return traditionalRegex.test(clean) || mercosulRegex.test(clean);
};

export const formatPlate = (plate: string): string => {
  const clean = plate.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 7);
  if (clean.length <= 3) return clean;
  // If it matches traditional pattern format with hyphen: AAA-9999
  if (/^[A-Z]{3}[0-9]{1,4}$/.test(clean)) {
    return `${clean.slice(0, 3)}-${clean.slice(3)}`;
  }
  // Otherwise Mercosul (keep as AAA9A99 or formatted)
  return clean;
};



