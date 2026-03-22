
import React, { useState, useMemo } from 'react';
import Header from '../components/Header';
import type { Shipment, User, Cargo, Client } from '../types';
import { UserProfile } from '../types';
import { BriefcaseIcon } from '../components/icons/BriefcaseIcon';
import { ShipIcon } from '../components/icons/ShipIcon';
import { UsersIcon } from '../components/icons/UsersIcon';
import { ClockIcon } from '../components/icons/ClockIcon';
import SalespersonReport from '../components/reports/SalespersonReport';
import ShipperReport from '../components/reports/ShipperReport';
import ClientReport from '../components/reports/ClientReport';
import OperationalTimingReport from '../components/reports/OperationalTimingReport';

interface ReportsPageProps {
  shipments: Shipment[];
  embarcadores: User[];
  cargos: Cargo[];
  users: User[];
  currentUser: User | null;
  clients: Client[];
}

type ActiveReport = 'comercial' | 'embarcadores' | 'clientes' | 'tempo-operacao';

const ReportsPage: React.FC<ReportsPageProps> = ({ shipments, embarcadores, cargos, users, currentUser, clients }) => {
  const [activeReport, setActiveReport] = useState<ActiveReport>('comercial');
  
  const canViewCommercialReport = useMemo(() => {
    if (!currentUser) return false;
    // Expanded access for Admin and Supervisor
    return [UserProfile.Comercial, UserProfile.Admin, UserProfile.Supervisor, UserProfile.Diretor].includes(currentUser.profile);
  }, [currentUser]);

  const renderReport = () => {
    switch(activeReport) {
      case 'comercial':
        return <SalespersonReport shipments={shipments} cargos={cargos} users={users} />;
      case 'embarcadores':
        return <ShipperReport shipments={shipments} users={users} />;
      case 'clientes':
        return <ClientReport shipments={shipments} cargos={cargos} clients={clients} />;
      case 'tempo-operacao':
        return <OperationalTimingReport shipments={shipments} />;
      default:
        return null;
    }
  };
  
  const navItems = [
      ...(canViewCommercialReport ? [{ id: 'comercial', label: 'Comercial', icon: BriefcaseIcon }] : []),
      { id: 'embarcadores', label: 'Solicitantes', icon: ShipIcon },
      { id: 'clientes', label: 'Clientes', icon: UsersIcon },
      { id: 'tempo-operacao', label: 'Tempo de Operação', icon: ClockIcon },
  ];

  // Adjust initial active report if commercial is not available
  useState(() => {
    if (!canViewCommercialReport && activeReport === 'comercial') {
      setActiveReport('embarcadores');
    }
  });


  return (
    <>
      <Header title="Relatórios" />
      <div className="flex flex-col md:flex-row gap-8">
        <aside className="w-full md:w-64">
          <nav className="flex flex-row md:flex-col gap-2">
             {navItems.map(item => (
                 <button
                    key={item.id}
                    onClick={() => setActiveReport(item.id as ActiveReport)}
                    className={`flex items-center w-full px-4 py-3 text-sm font-medium text-left rounded-lg transition-colors duration-200 ${
                        activeReport === item.id
                        ? 'bg-primary text-white'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                    >
                    <item.icon className="w-5 h-5 mr-3" />
                    {item.label}
                 </button>
             ))}
          </nav>
        </aside>
        <main className="flex-1">
          {renderReport()}
        </main>
      </div>
    </>
  );
};

export default ReportsPage;