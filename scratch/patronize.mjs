import fs from 'fs';
import { formatCPF, formatCpfCnpj, formatPhone, formatName, formatCityState } from '../utils/formatters.ts';

// We need to compile or just copy the formatters logic here so it can run as a plain JS script without TS issues.
// Since it's simple, I'll copy the functions here to avoid TS module resolution issues in node.
const formatCPFLocal = (value) => {
  if (!value) return value;
  const numeric = value.replace(/\D/g, '').slice(0, 11);
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

const PAT = 'sbp_4c9b9e772297e1529c1fd8bdc61e9fa775508d9e';
const PROJECT_REF = 'gyvnhvnuidrfmqzielmv';

async function executeSql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PAT}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SQL Error: ${res.status} - ${text}`);
  }
  return await res.json();
}

async function run() {
  console.log('Fetching drivers...');
  const drivers = await executeSql('SELECT id, name, cpf, phone FROM drivers;');
  let driverUpdates = '';
  for (const row of drivers) {
    const fn = formatNameLocal(row.name);
    const fc = formatCPFLocal(row.cpf);
    const fp = formatPhoneLocal(row.phone);
    if (fn !== row.name || fc !== row.cpf || fp !== row.phone) {
      driverUpdates += `UPDATE drivers SET name = '${fn.replace(/'/g, "''")}', cpf = '${(fc||'').replace(/'/g, "''")}', phone = '${(fp||'').replace(/'/g, "''")}' WHERE id = '${row.id}';\n`;
    }
  }

  console.log('Fetching owners...');
  const owners = await executeSql('SELECT id, name, cpf_cnpj, phone FROM owners;');
  let ownerUpdates = '';
  for (const row of owners) {
    const fn = formatNameLocal(row.name);
    const fc = formatCpfCnpjLocal(row.cpf_cnpj);
    const fp = formatPhoneLocal(row.phone);
    if (fn !== row.name || fc !== row.cpf_cnpj || fp !== row.phone) {
      ownerUpdates += `UPDATE owners SET name = '${fn.replace(/'/g, "''")}', cpf_cnpj = '${(fc||'').replace(/'/g, "''")}', phone = '${(fp||'').replace(/'/g, "''")}' WHERE id = '${row.id}';\n`;
    }
  }

  console.log('Fetching cargos...');
  const cargos = await executeSql('SELECT id, origin, destination FROM cargos;');
  let cargoUpdates = '';
  for (const row of cargos) {
    const fo = formatCityStateLocal(row.origin);
    const fd = formatCityStateLocal(row.destination);
    if (fo !== row.origin || fd !== row.destination) {
      cargoUpdates += `UPDATE cargos SET origin = '${(fo||'').replace(/'/g, "''")}', destination = '${(fd||'').replace(/'/g, "''")}' WHERE id = '${row.id}';\n`;
    }
  }

  console.log('Fetching shipments...');
  const shipments = await executeSql('SELECT id, driver_name, driver_cpf, driver_contact FROM shipments;');
  let shipmentUpdates = '';
  for (const row of shipments) {
    const fn = formatNameLocal(row.driver_name);
    const fc = formatCPFLocal(row.driver_cpf);
    const fp = formatPhoneLocal(row.driver_contact);
    if (fn !== row.driver_name || fc !== row.driver_cpf || fp !== row.driver_contact) {
      shipmentUpdates += `UPDATE shipments SET driver_name = '${(fn||'').replace(/'/g, "''")}', driver_cpf = '${(fc||'').replace(/'/g, "''")}', driver_contact = '${(fp||'').replace(/'/g, "''")}' WHERE id = '${row.id}';\n`;
    }
  }
  
  console.log('Fetching tool_stays...');
  // check if tool_stays exists first
  try {
     const stays = await executeSql('SELECT id, driver, origin, destination FROM tool_stays;');
     let stayUpdates = '';
     for (const row of stays) {
       const fn = formatNameLocal(row.driver);
       const fo = formatCityStateLocal(row.origin);
       const fd = formatCityStateLocal(row.destination);
       if (fn !== row.driver || fo !== row.origin || fd !== row.destination) {
         stayUpdates += `UPDATE tool_stays SET driver = '${(fn||'').replace(/'/g, "''")}', origin = '${(fo||'').replace(/'/g, "''")}', destination = '${(fd||'').replace(/'/g, "''")}' WHERE id = '${row.id}';\n`;
       }
     }
     if (stayUpdates) {
       console.log('Updating tool_stays...', stayUpdates.split('\\n').length, 'queries');
       await executeSql(stayUpdates);
     }
  } catch (e) { console.log('tool_stays might not exist or error', e.message); }

  console.log('Executing updates...');
  if (driverUpdates) {
    console.log(`Executing ${driverUpdates.split('\n').length - 1} driver updates...`);
    await executeSql(driverUpdates);
  }
  if (ownerUpdates) {
    console.log(`Executing ${ownerUpdates.split('\n').length - 1} owner updates...`);
    await executeSql(ownerUpdates);
  }
  if (cargoUpdates) {
    console.log(`Executing ${cargoUpdates.split('\n').length - 1} cargo updates...`);
    await executeSql(cargoUpdates);
  }
  if (shipmentUpdates) {
    console.log(`Executing ${shipmentUpdates.split('\n').length - 1} shipment updates...`);
    await executeSql(shipmentUpdates);
  }

  console.log('Done!');
}

run().catch(console.error);
