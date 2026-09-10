import { BRAZILIAN_CITIES } from '../brazilianCities';
import { formatName } from './formatters';

export const BRAZILIAN_UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
] as const;

export type BrazilianUF = typeof BRAZILIAN_UFS[number];

/**
 * Normaliza e padroniza a entrada de uma cidade no formato "Nome da Cidade, UF"
 * Trata variações como:
 * - "Rio Verde - GO" -> "Rio Verde, GO"
 * - "rio verde/go" -> "Rio Verde, GO"
 * - "rio verde, go" -> "Rio Verde, GO"
 * - "rio verde go" -> "Rio Verde, GO"
 */
export function formatCityState(value: string | undefined | null): string {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';

  // 1. Verifica se há separador explícito: vírgula, hífen, barra ou travessão
  const separatorMatch = trimmed.match(/^(.*?)(?:\s*[,|\-\/–—]\s*)([a-zA-Z]{2})\s*$/);
  if (separatorMatch) {
    const cityName = formatName(separatorMatch[1].trim());
    const uf = separatorMatch[2].toUpperCase();
    if (BRAZILIAN_UFS.includes(uf as BrazilianUF)) {
      return `${cityName}, ${uf}`;
    }
  }

  // 2. Se termina com vírgula e 2 letras
  const commaIndex = trimmed.lastIndexOf(',');
  if (commaIndex !== -1) {
    const cityName = formatName(trimmed.slice(0, commaIndex).trim());
    const ufPart = trimmed.slice(commaIndex + 1).replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase();
    return ufPart ? `${cityName}, ${ufPart}` : (cityName ? `${cityName}, ` : '');
  }

  // 3. Se termina com hífen ou barra
  const dashIndex = Math.max(trimmed.lastIndexOf('-'), trimmed.lastIndexOf('/'));
  if (dashIndex !== -1) {
    const cityName = formatName(trimmed.slice(0, dashIndex).trim());
    const ufPart = trimmed.slice(dashIndex + 1).replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase();
    return ufPart ? `${cityName}, ${ufPart}` : `${cityName}, `;
  }

  // 4. Se termina com espaço e 2 letras que batem com uma UF válida (ex: "Rio Verde GO")
  const spaceUfMatch = trimmed.match(/^(.*?)\s+([a-zA-Z]{2})$/);
  if (spaceUfMatch) {
    const potentialUF = spaceUfMatch[2].toUpperCase();
    if (BRAZILIAN_UFS.includes(potentialUF as BrazilianUF)) {
      const cityName = formatName(spaceUfMatch[1].trim());
      return `${cityName}, ${potentialUF}`;
    }
  }

  return formatName(trimmed);
}

export interface CityValidationResult {
  isValid: boolean;
  formatted: string;
  errorMessage?: string;
}

/**
 * Valida se uma string de cidade segue rigorosamente o formato "Nome da Cidade, UF"
 * com uma UF brasileira válida.
 */
export function validateCityFormat(value: string | undefined | null, fieldName: string = 'Cidade'): CityValidationResult {
  if (!value || typeof value !== 'string' || !value.trim()) {
    return {
      isValid: false,
      formatted: '',
      errorMessage: `O campo "${fieldName}" é obrigatório e deve ser preenchido no formato "Nome da Cidade, UF" (ex: Rio Verde, GO ou Santos, SP).`
    };
  }

  const raw = value.trim();

  // Se o usuário colou link/URL no campo de cidade
  if (raw.includes('http://') || raw.includes('https://') || raw.includes('google.com') || raw.includes('maps.')) {
    return {
      isValid: false,
      formatted: raw,
      errorMessage: `Link detectado no campo "${fieldName}". Informe a cidade no formato "Nome da Cidade, UF" (ex: Rio Verde, GO) e coloque o link do mapa no campo de localização.`
    };
  }

  // Regex para formato estrito: "Nome da Cidade, UF"
  const strictPattern = /^(.+),\s*([A-Za-z]{2})$/;
  const match = raw.match(strictPattern);

  if (!match) {
    // Tenta formatar para verificar se é recuperável
    const autoFormatted = formatCityState(raw);
    const autoMatch = autoFormatted.match(strictPattern);
    
    if (autoMatch && BRAZILIAN_UFS.includes(autoMatch[2].toUpperCase() as BrazilianUF)) {
      return {
        isValid: true,
        formatted: `${autoMatch[1].trim()}, ${autoMatch[2].toUpperCase()}`
      };
    }

    // Se não tem vírgula ou separador de estado
    if (!raw.includes(',') && !raw.includes('-') && !raw.includes('/')) {
      return {
        isValid: false,
        formatted: raw,
        errorMessage: `Formato inválido no campo "${fieldName}": "${raw}".\nFaltou informar a sigla do Estado (UF).\n\nForma correta: "Nome da Cidade, UF"\nExemplo: "${formatName(raw)}, GO" ou "Santos, SP"`
      };
    }

    return {
      isValid: false,
      formatted: raw,
      errorMessage: `Formato inválido no campo "${fieldName}": "${raw}".\nO modelo do sistema exige Cidade e UF separados por vírgula.\n\nForma correta: "Nome da Cidade, UF"\nExemplo: "Rio Verde, GO" ou "Santos, SP"`
    };
  }

  const cityName = formatName(match[1].trim());
  const uf = match[2].toUpperCase();

  if (!cityName || cityName.length < 2) {
    return {
      isValid: false,
      formatted: raw,
      errorMessage: `Nome de cidade muito curto no campo "${fieldName}". Informe o nome completo da cidade seguido da UF.\n\nForma correta: "Nome da Cidade, UF"\nExemplo: "Rio Verde, GO"`
    };
  }

  if (!BRAZILIAN_UFS.includes(uf as BrazilianUF)) {
    return {
      isValid: false,
      formatted: raw,
      errorMessage: `UF "${uf}" inválida no campo "${fieldName}".\nInforme uma sigla válida de estado brasileiro (ex: GO, MT, SP, PR, MG, MS, BA, etc.).\n\nForma correta: "${cityName}, UF"\nExemplo: "${cityName}, GO"`
    };
  }

  return {
    isValid: true,
    formatted: `${cityName}, ${uf}`
  };
}

/**
 * Validação simples boolean
 */
export function isValidCity(value: string | undefined | null): boolean {
  return validateCityFormat(value).isValid;
}
