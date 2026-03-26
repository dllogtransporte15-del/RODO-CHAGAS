
import React, { useMemo } from 'react';
import Card from '../components/Card';
import Header from '../components/Header';
import DonutChartCard from '../components/DonutChartCard';
import ShipmentFunnelCard from '../components/ShipmentFunnelCard';
import ShipperRankingCard from '../components/ShipperRankingCard';
import { TruckIcon } from '../components/icons/TruckIcon';
import { PackageIcon } from '../components/icons/PackageIcon';
import { DollarSignIcon } from '../components/icons/DollarSignIcon';
import { ClientsIcon } from '../components/icons/ClientsIcon';
import type { Cargo, Shipment, User } from '../types';
import { CargoStatus, ShipmentStatus, UserProfile } from '../types';
import ShipmentDetailsModal from '../components/ShipmentDetailsModal';

interface DashboardPageProps {
  cargos: Cargo[];
  shipments: Shipment[];
  users: User[];
  currentUser: User | null;
}

interface ShipmentListCardProps {
  title: string;
  shipments: Shipment[];
  users: User[];
  thresholds?: { yellow: number; red: number }; // in minutes
  onShowDetails?: (shipment: Shipment) => void;
}

const ShipmentListCard: React.FC<ShipmentListCardProps> = ({ title, shipments, users, thresholds, onShowDetails }) => {
  const getEmbarcadorName = (embarcadorId: string): string => {
    return users.find(u => u.id === embarcadorId)?.name || 'N/A';
  };
  
  const getElapsedTimeColor = (startTime: string): string => {
    if (!thresholds) return 'text-gray-800 dark:text-gray-200';

    const start = new Date(startTime).getTime();
    const now = Date.now();
    const diffMinutes = Math.floor((now - start) / (1000 * 60));

    if (diffMinutes > thresholds.red) {
      return 'text-red-500 dark:text-red-400';
    }
    if (diffMinutes > thresholds.yellow) {
      return 'text-yellow-500 dark:text-yellow-400';
    }
    return 'text-gray-800 dark:text-gray-200';
  };


  const formatElapsedTime = (startTime: string): string => {
      const start = new Date(startTime).getTime();
      const now = Date.now();
      const diffMinutes = Math.floor((now - start) / (1000 * 60));

      if (diffMinutes < 1) return '< 1 min';
      if (diffMinutes < 60) return `${diffMinutes} min`;

      const diffHours = Math.floor(diffMinutes / 60);
      if (diffHours < 24) {
          const remainingMinutes = diffMinutes % 60;
          return `${diffHours}h ${remainingMinutes}m`;
      }

      const diffDays = Math.floor(diffHours / 24);
      const remainingHours = diffHours % 24;
      return `${diffDays}d ${remainingHours}h`;
  };

  const formatDate = (timestamp: string) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md col-span-1 lg:col-span-1">
      <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4">{title} ({shipments.length})</h3>
      <div className="max-h-80 overflow-y-auto space-y-3 pr-2">
        {shipments.length > 0 ? (
          shipments.map(shipment => {
            const currentStatusEntry = shipment.statusHistory?.[shipment.statusHistory.length - 1];
            const requestTimestamp = currentStatusEntry?.timestamp || shipment.createdAt;
            const timeColorClass = getElapsedTimeColor(requestTimestamp);
            
            return (
                <div key={shipment.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md border-l-4 border-primary">
                    <div className="flex justify-between items-start">
                        <div>
                            {onShowDetails ? (
                                <button
                                    onClick={() => onShowDetails(shipment)}
                                    className="font-mono text-xs text-primary dark:text-blue-400 font-bold mb-1 hover:underline text-left"
                                >
                                    {shipment.id}
                                </button>
                            ) : (
                                <p className="font-mono text-xs text-gray-500 mb-1">{shipment.id}</p>
                            )}
                            <p className="font-semibold text-gray-900 dark:text-white truncate">{shipment.driverName}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-300">{shipment.horsePlate}</p>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                            <p className={`font-bold text-sm ${timeColorClass}`} title="Tempo de espera no status atual">{formatElapsedTime(requestTimestamp)}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(requestTimestamp)}</p>
                        </div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Solicitante: {getEmbarcadorName(shipment.embarcadorId)}</p>
                </div>
            )
          })
        ) : (
          <p className="text-sm text-center text-gray-500 dark:text-gray-400 pt-8">Nenhum embarque neste status.</p>
        )}
      </div>
    </div>
  );
};


const DashboardPage: React.FC<DashboardPageProps> = ({ cargos, shipments, users, currentUser }) => {
  const [detailsModalShipment, setDetailsModalShipment] = React.useState<Shipment | null>(null);

  const cargoStatusData = useMemo(() => {
    const counts = cargos.reduce((acc, cargo) => {
      acc[cargo.status] = (acc[cargo.status] || 0) + 1;
      return acc;
    }, {} as Record<CargoStatus, number>);

    return [
      { label: CargoStatus.EmAndamento, value: counts[CargoStatus.EmAndamento] || 0, color: 'bg-blue-500' },
      { label: CargoStatus.Suspensa, value: counts[CargoStatus.Suspensa] || 0, color: 'bg-gray-500' },
      { label: CargoStatus.Fechada, value: counts[CargoStatus.Fechada] || 0, color: 'bg-blue-300' },
    ];
  }, [cargos]);

  const shipmentStatusData = useMemo(() => {
    const statusOrder = Object.values(ShipmentStatus);
    const counts = shipments.reduce((acc, shipment) => {
      acc[shipment.status] = (acc[shipment.status] || 0) + 1;
      return acc;
    }, {} as Record<ShipmentStatus, number>);

    return statusOrder.map(status => ({
      label: status,
      value: counts[status] || 0,
    }));
  }, [shipments]);
  
  const activeShipments = useMemo(() => {
    return shipments.filter(s => s.status !== ShipmentStatus.Finalizado).length;
  }, [shipments]);

  const pendingLoads = useMemo(() => {
    return cargos.filter(c => c.status === CargoStatus.EmAndamento).length;
  }, [cargos]);

  const canViewRanking = useMemo(() => {
    if (!currentUser) return false;
    return [UserProfile.Comercial, UserProfile.Supervisor, UserProfile.Admin, UserProfile.Diretor].includes(currentUser.profile);
  }, [currentUser]);

  const dashboardStats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let monthlyEffectiveTonnage = 0;
    
    shipments.forEach(s => {
      const isEffective = ![ShipmentStatus.PreCadastro, ShipmentStatus.AguardandoSeguradora, ShipmentStatus.AguardandoCarregamento, ShipmentStatus.Cancelado].includes(s.status);
      if (isEffective) {
        const date = new Date(s.createdAt);
        if (date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
          monthlyEffectiveTonnage += s.shipmentTonnage || 0;
        }
      }
    });

    const monthlyCommission = monthlyEffectiveTonnage * 2;
    const canViewCommission = currentUser && [UserProfile.Diretor, UserProfile.Comercial, UserProfile.Admin].includes(currentUser.profile);

    return {
      monthlyEffectiveTonnage,
      monthlyCommission,
      canViewCommission
    };
  }, [shipments, currentUser]);

  const clientDashboardData = useMemo(() => {
    if (currentUser?.profile !== UserProfile.Cliente) return null;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let volumeLoadedThisMonth = 0;
    let volumeLoadedThisYear = 0;
    let scheduledVehicles = 0;
    let loadedAndFinishedVehicles = 0;

    const scheduledStatuses: ShipmentStatus[] = [
        ShipmentStatus.AguardandoSeguradora,
        ShipmentStatus.AguardandoCarregamento,
        ShipmentStatus.AguardandoNota,
        ShipmentStatus.AguardandoAdiantamento,
        ShipmentStatus.AguardandoAgendamento,
    ];

    const loadedAndFinishedStatuses: ShipmentStatus[] = [
        ShipmentStatus.AguardandoDescarga,
        ShipmentStatus.AguardandoPagamentoSaldo,
        ShipmentStatus.Finalizado,
    ];
    
    shipments.forEach(s => {
        // Volume calculations
        const loadedEntry = s.statusHistory?.find(h => h.status === ShipmentStatus.AguardandoDescarga);
        if (loadedEntry) {
            const loadedDate = new Date(loadedEntry.timestamp);
            if (loadedDate.getFullYear() === currentYear) {
                volumeLoadedThisYear += s.shipmentTonnage;
                if (loadedDate.getMonth() === currentMonth) {
                    volumeLoadedThisMonth += s.shipmentTonnage;
                }
            }
        }

        // Vehicle status counts
        if (scheduledStatuses.includes(s.status)) {
            scheduledVehicles++;
        }
        if (loadedAndFinishedStatuses.includes(s.status)) {
            loadedAndFinishedVehicles++;
        }
    });

    return {
        pendingLoads: cargos.filter(c => c.status === CargoStatus.EmAndamento).length,
        volumeLoadedThisMonth,
        volumeLoadedThisYear,
        scheduledVehicles,
        loadedAndFinishedVehicles,
    };
  }, [cargos, shipments, currentUser]);

  if (currentUser?.profile === UserProfile.Supervisor) {
    const totalActiveLoads = cargos.filter(c => c.status === CargoStatus.EmAndamento || c.status === CargoStatus.Suspensa).length;
    const shipmentsAwaitingLoading = shipments.filter(s => s.status === ShipmentStatus.AguardandoCarregamento);

    return (
      <>
        <Header title="Dashboard do Supervisor" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           <Card
              title="Total de Cargas Ativas"
              value={totalActiveLoads.toString()}
              icon={<PackageIcon className="w-6 h-6 text-white" />}
              colorClass="bg-blue-500"
            />
            <div className="lg:col-span-2">
                <ShipmentListCard 
                    title="Embarques Aguardando Carregamento"
                    shipments={shipmentsAwaitingLoading}
                    users={users}
                />
            </div>
        </div>
      </>
    );
  }

  if (currentUser?.profile === UserProfile.Fiscal) {
    const shipmentsPreCadastro = shipments.filter(s => s.status === ShipmentStatus.PreCadastro);
    const shipmentsAwaitingInsurance = shipments.filter(s => s.status === ShipmentStatus.AguardandoSeguradora);
    const shipmentsAwaitingNote = shipments.filter(s => s.status === ShipmentStatus.AguardandoNota);

    return (
      <>
        <Header title="Dashboard Fiscal" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <ShipmentListCard title="Aguardando Seguradora" shipments={shipmentsAwaitingInsurance} users={users} thresholds={{ yellow: 30, red: 50 }} onShowDetails={setDetailsModalShipment} />
          <ShipmentListCard title="Aguardando Cadastro" shipments={shipmentsPreCadastro} users={users} thresholds={{ yellow: 60, red: 90 }} onShowDetails={setDetailsModalShipment} />
          <ShipmentListCard title="Aguardando Nota" shipments={shipmentsAwaitingNote} users={users} thresholds={{ yellow: 120, red: 240 }} onShowDetails={setDetailsModalShipment} />
        </div>
        <ShipmentDetailsModal
          isOpen={!!detailsModalShipment}
          onClose={() => setDetailsModalShipment(null)}
          shipment={detailsModalShipment}
          cargo={detailsModalShipment ? cargos.find(c => c.id === detailsModalShipment.cargoId) : undefined}
        />
      </>
    );
  }

  if (currentUser?.profile === UserProfile.Financeiro) {
    const shipmentsAwaitingAdvance = shipments.filter(s => s.status === ShipmentStatus.AguardandoAdiantamento);
    const shipmentsAwaitingBalance = shipments.filter(s => s.status === ShipmentStatus.AguardandoPagamentoSaldo);
    const shipmentsInTransit = shipments.filter(s => s.status === ShipmentStatus.AguardandoDescarga); // Added filter
    const shipmentsUnloaded = shipments.filter(s => s.status === ShipmentStatus.AguardandoPagamentoSaldo); // Added filter

    return (
      <>
        <Header title="Dashboard Financeiro" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ShipmentListCard 
            title="Aguardando Pagamento de Adiantamento" 
            shipments={shipmentsAwaitingAdvance} 
            users={users} 
            thresholds={{ yellow: 30, red: 60 }} 
            onShowDetails={setDetailsModalShipment} // Added onShowDetails
          />
          <ShipmentListCard 
            title="Aguardando Pagamento de Saldo" 
            shipments={shipmentsAwaitingBalance} 
            users={users} 
            thresholds={{ yellow: 24 * 60, red: 47 * 60 }} 
            onShowDetails={setDetailsModalShipment} // Added onShowDetails
          />
          <ShipmentListCard 
            title="Em Trânsito / Entrega" 
            shipments={shipmentsInTransit} 
            users={users} 
            thresholds={{ yellow: 24 * 60, red: 48 * 60 }}
            onShowDetails={setDetailsModalShipment}
          />
          <ShipmentListCard 
            title="Descarga Pronta / Fechamento" 
            shipments={shipmentsUnloaded} 
            users={users} 
            thresholds={{ yellow: 12 * 60, red: 24 * 60 }}
            onShowDetails={setDetailsModalShipment}
          />
        </div>
        <ShipmentDetailsModal
          isOpen={!!detailsModalShipment}
          onClose={() => setDetailsModalShipment(null)}
          shipment={detailsModalShipment}
          cargo={detailsModalShipment ? cargos.find(c => c.id === detailsModalShipment.cargoId) : undefined}
        />
      </>
    );
  }

  if (currentUser?.profile === UserProfile.Cliente && clientDashboardData) {
    return (
        <>
          <Header title="Dashboard" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card
              title="Cargas em andamento"
              value={clientDashboardData.pendingLoads.toString()}
              icon={<PackageIcon className="w-6 h-6 text-white" />}
              colorClass="bg-blue-500"
            />
            <Card
              title="Volume carregado (Mês)"
              value={`${clientDashboardData.volumeLoadedThisMonth.toLocaleString('pt-BR')} ton`}
              icon={<TruckIcon className="w-6 h-6 text-white" />}
              colorClass="bg-green-500"
            />
            <Card
              title="Volume carregado (Ano)"
              value={`${clientDashboardData.volumeLoadedThisYear.toLocaleString('pt-BR')} ton`}
              icon={<TruckIcon className="w-6 h-6 text-white" />}
              colorClass="bg-green-600"
            />
            <Card
              title="Veículos marcados"
              value={clientDashboardData.scheduledVehicles.toString()}
              icon={<TruckIcon className="w-6 h-6 text-white" />}
              colorClass="bg-orange-500"
            />
            <Card
              title="Veículos carregados/finalizados"
              value={clientDashboardData.loadedAndFinishedVehicles.toString()}
              icon={<TruckIcon className="w-6 h-6 text-white" />}
              colorClass="bg-gray-500"
            />
          </div>
        </>
    )
  }


  return (
    <>
      <Header title="Dashboard" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card
          title="Embarques Ativos"
          value={activeShipments.toString()}
          icon={<TruckIcon className="w-6 h-6 text-white" />}
          colorClass="bg-blue-500"
        />
        <Card
          title="Cargas em Andamento"
          value={pendingLoads.toString()}
          icon={<PackageIcon className="w-6 h-6 text-white" />}
          colorClass="bg-gray-500"
        />
        <Card
          title="Tons Efetivadas (Mês)"
          value={`${dashboardStats.monthlyEffectiveTonnage.toLocaleString('pt-BR')} t`}
          icon={<TruckIcon className="w-6 h-6 text-white" />}
          colorClass="bg-green-500"
        />
        {dashboardStats.canViewCommission ? (
          <Card
            title="Comissão (Mês)"
            value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dashboardStats.monthlyCommission)}
            icon={<DollarSignIcon className="w-6 h-6 text-white" />}
            colorClass="bg-emerald-500"
          />
        ) : (
          <Card
            title="Clientes Ativos"
            value="0"
            icon={<ClientsIcon className="w-6 h-6 text-white" />}
            colorClass="bg-gray-400"
          />
        )}
      </div>
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {canViewRanking && <ShipperRankingCard shipments={shipments} cargos={cargos} users={users} currentUser={currentUser} />}
        <DonutChartCard title="Distribuição de Cargas por Status" data={cargoStatusData} />
        <ShipmentFunnelCard title="Funil de Embarques" data={shipmentStatusData} />
      </div>

      <ShipmentDetailsModal
        isOpen={!!detailsModalShipment}
        onClose={() => setDetailsModalShipment(null)}
        shipment={detailsModalShipment}
        cargo={detailsModalShipment ? cargos.find(c => c.id === detailsModalShipment.cargoId) : undefined}
      />
    </>
  );
};

export default DashboardPage;
