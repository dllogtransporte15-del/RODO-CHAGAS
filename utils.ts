import type { FreightOffer, Cargo } from './types';
import { CargoStatus } from './types';

export const formatId = (num: number, prefix: string, pad: number = 3): string => {
  return `${prefix}-${String(num).padStart(pad, '0')}`;
};

const numberToWordsPtBr = (num: number, gender: 'm' | 'f' = 'm'): string => {
  if (num === 0) return 'zero';

  const unitsM = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  const unitsF = ['', 'uma', 'duas', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  const units = gender === 'm' ? unitsM : unitsF;
  
  const teens = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const tens = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const hundreds = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

  const convertThreeDigits = (n: number, currentGender: 'm' | 'f'): string => {
    if (n === 0) return '';
    if (n === 100) return 'cem';
    
    let res = '';
    const h = Math.floor(n / 100);
    const remainder = n % 100;
    const t = Math.floor(remainder / 10);
    const u = remainder % 10;

    if (h > 0) res += hundreds[h];
    if (h > 0 && remainder > 0) res += ' e ';

    if (t === 1) {
      res += teens[u];
    } else {
      if (t > 1) res += tens[t];
      if (t > 1 && u > 0) res += ' e ';
      if (u > 0 || (h === 0 && t === 0)) {
          if (!(h > 0 && t === 0 && u === 0)) {
              res += (currentGender === 'm' ? unitsM[u] : unitsF[u]);
          }
      }
    }
    return res;
  };

  const millions = Math.floor(num / 1000000);
  const thousands = Math.floor((num % 1000000) / 1000);
  const rest = num % 1000;

  let result = '';
  if (millions > 0) {
      result += convertThreeDigits(millions, 'm') + (millions === 1 ? ' milhão' : ' milhões');
      if (thousands > 0 || rest > 0) result += ' e ';
  }

  if (thousands > 0) {
    if (thousands === 1) {
      result += 'mil';
    } else {
      result += convertThreeDigits(thousands, 'm') + ' mil';
    }
    if (rest > 0) result += ' e ';
  }

  if (rest > 0 || (millions === 0 && thousands === 0)) {
    result += convertThreeDigits(rest, gender);
  }

  return result.trim();
};

export const formatWeightPtBr = (num: number): string => {
  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 1000);

  let result = '';
  
  if (integerPart > 0) {
    result += numberToWordsPtBr(integerPart, 'f') + (integerPart === 1 ? ' tonelada' : ' toneladas');
  }

  if (decimalPart > 0) {
    if (result) result += ' e ';
    result += numberToWordsPtBr(decimalPart, 'm') + (decimalPart === 1 ? ' quilo' : ' quilos');
  }

  return (result || 'zero toneladas').toUpperCase();
};

/**
 * Encontra a carga associada a uma oferta de frete,
 * seja pelo offer.cargoId direto, pelo histórico de logs (Carga #... criada a partir da oferta),
 * ou por dados equivalentes.
 */
export const getMatchedCargo = (offer: FreightOffer, cargos?: Cargo[]): Cargo | null => {
  if (!offer || !cargos || cargos.length === 0) return null;

  // 1. Associação direta via offer.cargoId
  if (offer.cargoId) {
    const directMatch = cargos.find(c => 
      c.id === offer.cargoId || 
      String(c.sequenceId) === offer.cargoId || 
      formatId(c.sequenceId, 'CRG') === offer.cargoId
    );
    if (directMatch) return directMatch;
  }

  // 2. Associação através do histórico de logs da oferta (ex: "Carga #CRG-001 criada a partir da oferta.")
  if (offer.history && offer.history.length > 0) {
    for (let i = offer.history.length - 1; i >= 0; i--) {
      const log = offer.history[i];
      if (log.description && log.description.toLowerCase().includes('criada a partir da oferta')) {
        const match = log.description.match(/Carga\s+#?([^\s.]+)/i);
        if (match && match[1]) {
          const extractedRef = match[1].replace(/[.,]/g, '').trim();
          const logMatch = cargos.find(c => 
            c.id === extractedRef || 
            formatId(c.sequenceId, 'CRG') === extractedRef || 
            String(c.sequenceId) === extractedRef ||
            c.id.toLowerCase() === extractedRef.toLowerCase()
          );
          if (logMatch) return logMatch;
        }
      }
    }
  }

  // 3. Fallback: Associação por dados equivalentes (cliente, produto, origem e destino)
  const isAceita = offer.status === 'Aceita' || offer.status === 'Contraproposta Aceita';
  if (isAceita) {
    const attrMatch = cargos.find(c =>
      c.clientId === offer.clientId &&
      c.productId === offer.productId &&
      c.origin === offer.origin &&
      c.destination === offer.destination &&
      c.status === CargoStatus.EmAndamento
    );
    if (attrMatch) return attrMatch;
  }

  return null;
};

