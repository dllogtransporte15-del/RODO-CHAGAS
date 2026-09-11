
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
import { Menu as MenuIcon, X as XIcon, Activity, Sun, Moon } from 'lucide-react';
import DriverLocationTracker from './DriverLocationTracker';

interface TopNavBarProps {
  user: User;
  onLogout: () => void;
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  profilePermissions: ProfilePermissions;
  companyLogo: string | null;
  onOpenTickets: () => void;
  tickets: Ticket[];
  themeMode?: 'dark' | 'light';
  onToggleTheme?: () => void;
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
      { id: 'operational-loads', label: 'Oportunidades de Carga', icon: ChartIcon },
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
        { id: 'products', label: 'Produtos', icon: PackageIcon },
    ]
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
      { id: 'freight-offers-history', label: 'Histórico de Ofertas', icon: HistoryIcon },
    ]
  },
  {
    id: 'settings',
    label: 'Configurações',
    icon: UsersIcon,
    children: [
      { id: 'users-register', label: 'Gerenciar Usuários', icon: UserPlusIcon },
      { id: 'branches', label: 'Filiais', icon: FolderIcon },
      { id: 'appearance', label: 'Aparência', icon: ImageIcon },
      { id: 'system-monitor', label: 'Monitoramento', icon: Activity },
    ]
  }
];

const TopNavBar: React.FC<TopNavBarProps> = ({ 
  user, 
  onLogout, 
  currentPage, 
  setCurrentPage, 
  profilePermissions, 
  companyLogo, 
  onOpenTickets, 
  tickets,
  themeMode = 'dark',
  onToggleTheme
}) => {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
        if (user.profile === UserProfile.Motorista) {
          if (item.id === 'operational') {
            const allowedChildren = item.children?.filter(c => c.id === 'operational-loads' || c.id === 'operational-map' || c.id === 'shipment-history') || [];
            if (allowedChildren.length > 0) {
              acc.push({ ...item, children: allowedChildren });
            }
          }
          return acc;
        }

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
      setIsMobileMenuOpen(false);
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if click was outside the desktop dropdowns
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        // AND not inside the mobile menu
        if (!mobileMenuRef.current || !mobileMenuRef.current.contains(event.target as Node)) {
          setOpenDropdown(null);
        }
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
  };

  return (
    <header className="bg-white/90 dark:bg-[#0A1128]/90 backdrop-blur-2xl border-b border-slate-200 dark:border-white/10 shadow-sm dark:shadow-2xl sticky top-0 z-40 transition-colors duration-200">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between min-h-16 md:min-h-20 py-1.5">
          {/* Logo e Nome da Empresa + Status Online */}
          <div className="flex items-center flex-shrink-0 mr-4">
            <a href="#" onClick={(e) => { e.preventDefault(); handlePageSelect(user.profile === UserProfile.Motorista ? 'operational-loads' : 'dashboard'); }} className="flex items-center gap-3">
                {companyLogo ? (
                    <img src={companyLogo} alt="Logo" className="h-12 md:h-16 w-auto object-contain max-w-[220px] md:max-w-none filter drop-shadow-[0_4px_14px_rgba(241,100,33,0.35)] transition-all" />
                ) : (
                    <div className="flex items-center gap-2.5">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-[#1D3B8D] to-[#F16421] flex items-center justify-center shadow-lg shadow-orange-500/20 border border-white/20">
                        <TruckIcon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <span className="text-xl md:text-2xl font-black tracking-tight text-slate-900 dark:text-white">RODO</span>
                        <span className="text-xl md:text-2xl font-black tracking-tight text-[#F16421]">CHAGAS</span>
                      </div>
                    </div>
                )}
            </a>

            {/* Status Pill matching Login */}
            <div className="hidden xl:flex items-center gap-2 ml-4 px-3 py-1 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-ping" />
              <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 tracking-wider">SISTEMA ONLINE</span>
            </div>
          </div>

          {/* Navegação Principal */}
          <nav className="hidden lg:flex items-center space-x-1.5">
            {filteredNavItems.map((item) => {
                const isActive = currentPage === item.id || isParentOfCurrentPage(item);
                if(item.children) {
                    return (
                        <div className="relative" key={item.id} ref={item.id === openDropdown ? dropdownRef : null}>
                            <button
                                onClick={() => handleDropdownToggle(item.id)}
                                className={`flex items-center px-3.5 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-200 ${
                                    isActive 
                                      ? 'bg-gradient-to-r from-[#1D3B8D] to-[#162D6B] text-white shadow-lg shadow-blue-900/40 border border-blue-400/30' 
                                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
                                }`}
                            >
                                <span>{item.label}</span>
                                <ChevronDownIcon className={`w-3.5 h-3.5 ml-1.5 transition-transform ${openDropdown === item.id ? 'rotate-180' : ''}`} />
                            </button>
                            {openDropdown === item.id && (
                                <div className="absolute mt-2.5 w-60 origin-top-left bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200 dark:border-white/15 rounded-2xl shadow-2xl p-2 z-50 animate-fadeIn">
                                    {item.children.map(child => {
                                      if (child.children) {
                                        return (
                                          <div key={child.id} className="px-3 py-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-t border-slate-100 dark:border-white/5 mt-1 first:mt-0 first:border-0">
                                            {child.label}
                                            <div className="mt-1 normal-case font-normal text-xs space-y-0.5">
                                              {child.children.map(grandChild => (
                                                <a key={grandChild.id} href="#" onClick={(e) => { e.preventDefault(); handlePageSelect(grandChild.id as Page); }}
                                                   className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                                                     currentPage === grandChild.id 
                                                       ? 'text-white bg-gradient-to-r from-[#1D3B8D] to-[#162D6B] border border-blue-400/30 shadow-md' 
                                                       : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10'
                                                   }`}
                                                >
                                                   <grandChild.icon className="w-4 h-4 text-[#F16421]" />
                                                   {grandChild.label}
                                                </a>
                                              ))}
                                            </div>
                                          </div>
                                        )
                                      }
                                      return (
                                        <a key={child.id} href="#" onClick={(e) => { e.preventDefault(); handlePageSelect(child.id as Page); }}
                                           className={`flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-xl transition-all ${
                                             currentPage === child.id 
                                               ? 'text-white bg-gradient-to-r from-[#1D3B8D] to-[#162D6B] border border-blue-400/30 shadow-md' 
                                               : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10'
                                           }`}
                                        >
                                           <child.icon className="w-4 h-4 text-[#F16421]" />
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
                       className={`px-3.5 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-200 ${
                           isActive 
                             ? 'bg-gradient-to-r from-[#1D3B8D] to-[#162D6B] text-white shadow-lg shadow-blue-900/40 border border-blue-400/30' 
                             : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
                       }`}
                    >{item.label}</a>
                )
            })}
          </nav>

          {/* Ícones e Menu do Usuário */}
          <div className="flex items-center space-x-2.5">
             {user.profile === UserProfile.Motorista && (
                <DriverLocationTracker user={user} />
             )}

             {/* Theme Switcher Quick Button */}
             {onToggleTheme && (
                <button
                  type="button"
                  onClick={onToggleTheme}
                  className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all focus:outline-none flex items-center justify-center group shadow-sm"
                  title={themeMode === 'dark' ? 'Alternar para Fundo Claro' : 'Alternar para Fundo Escuro'}
                  aria-label="Alternar tema"
                >
                  {themeMode === 'dark' ? (
                    <Sun className="w-5 h-5 text-amber-400 group-hover:rotate-45 transition-transform" />
                  ) : (
                    <Moon className="w-5 h-5 text-indigo-600 group-hover:-rotate-12 transition-transform" />
                  )}
                </button>
             )}
             
             {/* Chamados / Tickets */}
             <div className="relative">
                <button
                onClick={onOpenTickets}
                className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all focus:outline-none shadow-sm"
                aria-label="Abrir chamados"
                >
                    <BellIcon className="w-5 h-5" />
                </button>
                {myOpenTicketsCount > 0 && (
                <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-black leading-none text-white bg-gradient-to-r from-[#F16421] to-red-600 rounded-full border border-white/20 shadow-lg shadow-orange-500/30">
                    {myOpenTicketsCount}
                </span>
                )}
            </div>

            {/* Profile Menu */}
            <div className="relative" ref={openDropdown === 'user' ? dropdownRef : null}>
              <button 
                onClick={() => handleDropdownToggle('user')} 
                className="flex items-center space-x-2.5 p-1.5 pr-3 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 transition-all shadow-sm"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#1D3B8D] to-[#F16421] text-white flex items-center justify-center font-black text-xs shadow-md border border-white/20">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="hidden lg:block text-left">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[120px]">{user.name}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[120px] uppercase font-semibold">{user.profile}</p>
                </div>
                 <ChevronDownIcon className={`hidden lg:block w-3.5 h-3.5 text-slate-500 dark:text-slate-400 transition-transform ${openDropdown === 'user' ? 'rotate-180' : ''}`} />
              </button>
              {openDropdown === 'user' && (
                <div className="absolute mt-2.5 w-56 right-0 origin-top-right bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200 dark:border-white/15 rounded-2xl shadow-2xl p-2 z-50 animate-fadeIn">
                    <div className="px-3 py-2 border-b border-slate-100 dark:border-white/10 mb-1">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{user.name}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                    </div>

                    {/* Theme Mode Toggle Item in Dropdown */}
                    {onToggleTheme && (
                      <button
                        type="button"
                        onClick={() => {
                          onToggleTheme();
                          setOpenDropdown(null);
                        }}
                        className="w-full text-left flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-all mb-1"
                      >
                        <span className="flex items-center gap-2.5">
                          {themeMode === 'dark' ? (
                            <Sun className="w-4 h-4 text-amber-500" />
                          ) : (
                            <Moon className="w-4 h-4 text-indigo-600" />
                          )}
                          <span>{themeMode === 'dark' ? 'Modo Claro' : 'Modo Escuro'}</span>
                        </span>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                          {themeMode === 'dark' ? 'Escuro' : 'Claro'}
                        </span>
                      </button>
                    )}

                    <button 
                      onClick={onLogout} 
                      className="w-full text-left flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all"
                    >
                        <LogOutIcon className="w-4 h-4" />
                        Sair do Sistema
                    </button>
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            <div className="lg:hidden flex items-center ml-1">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-xl text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 focus:outline-none"
              >
                <span className="sr-only">Abrir menu</span>
                {isMobileMenuOpen ? (
                  <XIcon className="block leading-none w-5 h-5" aria-hidden="true" />
                ) : (
                  <MenuIcon className="block leading-none w-5 h-5" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div 
          ref={mobileMenuRef}
          className="lg:hidden border-t border-slate-200 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl absolute left-0 right-0 top-full shadow-2xl max-h-[calc(100vh-4rem)] overflow-y-auto z-50 p-4 space-y-3"
        >
          <div className="space-y-1">
             {filteredNavItems.map((item) => {
                const isActive = currentPage === item.id || isParentOfCurrentPage(item);
                if (item.children) {
                   return (
                      <div key={item.id} className="space-y-1">
                         <button
                            onClick={() => handleDropdownToggle(item.id)}
                            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider ${
                                isActive 
                                  ? 'bg-gradient-to-r from-[#1D3B8D] to-[#162D6B] text-white border border-blue-400/30' 
                                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                            }`}
                         >
                            <div className="flex items-center">
                               <item.icon className="w-4 h-4 mr-2.5 text-[#F16421]" />
                               {item.label}
                            </div>
                            <ChevronDownIcon className={`w-4 h-4 transition-transform ${openDropdown === item.id ? 'rotate-180' : ''}`} />
                         </button>
                         {openDropdown === item.id && (
                            <div className="pl-6 space-y-1 pt-1 pb-2">
                               {item.children.map(child => {
                                  if (child.children) {
                                      return (
                                          <div key={child.id} className="pt-2">
                                              <div className="px-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{child.label}</div>
                                              <div className="space-y-1">
                                                {child.children.map(grandchild => (
                                                    <a key={grandchild.id} href="#" onClick={(e) => { e.preventDefault(); handlePageSelect(grandchild.id as Page); }}
                                                       className={`flex items-center px-3 py-2 rounded-xl text-xs font-medium ${
                                                         currentPage === grandchild.id 
                                                           ? 'text-white bg-blue-600/30 border border-blue-400/30' 
                                                           : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
                                                       }`}
                                                    >
                                                        <grandchild.icon className="w-3.5 h-3.5 mr-2 text-[#F16421]" />
                                                        {grandchild.label}
                                                    </a>
                                                ))}
                                              </div>
                                          </div>
                                      )
                                  }
                                  return (
                                      <a key={child.id} href="#" onClick={(e) => { e.preventDefault(); handlePageSelect(child.id as Page); }}
                                         className={`flex items-center px-3 py-2 rounded-xl text-xs font-medium ${
                                           currentPage === child.id 
                                             ? 'text-white bg-blue-600/30 border border-blue-400/30' 
                                             : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
                                         }`}
                                      >
                                          <child.icon className="w-3.5 h-3.5 mr-2 text-[#F16421]" />
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
                    <a key={item.id} href="#" onClick={(e) => { e.preventDefault(); handlePageSelect(item.id as Page); }}
                       className={`flex items-center px-3.5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider ${
                           isActive 
                             ? 'bg-gradient-to-r from-[#1D3B8D] to-[#162D6B] text-white border border-blue-400/30' 
                             : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                       }`}
                    >
                        <item.icon className="w-4 h-4 mr-2.5 text-[#F16421]" />
                        {item.label}
                    </a>
                )
             })}
          </div>
          <div className="pt-3 border-t border-slate-200 dark:border-white/10">
             <div className="flex items-center px-3 py-2 space-x-3 bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/5 mb-2">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-[#1D3B8D] to-[#F16421] text-white flex items-center justify-center font-bold text-sm">
                   {user.name.charAt(0).toUpperCase()}
                </div>
                <div>
                   <div className="text-xs font-bold text-slate-900 dark:text-white">{user.name}</div>
                   <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold">{user.profile}</div>
                </div>
             </div>
             <button
                onClick={onLogout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-red-500 hover:text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 border border-red-200 dark:border-red-500/20"
             >
                <LogOutIcon className="w-4 h-4" />
                Sair do Sistema
             </button>
          </div>
        </div>
      )}
    </header>
  );
};

export default TopNavBar;
