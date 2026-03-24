
import React, { useState, useMemo, useEffect } from 'react';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  History as HistoryIcon, Search, Filter, Download, FileText, 
  Truck, Calendar, MapPin, User, Trash2, ChevronRight, 
  ArrowRight, DollarSign, Clock, FileDigit, Building2,
  ChevronDown, ChevronUp, X, FileCode
} from 'lucide-react';
import Header from '../components/Header';
import { getToolStays, getToolQuotes, StayRecord, QuoteRecord, getToolClients, Client } from '../utils/toolStorage';
import type { User as AppUser } from '../types';

interface ToolsHistoryPageProps {
  currentUser: AppUser | null;
}

export default function ToolsHistoryPage({ currentUser }: ToolsHistoryPageProps) {
  const companyId = currentUser?.id || 'default';
  const [activeView, setActiveView] = useState<'estadias' | 'cotacoes'>('estadias');
  const [stays, setStays] = useState<StayRecord[]>([]);
  const [quotes, setQuotes] = useState<QuoteRecord[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    setStays(getToolStays(companyId));
    setQuotes(getToolQuotes(companyId));
    setClients(getToolClients(companyId));
  }, [companyId]);

  const filteredStays = useMemo(() => {
    return stays.filter(stay => {
      const matchesSearch = 
        stay.driver.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stay.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stay.origin.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stay.destination.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (stay.clientName && stay.clientName.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesClient = !filterClient || stay.clientName === filterClient;

      let matchesDate = true;
      if (dateStart || dateEnd) {
        const stayDate = parseISO(stay.date);
        const start = dateStart ? startOfDay(parseISO(dateStart)) : new Date(0);
        const end = dateEnd ? endOfDay(parseISO(dateEnd)) : new Date();
        matchesDate = isWithinInterval(stayDate, { start, end });
      }

      return matchesSearch && matchesClient && matchesDate;
    });
  }, [stays, searchTerm, filterClient, dateStart, dateEnd]);

  const filteredQuotes = useMemo(() => {
    return quotes.filter(quote => {
      const matchesSearch = 
        quote.origin.toLowerCase().includes(searchTerm.toLowerCase()) ||
        quote.destination.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (quote.clientName && quote.clientName.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesClient = !filterClient || quote.clientName === filterClient;

      let matchesDate = true;
      if (dateStart || dateEnd) {
        const quoteDate = parseISO(quote.date);
        const start = dateStart ? startOfDay(parseISO(dateStart)) : new Date(0);
        const end = dateEnd ? endOfDay(parseISO(dateEnd)) : new Date();
        matchesDate = isWithinInterval(quoteDate, { start, end });
      }

      return matchesSearch && matchesClient && matchesDate;
    });
  }, [quotes, searchTerm, filterClient, dateStart, dateEnd]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatNumber = (value: number, decimals: number = 2) => {
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const exportToPDF = () => {
    const isStays = activeView === 'estadias';
    const data = isStays ? filteredStays : filteredQuotes;
    if (data.length === 0) return;

    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setFontSize(18);
    doc.text(`Histórico de ${isStays ? 'Estadias' : 'Cotações de Frete'}`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Empresa ID: ${companyId} | Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 28);

    let head: string[][] = [];
    let body: any[][] = [];

    if (isStays) {
      head = [['Data', 'Cliente', 'Motorista', 'Placa', 'Origem', 'Destino', 'Local', 'Valor']];
      body = (data as StayRecord[]).map(s => [
        format(parseISO(s.date), 'dd/MM/yyyy'),
        s.clientName || '-',
        s.driver,
        s.plate,
        s.origin,
        s.destination,
        s.location,
        formatCurrency(s.totalValue)
      ]);
    } else {
      head = [['Data', 'Cliente', 'Origem', 'Destino', 'KM', 'Peso', 'Margem', 'Valor Total']];
      body = (data as QuoteRecord[]).map(q => [
        format(parseISO(q.date), 'dd/MM/yyyy'),
        q.clientName || '-',
        q.origin,
        q.destination,
        `${q.distance.toFixed(0)} km`,
        `${q.weight}t`,
        `${q.carrierProfitMargin.toFixed(1)}%`,
        formatCurrency(q.companyTotalFreight)
      ]);
    }

    autoTable(doc, {
      startY: 35,
      head,
      body,
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] },
      styles: { fontSize: 9 }
    });

    doc.save(`historico_${activeView}_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  return (
    <>
      <Header title="Histórico de Ferramentas" />
      <div className="space-y-6 font-sans">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-700 p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex bg-slate-100 dark:bg-gray-700 p-1 rounded-xl">
              <button onClick={() => { setActiveView('estadias'); setExpandedId(null); }} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeView === 'estadias' ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-600 dark:text-gray-400'}`}>Estadias</button>
              <button onClick={() => { setActiveView('cotacoes'); setExpandedId(null); }} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeView === 'cotacoes' ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-600 dark:text-gray-400'}`}>Cotações</button>
            </div>
            
            <div className="flex-1 max-w-md relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="Pesquisar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl text-sm outline-none outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            <div className="flex items-center gap-3">
              <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center px-4 py-2 rounded-xl text-sm font-medium border ${showFilters ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-white dark:bg-gray-700 text-slate-600 dark:text-gray-300 border-slate-200 dark:border-gray-600'}`}>
                <Filter className="w-4 h-4 mr-2" /> Filtros
              </button>
              <button onClick={exportToPDF} className="p-2 bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300 rounded-lg"><Download className="w-4 h-4" /></button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {(activeView === 'estadias' ? filteredStays : filteredQuotes).length > 0 ? (
            (activeView === 'estadias' ? filteredStays : filteredQuotes).map((item: any) => (
              <div key={item.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="p-4 md:p-6 cursor-pointer" onClick={() => toggleExpand(item.id)}>
                   <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-start space-x-4">
                         <div className="p-3 bg-slate-50 dark:bg-gray-700 rounded-xl text-slate-400">
                            {activeView === 'estadias' ? <Truck className="w-6 h-6" /> : <ArrowRight className="w-6 h-6" />}
                         </div>
                         <div>
                            <h3 className="font-semibold text-slate-900 dark:text-white">
                               {activeView === 'estadias' ? item.driver : `${item.origin} → ${item.destination}`}
                            </h3>
                            <div className="flex items-center mt-1 text-sm text-slate-500 dark:text-gray-400">
                               <Calendar className="w-3.5 h-3.5 mr-1.5" />
                               {format(parseISO(item.date), 'dd/MM/yyyy')}
                               <span className="mx-2">•</span>
                               {item.clientName || 'N/I'}
                            </div>
                         </div>
                      </div>
                      <div className="text-right">
                         <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(activeView === 'estadias' ? item.totalValue : item.companyTotalFreight)}
                         </div>
                         <div className="text-xs text-slate-400">
                            {activeView === 'estadias' ? `${item.plate}` : `${item.distance.toFixed(0)} km`}
                         </div>
                      </div>
                   </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-12 text-center text-slate-400">Nenhum registro encontrado.</div>
          )}
        </div>
      </div>
    </>
  );
}
