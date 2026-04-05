
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabase';
import TopNavBar from './components/TopNavBar';
import TicketModal from './components/TicketModal';
import DashboardPage from './pages/DashboardPage';
import ClientsPage from './pages/ClientsPage';
import OwnersPage from './pages/OwnersPage';
import LoadsPage from './pages/LoadsPage';
import DriversPage from './pages/DriversPage';
import VehiclesPage from './pages/VehiclesPage';
import ShipmentsPage from './pages/ShipmentsPage';
import OperationalLoadsPage from './pages/OperationalLoadsPage';
import OperationalMapPage from './pages/OperationalMapPage';
import ReportsPage from './pages/ReportsPage';
import UsersPage from './pages/UsersPage';
import PlaceholderPage from './pages/PlaceholderPage';
import LoginPage from './pages/LoginPage';
import CommissionsPage from './pages/CommissionsPage';
import AppearancePage from './pages/AppearancePage';
import ShipmentHistoryPage from './pages/ShipmentHistoryPage';
import LoadHistoryPage from './pages/LoadHistoryPage';
import LayoverCalculatorPage from './pages/LayoverCalculatorPage';
import FreightQuotePage from './pages/FreightQuotePage';
import ToolsHistoryPage from './pages/ToolsHistoryPage';
import ProductsPage from './pages/ProductsPage';
import type { Client, Owner, Driver, Vehicle, Product, Cargo, Shipment, User, Page, ProfilePermissions, HistoryLog, Ticket, TicketHistory, ShipmentLock } from './types';
import { CargoStatus, ShipmentStatus, UserProfile, TicketStatus, TicketPriority, DriverClassification, VehicleSetType, VehicleBodyType, REQUIRED_DOCUMENT_MAP } from './types';
import { formatId } from './utils';
import { INITIAL_PERMISSIONS } from './auth';
import {
  fetchClients, fetchOwners, fetchDrivers, fetchVehicles, fetchProducts,
  fetchCargos, fetchShipments, fetchUsers, fetchTickets, fetchProfilePermissions,
  upsertClient, upsertOwner, upsertDriver, upsertVehicle, upsertCargo, insertCargo,
  upsertShipment, insertShipment, upsertUser, upsertTicket, saveProfilePermissions,
  upsertManyDrivers, upsertManyVehicles, upsertManyShipments, upsertManyCargos,
  uploadShipmentAttachment, getShipmentAttachmentUrl,
  fetchAppSettings, saveAppSettings,
  deleteCargo, deleteShipment, deleteUser, upsertProduct, deleteProduct,
  fetchShipmentLocks, tryAcquireShipmentLock, releaseShipmentLock
} from './lib/db';

const RODOCHAGAS_LOGO_BASE64 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxISEhUSEhIVFRUVFRUVFRUVFRUVFRUVFRUWFhUVFRUYHSggGBolHRUVITEhJSkrLi4uFx8zODMtNygtLisBCgoKDg0OGxAQGy0lICUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAJYAlgMBIgACEQEDEQH/xAAcAAABBQEBAQAAAAAAAAAAAAAAAQIDBAUGBwj/xAA+EAABAwIEAwQHBgQGAwAAAAABAAIRAyEEEjFBBVFhBnGBkRMiMqGxwdHwFEJS4fEGYnKCorLCFiQ0c8P/AAaAQEAAwEBAQAAAAAAAAAAAAAAAQIDBAUG/xAAuEQEAAgIBAwIDCAIDAAAAAAAAAAECEQMSITFBUQQTYSIycYGRobHR8MEUI0Lh/9oADAMBAAIRAxEAPwD2hCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAUK1aVpc89Ggn2CuuX4zxFtWm+j9o1hfBqQCWs/e5mRcNdG26AOKzTjT6lYsqVG02sE0qbRmc4HUCJMnfTQBY9Hjr2U20KDy+ZNTESHGTEz337Kzw/1wzE1B9np0zVqVsVKr3F0TYS42G+wWdw3gn+HqvrucypC4DSgOaGtJEmDqSY3IE5TMSfLb2m9I6mLi4fX8X/R1XA+NuxD/ALO+mGVC0ua5pcWutMEEXuCR/wBz0F3yLgPCwzG1ahqNL/suVkES4BxJLSPuwdR+6NeqO1d/C5HJp9/L/Rz54qMbvoEIQuowBCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCAOY4/VpChVa97BLHNLQczpkEWGs2XlsJcKjnFrnNaXmSAHHYEaR6L2vEeC4fEATDiLtc2A4dJ0PsQuawv2bNbicxqn2JgtZT5S+dxmc4i+ggLs4fUQjFqbs8Hi/DZZZ5UoK0v5OLxOIbUfUqVGmpUDiym0OMMaNPdAJjUnfZe0+z2niGYdzcWAHOHslzSxxEHIQ6SRY/guX/APj52L+0Go1sEimKbS6mB+6XmQCTroOnr0WB4NRw/8AaKj6dSpnFM5y5uVr8xAawEkkwdTHMLfUTlODWl7/AKRz8LhjhzuMrb1/p0PQgIXAV3QhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgAQhCABCEIAEIQgD/9k=";

const FIELD_TRANSLATIONS: Record<string, string> = {
  // Cargo fields
  clientId: 'Cliente',
  productId: 'Produto',
  origin: 'Origem',
  originMapLink: 'Link do Mapa (Origem)',
  destination: 'Destino',
  destinationMapLink: 'Link do Mapa (Destino)',
  totalVolume: 'Volume Total',
  scheduledVolume: 'Volume Agendado',
  loadedVolume: 'Volume Carregado',
  companyFreightValuePerTon: 'Frete Empresa (p/ Ton)',
  driverFreightValuePerTon: 'Frete Motorista (p/ Ton)',
  hasIcms: 'Incide ICMS',
  icmsPercentage: '% ICMS',
  requiresScheduling: 'Exige Agendamento',
  type: 'Tipo de Carga',
  status: 'Status da Carga',
  createdById: 'Comercial Responsável',
  freightLegs: 'Trechos de Frete',
  dailySchedule: 'Agenda Diária',
  originCoords: 'Coordenadas de Origem',
  destinationCoords: 'Coordenadas de Destino',

  // Shipment fields
  driverId: 'Motorista',
  driverCpf: 'CPF do Motorista',
  anttOwnerIdentifier: 'CPF/CNPJ Titular ANTT',
  bankDetails: 'Dados Bancários',
  embarcadorId: 'Embarcador',
  horsePlate: 'Placa Cavalo',
  trailer1Plate: 'Placa Carreta 1',
  trailer2Plate: 'Placa Carreta 2',
  trailer3Plate: 'Placa Carreta 3',
  shipmentTonnage: 'Toneladas do Embarque',
  driverFreightValue: 'Valor Frete Motorista',
};

interface NewShipmentRequestData extends Omit<Shipment, 'id' | 'orderId' | 'status' | 'documents' | 'history' | 'createdAt' | 'createdById' | 'statusHistory'> {
  driverCnh?: string;
  vehicleSetType?: VehicleSetType;
  vehicleBodyType?: VehicleBodyType;
  filesToAttach?: File[];
}

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('rodochagas_currentUser');
    return saved ? JSON.parse(saved) : null;
  });
  const [currentPage, setCurrentPage] = useState<Page>(() => {
    return (localStorage.getItem('rodochagas_currentPage') as Page) || 'dashboard';
  });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Centralized State Management — persisted via Supabase
  const [clients, setClients] = useState<Client[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeLocks, setActiveLocks] = useState<ShipmentLock[]>([]);
  const [profilePermissions, setProfilePermissions] = useState<ProfilePermissions>(INITIAL_PERMISSIONS);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [isAnyModalOpen, setIsAnyModalOpen] = useState(false);
  const isAnyModalActive = isAnyModalOpen || isTicketModalOpen;
  const isAnyModalActiveRef = useRef(isAnyModalActive);
  
  useEffect(() => {
    isAnyModalActiveRef.current = isAnyModalActive;
  }, [isAnyModalActive]);

  const [companyLogo, setCompanyLogo] = useState<string | null>(() => {
    return localStorage.getItem('rodochagas_companyLogo') || RODOCHAGAS_LOGO_BASE64;
  });

  const [themeImage, setThemeImage] = useState<string | null>(() => {
    return localStorage.getItem('rodochagas_themeImage') || null;
  });

  const [nextIds, setNextIds] = useState(() => {
    const saved = localStorage.getItem('rodochagas_nextIds');
    if (saved) return JSON.parse(saved);
    return { client: 100, owner: 100, driver: 100, vehicle: 100, product: 100, shipment: 100, cargo: 100, user: 100, ticket: 1, history: 1000 };
  });

  // --- LOAD DATA FROM SUPABASE ---
  const loadAllData = useCallback(async (isBackground = false) => {
    if (!isBackground) setIsLoading(true);
    setLoadError(null);
    try {
      const [dbClients, dbOwners, dbDrivers, dbVehicles, dbProducts, dbCargos, dbShipments, dbUsers, dbTickets, dbPermissions, dbSettings, dbLocks] = await Promise.all([
        fetchClients(),
        fetchOwners(),
        fetchDrivers(),
        fetchVehicles(),
        fetchProducts(),
        fetchCargos(),
        fetchShipments(),
        fetchUsers(),
        fetchTickets(),
        fetchProfilePermissions(),
        fetchAppSettings(),
        fetchShipmentLocks(),
      ]);
      setClients(dbClients);
      setOwners(dbOwners);
      setDrivers(dbDrivers);
      setVehicles(dbVehicles);
      setProducts(dbProducts);
      setCargos(dbCargos);
      setShipments(dbShipments);
      setUsers(dbUsers);
      setTickets(dbTickets);
      if (dbPermissions && Object.keys(dbPermissions).length > 0) {
        setProfilePermissions(dbPermissions);
      }
      if (dbSettings) {
        if (dbSettings.company_logo) setCompanyLogo(dbSettings.company_logo);
        if (dbSettings.theme_image) setThemeImage(dbSettings.theme_image);
      }
      setActiveLocks(dbLocks);
      // Update nextIds from DB counts
      setNextIds({
        client: dbClients.length + 100,
        owner: dbOwners.length + 100,
        driver: dbDrivers.length + 100,
        vehicle: dbVehicles.length + 100,
        product: (dbProducts.length || 0) + 100,
        shipment: dbShipments.length + 100,
        cargo: dbCargos.length + 100,
        user: dbUsers.length + 100,
        ticket: dbTickets.length + 1,
        history: 9999,
      });
    } catch (err: any) {
      console.error('Erro ao carregar dados do Supabase:', err);
      setLoadError('Erro ao conectar ao banco de dados. Verifique sua conexão.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('rodochagas_currentUser', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('rodochagas_currentUser');
    }
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('rodochagas_currentPage', currentPage);
  }, [currentPage]);

  // --- REAL-TIME UPDATES ---
  useEffect(() => {
    const channel = supabase
      .channel('schema_changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        console.log('Real-time change detected:', payload);
        if (isAnyModalActiveRef.current) {
          console.log('Suppressed real-time refresh because a modal is open.');
          return;
        }
        loadAllData(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadAllData]);

  useEffect(() => {
    const channel = supabase
      .channel('lock_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shipment_locks' }, () => {
        fetchShipmentLocks().then(setActiveLocks);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Keep localStorage only for UI preferences
  useEffect(() => { localStorage.setItem('rodochagas_nextIds', JSON.stringify(nextIds)); }, [nextIds]);
  useEffect(() => {
    if (companyLogo) {
      localStorage.setItem('rodochagas_companyLogo', companyLogo);
      
      // Update favicon
      const link = (document.querySelector("link[rel*='icon']") as HTMLLinkElement) || document.createElement('link');
      link.type = 'image/x-icon';
      link.rel = 'shortcut icon';
      link.href = companyLogo;
      if (!document.querySelector("link[rel*='icon']")) {
        document.getElementsByTagName('head')[0].appendChild(link);
      }
    } else {
      localStorage.removeItem('rodochagas_companyLogo');
    }
  }, [companyLogo]);
  useEffect(() => {
    if (themeImage) {
      localStorage.setItem('rodochagas_themeImage', themeImage);
    } else {
      localStorage.removeItem('rodochagas_themeImage');
    }
  }, [themeImage]);

  useEffect(() => {
    if (themeImage) {
      document.body.style.backgroundImage = `url(${themeImage})`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
      document.body.style.backgroundAttachment = 'fixed';
    } else {
      document.body.style.backgroundImage = '';
      document.body.style.backgroundSize = '';
      document.body.style.backgroundPosition = '';
      document.body.style.backgroundAttachment = '';
    }
  }, [themeImage]);

  const nextStatusMap: Partial<Record<ShipmentStatus, ShipmentStatus>> = {
    [ShipmentStatus.AguardandoSeguradora]: ShipmentStatus.PreCadastro,
    [ShipmentStatus.PreCadastro]: ShipmentStatus.AguardandoCarregamento,
    [ShipmentStatus.AguardandoCarregamento]: ShipmentStatus.AguardandoNota,
    [ShipmentStatus.AguardandoNota]: ShipmentStatus.AguardandoAdiantamento,
    // AguardandoAdiantamento is now handled conditionally
    [ShipmentStatus.AguardandoAgendamento]: ShipmentStatus.AguardandoDescarga,
    [ShipmentStatus.AguardandoDescarga]: ShipmentStatus.AguardandoPagamentoSaldo,
    [ShipmentStatus.AguardandoPagamentoSaldo]: ShipmentStatus.Finalizado,
  };

  // --- HISTORY LOGGING ---
  const createHistoryLog = (description: string): HistoryLog => {
    if (!currentUser) throw new Error("Ação não pode ser realizada sem um usuário logado.");
    const newLog = {
      id: `log_${nextIds.history}`,
      userId: currentUser.id,
      timestamp: new Date().toISOString(),
      description: `${description}`,
    };
    setNextIds((prev: any) => ({...prev, history: prev.history + 1}));
    return newLog;
  }

  // --- AUTH HANDLERS ---
  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setCurrentPage('dashboard');
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  const handleSavePermissions = async (newPermissions: ProfilePermissions) => {
    setProfilePermissions(newPermissions);
    try {
      await saveProfilePermissions(newPermissions);
    } catch (err) {
      console.error('Erro ao salvar permissões:', err);
    }
    alert("Permissões salvas com sucesso!");
  };
  
  const handleSaveLogo = async (logo: string) => {
    setCompanyLogo(logo || null);
    try {
      await saveAppSettings({ company_logo: logo || null });
    } catch (err) {
      console.error('Erro ao salvar logo no Supabase:', err);
    }
    alert("Logo da empresa atualizado com sucesso!");
  };

  const handleSaveThemeImage = async (image: string) => {
    setThemeImage(image || null);
    try {
      await saveAppSettings({ theme_image: image || null });
    } catch (err) {
      console.error('Erro ao salvar tema no Supabase:', err);
    }
    alert("Tema de fundo atualizado com sucesso!");
  };

  const handleSaveTicket = async (ticketData: Omit<Ticket, 'id' | 'history' | 'createdAt' | 'createdById'>) => {
    if (!currentUser) return;
    const newId = formatId(nextIds.ticket, 'TCK');
    const newTicket: Ticket = {
      ...ticketData,
      id: newId,
      status: TicketStatus.Aberto,
      createdById: currentUser.id,
      createdAt: new Date().toISOString(),
      history: [{
          userId: currentUser.id,
          timestamp: new Date().toISOString(),
          comment: `Chamado criado e atribuído a ${users.find(u => u.id === ticketData.assignedToId)?.name || 'N/A'}.`
      }],
    };
    setTickets((prev: Ticket[]) => [newTicket, ...prev]);
    setNextIds((prev: any) => ({ ...prev, ticket: prev.ticket + 1 }));
    try { await upsertTicket(newTicket); } catch(err) { console.error('Erro ao salvar ticket:', err); }
  }

  const handleUpdateTicket = async (ticketId: string, newStatus: TicketStatus, comment: string) => {
    if (!currentUser) return;
    
    const ticketToUpdate = tickets.find(t => t.id === ticketId);
    if (!ticketToUpdate) return;

    const oldStatus = ticketToUpdate.status;
    let finalComment = comment.trim();
    if (!finalComment) {
      finalComment = newStatus === TicketStatus.Resolvido
        ? 'Chamado marcado como resolvido.'
        : `Status alterado para ${newStatus}.`;
    }

    const newHistoryEntry: TicketHistory = {
      userId: currentUser.id,
      timestamp: new Date().toISOString(),
      comment: finalComment,
      oldStatus,
      newStatus,
    };

    const updatedTicket = { 
      ...ticketToUpdate, 
      status: newStatus, 
      history: [...ticketToUpdate.history, newHistoryEntry] 
    };

    setTickets((prevTickets: Ticket[]) =>
      prevTickets.map(ticket => ticket.id === ticketId ? updatedTicket : ticket)
    );

    try {
      await upsertTicket(updatedTicket);
    } catch (err) {
      console.error('Erro ao atualizar ticket:', err);
    }
  };


  // --- DATA FILTERING BASED ON USER ---
  const visibleLoads = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.profile === UserProfile.Embarcador) {
      return cargos;
    }
    if (currentUser.profile === UserProfile.Cliente && currentUser.clientId) {
      return cargos.filter(c => c.clientId === currentUser.clientId);
    }
    return cargos;
  }, [currentUser, cargos, shipments]);

  const visibleShipments = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.profile === UserProfile.Embarcador) {
      return shipments.filter(s => s.embarcadorId === currentUser.id);
    }
    if (currentUser.profile === UserProfile.Cliente && currentUser.clientId) {
        const clientCargoIds = new Set(
            cargos.filter(c => c.clientId === currentUser.clientId).map(c => c.id)
        );
        return shipments.filter(s => clientCargoIds.has(s.cargoId));
    }
    return shipments;
  }, [currentUser, shipments, cargos]);
  
  const visibleEmbarcadores = useMemo(() => {
    if (!currentUser) return [];
    const allEmbarcadorUsers = users.filter(u => u.profile === UserProfile.Embarcador);

    if (currentUser.profile === UserProfile.Embarcador) {
        return allEmbarcadorUsers.filter(u => u.id === currentUser.id);
    }
    
    return allEmbarcadorUsers;
  }, [currentUser, users]);


  const inProgressLoads = useMemo(() => 
    visibleLoads.filter(c => c.status === CargoStatus.EmAndamento || c.status === CargoStatus.Suspensa),
    [visibleLoads]
  );
  
  // --- CRUD HANDLERS ---
  const handleCreateShipment = async (data: NewShipmentRequestData) => {
    if (!currentUser) return;
    
    let currentNextIds = { ...nextIds };
    let historyId = currentNextIds.history;
    
    const createHistoryLogLocal = (description: string): HistoryLog => {
      const newLog = {
        id: `log_${historyId}`,
        userId: currentUser.id,
        timestamp: new Date().toISOString(),
        description,
      };
      historyId++;
      return newLog;
    };

    let newDrivers = [...drivers];
    let addedDrivers: Driver[] = [];
    let driverToUse = drivers.find(d => d.name.trim().toLowerCase() === data.driverName.trim().toLowerCase());
    if (!driverToUse) {
      const newDriverId = formatId(currentNextIds.driver, 'DRV');
      driverToUse = {
        id: newDriverId,
        name: data.driverName,
        cpf: data.driverCpf || '',
        cnh: data.driverCnh || '',
        phone: data.driverContact || '',
        classification: DriverClassification.Terceiro,
        active: true,
      };
      newDrivers.unshift(driverToUse);
      addedDrivers.push(driverToUse);
      currentNextIds.driver++;
    }

    let newVehicles = [...vehicles];
    let addedVehicles: Vehicle[] = [];
    const defaultOwner = owners.find(o => o.name === 'PROPRIETÁRIO PADRÃO TERCEIRO');
    if (!defaultOwner) {
        alert("Erro crítico: Proprietário padrão para veículos de terceiros não encontrado. Contate o suporte.");
        return;
    }

    const processVehicle = (plate: string, isHorse: boolean) => {
        if (!plate || !plate.trim()) return;
        let vehicle = newVehicles.find(v => v.plate.trim().toLowerCase() === plate.trim().toLowerCase());
        if (!vehicle) {
            const newVehicleId = formatId(currentNextIds.vehicle, 'VEH');
            const newVehicle: Vehicle = {
                id: newVehicleId,
                plate: plate,
                setType: isHorse ? (data.vehicleSetType || VehicleSetType.LSSimples) : VehicleSetType.LSSimples,
                bodyType: isHorse ? (data.vehicleBodyType || VehicleBodyType.Graneleiro) : VehicleBodyType.Graneleiro,
                classification: DriverClassification.Terceiro,
                ownerId: defaultOwner.id,
            };
            newVehicles.unshift(newVehicle);
            addedVehicles.push(newVehicle);
            currentNextIds.vehicle++;
        }
    };

    processVehicle(data.horsePlate, true);
    processVehicle(data.trailer1Plate || '', false);
    processVehicle(data.trailer2Plate || '', false);
    processVehicle(data.trailer3Plate || '', false);

    const prefix = currentUser?.name ? currentUser.name.substring(0, 3).toUpperCase() : 'SHP';
    const newShipmentId = formatId(currentNextIds.shipment, prefix);
    
    const documentsUrlMap: { [key: string]: string[] } = {};
    const attachedFileNames: string[] = [];
    if (data.filesToAttach && data.filesToAttach.length > 0) {
      try {
        const newDocUrls = [];
        for (const file of data.filesToAttach) {
          const path = await uploadShipmentAttachment(newShipmentId, 'Arquivos Iniciais', file);
          const url = getShipmentAttachmentUrl(path);
          newDocUrls.push(url);
          attachedFileNames.push(file.name);
        }
        documentsUrlMap['Arquivos Iniciais'] = newDocUrls;
      } catch (error) {
        console.error('Erro ao fazer upload dos anexos iniciais:', error);
        alert('Ocorreu um erro ao enviar os arquivos. O embarque foi criado, mas os arquivos não puderam ser salvos.');
      }
    }
    
    let historyMsg = `Embarque ${newShipmentId} criado.`;
    if (attachedFileNames.length > 0) historyMsg += ` Anexo(s): ${attachedFileNames.join(', ')}.`;
    if (data.bankDetails) historyMsg += ` Dados bancários preenchidos.`;

    const newShipment: Shipment = {
      id: newShipmentId,
      orderId: `ord_${newShipmentId}`,
      cargoId: data.cargoId,
      driverName: data.driverName,
      driverContact: data.driverContact,
      driverCpf: data.driverCpf,
      embarcadorId: data.embarcadorId,
      horsePlate: data.horsePlate,
      trailer1Plate: data.trailer1Plate,
      trailer2Plate: data.trailer2Plate,
      trailer3Plate: data.trailer3Plate,
      shipmentTonnage: data.shipmentTonnage,
      driverFreightValue: data.driverFreightValue,
      driverFreightRateSnapshot: cargos.find(c => c.id === data.cargoId)?.driverFreightValuePerTon,
      companyFreightRateSnapshot: cargos.find(c => c.id === data.cargoId)?.companyFreightValuePerTon,
      status: ShipmentStatus.AguardandoSeguradora,
      scheduledDate: data.scheduledDate,
      scheduledTime: data.scheduledTime,
      bankDetails: data.bankDetails,
      documents: Object.keys(documentsUrlMap).length > 0 ? documentsUrlMap : undefined,
      history: [createHistoryLogLocal(historyMsg)],
      createdAt: new Date().toISOString(),
      createdById: currentUser.id,
      driverReferences: data.driverReferences,
      ownerContact: data.ownerContact,
      statusHistory: [{
        status: ShipmentStatus.AguardandoSeguradora,
        timestamp: new Date().toISOString(),
        userId: currentUser.id,
      }],
      vehicleTag: data.vehicleTag,
    };
    const newShipments = [newShipment, ...shipments];
    
    const newCargos = cargos.map(cargo => {
      if (cargo.id === data.cargoId) {
        const newScheduledVolume = cargo.scheduledVolume + data.shipmentTonnage;
        return {
          ...cargo,
          scheduledVolume: newScheduledVolume,
          history: [...cargo.history, createHistoryLogLocal(`Volume agendado atualizado para ${newScheduledVolume.toFixed(2)} ton devido ao novo embarque ${newShipmentId}`)],
        };
      }
      return cargo;
    });
    
    currentNextIds.shipment++;
    currentNextIds.history = historyId;
    
    // Batch state updates (optimistic)
    setDrivers(newDrivers);
    setVehicles(newVehicles);
    setShipments(newShipments);
    setCargos(newCargos);
    setNextIds(currentNextIds);

    // Persist to Supabase
    try {
      const updatedCargo = newCargos.find(c => c.id === data.cargoId);
      await Promise.all([
        upsertManyDrivers(addedDrivers),
        upsertManyVehicles(addedVehicles),
        insertShipment(newShipment),
        updatedCargo ? upsertCargo(updatedCargo) : Promise.resolve(),
      ]);
    } catch (err) {
      console.error('Erro ao salvar embarque no Supabase:', err);
    }

    setCurrentPage('shipments');
    alert(`Novo embarque ${newShipmentId} criado com sucesso! Motoristas/Veículos não cadastrados foram adicionados automaticamente.`);
  };

  const handleMarkArrival = async (shipmentId: string) => {
    if (!currentUser) return;
    const shipmentToUpdate = shipments.find(s => s.id === shipmentId);
    if (!shipmentToUpdate) return;

    const now = new Date().toISOString();
    const updatedShipment: Shipment = { 
      ...shipmentToUpdate, 
      arrivalTime: now, 
      history: [...shipmentToUpdate.history, createHistoryLog(`Chegada do veículo marcada em ${new Date(now).toLocaleString('pt-BR')}`)] 
    };

    setShipments((prev: Shipment[]) => prev.map(s => s.id === shipmentId ? updatedShipment : s));
    try {
      await upsertShipment(updatedShipment);
    } catch (err) {
      console.error('Erro ao marcar chegada:', err);
    }
  };

  const handleUpdateShipmentAttachment = async (shipmentId: string, data: { 
    filesToAttach: { [key: string]: File[] }, 
    bankDetails?: string, 
    loadedTonnage?: number, 
    advancePercentage?: number, 
    advanceValue?: number,
    tollValue?: number, 
    balanceToReceiveValue?: number,
    discountValue?: number,
    netBalanceValue?: number,
    unloadedTonnage?: number,
    route?: string 
  }) => {
    const { filesToAttach, bankDetails, loadedTonnage, advancePercentage, advanceValue, tollValue, balanceToReceiveValue, discountValue, netBalanceValue, unloadedTonnage, route } = data;
    const originalShipment = shipments.find(s => s.id === shipmentId);
    if (!originalShipment || !currentUser) return;

    // Validation for "Aguardando Nota" transition
    if (originalShipment.status === ShipmentStatus.AguardandoNota && !originalShipment.bankDetails && !bankDetails) {
        alert('Dados bancários são obrigatórios para avançar para a etapa de adiantamento.');
        return;
    }

    if (originalShipment.status === ShipmentStatus.AguardandoCarregamento && !route?.trim()) {
        alert('A rota do motorista é obrigatória para avançar para a próxima etapa.');
        return;
    }

    if (originalShipment.status === ShipmentStatus.AguardandoCarregamento && (!loadedTonnage || loadedTonnage <= 0)) {
        alert('O peso carregado é obrigatório para avançar para a próxima etapa.');
        return;
    }

    let nextStatus: ShipmentStatus | undefined;

    if (originalShipment.status === ShipmentStatus.AguardandoAdiantamento) {
        const relatedCargo = cargos.find(c => c.id === originalShipment.cargoId);
        if (relatedCargo?.requiresScheduling) {
            nextStatus = ShipmentStatus.AguardandoAgendamento;
        } else {
            nextStatus = ShipmentStatus.AguardandoDescarga;
        }
    } else {
        nextStatus = nextStatusMap[originalShipment.status];
    }
    
    if (!nextStatus) return;


    const currentStatus = originalShipment.status;
    let isUserAllowed = true;
    let alertMessage = '';

    // Check permissions based on the current status
    if (currentStatus === ShipmentStatus.PreCadastro || currentStatus === ShipmentStatus.AguardandoSeguradora) {
        isUserAllowed = [UserProfile.Fiscal, UserProfile.Admin].includes(currentUser.profile);
        alertMessage = 'Apenas os perfis Fiscal ou Administrador podem realizar esta ação.';
    } else if (currentStatus === ShipmentStatus.AguardandoAdiantamento || currentStatus === ShipmentStatus.AguardandoPagamentoSaldo) {
        isUserAllowed = [UserProfile.Financeiro, UserProfile.Diretor, UserProfile.Admin].includes(currentUser.profile);
        alertMessage = 'Apenas os perfis Financeiro, Diretor ou Administrador do Sistema podem realizar esta ação.';
    }

    if (!isUserAllowed) {
        alert(`Você não tem permissão para alterar o status deste embarque. ${alertMessage}`);
        return;
    }

    const updatedDocuments = { ...(originalShipment.documents || {}) };
    const attachedFileNames: string[] = [];

    try {
      for (const docType in filesToAttach) {
        const newDocUrls = [];
        for (const file of filesToAttach[docType]) {
          const path = await uploadShipmentAttachment(shipmentId, docType, file);
          const url = getShipmentAttachmentUrl(path);
          newDocUrls.push(url);
          attachedFileNames.push(file.name);
        }
        const existingDocs = updatedDocuments[docType] || [];
        updatedDocuments[docType] = [...existingDocs, ...newDocUrls];
      }
    } catch (error) {
      console.error('Erro ao fazer upload dos anexos:', error);
      alert('Ocorreu um erro ao enviar os arquivos. Tente novamente.');
      return;
    }
    
    const historyLogs = [];
    if(attachedFileNames.length > 0) historyLogs.push(`anexo(s): ${attachedFileNames.join(', ')}`);
    if(bankDetails) historyLogs.push(`Dados bancários preenchidos.`);

    let updatedTonnage = originalShipment.shipmentTonnage;
    let updatedDriverFreight = originalShipment.driverFreightValue;
    
    // Recalcular frete se a tonelagem carregada for informada
    if (loadedTonnage !== undefined && loadedTonnage > 0) {
        updatedTonnage = loadedTonnage;
        const rateToUse = originalShipment.driverFreightRateSnapshot || cargos.find(c => c.id === originalShipment.cargoId)?.driverFreightValuePerTon || 0;
        updatedDriverFreight = rateToUse * loadedTonnage;
        const formattedVal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(updatedDriverFreight);
        historyLogs.push(`Tonelagem ajustada após carregamento para ${loadedTonnage.toLocaleString('pt-BR')} ton. Frete atualizado com base na taxa de ${rateToUse.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})} para ${formattedVal}.`);
    }
    
    let calculatedAdvanceValue = originalShipment.advanceValue;
    let finalAdvancePercentage = originalShipment.advancePercentage;
    
    // Use manually provided advanceValue if available, otherwise calculate from percentage
    if (advanceValue !== undefined) {
        calculatedAdvanceValue = advanceValue;
        finalAdvancePercentage = advancePercentage || originalShipment.advancePercentage;
        
        const formattedAdv = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculatedAdvanceValue);
        let historyMsg = `Valor pago na conta de R$ ${calculatedAdvanceValue.toLocaleString('pt-BR')} registrado.`;
        if (finalAdvancePercentage) historyMsg += ` (Equivalente a ${finalAdvancePercentage}%)`;
        historyLogs.push(historyMsg);
    } else if (advancePercentage !== undefined && advancePercentage > 0) {
        finalAdvancePercentage = advancePercentage;
        calculatedAdvanceValue = ((updatedDriverFreight * advancePercentage) / 100) - (tollValue || 0);
        const formattedAdv = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculatedAdvanceValue);
        let historyMsg = `Pagamento de Adiantamento: ${advancePercentage}% registrado (${formattedAdv}).`;
        if (tollValue && tollValue > 0) {
            historyMsg += ` (Dedução de R$ ${tollValue.toLocaleString('pt-BR')} ref. pedágio)`;
        }
        historyLogs.push(historyMsg);
    }

    let finalBalanceToReceive = originalShipment.balanceToReceiveValue;
    let finalDiscountValue = originalShipment.discountValue;
    let finalNetBalanceValue = originalShipment.netBalanceValue;

    if (balanceToReceiveValue !== undefined || discountValue !== undefined || netBalanceValue !== undefined) {
        finalBalanceToReceive = balanceToReceiveValue ?? originalShipment.balanceToReceiveValue;
        finalDiscountValue = discountValue ?? originalShipment.discountValue;
        finalNetBalanceValue = netBalanceValue ?? originalShipment.netBalanceValue;

        const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
        let historyMsg = `Pagamento de Saldo registrado: `;
        if (balanceToReceiveValue !== undefined) historyMsg += `Bruto: ${fmt.format(balanceToReceiveValue)}. `;
        if (discountValue !== undefined) historyMsg += `Descontos: ${fmt.format(discountValue)}. `;
        if (netBalanceValue !== undefined) historyMsg += `Líquido pago: ${fmt.format(netBalanceValue)}.`;
        historyLogs.push(historyMsg);
    }

    let finalUnloadedTonnage = originalShipment.unloadedTonnage;
    if (unloadedTonnage !== undefined && unloadedTonnage > 0) {
        finalUnloadedTonnage = unloadedTonnage;
        let historyMsg = `Peso descarregado informado: ${unloadedTonnage.toLocaleString('pt-BR')} ton.`;
        if (unloadedTonnage < updatedTonnage) {
            const quebra = updatedTonnage - unloadedTonnage;
            historyMsg += ` (QUEBRA DETECTADA: ${quebra.toLocaleString('pt-BR')} ton).`;
        }
        historyLogs.push(historyMsg);
    }
    
    if (route) {
        historyLogs.push(`Rota informada: ${route}`);
    }

    const updatedShipment: Shipment = {
        ...originalShipment,
        status: nextStatus,
        documents: updatedDocuments,
        bankDetails: bankDetails || originalShipment.bankDetails,
        shipmentTonnage: updatedTonnage,
        driverFreightValue: updatedDriverFreight,
        advancePercentage: finalAdvancePercentage,
        advanceValue: calculatedAdvanceValue,
        tollValue: tollValue !== undefined ? tollValue : originalShipment.tollValue,
        balanceToReceiveValue: finalBalanceToReceive,
        discountValue: finalDiscountValue,
        netBalanceValue: finalNetBalanceValue,
        unloadedTonnage: finalUnloadedTonnage,
        route: route || originalShipment.route,
        history: [...originalShipment.history, createHistoryLog(`Status alterado para ${nextStatus}. ${historyLogs.join(' ')}`)],
        statusHistory: [
            ...(originalShipment.statusHistory || []),
            {
                status: nextStatus,
                timestamp: new Date().toISOString(),
                userId: currentUser.id,
            }
        ],
    };
    
    setShipments((prev: Shipment[]) => prev.map(s => s.id === shipmentId ? updatedShipment : s));

    const isAdvancingToLoaded = nextStatus === ShipmentStatus.AguardandoDescarga && 
                              Object.values(ShipmentStatus).indexOf(originalShipment.status) < Object.values(ShipmentStatus).indexOf(ShipmentStatus.AguardandoDescarga);

    let updatedCargo: Cargo | undefined;
    if (isAdvancingToLoaded) {
      setCargos(prevCargos =>
        prevCargos.map(cargo => {
          if (cargo.id === originalShipment.cargoId) {
            const newLoadedVolume = cargo.loadedVolume + originalShipment.shipmentTonnage;
            updatedCargo = { ...cargo, loadedVolume: newLoadedVolume, history: [...cargo.history, createHistoryLog(`Volume carregado atualizado para ${newLoadedVolume.toFixed(2)} ton. Embarque ${shipmentId} aguarda descarga.`)] };
            return updatedCargo;
          }
          return cargo;
        })
      );
    }

    // Persist to Supabase
    try {
      await upsertShipment(updatedShipment);
      if (updatedCargo) await upsertCargo(updatedCargo);
    } catch(err) { console.error('Erro ao atualizar embarque:', err); }
  };

  const handleUpdateShipmentAnttAndBankDetails = async (shipmentId: string, data: { anttOwnerIdentifier: string; bankDetails?: string }) => {
    const shipmentToUpdate = shipments.find(s => s.id === shipmentId);
    if (!shipmentToUpdate) return;

    const changes: string[] = [];
    if (shipmentToUpdate.anttOwnerIdentifier !== data.anttOwnerIdentifier) changes.push(`${FIELD_TRANSLATIONS.anttOwnerIdentifier} definido.`);
    if (data.bankDetails && shipmentToUpdate.bankDetails !== data.bankDetails) changes.push(`${FIELD_TRANSLATIONS.bankDetails} definidos.`);

    const updatedShipment: Shipment = { 
      ...shipmentToUpdate, 
      anttOwnerIdentifier: data.anttOwnerIdentifier, 
      bankDetails: data.bankDetails || shipmentToUpdate.bankDetails, 
      history: changes.length > 0 ? [...shipmentToUpdate.history, createHistoryLog(changes.join(' '))] : shipmentToUpdate.history 
    };

    setShipments((prev: Shipment[]) => prev.map(s => s.id === shipmentId ? updatedShipment : s));
    try {
      await upsertShipment(updatedShipment);
    } catch (err) {
      console.error('Erro ao atualizar ANTT/banco:', err);
    }
  };

  const handleUpdateShipmentPrice = async (shipmentId: string, data: { newTotal: number, newRate?: number, newCompanyRate?: number }) => {
    const shipmentToUpdate = shipments.find(s => s.id === shipmentId);
    if (!shipmentToUpdate) return;

    const oldPriceFormatted = shipmentToUpdate.driverFreightValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const newPriceFormatted = data.newTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const historyMsgParts = [`${FIELD_TRANSLATIONS['driverFreightValue']} alterado de "${oldPriceFormatted}" para "${newPriceFormatted}".`];

    const updateObj: Partial<Shipment> = { driverFreightValue: data.newTotal };
    
    if (data.newRate !== undefined) {
      const oldRateFormatted = (shipmentToUpdate.driverFreightRateSnapshot || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const newRateFormatted = data.newRate.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      updateObj.driverFreightRateSnapshot = data.newRate;
      historyMsgParts.push(`Taxa do motorista alterada de "${oldRateFormatted}" para "${newRateFormatted}".`);
    }

    if (data.newCompanyRate !== undefined) {
      const oldCompanyRateFormatted = (shipmentToUpdate.companyFreightRateSnapshot || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const newCompanyRateFormatted = data.newCompanyRate.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      updateObj.companyFreightRateSnapshot = data.newCompanyRate;
      historyMsgParts.push(`Frete Empresa alterado de "${oldCompanyRateFormatted}" para "${newCompanyRateFormatted}".`);
    }

    const updatedShipment: Shipment = { 
      ...shipmentToUpdate, 
      ...updateObj, 
      history: [...shipmentToUpdate.history, createHistoryLog(historyMsgParts.join(' '))] 
    };

    setShipments((prev: Shipment[]) => prev.map(s => s.id === shipmentId ? updatedShipment : s));
    try {
      await upsertShipment(updatedShipment);
    } catch (err) {
      console.error('Erro ao atualizar preço:', err);
    }
  };
  
  const handleConfirmCancelShipment = async (shipmentId: string, reason: string) => {
    const shipmentToCancel = shipments.find(s => s.id === shipmentId);
    if (!shipmentToCancel || !currentUser) return;
    
    const oldStatus = shipmentToCancel.status;
    const historyEntry = `Status alterado de "${oldStatus}" para "${ShipmentStatus.Cancelado}". Motivo: ${reason}`;
    
    const cancelledShipment: Shipment = { 
      ...shipmentToCancel, 
      status: ShipmentStatus.Cancelado,
      cancellationReason: reason,
      history: [...shipmentToCancel.history, createHistoryLog(historyEntry)], 
      statusHistory: [...(shipmentToCancel.statusHistory || []), { status: ShipmentStatus.Cancelado, timestamp: new Date().toISOString(), userId: currentUser.id }] 
    };

    setShipments((prev: Shipment[]) => prev.map(s => s.id === shipmentId ? cancelledShipment : s));

    const wasLoaded = Object.values(ShipmentStatus).indexOf(shipmentToCancel.status) >= Object.values(ShipmentStatus).indexOf(ShipmentStatus.AguardandoDescarga);
    const relatedCargo = cargos.find(c => c.id === shipmentToCancel.cargoId);
    
    let updatedCargo: Cargo | undefined;
    if (relatedCargo) {
        const newScheduledVolume = relatedCargo.scheduledVolume - shipmentToCancel.shipmentTonnage;
        const newLoadedVolume = wasLoaded ? relatedCargo.loadedVolume - shipmentToCancel.shipmentTonnage : relatedCargo.loadedVolume;
        const historyDescription = wasLoaded
            ? `Volumes agendado e carregado ajustados devido ao cancelamento do embarque ${shipmentId}`
            : `Volume agendado ajustado devido ao cancelamento do embarque ${shipmentId}`;
        
        updatedCargo = { 
            ...relatedCargo, 
            scheduledVolume: Math.max(0, newScheduledVolume), 
            loadedVolume: Math.max(0, newLoadedVolume), 
            history: [...relatedCargo.history, createHistoryLog(historyDescription)] 
        };
        
        setCargos(prevCargos => prevCargos.map(cargo => cargo.id === relatedCargo.id ? updatedCargo! : cargo));
    }

    try {
      await upsertShipment(cancelledShipment);
      if (updatedCargo) await upsertCargo(updatedCargo);
    } catch (err) {
      console.error('Erro ao cancelar embarque:', err);
    }
  };

  const handleTransferShipment = async (shipmentId: string, newEmbarcadorId: string) => {
    let updated: Shipment | undefined;
    setShipments((prev: Shipment[]) => prev.map(s => {
        if (s.id === shipmentId) {
            const oldEmbarcadorName = users.find(u => u.id === s.embarcadorId)?.name || 'N/A';
            const newEmbarcadorName = users.find(u => u.id === newEmbarcadorId)?.name || 'N/A';
            updated = { ...s, embarcadorId: newEmbarcadorId, history: [...s.history, createHistoryLog(`Embarcador responsável alterado de "${oldEmbarcadorName}" para "${newEmbarcadorName}".`)] };
            return updated;
        }
        return s;
    }));
    if (updated) {
      try { await upsertShipment(updated); } catch(err) { console.error('Erro ao transferir embarque:', err); }
    }
  };

  const handleSaveClient = async (clientData: Client | Omit<Client, 'id'>) => {
    let saved: Client;
    if ('id' in clientData) {
      saved = clientData;
      setClients(prev => prev.map(c => c.id === clientData.id ? clientData : c));
    } else { 
      const newId = formatId(nextIds.client, 'CLI');
      saved = { ...clientData, id: newId };
      setClients(prev => [saved, ...prev]);
      setNextIds((prev: any) => ({ ...prev, client: prev.client + 1 }));
    }
    try { await upsertClient(saved); } catch(err) { console.error('Erro ao salvar cliente:', err); }
  };
  
  const handleDeleteCargo = async (cargoId: string) => {
    if (!currentUser || currentUser.profile !== UserProfile.Admin) return;
    
    const relatedShipments = shipments.filter(s => s.cargoId === cargoId);
    const confirmMsg = relatedShipments.length > 0
      ? `A carga ${cargoId} possui ${relatedShipments.length} embarque(s) associado(s). Se você excluir a carga, os embarques NÃO serão excluídos, mas poderão ficar sem os detalhes da carga original na visualização. Deseja excluir a carga e manter os embarques?`
      : `Tem certeza que deseja excluir permanentemente a carga ${cargoId}?`;

    if (window.confirm(confirmMsg)) {
        try {
            await deleteCargo(cargoId);
            setCargos(prev => prev.filter(c => c.id !== cargoId));
            
            // Shipments are NOT deleted anymore to preserve historical data
            alert("Carga excluída com sucesso. Os embarques vinculados foram preservados.");
        } catch (err) {
            console.error('Erro ao excluir carga:', err);
            alert("Erro ao excluir carga. Verifique o console.");
        }
    }
  };


  const handleDeleteShipment = async (shipmentId: string) => {
    if (!currentUser || currentUser.profile !== UserProfile.Admin) return;
    
    const shipmentToDelete = shipments.find(s => s.id === shipmentId);
    if (!shipmentToDelete) return;

    if (window.confirm(`Tem certeza que deseja excluir permanentemente o embarque ${shipmentId}?`)) {
        try {
            await deleteShipment(shipmentId);
            setShipments((prev: Shipment[]) => prev.filter(s => s.id !== shipmentId));

            // Atualizar volumes da carga
            const wasLoaded = Object.values(ShipmentStatus).indexOf(shipmentToDelete.status) >= Object.values(ShipmentStatus).indexOf(ShipmentStatus.AguardandoDescarga);
            const relatedCargo = cargos.find(c => c.id === shipmentToDelete.cargoId);
            
            if (relatedCargo) {
                const newScheduledVolume = Math.max(0, relatedCargo.scheduledVolume - shipmentToDelete.shipmentTonnage);
                const newLoadedVolume = wasLoaded ? Math.max(0, relatedCargo.loadedVolume - shipmentToDelete.shipmentTonnage) : relatedCargo.loadedVolume;
                const updatedCargo: Cargo = { 
                    ...relatedCargo, 
                    scheduledVolume: newScheduledVolume, 
                    loadedVolume: newLoadedVolume,
                    history: [...relatedCargo.history, createHistoryLog(`Embarque ${shipmentId} EXCLUÍDO pelo Administrador. Volumes ajustados.`)]
                };
                
                setCargos(prevCargos => prevCargos.map(cargo => cargo.id === relatedCargo.id ? updatedCargo : cargo));
                await upsertCargo(updatedCargo);
            }
            alert("Embarque excluído com sucesso e volumes da carga recalculados.");
        } catch (err) {
            console.error('Erro ao excluir embarque:', err);
            alert("Erro ao excluir embarque. Verifique o console.");
        }
    }
  };

  const handleSaveOwner = async (ownerData: Owner | Omit<Owner, 'id'>) => {
    let saved: Owner;
    if ('id' in ownerData) {
      saved = ownerData;
      setOwners(prev => prev.map(o => o.id === ownerData.id ? ownerData : o));
    } else {
      const newId = formatId(nextIds.owner, 'OWN');
      saved = { ...ownerData, id: newId };
      setOwners(prev => [saved, ...prev]);
      setNextIds((prev: any) => ({ ...prev, owner: prev.owner + 1 }));
    }
    try { await upsertOwner(saved); } catch(err) { console.error('Erro ao salvar proprietário:', err); }
  };

  const handleSaveDriver = async (driverData: Driver | Omit<Driver, 'id'>) => {
    let saved: Driver;
    if ('id' in driverData) {
      saved = driverData;
      setDrivers(prev => prev.map(d => d.id === driverData.id ? driverData : d));
    } else {
      const newId = formatId(nextIds.driver, 'DRV');
      saved = { ...driverData, id: newId };
      setDrivers(prev => [saved, ...prev]);
      setNextIds((prev: any) => ({ ...prev, driver: prev.driver + 1 }));
    }
    try { await upsertDriver(saved); } catch(err) { console.error('Erro ao salvar motorista:', err); }
  };

  const handleSaveVehicle = async (vehicleData: Vehicle | Omit<Vehicle, 'id'>) => {
    let saved: Vehicle;
    if ('id' in vehicleData) {
      saved = vehicleData;
      setVehicles(prev => prev.map(v => v.id === vehicleData.id ? vehicleData : v));
    } else {
      const newId = formatId(nextIds.vehicle, 'VEH');
      saved = { ...vehicleData, id: newId };
      setVehicles(prev => [saved, ...prev]);
      setNextIds((prev: any) => ({ ...prev, vehicle: prev.vehicle + 1 }));
    }
    try { await upsertVehicle(saved); } catch(err) { console.error('Erro ao salvar veículo:', err); }
  };

  const handleSaveProduct = async (productData: Product | Omit<Product, 'id'>) => {
    let saved: Product;
    if ('id' in productData) {
      saved = productData;
      setProducts(prev => prev.map(p => p.id === productData.id ? productData : p));
    } else {
      const newId = `PRD-${String(nextIds.product).padStart(3, '0')}`;
      saved = { ...productData, id: newId };
      setProducts(prev => [saved, ...prev]);
      setNextIds((prev: any) => ({ ...prev, product: prev.product + 1 }));
    }
    try { await upsertProduct(saved); } catch(err) { console.error('Erro ao salvar produto:', err); }
    alert('Produto salvo com sucesso!');
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      await deleteProduct(productId);
      setProducts(prev => prev.filter(p => p.id !== productId));
      alert('Produto excluído com sucesso.');
    } catch (err) {
      console.error('Erro ao excluir produto:', err);
      alert('Erro ao excluir produto.');
    }
  };
  
  const handleSaveLoad = async (loadData: Cargo | Omit<Cargo, 'id' | 'history' | 'createdAt' | 'createdById'>) => {
    if ('id' in loadData) {
      const oldCargo = cargos.find(l => l.id === loadData.id);
      if (!oldCargo) return;

      const changes: string[] = [];
      (Object.keys(loadData) as Array<keyof Cargo>).forEach(key => {
        if (key === 'scheduledVolume' || key === 'loadedVolume') return;

        const oldValue: any = oldCargo[key];
        const newValue: any = loadData[key];

        if (key !== 'id' && key !== 'history' && key !== 'createdAt' && oldValue !== newValue) {
          const fieldName = FIELD_TRANSLATIONS[key] || key;
          let oldDisplayValue = oldValue;
          let newDisplayValue = newValue;

          switch (key) {
            case 'clientId':
              oldDisplayValue = clients.find(c => c.id === oldValue)?.nomeFantasia || oldValue;
              newDisplayValue = clients.find(c => c.id === newValue)?.nomeFantasia || newValue;
              break;
            case 'productId':
              oldDisplayValue = products.find(p => p.id === oldValue)?.name || oldValue;
              newDisplayValue = products.find(p => p.id === newValue)?.name || newValue;
              break;
            case 'createdById':
              oldDisplayValue = users.find(u => u.id === oldValue)?.name || oldValue;
              newDisplayValue = users.find(u => u.id === newValue)?.name || newValue;
              break;
            case 'hasIcms':
            case 'requiresScheduling':
              oldDisplayValue = oldValue ? 'Sim' : 'Não';
              newDisplayValue = newValue ? 'Sim' : 'Não';
              break;
            case 'companyFreightValuePerTon':
            case 'driverFreightValuePerTon':
              oldDisplayValue = oldValue?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? 'N/A';
              newDisplayValue = newValue?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? 'N/A';
              break;
            case 'totalVolume':
              oldDisplayValue = `${oldValue} ton`;
              newDisplayValue = `${newValue} ton`;
              break;
            case 'icmsPercentage':
              oldDisplayValue = `${oldValue}%`;
              newDisplayValue = `${newValue}%`;
              break;
            case 'originCoords':
            case 'destinationCoords':
              oldDisplayValue = oldValue ? `Lat: ${oldValue.lat.toFixed(4)}, Lng: ${oldValue.lng.toFixed(4)}` : 'N/A';
              newDisplayValue = newValue ? `Lat: ${newValue.lat.toFixed(4)}, Lng: ${newValue.lng.toFixed(4)}` : 'N/A';
              break;
            case 'dailySchedule':
              oldDisplayValue = Array.isArray(oldValue) && oldValue.length > 0 ? `${oldValue.length} dias agendados` : (oldValue === "" ? 'Vazio' : 'N/A');
              newDisplayValue = Array.isArray(newValue) && newValue.length > 0 ? `${newValue.length} dias agendados` : 'Vazio';
              break;
            case 'freightLegs':
              oldDisplayValue = Array.isArray(oldValue) && oldValue.length > 0 ? `${oldValue.length} trechos` : 'Padrão';
              newDisplayValue = Array.isArray(newValue) && newValue.length > 0 ? `${newValue.length} trechos` : 'Padrão';
              break;
          }
          changes.push(`${fieldName} alterado de "${oldDisplayValue}" para "${newDisplayValue}"`);
        }
      });

      let updatedCargo: Cargo;
      if (changes.length > 0) {
        const newHistory = createHistoryLog(`Carga atualizada: ${changes.join('; ')}.`);
        updatedCargo = { ...oldCargo, ...loadData, history: [...oldCargo.history, newHistory] };
      } else {
        updatedCargo = { ...oldCargo, ...loadData };
      }

      setCargos(prev => prev.map(l => l.id === loadData.id ? updatedCargo : l));
      try {
        await upsertCargo(updatedCargo);
      } catch (err) {
        console.error('Erro ao atualizar carga:', err);
      }
    } else { 
      if (!currentUser) return;
      const newId = formatId(nextIds.cargo, 'CRG');
      const newLoad: Cargo = {
        ...loadData,
        id: newId,
        createdAt: new Date().toISOString(),
        createdById: (loadData as any).createdById || currentUser.id,
        history: [createHistoryLog(`Carga ${newId} criada`)],
      };
      setCargos(prev => [newLoad, ...prev]);
      setNextIds((prev: any) => ({ ...prev, cargo: prev.cargo + 1 }));
      try { await insertCargo(newLoad); } catch(err) { console.error('Erro ao criar carga:', err); }
    }
  };

  const handleSaveUser = async (userData: User | Omit<User, 'id'>) => {
    let saved: User;
    if ('id' in userData) {
      saved = userData;
      setUsers(prev => prev.map(u => u.id === userData.id ? { ...u, ...userData } : u));
    } else { 
      const newId = formatId(nextIds.user, 'USR');
      saved = { ...userData, id: newId } as User;
      setUsers(prev => [saved, ...prev]);
      setNextIds((prev: any) => ({ ...prev, user: prev.user + 1 }));
    }
    try { await upsertUser(saved); } catch(err) { console.error('Erro ao salvar usuário:', err); }
  };
  
  const handleDeleteUser = async (userId: string) => {
    if (!currentUser || currentUser.profile !== UserProfile.Admin) return;
    if (userId === currentUser.id) {
        alert("Você não pode excluir seu próprio usuário.");
        return;
    }
    
    if (window.confirm('Tem certeza que deseja excluir permanentemente este usuário?')) {
        try {
            await deleteUser(userId);
            setUsers(prev => prev.filter(u => u.id !== userId));
            alert("Usuário excluído com sucesso.");
        } catch (err) {
            console.error('Erro ao excluir usuário:', err);
            alert("Erro ao excluir usuário. Verifique o console.");
        }
    }
  };

  const handleRevertShipmentStatus = async (shipmentId: string) => {
    const shipment = shipments.find(s => s.id === shipmentId);
    if (!shipment || !currentUser) return;
    
    if (![UserProfile.Admin, UserProfile.Diretor].includes(currentUser.profile)) {
        alert("Apenas administradores ou diretores podem reverter o status.");
        return;
    }

    if (!shipment.statusHistory || shipment.statusHistory.length <= 1) {
        alert("Não há histórico de status para reverter.");
        return;
    }

    const currentStatus = shipment.status;
    const historyCopy = [...shipment.statusHistory];
    historyCopy.pop(); // Remove the current status entry
    const previousStatusEntry = historyCopy[historyCopy.length - 1];
    const previousStatus = previousStatusEntry.status;

    const docTypeToRemove = REQUIRED_DOCUMENT_MAP[previousStatus];
    const updatedDocuments = { ...(shipment.documents || {}) };
    if (docTypeToRemove && updatedDocuments[docTypeToRemove]) {
        delete updatedDocuments[docTypeToRemove];
    }

    let updatedCargo: Cargo | undefined;
    if (currentStatus === ShipmentStatus.AguardandoDescarga) {
        const cargo = cargos.find(c => c.id === shipment.cargoId);
        if (cargo) {
            const newLoadedVolume = Math.max(0, cargo.loadedVolume - shipment.shipmentTonnage);
            updatedCargo = {
                ...cargo,
                loadedVolume: newLoadedVolume,
                history: [...cargo.history, createHistoryLog(`Volume carregado estornado devido à reversão do embarque ${shipmentId} (Status revertido para ${previousStatus}).`)]
            };
        }
    }

    const updatedShipment: Shipment = {
        ...shipment,
        status: previousStatus,
        statusHistory: historyCopy,
        documents: Object.keys(updatedDocuments).length > 0 ? updatedDocuments : undefined,
        history: [...shipment.history, createHistoryLog(`Status revertido de "${currentStatus}" para "${previousStatus}" por ${currentUser.name}. Anexos do último passo removidos.`)]
    };

    setShipments((prev: Shipment[]) => prev.map(s => s.id === shipmentId ? updatedShipment : s));
    if (updatedCargo) {
        setCargos(prev => prev.map(c => c.id === updatedShipment.cargoId ? updatedCargo! : c));
    }

    try {
        await upsertShipment(updatedShipment);
        if (updatedCargo) await upsertCargo(updatedCargo);
    } catch (err) {
        console.error('Erro ao reverter status:', err);
        alert("Erro ao salvar a reversão no banco de dados.");
    }
  };

  // --- RENDER LOGIC ---
  const renderPage = () => {
    if (!currentUser) return null;

    // We moved the isLoading check to the top-level to prevent race conditions during login.

    if (loadError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '16px' }}>
          <p style={{ color: '#ef4444', fontSize: '16px' }}>{loadError}</p>
          <button onClick={() => loadAllData()} style={{ padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Tentar novamente</button>
        </div>
      );
    }


    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage cargos={visibleLoads} shipments={visibleShipments} users={users} currentUser={currentUser} clients={clients} />;
      case 'clients':
        return <ClientsPage clients={clients} setClients={setClients} onSaveClient={handleSaveClient} currentUser={currentUser} profilePermissions={profilePermissions} />;
      case 'owners':
        return <OwnersPage owners={owners} setOwners={setOwners} onSaveOwner={handleSaveOwner} currentUser={currentUser} profilePermissions={profilePermissions} />;
      case 'drivers':
        return <DriversPage drivers={drivers} setDrivers={setDrivers} onSaveDriver={handleSaveDriver} owners={owners} currentUser={currentUser} profilePermissions={profilePermissions} />;
      case 'vehicles':
        return <VehiclesPage vehicles={vehicles} setVehicles={setVehicles} onSaveVehicle={handleSaveVehicle} owners={owners} currentUser={currentUser} profilePermissions={profilePermissions} />;
      case 'loads':
        return <LoadsPage loads={visibleLoads} setLoads={setCargos} clients={clients} products={products} onSaveLoad={handleSaveLoad} currentUser={currentUser} profilePermissions={profilePermissions} users={users} shipments={visibleShipments} onDeleteLoad={handleDeleteCargo} onModalStateChange={setIsAnyModalOpen} />;
      case 'products':
        return <ProductsPage products={products} onSaveProduct={handleSaveProduct} onDeleteProduct={handleDeleteProduct} currentUser={currentUser} profilePermissions={profilePermissions} />;
      case 'shipments':
        return <ShipmentsPage 
                    shipments={visibleShipments} 
                    cargos={cargos} 
                    clients={clients} 
                    products={products}
                    drivers={drivers} 
                    vehicles={vehicles}
                    currentUser={currentUser} 
                    profilePermissions={profilePermissions} 
                    users={users}
                    onUpdateAttachment={handleUpdateShipmentAttachment}
                    onUpdatePrice={handleUpdateShipmentPrice}
                    onConfirmCancel={handleConfirmCancelShipment}
                    onUpdateAnttAndBankDetails={handleUpdateShipmentAnttAndBankDetails}
                    onMarkArrival={handleMarkArrival}
                    onTransferShipment={handleTransferShipment}
                    onDeleteShipment={handleDeleteShipment}
                    onRevertStatus={handleRevertShipmentStatus}
                    activeLocks={activeLocks}
                    onModalStateChange={setIsAnyModalOpen}
                />;
      case 'operational-loads':
        return (
          <OperationalLoadsPage
            loads={inProgressLoads}
            clients={clients}
            products={products}
            drivers={drivers}
            vehicles={vehicles}
            onCreateShipment={handleCreateShipment}
            onSaveLoad={handleSaveLoad}
            currentUser={currentUser} 
            profilePermissions={profilePermissions}
            shipments={visibleShipments}
            users={users}
            onDeleteLoad={handleDeleteCargo}
            onModalStateChange={setIsAnyModalOpen}
          />
        );
      case 'operational-map':
        return (
          <OperationalMapPage
            cargos={cargos}
            shipments={shipments}
            clients={clients}
            products={products}
            drivers={drivers}
            vehicles={vehicles}
            onCreateShipment={handleCreateShipment}
            currentUser={currentUser}
            users={users}
            onModalStateChange={setIsAnyModalOpen}
          />
        );
      case 'financial':
        return <CommissionsPage shipments={visibleShipments} cargos={cargos} users={users} />;
      case 'reports':
        return <ReportsPage shipments={visibleShipments} embarcadores={visibleEmbarcadores} cargos={cargos} users={users} currentUser={currentUser} clients={clients} />;
      case 'users-register':
        return <UsersPage 
                  users={users} 
                  setUsers={setUsers} 
                  onSaveUser={handleSaveUser} 
                  currentUser={currentUser} 
                  profilePermissions={profilePermissions} 
                  onSavePermissions={handleSavePermissions}
                  clients={clients}
                  onDeleteUser={handleDeleteUser}
                />;
      case 'appearance':
        return <AppearancePage
                  currentLogo={companyLogo}
                  onSaveLogo={handleSaveLogo}
                  currentTheme={themeImage}
                  onSaveTheme={handleSaveThemeImage}
                />;
      case 'shipment-history':
        return <ShipmentHistoryPage
                  shipments={visibleShipments}
                  cargos={cargos}
                  users={users}
                  currentUser={currentUser}
                  clients={clients}
                  products={products}
                  vehicles={vehicles}
                  onDeleteShipment={handleDeleteShipment}
                />;
      case 'load-history':
        return <LoadHistoryPage
                  loads={cargos}
                  clients={clients}
                  products={products}
                  users={users}
                  currentUser={currentUser}
                  shipments={shipments}
                  onDeleteLoad={handleDeleteCargo}
                />;
      case 'layover-calculator':
        return <LayoverCalculatorPage currentUser={currentUser} />;
      case 'freight-quote':
        return <FreightQuotePage currentUser={currentUser} />;
      case 'tools-history':
        return <ToolsHistoryPage currentUser={currentUser} />;
      case 'dashboard':
        return <DashboardPage cargos={visibleLoads} shipments={visibleShipments} users={users} currentUser={currentUser} clients={clients} />;
      default:
        return <DashboardPage cargos={visibleLoads} shipments={visibleShipments} users={users} currentUser={currentUser} clients={clients} />;

    }
  };

  // Only show the full-screen loader if it's the initial load (no data yet)
  if (isLoading && shipments.length === 0 && cargos.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '16px', background: '#f9fafb' }}>
        <div style={{ width: '48px', height: '48px', border: '4px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ color: '#6b7280', fontSize: '18px', fontWeight: 500 }}>Carregando Rodochagas Logística...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} users={users} companyLogo={companyLogo} />;
  }

  const operationalPages: Page[] = ['loads', 'shipments', 'shipment-history', 'load-history', 'operational-loads', 'operational-map'];
  const isOperationalPage = operationalPages.includes(currentPage);

  return (
    <div className="flex flex-col h-screen bg-light-bg dark:bg-dark-bg text-gray-800 dark:text-gray-200">
      <TopNavBar
        user={currentUser}
        onLogout={handleLogout}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        profilePermissions={profilePermissions}
        companyLogo={companyLogo}
        onOpenTickets={() => setIsTicketModalOpen(true)}
        tickets={tickets}
      />
      <main className="flex-1 overflow-y-auto">
        <div className={isOperationalPage ? "px-6 py-8" : "container mx-auto px-6 py-8"}>
            {renderPage()}
        </div>
      </main>
       <TicketModal
        isOpen={isTicketModalOpen}
        onClose={() => setIsTicketModalOpen(false)}
        tickets={tickets}
        users={users}
        currentUser={currentUser}
        onSave={handleSaveTicket}
        onUpdate={handleUpdateTicket}
      />
    </div>
  );
};

export default App;
