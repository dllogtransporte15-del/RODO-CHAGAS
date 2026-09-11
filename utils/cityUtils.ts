import { BRAZILIAN_CITIES } from '../brazilianCities';
import { formatName } from './formatters';

export const BRAZILIAN_UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
] as const;

export type BrazilianUF = typeof BRAZILIAN_UFS[number];

/**
 * Formata a entrada de cidade e estado:
 * 1. O nome da cidade é digitado livremente com espaços preservados para nomes compostos.
 * 2. NENHUMA vírgula é adicionada automaticamente ao clicar em espaço.
 * 3. A vírgula deve ser adicionada MANUALMENTE pelo usuário.
 * 4. Ao adicionar a vírgula, formata o nome da cidade com capitalização e aplica o padrão ", ".
 * 5. Após a vírgula, libera para informar APENAS a sigla da UF (máximo 2 letras, maiúsculas).
 */
export function formatCityState(value: string | undefined | null): string {
  if (!value || typeof value !== 'string') return '';
  if (!value.trim() && value.length > 0) return value; // apenas espaços

  // Verifica se há vírgula inserida manualmente
  const commaIndex = value.indexOf(',');

  if (commaIndex === -1) {
    // SEM VÍRGULA: O usuário está digitando apenas o nome da cidade.
    // Preserva espaços no final para digitação contínua de nomes compostos (ex: "Rio Verde ")
    const trailingSpacesMatch = value.match(/\s+$/);
    const trailingSpaces = trailingSpacesMatch ? trailingSpacesMatch[0] : '';
    const trimmed = value.trim();

    if (!trimmed) return trailingSpaces;

    // Formata o nome da cidade mantendo maiúsculas/minúsculas adequadas
    const formattedName = formatName(trimmed);
    return formattedName + trailingSpaces;
  }

  // COM VÍRGULA: O usuário digitou a vírgula manualmente
  const cityPartRaw = value.slice(0, commaIndex);
  const afterCommaRaw = value.slice(commaIndex + 1);

  // Formata o nome da cidade antes da vírgula
  const trimmedCity = cityPartRaw.trim();
  const formattedCity = trimmedCity ? formatName(trimmedCity) : '';

  // Após a vírgula: libera para informar APENAS letras (máximo 2 letras para a UF, em maiúsculo)
  const ufLetters = afterCommaRaw.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase();

  if (!formattedCity && !ufLetters) {
    return ', ';
  }

  if (ufLetters.length > 0) {
    return `${formattedCity}, ${ufLetters}`;
  }

  // Usuário acabou de digitar a vírgula (ex: "Uberaba,") -> entrega "Uberaba, "
  return `${formattedCity}, `;
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
