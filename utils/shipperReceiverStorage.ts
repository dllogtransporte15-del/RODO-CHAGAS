import { supabase } from '../supabase';
import type { ShipperReceiver } from '../types';

export type { ShipperReceiver };

const STORAGE_KEY = 'rodochagas_shippers_receivers';

export const getStoredShipperReceivers = (): ShipperReceiver[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading shipper/receivers from localStorage:', e);
  }
  return [];
};

export const fetchShipperReceivers = async (): Promise<ShipperReceiver[]> => {
  let list = getStoredShipperReceivers();
  try {
    const { data, error } = await supabase
      .from('shippers_receivers')
      .select('*')
      .order('name', { ascending: true });

    if (!error && data && data.length > 0) {
      const dbList: ShipperReceiver[] = data.map((row: any) => ({
        id: row.id,
        name: row.name,
        documentType: row.document_type || (row.document_number?.length > 14 ? 'CNPJ' : 'CPF'),
        documentNumber: row.document_number || '',
        phone: row.phone || undefined,
        isWhatsapp: row.is_whatsapp ?? true,
        type: row.type || 'ambos',
        city: row.city || undefined,
        state: row.state || undefined,
        address: row.address || undefined,
        mapLink: row.map_link || undefined,
        notes: row.notes || undefined,
        createdAt: row.created_at,
      }));

      const map = new Map<string, ShipperReceiver>();
      dbList.forEach(item => map.set(item.id || item.name.toLowerCase().trim(), item));
      list.forEach(item => {
        const key = item.id || item.name.toLowerCase().trim();
        if (!map.has(key)) map.set(key, item);
      });
      list = Array.from(map.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    }
  } catch (err) {
    console.warn('Shipper/Receivers database fetch fallback to localStorage:', err);
  }

  return list;
};

export const saveShipperReceiver = async (
  item: Omit<ShipperReceiver, 'id' | 'createdAt'> & { id?: string; createdAt?: string }
): Promise<ShipperReceiver> => {
  const cleanName = item.name.trim();
  const newRecord: ShipperReceiver = {
    id: item.id || `EXP-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: cleanName,
    documentType: item.documentType || 'CNPJ',
    documentNumber: item.documentNumber.trim(),
    phone: item.phone?.trim() || undefined,
    isWhatsapp: item.isWhatsapp ?? true,
    type: item.type || 'ambos',
    city: item.city?.trim() || undefined,
    state: item.state?.trim() || undefined,
    address: item.address?.trim() || undefined,
    mapLink: item.mapLink?.trim() || undefined,
    notes: item.notes?.trim() || undefined,
    createdAt: item.createdAt || new Date().toISOString(),
  };

  // 1. Save to LocalStorage immediately
  const existing = getStoredShipperReceivers();
  const filtered = existing.filter(
    r => r.id !== newRecord.id && r.name.toLowerCase().trim() !== cleanName.toLowerCase()
  );
  const updated = [newRecord, ...filtered];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

  // 2. Try Supabase upsert
  try {
    await supabase.from('shippers_receivers').upsert({
      id: newRecord.id,
      name: newRecord.name,
      document_type: newRecord.documentType,
      document_number: newRecord.documentNumber,
      phone: newRecord.phone || null,
      is_whatsapp: newRecord.isWhatsapp,
      type: newRecord.type,
      city: newRecord.city || null,
      state: newRecord.state || null,
      address: newRecord.address || null,
      map_link: newRecord.mapLink || null,
      notes: newRecord.notes || null,
      created_at: newRecord.createdAt,
    });
  } catch (err) {
    console.warn('Could not save shippers_receivers to Supabase, cached locally:', err);
  }

  return newRecord;
};

export const deleteShipperReceiver = async (id: string): Promise<void> => {
  const existing = getStoredShipperReceivers();
  const updated = existing.filter(r => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

  try {
    await supabase.from('shippers_receivers').delete().eq('id', id);
  } catch (err) {
    console.warn('Error deleting shipper/receiver from DB:', err);
  }
};

export const findShipperReceiverByName = (name: string | undefined | null): ShipperReceiver | undefined => {
  if (!name || !name.trim()) return undefined;
  const list = getStoredShipperReceivers();
  const normalized = name.toLowerCase().trim();
  return list.find(r => r.name.toLowerCase().trim() === normalized);
};
