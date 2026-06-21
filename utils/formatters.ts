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

export const formatCityState = (value: string): string => {
  // Try to parse "Cidade, UF"
  const commaIndex = value.indexOf(',');
  if (commaIndex !== -1) {
    const city = formatName(value.slice(0, commaIndex).trim());
    const statePart = value.slice(commaIndex + 1).replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase();
    return statePart ? `${city}, ${statePart}` : `${city}, `;
  }

  // Handle typing like "Goiania GO" without comma
  const spaceParts = value.split(/[\s-]+/);
  if (spaceParts.length > 1) {
    const possibleState = spaceParts[spaceParts.length - 1];
    if (possibleState.length === 2 && !possibleState.includes(',')) {
      const city = formatName(spaceParts.slice(0, -1).join(' ').trim());
      const state = possibleState.toUpperCase();
      return `${city}, ${state}`;
    }
  }

  return formatName(value);
};

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

export const autoFormatInput = (name: string, value: string): string => {
  if (!value) return value;
  
  const lowerName = name.toLowerCase();
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
    return formatCityState(value);
  }
  if (lowerName.includes('name') || lowerName.includes('nome') || lowerName === 'driver' || lowerName === 'client') {
    return formatName(value);
  }
  return value;
};

