
export interface Client {
  id: string;
  companyId: string;
  name: string;
}

export interface StayRecord {
  id: string;
  companyId: string;
  clientName?: string;
  date: string;
  driver: string;
  plate: string;
  invoice: string;
  origin: string;
  destination: string;
  location: 'Origem' | 'Destino';
  entryDate: string;
  exitDate: string;
  totalHours: number;
  weight: number;
  valuePerHour: number;
  tolerance: number;
  totalValue: number;
}

export interface QuoteRecord {
  id: string;
  companyId: string;
  clientName?: string;
  date: string;
  origin: string;
  destination: string;
  distance: number;
  axes: number;
  cargoType: string;
  inputMode: 'PER_KM' | 'TOTAL' | 'PER_TON';
  valuePerKm: number;
  driverTotalValue: number;
  tollValue: number;
  anttValue: number;
  weight: number;
  margin: number;
  icms: number;
  driverFreightPerTon: number;
  companyFreightPerTon: number;
  companyTotalFreight: number;
  dieselPrice: number;
  averageConsumption: number;
  driverCommissionPercent: number;
  dieselCost: number;
  commissionValue: number;
  carrierNetProfit: number;
  carrierProfitMargin: number;
}

// Client Management
export const getToolClients = (companyId: string): Client[] => {
  try {
    const allClients: Client[] = JSON.parse(localStorage.getItem('dllog_clients') || '[]');
    return allClients.filter(c => c.companyId === companyId);
  } catch {
    return [];
  }
};

export const saveToolClient = (companyId: string, name: string): Client => {
  try {
    const allClients: Client[] = JSON.parse(localStorage.getItem('dllog_clients') || '[]');
    const existing = allClients.find(c => c.companyId === companyId && c.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing;

    const id = `CLI-${String(allClients.length + 1).padStart(3, '0')}`;
    const newClient: Client = { id, companyId, name };
    localStorage.setItem('dllog_clients', JSON.stringify([...allClients, newClient]));
    return newClient;
  } catch (e) {
    console.error('Error saving client:', e);
    return { id: 'TEMP', companyId, name };
  }
};

// Records Management
export const getToolStays = (companyId: string): StayRecord[] => {
  try {
    const allStays: StayRecord[] = JSON.parse(localStorage.getItem('dllog_stays') || '[]');
    // Filter by companyId to keep data isolated per user/company
    return allStays.filter(stay => stay.companyId === companyId);
  } catch {
    return [];
  }
};

export const saveToolStay = (stay: Omit<StayRecord, 'id' | 'date'>): StayRecord => {
  try {
    const allStays: StayRecord[] = JSON.parse(localStorage.getItem('dllog_stays') || '[]');
    const id = `EST-${String(allStays.length + 1).padStart(3, '0')}`;
    const newStay: StayRecord = { ...stay, id, date: new Date().toISOString() };
    localStorage.setItem('dllog_stays', JSON.stringify([newStay, ...allStays]));
    return newStay;
  } catch {
    const id = `EST-001`;
    const newStay: StayRecord = { ...stay, id, date: new Date().toISOString() };
    localStorage.setItem('dllog_stays', JSON.stringify([newStay]));
    return newStay;
  }
};

export const getToolQuotes = (companyId: string): QuoteRecord[] => {
  try {
    const allQuotes: QuoteRecord[] = JSON.parse(localStorage.getItem('dllog_quotes') || '[]');
    return allQuotes.filter(quote => quote.companyId === companyId);
  } catch {
    return [];
  }
};

export const saveToolQuote = (quote: Omit<QuoteRecord, 'id' | 'date'>): QuoteRecord => {
  try {
    const allQuotes: QuoteRecord[] = JSON.parse(localStorage.getItem('dllog_quotes') || '[]');
    const id = `COT-${String(allQuotes.length + 1).padStart(3, '0')}`;
    const newQuote: QuoteRecord = { ...quote, id, date: new Date().toISOString() };
    localStorage.setItem('dllog_quotes', JSON.stringify([newQuote, ...allQuotes]));
    return newQuote;
  } catch {
    const id = `COT-001`;
    const newQuote: QuoteRecord = { ...quote, id, date: new Date().toISOString() };
    localStorage.setItem('dllog_quotes', JSON.stringify([newQuote]));
    return newQuote;
  }
};
