import React, { useState, useMemo } from 'react';
import type { Shipment, User, Cargo, Client } from '../../types';
import { ShipmentStatus, UserProfile } from '../../types';
import { 
    Download, 
    List, 
    X, 
    Filter, 
    Search, 
    ShieldCheck, 
    Truck, 
    Clock, 
    CheckCircle2, 
    XCircle, 
    TrendingUp, 
    DollarSign,
    Users,
    Percent,
    Sparkles
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import MultiSelectDropdown from '../MultiSelectDropdown';

import { resolveShipmentRequesterId, getShipmentRequesterUser } from '../../utils/shipperUtils';

interface ShipperReportProps {
  shipments: Shipment[];
  cargos: Cargo[];
  clients: Client[];
  users: User[];
  currentUser: User | null;
  companyLogo?: string | null;
}

export const EFFECTIVE_SHIPMENT_STATUSES: ShipmentStatus[] = [
  ShipmentStatus.AguardandoNota,
  ShipmentStatus.AguardandoAdiantamento,
  ShipmentStatus.AguardandoAgendamento,
  ShipmentStatus.AguardandoDescarga,
  ShipmentStatus.AguardandoPagamentoSaldo,
  ShipmentStatus.Finalizado
];

export const isShipmentEffective = (s: Shipment): boolean => {
  if (s.status === ShipmentStatus.Cancelado) return false;
  if (EFFECTIVE_SHIPMENT_STATUSES.includes(s.status)) return true;
  return !!s.statusHistory?.some(h => EFFECTIVE_SHIPMENT_STATUSES.includes(h.status));
};

interface OperatorStats {
  id: string;
  name: string;
  profile?: UserProfile;
  total: number;
  efetivados: number; // Veículos efetivados (Ag. Nota em diante)
  finalizado: number;
  emAndamento: number;
  cancelado: number;
  effectiveTonnage: number;
  commission: number;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  variant?: 'emerald' | 'blue' | 'amber' | 'cyan' | 'rose' | 'purple' | 'default';
  highlight?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({ 
  title, 
  value, 
  subtitle, 
  icon, 
  variant = 'default',
  highlight = false 
}) => {
  const styles = {
    emerald: {
      card: highlight
        ? 'bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-500/40 dark:border-emerald-500/30 ring-1 ring-emerald-500/20 shadow-sm shadow-emerald-500/5'
        : 'bg-white dark:bg-slate-800/90 border-slate-200/80 dark:border-slate-700/60',
      iconBox: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20',
      value: 'text-emerald-700 dark:text-emerald-300',
    },
    blue: {
      card: 'bg-white dark:bg-slate-800/90 border-slate-200/80 dark:border-slate-700/60',
      iconBox: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/20',
      value: 'text-slate-900 dark:text-white',
    },
    amber: {
      card: 'bg-white dark:bg-slate-800/90 border-slate-200/80 dark:border-slate-700/60',
      iconBox: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20',
      value: 'text-slate-900 dark:text-white',
    },
    cyan: {
      card: 'bg-white dark:bg-slate-800/90 border-slate-200/80 dark:border-slate-700/60',
      iconBox: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 ring-1 ring-cyan-500/20',
      value: 'text-slate-900 dark:text-white',
    },
    rose: {
      card: 'bg-white dark:bg-slate-800/90 border-slate-200/80 dark:border-slate-700/60',
      iconBox: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 ring-1 ring-rose-500/20',
      value: 'text-slate-900 dark:text-white',
    },
    purple: {
      card: 'bg-white dark:bg-slate-800/90 border-slate-200/80 dark:border-slate-700/60',
      iconBox: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 ring-1 ring-purple-500/20',
      value: 'text-slate-900 dark:text-white',
    },
    default: {
      card: 'bg-white dark:bg-slate-800/90 border-slate-200/80 dark:border-slate-700/60',
      iconBox: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 ring-1 ring-slate-500/20',
      value: 'text-slate-900 dark:text-white',
    }
  }[variant];

  return (
    <div className={`relative p-3.5 sm:p-4 rounded-xl border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md flex flex-col justify-between ${styles.card}`}>
      <div className="flex items-center justify-between mb-2 gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
          {title}
        </span>
        <div className={`p-2 rounded-lg shrink-0 ${styles.iconBox}`}>
          {icon}
        </div>
      </div>
      <div>
        <p className={`text-xl sm:text-2xl font-bold tracking-tight ${styles.value} truncate`}>
          {value}
        </p>
        {subtitle && (
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
};

const ShipperReport: React.FC<ShipperReportProps> = ({ shipments, cargos, clients, users, currentUser, companyLogo }) => {
    const [showListModal, setShowListModal] = useState(false);
    const [selectedEmbarcadorId, setSelectedEmbarcadorId] = useState<string | 'ALL'>('ALL');
    const [filterModalStatus, setFilterModalStatus] = useState<string[]>([]);
    const [filterModalOrigin, setFilterModalOrigin] = useState<string[]>([]);
    const [filterModalDest, setFilterModalDest] = useState<string[]>([]);
    const [filterModalDriver, setFilterModalDriver] = useState<string[]>([]);
    const [showModalFilters, setShowModalFilters] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const canViewCommission = useMemo(() => {
        if (!currentUser) return false;
        return [UserProfile.Diretor, UserProfile.Comercial, UserProfile.Admin].includes(currentUser.profile);
    }, [currentUser]);

    const cargoMap = useMemo(() => new Map(cargos.map(c => [c.id, c])), [cargos]);

    const getEmbarcadorId = (s: Shipment) => resolveShipmentRequesterId(s, users);

    // Identifica os IDs dos membros da equipe do usuário logado
    const allowedTeamIds = useMemo(() => {
      const set = new Set<string>();
      if (!currentUser) return set;
      set.add(currentUser.id);
      if (currentUser.profile === UserProfile.AgenciadorLider) {
        users.filter(u => u.leaderId === currentUser.id).forEach(u => set.add(u.id));
      } else if (currentUser.profile === UserProfile.AgenciadorEmbarque) {
        if (currentUser.leaderId) {
          set.add(currentUser.leaderId);
          users.filter(u => u.leaderId === currentUser.leaderId).forEach(u => set.add(u.id));
        }
      }
      return set;
    }, [currentUser, users]);

    const isRestrictedAgent = useMemo(() => {
      if (!currentUser) return false;
      return ![UserProfile.Admin, UserProfile.Diretor].includes(currentUser.profile);
    }, [currentUser]);

    const operatorStats = useMemo<OperatorStats[]>(() => {
        let shipperIds = Array.from(new Set(shipments.map(s => resolveShipmentRequesterId(s, users)).filter(Boolean))) as string[];

        // Escopo e Privacidade: Se não for Admin/Diretoria, restringe exclusivamente à equipe do usuário logado
        if (isRestrictedAgent) {
          shipperIds = shipperIds.filter(id => allowedTeamIds.has(id));
        }

        return shipperIds.map(shipperId => {
            const shipperUser = users.find(u => u.id === shipperId);
            const shipperShipments = shipments.filter(s => resolveShipmentRequesterId(s, users) === shipperId);
          
            const stats = shipperShipments.reduce((acc, shipment) => {
                if (shipment.status === ShipmentStatus.Finalizado) {
                  acc.finalizado += 1;
                } else if (shipment.status === ShipmentStatus.Cancelado) {
                  acc.cancelado += 1;
                } else {
                  acc.emAndamento += 1;
                }

                // Veículos Efetivados: todos aqueles que passaram do status de 'Ag. Nota' em diante (documentação fiscal anexada)
                const isEffective = isShipmentEffective(shipment);
                if (isEffective) {
                    acc.efetivados += 1;
                    acc.effectiveTonnage += shipment.shipmentTonnage || 0;
                }

                return acc;
            }, { efetivados: 0, finalizado: 0, cancelado: 0, emAndamento: 0, effectiveTonnage: 0, commission: 0 });
            
            stats.commission = stats.effectiveTonnage * 2;
    
            return {
                id: shipperId,
                name: shipperUser?.name || `Usuário (${shipperId})`,
                profile: shipperUser?.profile,
                total: shipperShipments.length,
                ...stats,
            };
        }).filter(stat => {
            if (stat.name.trim().toLowerCase() === 'embarcador' && stat.total === 0) return false;
            return stat.total > 0;
        }).sort((a, b) => b.total - a.total);
    }, [shipments, users, isRestrictedAgent, allowedTeamIds]);

    const filteredOperatorStats = useMemo(() => {
        if (!searchTerm.trim()) return operatorStats;
        const term = searchTerm.toLowerCase().trim();
        return operatorStats.filter(stat => 
            stat.name.toLowerCase().includes(term) ||
            (stat.profile && stat.profile.toLowerCase().includes(term))
        );
    }, [operatorStats, searchTerm]);

    const overallTotals = useMemo(() => {
        return filteredOperatorStats.reduce((acc, curr) => ({
            total: acc.total + curr.total,
            efetivados: acc.efetivados + curr.efetivados,
            finalizado: acc.finalizado + curr.finalizado,
            emAndamento: acc.emAndamento + curr.emAndamento,
            cancelado: acc.cancelado + curr.cancelado,
            effectiveTonnage: acc.effectiveTonnage + curr.effectiveTonnage,
            commission: acc.commission + curr.commission
        }), {
            total: 0,
            efetivados: 0,
            finalizado: 0,
            emAndamento: 0,
            cancelado: 0,
            effectiveTonnage: 0,
            commission: 0
        });
    }, [filteredOperatorStats]);

    const getShipmentsForPdfAndList = (embarcadorId?: string) => {
        if (embarcadorId && embarcadorId !== 'ALL') {
            return shipments.filter(s => resolveShipmentRequesterId(s, users) === embarcadorId);
        }
        if (isRestrictedAgent) {
          return shipments.filter(s => allowedTeamIds.has(resolveShipmentRequesterId(s, users)));
        }
        return shipments;
    };

    const baseModalShipments = useMemo(() => {
        if (selectedEmbarcadorId && selectedEmbarcadorId !== 'ALL') {
            return shipments.filter(s => resolveShipmentRequesterId(s, users) === selectedEmbarcadorId);
        }
        if (isRestrictedAgent) {
            return shipments.filter(s => allowedTeamIds.has(resolveShipmentRequesterId(s, users)));
        }
        return shipments;
    }, [shipments, selectedEmbarcadorId, users, isRestrictedAgent, allowedTeamIds]);

    const modalStatusOptions = useMemo(() => Array.from(new Set(baseModalShipments.map(s => s.status))).filter(Boolean).sort(), [baseModalShipments]);
    const modalOriginOptions = useMemo(() => Array.from(new Set(baseModalShipments.map(s => cargoMap.get(s.cargoId)?.origin || ''))).filter(Boolean).sort(), [baseModalShipments, cargoMap]);
    const modalDestOptions = useMemo(() => Array.from(new Set(baseModalShipments.map(s => cargoMap.get(s.cargoId)?.destination || ''))).filter(Boolean).sort(), [baseModalShipments, cargoMap]);
    const modalDriverOptions = useMemo(() => Array.from(new Set(baseModalShipments.map(s => s.driverName))).filter(Boolean).sort(), [baseModalShipments]);

    const filteredModalShipments = useMemo(() => {
        return baseModalShipments.filter(shipment => {
            const cargo = cargoMap.get(shipment.cargoId);
            if (filterModalStatus.length > 0 && !filterModalStatus.includes(shipment.status)) return false;
            if (filterModalOrigin.length > 0 && !filterModalOrigin.includes(cargo?.origin || '')) return false;
            if (filterModalDest.length > 0 && !filterModalDest.includes(cargo?.destination || '')) return false;
            if (filterModalDriver.length > 0 && !filterModalDriver.includes(shipment.driverName)) return false;
            return true;
        });
    }, [baseModalShipments, filterModalStatus, filterModalOrigin, filterModalDest, filterModalDriver, cargoMap]);

    const activeModalFiltersCount = filterModalStatus.length + filterModalOrigin.length + filterModalDest.length + filterModalDriver.length;

    const clearModalFilters = () => {
        setFilterModalStatus([]);
        setFilterModalOrigin([]);
        setFilterModalDest([]);
        setFilterModalDriver([]);
    };

    const generatePDFFromModal = () => {
        const op = selectedEmbarcadorId !== 'ALL' ? operatorStats.find(o => o.id === selectedEmbarcadorId) : null;
        const embarcadorName = selectedEmbarcadorId === 'ALL'
            ? 'Geral'
            : (op ? `${op.name}${op.profile ? ` (${op.profile})` : ''}` : 'Embarcador');

        const filterDesc: string[] = [];
        if (filterModalStatus.length > 0) filterDesc.push(`Status: ${filterModalStatus.join(', ')}`);
        if (filterModalDriver.length > 0) filterDesc.push(`Motorista: ${filterModalDriver.join(', ')}`);
        if (filterModalOrigin.length > 0) filterDesc.push(`Origem: ${filterModalOrigin.join(', ')}`);
        if (filterModalDest.length > 0) filterDesc.push(`Destino: ${filterModalDest.join(', ')}`);

        const doc = new jsPDF('landscape');

        if (companyLogo) {
            try {
                const pageWidth = doc.internal.pageSize.getWidth();
                doc.addImage(companyLogo, 'PNG', pageWidth - 14 - 35, 5, 35, 15);
            } catch (e) {
                console.warn("Could not add company logo to PDF", e);
            }
        }

        doc.setFontSize(16);
        doc.text(`Listagem de Embarques - ${embarcadorName}`, 14, 15);
        doc.setFontSize(10);
        doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 22);
        if (filterDesc.length > 0) {
            doc.setFontSize(8);
            doc.setTextColor(100);
            doc.text(`Filtros: ${filterDesc.join(' | ')}`, 14, 28);
            doc.setTextColor(0);
        }

        const isEmbarcador = currentUser?.profile === UserProfile.Embarcador;
        const startY = filterDesc.length > 0 ? 34 : 28;
        const tableColumn = isEmbarcador
            ? ["ID", "Início", "Fim", "Cliente", "Motorista", "Placa", "Origem", "Destino", "Frete/Ton", "Peso Carregado", "Peso Destino", "Quebra", "Status"]
            : ["ID", "Início", "Fim", "Cliente", "Motorista", "Placa", "Origem", "Destino", "Frete Emp/Ton", "Frete Mot/Ton", "Peso Carregado", "Peso Destino", "Quebra", "Status"];
        const tableRows: any[] = [];

        let totalFreteEmpresa = 0;
        let totalFreteMotorista = 0;
        let totalPesoCarregado = 0;
        let totalPesoDestino = 0;

        const shipmentsForPdf = filteredModalShipments.filter(s => s.status === ShipmentStatus.Finalizado);

        shipmentsForPdf.forEach(shipment => {
            const cargo = cargoMap.get(shipment.cargoId);
            const origem = cargo?.origin || 'N/A';
            const destino = cargo?.destination || 'N/A';
            const cliente = clients.find(c => c.id === cargo?.clientId)?.nomeFantasia || 'N/A';

            const dataInicio = new Date(shipment.createdAt).toLocaleDateString('pt-BR');
            const statusFinalizado = shipment.statusHistory?.find(h => h.status === ShipmentStatus.Finalizado);
            const dataFim = statusFinalizado ? new Date(statusFinalizado.timestamp).toLocaleDateString('pt-BR') : '-';

            const freteEmpresa = shipment.companyFreightRateSnapshot || cargo?.companyFreightValuePerTon || 0;
            const freteMotorista = shipment.driverFreightRateSnapshot || (shipment.driverFreightValue / (shipment.shipmentTonnage || 1));

            const pesoOrigem = shipment.shipmentTonnage || 0;
            const pesoDestino = shipment.unloadedTonnage;

            let quebra = '-';
            if (pesoDestino !== undefined && pesoDestino < pesoOrigem) {
                quebra = (pesoOrigem - pesoDestino).toFixed(2) + ' t';
            }
            
            totalFreteEmpresa += freteEmpresa * pesoOrigem;
            totalFreteMotorista += shipment.driverFreightValue;
            totalPesoCarregado += pesoOrigem;
            if (pesoDestino !== undefined) {
                totalPesoDestino += pesoDestino;
            }

            const fmt = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

            if (isEmbarcador) {
                tableRows.push([
                    shipment.id,
                    dataInicio,
                    dataFim,
                    cliente,
                    shipment.driverName,
                    shipment.horsePlate || '-',
                    origem,
                    destino,
                    fmt(freteMotorista),
                    pesoOrigem.toFixed(2) + ' t',
                    pesoDestino !== undefined ? pesoDestino.toFixed(2) + ' t' : '-',
                    quebra,
                    shipment.status
                ]);
            } else {
                tableRows.push([
                    shipment.id,
                    dataInicio,
                    dataFim,
                    cliente,
                    shipment.driverName,
                    shipment.horsePlate || '-',
                    origem,
                    destino,
                    fmt(freteEmpresa),
                    fmt(freteMotorista),
                    pesoOrigem.toFixed(2) + ' t',
                    pesoDestino !== undefined ? pesoDestino.toFixed(2) + ' t' : '-',
                    quebra,
                    shipment.status
                ]);
            }
        });

        const fmt = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
        
        if (isEmbarcador) {
            tableRows.push([
                "TOTAIS", "-", "-", "-", "-", `Embarques: ${shipmentsForPdf.length}`, "-", "-",
                fmt(totalFreteMotorista),
                totalPesoCarregado.toFixed(2) + ' t',
                totalPesoDestino > 0 ? totalPesoDestino.toFixed(2) + ' t' : '-',
                "-", "-"
            ]);
        } else {
            tableRows.push([
                "TOTAIS", "-", "-", "-", "-", `Embarques: ${shipmentsForPdf.length}`, "-", "-",
                fmt(totalFreteEmpresa),
                fmt(totalFreteMotorista),
                totalPesoCarregado.toFixed(2) + ' t',
                totalPesoDestino > 0 ? totalPesoDestino.toFixed(2) + ' t' : '-',
                "-", "-"
            ]);

            tableRows.push([
                "LÍQUIDO", "-", "-", "-", "-", "-", "-", "-",
                fmt(totalFreteEmpresa - totalFreteMotorista),
                "-", "-", "-", "-", "-"
            ]);
        }

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY,
            theme: 'grid',
            styles: { fontSize: 7.5 },
            headStyles: { fillColor: [29, 59, 141], textColor: 255 },
            didParseCell: (data) => {
                if (data.cell.section === 'body') {
                    const rawRow = data.row.raw;
                    if (Array.isArray(rawRow)) {
                        if (rawRow[0] === 'TOTAIS' || rawRow[0] === 'TOTAL') {
                            data.cell.styles.fillColor = [240, 240, 240];
                            data.cell.styles.fontStyle = 'bold';
                            data.cell.styles.textColor = [0, 0, 0];
                        } else if (rawRow[0] === 'LÍQUIDO') {
                            data.cell.styles.fillColor = [220, 245, 220];
                            data.cell.styles.fontStyle = 'bold';
                            data.cell.styles.textColor = [0, 102, 0];
                        }
                    }
                }
            }
        });

        const suffix = activeModalFiltersCount > 0 ? '_filtrado' : '';
        doc.save(`Listagem_${embarcadorName.replace(/\s+/g, '_')}${suffix}_${new Date().getTime()}.pdf`);
    };

    const generatePDF = (embarcadorId?: string) => {
        // Filter to only export finalized shipments for the PDF
        const targetShipments = getShipmentsForPdfAndList(embarcadorId).filter(s => s.status === ShipmentStatus.Finalizado);
        const op = embarcadorId && embarcadorId !== 'ALL' ? operatorStats.find(o => o.id === embarcadorId) : null;
        const embarcadorName = embarcadorId && embarcadorId !== 'ALL' 
            ? (op ? `${op.name}${op.profile ? ` (${op.profile})` : ''}` : 'Geral')
            : 'Geral';

        const doc = new jsPDF('landscape');

        if (companyLogo) {
            try {
                const pageWidth = doc.internal.pageSize.getWidth();
                doc.addImage(companyLogo, 'PNG', pageWidth - 14 - 35, 5, 35, 15);
            } catch (e) {
                console.warn("Could not add company logo to PDF", e);
            }
        }
        
        doc.setFontSize(16);
        doc.text(`Relatório de Embarques Finalizados - Solicitante: ${embarcadorName || 'Todos'}`, 14, 15);
        doc.setFontSize(10);
        doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 22);

        const isEmbarcador = currentUser?.profile === UserProfile.Embarcador;
        const tableColumn = isEmbarcador
            ? ["ID", "Início", "Fim", "Cliente", "Motorista", "Placa", "Origem", "Destino", "Frete/Ton", "Peso Carregado", "Peso Destino", "Quebra"]
            : ["ID", "Início", "Fim", "Cliente", "Motorista", "Placa", "Origem", "Destino", "Frete Emp/Ton", "Frete Mot/Ton", "Peso Carregado", "Peso Destino", "Quebra"];
        const tableRows: any[] = [];

        let totalFreteEmpresa = 0;
        let totalFreteMotorista = 0;
        let totalPesoCarregado = 0;
        let totalPesoDestino = 0;

        targetShipments.forEach(shipment => {
            const cargo = cargoMap.get(shipment.cargoId);
            const origem = cargo?.origin || 'N/A';
            const destino = cargo?.destination || 'N/A';
            const cliente = clients.find(c => c.id === cargo?.clientId)?.nomeFantasia || 'N/A';
            
            const dataInicio = new Date(shipment.createdAt).toLocaleDateString('pt-BR');
            const statusFinalizado = shipment.statusHistory?.find(h => h.status === ShipmentStatus.Finalizado);
            const dataFim = statusFinalizado ? new Date(statusFinalizado.timestamp).toLocaleDateString('pt-BR') : '-';
            
            const freteEmpresa = shipment.companyFreightRateSnapshot || cargo?.companyFreightValuePerTon || 0;
            const freteMotorista = shipment.driverFreightRateSnapshot || (shipment.driverFreightValue / (shipment.shipmentTonnage || 1));
            
            const pesoOrigem = shipment.shipmentTonnage || 0;
            const pesoDestino = shipment.unloadedTonnage;
            
            let quebra = 'Não';
            if (pesoDestino !== undefined && pesoDestino < pesoOrigem) {
                quebra = (pesoOrigem - pesoDestino).toFixed(2) + ' t';
            }

            totalFreteEmpresa += freteEmpresa * pesoOrigem;
            totalFreteMotorista += shipment.driverFreightValue;
            totalPesoCarregado += pesoOrigem;
            if (pesoDestino !== undefined) {
                totalPesoDestino += pesoDestino;
            }

            const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

            if (isEmbarcador) {
                tableRows.push([
                    shipment.id,
                    dataInicio,
                    dataFim,
                    cliente,
                    shipment.driverName,
                    shipment.horsePlate || '-',
                    origem,
                    destino,
                    formatCurrency(freteMotorista),
                    pesoOrigem.toFixed(2) + ' t',
                    pesoDestino !== undefined ? pesoDestino.toFixed(2) + ' t' : '-',
                    quebra
                ]);
            } else {
                tableRows.push([
                    shipment.id,
                    dataInicio,
                    dataFim,
                    cliente,
                    shipment.driverName,
                    shipment.horsePlate || '-',
                    origem,
                    destino,
                    formatCurrency(freteEmpresa),
                    formatCurrency(freteMotorista),
                    pesoOrigem.toFixed(2) + ' t',
                    pesoDestino !== undefined ? pesoDestino.toFixed(2) + ' t' : '-',
                    quebra
                ]);
            }
        });

        const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

        if (isEmbarcador) {
            tableRows.push([
                "TOTAIS", "-", "-", "-", "-", `Embarques: ${targetShipments.length}`, "-", "-",
                formatCurrency(totalFreteMotorista),
                totalPesoCarregado.toFixed(2) + ' t',
                totalPesoDestino > 0 ? totalPesoDestino.toFixed(2) + ' t' : '-',
                "-"
            ]);
        } else {
            tableRows.push([
                "TOTAIS", "-", "-", "-", "-", `Embarques: ${targetShipments.length}`, "-", "-",
                formatCurrency(totalFreteEmpresa),
                formatCurrency(totalFreteMotorista),
                totalPesoCarregado.toFixed(2) + ' t',
                totalPesoDestino > 0 ? totalPesoDestino.toFixed(2) + ' t' : '-',
                "-"
            ]);

            tableRows.push([
                "LÍQUIDO", "-", "-", "-", "-", "-", "-", "-",
                formatCurrency(totalFreteEmpresa - totalFreteMotorista),
                "-", "-", "-", "-"
            ]);
        }

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 28,
            theme: 'grid',
            styles: { fontSize: 8 },
            headStyles: { fillColor: [29, 59, 141], textColor: 255 },
            didParseCell: (data) => {
                if (data.cell.section === 'body') {
                    const rawRow = data.row.raw;
                    if (Array.isArray(rawRow)) {
                        if (rawRow[0] === 'TOTAIS' || rawRow[0] === 'TOTAL') {
                            data.cell.styles.fillColor = [240, 240, 240];
                            data.cell.styles.fontStyle = 'bold';
                            data.cell.styles.textColor = [0, 0, 0];
                        } else if (rawRow[0] === 'LÍQUIDO') {
                            data.cell.styles.fillColor = [220, 245, 220];
                            data.cell.styles.fontStyle = 'bold';
                            data.cell.styles.textColor = [0, 102, 0];
                        }
                    }
                }
            }
        });

        doc.save(`Relatorio_Embarques_${embarcadorName?.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`);
    };

    const openListModal = (embarcadorId: string) => {
        setSelectedEmbarcadorId(embarcadorId);
        clearModalFilters();
        setShowModalFilters(false);
        setShowListModal(true);
    };

    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    return (
        <div className="space-y-6">
            {/* Top Toolbar: Title, Search, and Global Action Buttons */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                            Desempenho por Embarcador / Solicitante
                        </h2>
                        <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                            {filteredOperatorStats.length} {filteredOperatorStats.length === 1 ? 'operador' : 'operadores'}
                        </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Métricas operacionais, veículos efetivados (Ag. Nota em diante) e comissionamento por solicitante
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
                    {/* Live Search */}
                    <div className="relative flex-1 sm:w-64 sm:flex-initial">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Buscar operador por nome..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-8 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all shadow-sm"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                                title="Limpar busca"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    <button 
                        onClick={() => generatePDF('ALL')}
                        className="inline-flex items-center gap-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white px-4 py-2 rounded-xl font-medium transition-all shadow-sm hover:shadow text-xs"
                    >
                        <Download className="w-4 h-4" /> Baixar PDF Geral
                    </button>
                    <button 
                        onClick={() => openListModal('ALL')}
                        className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl font-medium transition-all shadow-sm hover:shadow text-xs"
                    >
                        <List className="w-4 h-4" /> Listagem Geral
                    </button>
                </div>
            </div>

            {/* Overview Totals Ribbon */}
            {filteredOperatorStats.length > 0 && (
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-800 border border-slate-700/80 shadow-md text-white">
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                            <Sparkles className="w-4 h-4 text-emerald-400" />
                            <span>Visão Consolidada ({filteredOperatorStats.length} {filteredOperatorStats.length === 1 ? 'operador' : 'operadores'})</span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                            Base: Período e filtros ativos
                        </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-800/80">
                        {/* 1. Veículos Efetivados Geral (FIRST) */}
                        <div className="pt-2 sm:pt-0 sm:px-3 first:pl-0">
                            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block">
                                Veículos Efetivados
                            </span>
                            <span className="text-xl sm:text-2xl font-black text-emerald-300 block tracking-tight">
                                {overallTotals.efetivados.toLocaleString('pt-BR')}
                            </span>
                            <span className="text-[10px] text-emerald-400/80 block mt-0.5">Ag. Nota em diante</span>
                        </div>

                        {/* 2. Total de Embarques */}
                        <div className="pt-2 sm:pt-0 sm:px-3">
                            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                                Total Embarques
                            </span>
                            <span className="text-xl sm:text-2xl font-black text-white block tracking-tight">
                                {overallTotals.total.toLocaleString('pt-BR')}
                            </span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">Todos status</span>
                        </div>

                        {/* 3. Taxa de Efetivação */}
                        <div className="pt-2 sm:pt-0 sm:px-3">
                            <span className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider block">
                                Taxa Efetivação
                            </span>
                            <span className="text-xl sm:text-2xl font-black text-cyan-300 block tracking-tight">
                                {overallTotals.total > 0 ? ((overallTotals.efetivados / overallTotals.total) * 100).toFixed(1) : 0}%
                            </span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">Efetivados / Total</span>
                        </div>

                        {/* 4. Toneladas Efetivadas */}
                        <div className="pt-2 sm:pt-0 sm:px-3">
                            <span className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider block">
                                Volume Efetivado
                            </span>
                            <span className="text-xl sm:text-2xl font-black text-purple-300 block tracking-tight">
                                {overallTotals.effectiveTonnage.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} t
                            </span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">Cargas carregadas</span>
                        </div>

                        {/* 5. Finalizados e Em Andamento */}
                        <div className="pt-2 sm:pt-0 sm:px-3">
                            <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider block">
                                Concluídos / Rota
                            </span>
                            <span className="text-xl sm:text-2xl font-black text-amber-300 block tracking-tight">
                                {overallTotals.finalizado} <span className="text-xs text-slate-400 font-normal">/ {overallTotals.emAndamento}</span>
                            </span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">Finalizados vs Em Andamento</span>
                        </div>

                        {/* 6. Comissão ou Cancelados */}
                        {canViewCommission ? (
                            <div className="pt-2 sm:pt-0 sm:px-3">
                                <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block">
                                    Comissão Total
                                </span>
                                <span className="text-xl sm:text-2xl font-black text-emerald-400 block tracking-tight">
                                    {formatCurrency(overallTotals.commission)}
                                </span>
                                <span className="text-[10px] text-slate-400 block mt-0.5">R$ 2,00 / ton efetivada</span>
                            </div>
                        ) : (
                            <div className="pt-2 sm:pt-0 sm:px-3">
                                <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider block">
                                    Cancelados
                                </span>
                                <span className="text-xl sm:text-2xl font-black text-rose-400 block tracking-tight">
                                    {overallTotals.cancelado}
                                </span>
                                <span className="text-[10px] text-slate-400 block mt-0.5">{overallTotals.total > 0 ? ((overallTotals.cancelado / overallTotals.total) * 100).toFixed(1) : 0}% do total</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            {filteredOperatorStats.length === 0 ? (
                <div className="bg-white dark:bg-slate-800/80 rounded-2xl p-10 text-center text-slate-500 dark:text-slate-400 shadow-sm border border-slate-200/80 dark:border-slate-700/60">
                    <p className="text-base font-semibold text-slate-700 dark:text-slate-200">Nenhum solicitante ou embarque encontrado.</p>
                    <p className="text-xs text-slate-400 mt-1">Verifique os filtros de período acima ou o termo de busca pesquisado.</p>
                </div>
            ) : (
                <div className="space-y-4">
                {filteredOperatorStats.map(stats => {
                    const effRate = stats.total > 0 ? Math.round((stats.efetivados / stats.total) * 100) : 0;
                    const initials = stats.name
                        .split(' ')
                        .filter(Boolean)
                        .map(n => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase() || 'OP';

                    return (
                        <div 
                            key={stats.id} 
                            className="bg-white dark:bg-slate-800/90 p-4 sm:p-5 rounded-2xl shadow-sm hover:shadow-md border border-slate-200/80 dark:border-slate-700/70 transition-all duration-200"
                        >
                            {/* Card Header: Avatar, Name, Badges, and Action Buttons */}
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3.5 mb-3.5 border-b border-slate-100 dark:border-slate-700/60">
                                <div className="flex items-center gap-3 flex-wrap">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-primary flex items-center justify-center text-white font-bold text-xs shadow-sm ring-2 ring-white dark:ring-slate-800 shrink-0">
                                        {initials}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                                                {stats.name}
                                            </h3>
                                            {stats.profile && (
                                                <span className="text-[11px] px-2.5 py-0.5 rounded-full font-medium bg-slate-100 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                                                    {stats.profile}
                                                </span>
                                            )}
                                            <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold border ${
                                                effRate >= 70 
                                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
                                                    : effRate >= 40
                                                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'
                                                    : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600'
                                            }`}>
                                                {effRate}% Efetivação ({stats.efetivados}/{stats.total})
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 self-end sm:self-auto">
                                    <button 
                                        onClick={() => generatePDF(stats.id)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/70 border border-rose-200 dark:border-rose-900/60 transition-colors shadow-sm"
                                        title="Baixar PDF de finalizados deste embarcador"
                                    >
                                        <Download className="w-3.5 h-3.5" /> PDF
                                    </button>
                                    <button 
                                        onClick={() => openListModal(stats.id)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-950/70 border border-blue-200 dark:border-blue-900/60 transition-colors shadow-sm"
                                        title="Ver listagem detalhada de todos os embarques deste solicitante"
                                    >
                                        <List className="w-3.5 h-3.5" /> Listagem
                                    </button>
                                </div>
                            </div>

                            {/* Responsive Metrics Grid - VEÍCULOS EFETIVADOS IS FIRST */}
                            <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 ${canViewCommission ? 'xl:grid-cols-7' : 'xl:grid-cols-6'} gap-3`}>
                                {/* 1. VEÍCULOS EFETIVADOS (PRIMEIRO, CONFORME SOLICITADO) */}
                                <MetricCard 
                                    title="Veículos Efetivados" 
                                    value={stats.efetivados} 
                                    subtitle="Ag. Nota em diante" 
                                    variant="emerald" 
                                    highlight={true}
                                    icon={<ShieldCheck className="w-4 h-4" />} 
                                />

                                {/* 2. TOTAL EMBARQUES */}
                                <MetricCard 
                                    title="Total Embarques" 
                                    value={stats.total} 
                                    subtitle="Programados" 
                                    variant="blue" 
                                    icon={<Truck className="w-4 h-4" />} 
                                />

                                {/* 3. EM ANDAMENTO */}
                                <MetricCard 
                                    title="Em Andamento" 
                                    value={stats.emAndamento} 
                                    subtitle="Em trânsito / pátio" 
                                    variant="amber" 
                                    icon={<Clock className="w-4 h-4" />} 
                                />

                                {/* 4. FINALIZADOS */}
                                <MetricCard 
                                    title="Finalizados" 
                                    value={stats.finalizado} 
                                    subtitle="Concluídos" 
                                    variant="cyan" 
                                    icon={<CheckCircle2 className="w-4 h-4" />} 
                                />

                                {/* 5. CANCELADOS */}
                                <MetricCard 
                                    title="Cancelados" 
                                    value={stats.cancelado} 
                                    subtitle={stats.total > 0 ? `${((stats.cancelado / stats.total) * 100).toFixed(0)}% do total` : '0%'} 
                                    variant="rose" 
                                    icon={<XCircle className="w-4 h-4" />} 
                                />

                                {/* 6. TONELADAS EFETIVADAS */}
                                <MetricCard 
                                    title="Toneladas Efetivadas" 
                                    value={`${stats.effectiveTonnage.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t`} 
                                    subtitle="Volume transportado" 
                                    variant="purple" 
                                    icon={<TrendingUp className="w-4 h-4" />} 
                                />

                                {/* 7. COMISSÃO (SE VISÍVEL) */}
                                {canViewCommission && (
                                    <MetricCard 
                                        title="Comissão (R$ 2/t)" 
                                        value={formatCurrency(stats.commission)} 
                                        subtitle="R$ 2,00 / t efetivada" 
                                        variant="emerald" 
                                        icon={<DollarSign className="w-4 h-4" />} 
                                    />
                                )}
                            </div>
                        </div>
                    );
                })}
                </div>
            )}

            {showListModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="flex justify-between items-center p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                    Listagem de Embarques
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {selectedEmbarcadorId === 'ALL' ? 'Todos os Solicitantes / Embarcadores' : (() => {
                                        const op = operatorStats.find(o => o.id === selectedEmbarcadorId);
                                        return `Responsável: ${op?.name || ''}${op?.profile ? ` (${op.profile})` : ''}`;
                                    })()}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={generatePDFFromModal}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800"
                                    title={activeModalFiltersCount > 0 ? 'Baixar PDF com filtros aplicados' : 'Baixar PDF completo'}
                                >
                                    <Download className="w-4 h-4" />
                                    PDF {activeModalFiltersCount > 0 && <span className="ml-1 bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{filteredModalShipments.length}</span>}
                                </button>
                                <button 
                                    onClick={() => setShowModalFilters(!showModalFilters)}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium ${showModalFilters || activeModalFiltersCount > 0 ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'}`}
                                >
                                    <Filter className="w-4 h-4" /> Filtros {activeModalFiltersCount > 0 && `(${activeModalFiltersCount})`}
                                </button>
                                <button
                                    onClick={() => setShowListModal(false)}
                                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        {showModalFilters && (
                            <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-900/20">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <MultiSelectDropdown label="Status" options={modalStatusOptions} selectedValues={filterModalStatus} onChange={setFilterModalStatus} placeholder="Todos..." />
                                    <MultiSelectDropdown label="Motorista" options={modalDriverOptions} selectedValues={filterModalDriver} onChange={setFilterModalDriver} placeholder="Todos..." />
                                    <MultiSelectDropdown label="Origem" options={modalOriginOptions} selectedValues={filterModalOrigin} onChange={setFilterModalOrigin} placeholder="Todas..." />
                                    <MultiSelectDropdown label="Destino" options={modalDestOptions} selectedValues={filterModalDest} onChange={setFilterModalDest} placeholder="Todos..." />
                                </div>
                                {activeModalFiltersCount > 0 && (
                                    <div className="mt-3 flex justify-end">
                                        <button onClick={clearModalFilters} className="text-xs flex items-center gap-1 text-red-600 hover:text-red-700 dark:text-red-400">
                                            <X className="w-3.5 h-3.5" /> Limpar Filtros
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="p-0 overflow-auto flex-1">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0 shadow-sm">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">ID / Motorista</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Datas (Início/Fim)</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Placa</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cliente</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Rota (Origem → Destino)</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{currentUser?.profile === UserProfile.Embarcador ? 'Frete (/Ton)' : 'Valores (/Ton)'}</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Pesos (Orig. / Dest.)</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                    {filteredModalShipments.map((shipment) => {
                                        const cargo = cargoMap.get(shipment.cargoId);
                                        const origem = cargo?.origin || 'N/A';
                                        const destino = cargo?.destination || 'N/A';
                                        const clienteNome = clients.find(c => c.id === cargo?.clientId)?.nomeFantasia || '-';
                                        
                                        const dataInicio = new Date(shipment.createdAt).toLocaleDateString('pt-BR');
                                        const statusFinalizado = shipment.statusHistory?.find(h => h.status === ShipmentStatus.Finalizado);
                                        const dataFim = statusFinalizado ? new Date(statusFinalizado.timestamp).toLocaleDateString('pt-BR') : '-';

                                        const freteEmpresa = shipment.companyFreightRateSnapshot || cargo?.companyFreightValuePerTon || 0;
                                        const freteMotorista = shipment.driverFreightRateSnapshot || (shipment.driverFreightValue / (shipment.shipmentTonnage || 1));
                                        
                                        const pesoOrigem = shipment.shipmentTonnage || 0;
                                        const pesoDestino = shipment.unloadedTonnage;
                                        let quebra = null;
                                        if (pesoDestino !== undefined && pesoDestino < pesoOrigem) {
                                             quebra = (pesoOrigem - pesoDestino).toFixed(2);
                                        }

                                        return (
                                            <tr key={shipment.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-bold text-gray-900 dark:text-white">{shipment.id}</div>
                                                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{shipment.driverName}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex flex-col gap-1 text-sm">
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-gray-500 dark:text-gray-400">Início:</span>
                                                            <span className="font-medium text-gray-900 dark:text-gray-200">{dataInicio}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-gray-500 dark:text-gray-400">Fim:</span>
                                                            <span className="font-medium text-gray-900 dark:text-gray-200">{dataFim}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="text-sm font-bold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded border border-gray-200 dark:border-gray-600">
                                                        {shipment.horsePlate || '-'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{clienteNome}</span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex flex-col gap-1 text-sm">
                                                        <span className="font-medium text-gray-900 dark:text-white">{origem}</span>
                                                        <span className="text-gray-400 text-xs">para</span>
                                                        <span className="font-medium text-gray-900 dark:text-white">{destino}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                    <div className="flex flex-col gap-1">
                                                        {currentUser?.profile !== UserProfile.Embarcador && (
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-xs text-gray-500 font-medium">Empresa:</span>
                                                                <span className="font-bold text-primary dark:text-blue-400">{formatCurrency(freteEmpresa)}</span>
                                                            </div>
                                                        )}
                                                        <div className="flex items-center justify-between">
                                                            {currentUser?.profile !== UserProfile.Embarcador && <span className="text-xs text-gray-500 font-medium">Motorista:</span>}
                                                            <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(freteMotorista)}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs text-gray-500">Origem:</span>
                                                            <span className="font-medium dark:text-gray-300">{pesoOrigem.toFixed(2)} t</span>
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs text-gray-500">Destino:</span>
                                                            <span className="font-medium dark:text-gray-300">{pesoDestino !== undefined ? `${pesoDestino.toFixed(2)} t` : '-'}</span>
                                                        </div>
                                                        {quebra && (
                                                            <div className="flex items-center justify-between mt-1 pt-1 border-t border-gray-100 dark:border-gray-700">
                                                                <span className="text-[10px] text-red-500 font-bold uppercase">Quebra:</span>
                                                                <span className="text-xs text-red-600 font-bold">{quebra} t</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                    <div className="flex flex-col gap-1 items-start">
                                                        <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                            shipment.status === ShipmentStatus.Finalizado
                                                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                                                                : shipment.status === ShipmentStatus.Cancelado
                                                                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60'
                                                                : 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60'
                                                        }`}>
                                                            {shipment.status}
                                                        </span>
                                                        {isShipmentEffective(shipment) && (
                                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                                                Efetivado
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ShipperReport;
