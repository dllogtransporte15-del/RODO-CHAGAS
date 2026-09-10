import { supabase } from '../supabase';
import type { RecipientClient } from '../types';
export type { RecipientClient };

const STORAGE_KEY = 'hts_recipient_clients';

export const getStoredRecipientClients = (): RecipientClient[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading recipient clients from localStorage:', e);
  }
  return [];
};

export const fetchRecipientClients = async (clientId?: string): Promise<RecipientClient[]> => {
  let list = getStoredRecipientClients();
  try {
    let query = supabase.from('recipient_clients').select('*');
    if (clientId) {
      query = query.or(`client_id.eq.${clientId},client_id.is.null`);
    }
    const { data, error } = await query.order('name', { ascending: true });
    if (!error && data && data.length > 0) {
      const dbList: RecipientClient[] = data.map((row: any) => ({
        id: row.id,
        clientId: row.client_id,
        name: row.name,
        cpfCnpj: row.cpf_cnpj,
        phone: row.phone,
        createdAt: row.created_at,
      }));
      const map = new Map<string, RecipientClient>();
      dbList.forEach(item => map.set(item.id || item.name, item));
      list.forEach(item => {
        if (!map.has(item.id || item.name)) map.set(item.id || item.name, item);
      });
      list = Array.from(map.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    }
  } catch (err) {
    console.warn('Recipient clients database fetch fallback:', err);
  }

  if (clientId) {
    return list.filter(r => !r.clientId || r.clientId === clientId);
  }
  return list;
};

export const saveRecipientClient = async (
  recipient: Omit<RecipientClient, 'id' | 'createdAt'> & { id?: string }
): Promise<RecipientClient> => {
  const newRecipient: RecipientClient = {
    id: recipient.id || `REC-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    clientId: recipient.clientId,
    name: recipient.name.trim(),
    cpfCnpj: recipient.cpfCnpj.trim(),
    phone: recipient.phone?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };

  // 1. Save to LocalStorage immediately
  const existing = getStoredRecipientClients();
  const filtered = existing.filter(r => r.id !== newRecipient.id && r.name.toLowerCase() !== newRecipient.name.toLowerCase());
  const updated = [newRecipient, ...filtered];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

  // 2. Try Supabase upsert
  try {
    await supabase.from('recipient_clients').upsert({
      id: newRecipient.id,
      client_id: newRecipient.clientId || null,
      name: newRecipient.name,
      cpf_cnpj: newRecipient.cpfCnpj,
      phone: newRecipient.phone || null,
      created_at: newRecipient.createdAt,
    });
  } catch (err) {
    console.warn('Could not save recipient_client to supabase table, cached in localStorage:', err);
  }

  return newRecipient;
};

export const deleteRecipientClient = async (id: string): Promise<void> => {
  const existing = getStoredRecipientClients();
  const updated = existing.filter(r => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

  try {
    await supabase.from('recipient_clients').delete().eq('id', id);
  } catch (err) {
    console.warn('Error deleting recipient client from DB:', err);
  }
};
