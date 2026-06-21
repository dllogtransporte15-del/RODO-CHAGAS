import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gyvnhvnuidrfmqzielmv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dm5odm51aWRyZm1xemllbG12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTY5ODksImV4cCI6MjA4OTU5Mjk4OX0.dK_l3INxOB9_HVYte43PCXFQLe8DnXgPitcxhNK4x30';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const formatCPFLocal = (value) => {
  if (!value) return value;
  const numeric = value.replace(/\D/g, '').slice(0, 11);
  if (numeric.length === 0) return '';
  return numeric.replace(/(\d{3})(\d{3})?(\d{3})?(\d{2})?/, (_, p1, p2, p3, p4) => {
    let res = p1;
    if (p2) res += `.${p2}`;
    if (p3) res += `.${p3}`;
    if (p4) res += `-${p4}`;
    return res;
  });
};

const formatCpfCnpjLocal = (value) => {
  if (!value) return value;
  const numeric = value.replace(/\D/g, '').slice(0, 14);
  if (numeric.length === 0) return '';
  if (numeric.length <= 11) {
    return formatCPFLocal(numeric);
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

const formatPhoneLocal = (value) => {
  if (!value) return value;
  const numeric = value.replace(/\D/g, '').slice(0, 11);
  if (numeric.length === 0) return '';
  if (numeric.length <= 2) return `(${numeric}`;
  if (numeric.length <= 6) return `(${numeric.slice(0, 2)}) ${numeric.slice(2)}`;
  if (numeric.length <= 10) return `(${numeric.slice(0, 2)}) ${numeric.slice(2, 6)}-${numeric.slice(6)}`;
  return `(${numeric.slice(0, 2)}) ${numeric.slice(2, 7)}-${numeric.slice(7)}`;
};

const formatNameLocal = (value) => {
  if (!value) return value;
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

const formatCityStateLocal = (value) => {
  if (!value) return value;
  const commaIndex = value.indexOf(',');
  if (commaIndex !== -1) {
    const city = formatNameLocal(value.slice(0, commaIndex).trim());
    const statePart = value.slice(commaIndex + 1).replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase();
    return statePart ? `${city}, ${statePart}` : `${city}, `;
  }

  const spaceParts = value.split(/[\s-]+/);
  if (spaceParts.length > 1) {
    const possibleState = spaceParts[spaceParts.length - 1];
    if (possibleState.length === 2 && !possibleState.includes(',')) {
      const city = formatNameLocal(spaceParts.slice(0, -1).join(' ').trim());
      const state = possibleState.toUpperCase();
      return `${city}, ${state}`;
    }
  }

  return formatNameLocal(value);
};

async function fetchAll(table, selectStr) {
  let all = [];
  let start = 0;
  const limit = 1000;
  while (true) {
    const { data, error } = await supabase.from(table).select(selectStr).range(start, start + limit - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < limit) break;
    start += limit;
  }
  return all;
}

const batchProcess = async (items, batchSize, processFn) => {
  let count = 0;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(batch.map(processFn));
    count += batch.length;
    console.log(`Processed ${count}/${items.length}`);
  }
};

async function run() {
  console.log('--- DRIVERS ---');
  const drivers = await fetchAll('drivers', 'id, name, cpf, phone');
  const dUpdates = drivers.map(row => {
    const fn = formatNameLocal(row.name);
    const fc = formatCPFLocal(row.cpf);
    const fp = formatPhoneLocal(row.phone);
    if (fn !== row.name || fc !== row.cpf || fp !== row.phone) {
      return { id: row.id, name: fn, cpf: fc, phone: fp };
    }
    return null;
  }).filter(Boolean);
  await batchProcess(dUpdates, 50, item => supabase.from('drivers').update({ name: item.name, cpf: item.cpf, phone: item.phone }).eq('id', item.id));

  console.log('--- OWNERS ---');
  const owners = await fetchAll('owners', 'id, name, cpf_cnpj, phone');
  const oUpdates = owners.map(row => {
    const fn = formatNameLocal(row.name);
    const fc = formatCpfCnpjLocal(row.cpf_cnpj);
    const fp = formatPhoneLocal(row.phone);
    if (fn !== row.name || fc !== row.cpf_cnpj || fp !== row.phone) {
      return { id: row.id, name: fn, cpf_cnpj: fc, phone: fp };
    }
    return null;
  }).filter(Boolean);
  await batchProcess(oUpdates, 50, item => supabase.from('owners').update({ name: item.name, cpf_cnpj: item.cpf_cnpj, phone: item.phone }).eq('id', item.id));

  console.log('--- CLIENTS ---');
  const clients = await fetchAll('clients', 'id, razao_social, nome_fantasia, cnpj, phone, city, state');
  const cUpdates = clients.map(row => {
    const fnR = formatNameLocal(row.razao_social);
    const fnF = formatNameLocal(row.nome_fantasia);
    const fCnpj = formatCpfCnpjLocal(row.cnpj);
    const fp = formatPhoneLocal(row.phone);
    const fCity = formatNameLocal(row.city);
    const fState = row.state ? row.state.toUpperCase() : row.state;
    if (fnR !== row.razao_social || fnF !== row.nome_fantasia || fCnpj !== row.cnpj || fp !== row.phone || fCity !== row.city || fState !== row.state) {
      return { id: row.id, razao_social: fnR, nome_fantasia: fnF, cnpj: fCnpj, phone: fp, city: fCity, state: fState };
    }
    return null;
  }).filter(Boolean);
  await batchProcess(cUpdates, 50, item => supabase.from('clients').update({ 
        razao_social: item.razao_social, nome_fantasia: item.nome_fantasia, cnpj: item.cnpj, phone: item.phone, city: item.city, state: item.state 
      }).eq('id', item.id));

  console.log('--- CARGOS ---');
  const cargos = await fetchAll('cargos', 'id, origin, destination');
  const cgUpdates = cargos.map(row => {
    const fo = formatCityStateLocal(row.origin);
    const fd = formatCityStateLocal(row.destination);
    if (fo !== row.origin || fd !== row.destination) {
      return { id: row.id, origin: fo, destination: fd };
    }
    return null;
  }).filter(Boolean);
  await batchProcess(cgUpdates, 50, item => supabase.from('cargos').update({ origin: item.origin, destination: item.destination }).eq('id', item.id));

  console.log('--- SHIPMENTS ---');
  const shipments = await fetchAll('shipments', 'id, driver_name, driver_cpf, driver_contact, owner_contact');
  const sUpdates = shipments.map(row => {
    const fn = formatNameLocal(row.driver_name);
    const fc = formatCPFLocal(row.driver_cpf);
    const fp = formatPhoneLocal(row.driver_contact);
    const fop = formatPhoneLocal(row.owner_contact);
    if (fn !== row.driver_name || fc !== row.driver_cpf || fp !== row.driver_contact || fop !== row.owner_contact) {
      return { id: row.id, driver_name: fn, driver_cpf: fc, driver_contact: fp, owner_contact: fop };
    }
    return null;
  }).filter(Boolean);
  await batchProcess(sUpdates, 50, item => supabase.from('shipments').update({ 
        driver_name: item.driver_name, driver_cpf: item.driver_cpf, driver_contact: item.driver_contact, owner_contact: item.owner_contact 
      }).eq('id', item.id));
      
  console.log('--- TOOL STAYS ---');
  try {
      const stays = await fetchAll('tool_stays', 'id, driver, origin, destination');
      const staysUpd = stays.map(row => {
        const fn = formatNameLocal(row.driver);
        const fo = formatCityStateLocal(row.origin);
        const fd = formatCityStateLocal(row.destination);
        if (fn !== row.driver || fo !== row.origin || fd !== row.destination) {
           return { id: row.id, driver: fn, origin: fo, destination: fd };
        }
        return null;
      }).filter(Boolean);
      await batchProcess(staysUpd, 50, item => supabase.from('tool_stays').update({ driver: item.driver, origin: item.origin, destination: item.destination }).eq('id', item.id));
  } catch(e) { console.log('Skipping tool_stays', e.message); }

  console.log('--- TOOL QUOTES ---');
  try {
      const quotes = await fetchAll('tool_quotes', 'id, origin, destination');
      const quotesUpd = quotes.map(row => {
        const fo = formatCityStateLocal(row.origin);
        const fd = formatCityStateLocal(row.destination);
        if (fo !== row.origin || fd !== row.destination) {
           return { id: row.id, origin: fo, destination: fd };
        }
        return null;
      }).filter(Boolean);
      await batchProcess(quotesUpd, 50, item => supabase.from('tool_quotes').update({ origin: item.origin, destination: item.destination }).eq('id', item.id));
  } catch(e) { console.log('Skipping tool_quotes', e.message); }

  console.log('Done!');
}

run().catch(console.error);
