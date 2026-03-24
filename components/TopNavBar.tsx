
import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Page, User, ProfilePermissions, Ticket } from '../types';
import { UserProfile, TicketStatus } from '../types';
import { can } from '../auth';
import { DashboardIcon } from './icons/DashboardIcon';
import { ClientsIcon } from './icons/ClientsIcon';
import { TruckIcon } from './icons/TruckIcon';
import { DriverIcon } from './icons/DriverIcon';
import { PackageIcon } from './icons/PackageIcon';
import { DollarSignIcon } from './icons/DollarSignIcon';
import { ChartIcon } from './icons/ChartIcon';
import { UsersIcon } from './icons/UsersIcon';
import { FolderIcon } from './icons/FolderIcon';
import { UserPlusIcon } from './icons/UserPlusIcon';
import { LogOutIcon } from './icons/LogOutIcon';
import { MapIcon } from './icons/MapIcon';
import { ImageIcon } from './icons/ImageIcon';
import { HistoryIcon } from './icons/HistoryIcon';
import { BellIcon } from './icons/BellIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { ArchiveIcon } from './icons/ArchiveIcon';
import { ToolIcon } from './icons/ToolIcon';
import { CalculatorIcon } from './icons/CalculatorIcon';
import { InfoIcon } from './icons/InfoIcon';

interface TopNavBarProps {
  user: User;
  onLogout: () => void;
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  profilePermissions: ProfilePermissions;
  companyLogo: string | null;
  onOpenTickets: () => void;
  tickets: Ticket[];
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: DashboardIcon },
  {
    id: 'operational',
    label: 'Operacional',
    icon: TruckIcon,
    children: [
      { id: 'shipments', label: 'Embarques', icon: PackageIcon },
      { id: 'shipment-history', label: 'Histórico Embarques', icon: HistoryIcon },
      { id: 'load-history', label: 'Histórico Cargas', icon: ArchiveIcon },
      { id: 'operational-loads', label: 'Cargas', icon: ChartIcon },
      { id: 'operational-map', label: 'Mapa Operacional', icon: MapIcon },
    ],
  },
  {
    id: 'cadastro',
    label: 'Cadastro',
    icon: FolderIcon,
    children: [
        { id: 'clients', label: 'Clientes', icon: ClientsIcon },
        { id: 'owners', label: 'Proprietários', icon: UsersIcon },
        { id: 'drivers', label: 'Motoristas', icon: DriverIcon },
        { id: 'vehicles', label: 'Veículos', icon: TruckIcon },
        { id: 'loads', label: 'Cargas', icon: PackageIcon },
    ]
  },
  {
    id: 'financial',
    label: 'Financeiro',
    icon: DollarSignIcon,
    children: [
      { id: 'commissions', label: 'Comissões', icon: DollarSignIcon },
    ],
  },
  { id: 'reports', label: 'Relatórios', icon: ChartIcon },
  {
    id: 'ferramentas',
    label: 'Ferramentas',
    icon: ToolIcon,
    children: [
      { id: 'layover-calculator', label: 'Cálculo de Estadias', icon: CalculatorIcon },
      { id: 'freight-quote', label: 'Cotação de Frete', icon: MapIcon },
      { id: 'tools-history', label: 'Histórico', icon: HistoryIcon },
    ]
  },
  {
    id: 'settings',
    label: 'Configurações',
    icon: UsersIcon,
    children: [
      { id: 'users-register', label: 'Gerenciar Usuários', icon: UserPlusIcon },
      { id: 'appearance', label: 'Aparência', icon: ImageIcon },
    ]
  }
];

const TopNavBar: React.FC<TopNavBarProps> = ({ user, onLogout, currentPage, setCurrentPage, profilePermissions, companyLogo, onOpenTickets, tickets }) => {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const myOpenTicketsCount = useMemo(() => {
    return tickets.filter(
      t => t.assignedToId === user.id &&
           t.status !== TicketStatus.Resolvido &&
           t.status !== TicketStatus.Fechado
    ).length;
  }, [tickets, user]);

  const filteredNavItems = React.useMemo(() => {
    const filterItems = (items: NavItem[]): NavItem[] => {
      return items.reduce((acc: NavItem[], item) => {
        if (user.profile === UserProfile.Cliente && item.id === 'cadastro') {
          return acc;
        }
        
        if (item.children) {
          const visibleChildren = filterItems(item.children);
          if (visibleChildren.length > 0) {
            acc.push({ ...item, children: visibleChildren });
          }
        } 
        else {
          if (can('read', user, item.id as Page, profilePermissions)) {
            acc.push(item);
          }
        }
        return acc;
      }, []);
    };
    return filterItems(navItems);
  }, [user, profilePermissions]);

  const handleDropdownToggle = (id: string) => {
    setOpenDropdown(openDropdown === id ? null : id);
  };
  
  const handlePageSelect = (page: Page) => {
      setCurrentPage(page);
      setOpenDropdown(null);
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isParentOfCurrentPage = (item: NavItem): boolean => {
      if (!item.children) return false;
      return item.children.some(child => {
        if (child.id === currentPage) return true;
        if (child.children) return isParentOfCurrentPage(child);
        return false;
      });
  }

  return (
    <header className="bg-white dark:bg-gray-800 shadow-md sticky top-0 z-40 border-b dark:border-gray-700">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo e Nome da Empresa */}
          <div className="flex items-center flex-shrink-0 mr-4">
            <a href="#" onClick={(e) => { e.preventDefault(); handlePageSelect('dashboard')}} className="flex items-center">
                {companyLogo ? (
                    <img src={companyLogo} alt="Logo" className="h-8 md:h-9 w-auto object-contain max-w-[150px] md:max-w-none" />
                ) : (
                    <h1 className="text-lg md:text-xl font-bold text-primary dark:text-white whitespace-nowrap">Rodochagas Logística</h1>
                )}
            </a>
          </div>

          {/* Navegação Principal */}
          <nav className="hidden md:flex items-center space-x-1">
            {filteredNavItems.map((item) => {
                const isActive = currentPage === item.id || isParentOfCurrentPage(item);
                if(item.children) {
                    return (
                        <div className="relative" key={item.id} ref={item.id === openDropdown ? dropdownRef : null}>
                            <button
                                onClick={() => handleDropdownToggle(item.id)}
                                className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                                    isActive ? 'text-primary dark:text-blue-400 bg-blue-50 dark:bg-blue-900/50' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                            >
                                <span>{item.label}</span>
                                <ChevronDownIcon className={`w-4 h-4 ml-1 transition-transform ${openDropdown === item.id ? 'rotate-180' : ''}`} />
                            </button>
                            {openDropdown === item.id && (
                                <div className="absolute mt-2 w-56 origin-top-left bg-white dark:bg-gray-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 py-1">
                                    {item.children.map(child => {
                                      if (child.children) {
                                        return (
                                          <div key={child.id} className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider border-t border-gray-100 dark:border-gray-700 mt-1 first:mt-0 first:border-0">
                                            {child.label}
                                            <div className="mt-1 normal-case font-normal text-sm">
                                              {child.children.map(grandChild => (
                                                <a key={grandChild.id} href="#" onClick={(e) => { e.preventDefault(); handlePageSelect(grandChild.id as Page); }}
                                                   className={`flex items-center gap-3 px-2 py-1.5 rounded-md ${currentPage === grandChild.id ? 'text-primary dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'} hover:bg-gray-100 dark:hover:bg-gray-700`}
                                                >
                                                   <grandChild.icon className="w-4 h-4" />
                                                   {grandChild.label}
                                                </a>
                                              ))}
                                            </div>
                                          </div>
                                        )
                                      }
                                      return (
                                        <a key={child.id} href="#" onClick={(e) => { e.preventDefault(); handlePageSelect(child.id as Page); }}
                                           className={`flex items-center gap-3 px-4 py-2 text-sm ${currentPage === child.id ? 'text-primary dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'} hover:bg-gray-100 dark:hover:bg-gray-700`}
                                        >
                                           <child.icon className="w-4 h-4" />
                                           {child.label}
                                        </a>
                                      )
                                    })}
                                </div>
                            )}
                        </div>
                    )
                }
                return (
                    <a href="#" key={item.id} onClick={(e) => { e.preventDefault(); handlePageSelect(item.id as Page); }}
                       className={`px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                           isActive ? 'text-primary dark:text-blue-400 bg-blue-50 dark:bg-blue-900/50' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                       }`}
                    >{item.label}</a>
                )
            })}
          </nav>

          {/* Ícones e Menu do Usuário */}
          <div className="flex items-center space-x-4">
             <div className="relative">
                <button
                onClick={onOpenTickets}
                className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none"
                aria-label="Abrir chamados"
                >
                    <BellIcon className="w-6 h-6" />
                </button>
                {myOpenTicketsCount > 0 && (
                <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
                    {myOpenTicketsCount}
                </span>
                )}
            </div>

            <div className="relative" ref={openDropdown === 'user' ? dropdownRef : null}>
              <button onClick={() => handleDropdownToggle('user')} className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-blue-200 text-primary flex items-center justify-center font-bold">
                  {user.name.charAt(0)}
                </div>
                <div className="hidden lg:block text-left">
                    <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">{user.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.profile}</p>
                </div>
                 <ChevronDownIcon className={`w-4 h-4 text-gray-500 transition-transform ${openDropdown === 'user' ? 'rotate-180' : ''}`} />
              </button>
              {openDropdown === 'user' && (
                <div className="absolute mt-2 w-48 right-0 origin-top-right bg-white dark:bg-gray-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 py-1">
                    <button onClick={onLogout} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                        <LogOutIcon className="w-4 h-4" />
                        Sair
                    </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopNavBar;
