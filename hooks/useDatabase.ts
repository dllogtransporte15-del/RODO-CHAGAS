
import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import type { 
  User, Client, Owner, Driver, Vehicle, Product, Cargo, Shipment, Ticket,
  ProfilePermissions, ShipmentLock, Branch, FreightOffer
} from '../types';
import { ShipmentStatus } from '../types';
import { INITIAL_PERMISSIONS } from '../auth';
import { 
  fetchClients, fetchOwners, fetchDrivers, fetchVehicles, fetchProducts,
  fetchCargos, fetchShipments, fetchUsers, fetchTickets, fetchProfilePermissions,
  fetchAppSettings, fetchShipmentLocks, fetchBranches, fetchFreightOffers,
  toClient, toOwner, toDriver, toVehicle, toProduct, toCargo, toShipment,
  toUser, toTicket, toBranch, toFreightOffer
} from '../lib/db';
import { getAllToolStays, StayRecord } from '../utils/toolStorage';

// ─── Module-level helpers (accessible from both loadAllData and realtime handler) ───

function getMaxId(items: any[], startOffset: number): number {
  if (!items || items.length === 0) {
    return startOffset;
  }
  let maxNum = startOffset - 1;
  for (const item of items) {
    const idToCheck = item?.displayId || item?.id;
    if (idToCheck && typeof idToCheck === 'string') {
      const match = idToCheck.match(/-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    }
  }
  return maxNum + 1;
}

function calculateNextIds(
  dbClients: any[], dbOwners: any[], dbDrivers: any[], dbVehicles: any[], 
  dbProducts: any[], dbShipments: any[], dbCargos: any[], dbUsers: any[], dbTickets: any[],
  dbBranches: any[], dbOffers: any[] = []
) {
  return {
    client: getMaxId(dbClients, 100),
    owner: getMaxId(dbOwners, 100),
    driver: getMaxId(dbDrivers, 100),
    vehicle: getMaxId(dbVehicles, 100),
    product: getMaxId(dbProducts, 100),
    shipment: getMaxId(dbShipments, 100),
    cargo: getMaxId(dbCargos, 100),
    user: getMaxId(dbUsers, 100),
    ticket: getMaxId(dbTickets, 1),
    branch: getMaxId(dbBranches, 10),
    freightOffer: getMaxId(dbOffers, 500),
    history: 9999,
  };
}

export function syncCargosWithShipments(cargosList: Cargo[], shipmentsList: Shipment[]): Cargo[] {
  return cargosList.map(cargo => {
    const activeShipments = shipmentsList.filter(s => s.cargoId === cargo.id && s.status !== ShipmentStatus.Cancelado);
    const scheduledVolume = activeShipments.reduce((sum, s) => sum + (Number(s.shipmentTonnage) || 0), 0);
    const loadedVolume = activeShipments
      .filter(s => Object.values(ShipmentStatus).indexOf(s.status) >= Object.values(ShipmentStatus).indexOf(ShipmentStatus.AguardandoDescarga))
      .reduce((sum, s) => sum + (Number(s.shipmentTonnage) || 0), 0);
    
    return {
      ...cargo,
      scheduledVolume,
      loadedVolume,
    };
  });
}

// ─────────────────────────────────────────────

export function useDatabase(currentUser: User | null) {
  const [clients, setClients] = useState<Client[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [freightOffers, setFreightOffers] = useState<FreightOffer[]>([]);
  const [stays, setStays] = useState<StayRecord[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeLocks, setActiveLocks] = useState<ShipmentLock[]>([]);
  const [profilePermissions, setProfilePermissions] = useState<ProfilePermissions>(INITIAL_PERMISSIONS);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  const [companyLogo, setCompanyLogo] = useState<string | null>(() => localStorage.getItem('rodochagas_companyLogo'));
  const [themeImage, setThemeImage] = useState<string | null>(() => localStorage.getItem('rodochagas_themeImage'));

  const [nextIds, setNextIds] = useState(() => {
    const saved = localStorage.getItem('rodochagas_nextIds');
    if (saved) return JSON.parse(saved);
    return { client: 100, owner: 100, driver: 100, vehicle: 100, product: 100, shipment: 100, cargo: 100, user: 100, ticket: 1, branch: 10, freightOffer: 1, history: 1000 };
  });

  const isAnyModalActiveRef = useRef(false);

  const loadAllData = useCallback(async (isBackground = false) => {
    if (!isBackground) setIsLoading(true);
    setLoadError(null);
    
    const timeoutId = setTimeout(() => {
      console.error('[useDatabase] loadAllData timed out after 15s. Forcing isLoading=false.');
      setIsLoading(false);
    }, 15000);

    try {
      if (!currentUser) {
        setIsLoading(false);
        return;
      }

      const isMotorista = currentUser.profile === 'Motorista';

      if (isMotorista) {
        const [
          dbCargos, dbShipments, dbSettings, dbPermissions,
          dbProducts, dbClients, dbFreightOffers, dbUsers
        ] = await Promise.all([
          fetchCargos(), fetchShipments(), fetchAppSettings(), fetchProfilePermissions(),
          fetchProducts(), fetchClients(), fetchFreightOffers(), fetchUsers()
        ]);

        const syncedCargos = syncCargosWithShipments(dbCargos, dbShipments);
        setCargos(syncedCargos);
        setShipments(dbShipments);
        setProducts(dbProducts);
        setClients(dbClients);
        setFreightOffers(dbFreightOffers);
        setUsers(dbUsers);

        if (dbPermissions) setProfilePermissions(dbPermissions);
        if (dbSettings) {
          if (dbSettings.company_logo) setCompanyLogo(dbSettings.company_logo);
          if (dbSettings.theme_image) setThemeImage(dbSettings.theme_image);
        }

      } else {
        const [
          dbClients, dbOwners, dbDrivers, dbVehicles, dbProducts, dbCargos, 
          dbShipments, dbUsers, dbTickets, dbPermissions, dbSettings, dbLocks, dbBranches,
          dbStays, dbFreightOffers
        ] = await Promise.all([
          fetchClients(), fetchOwners(), fetchDrivers(), fetchVehicles(), fetchProducts(),
          fetchCargos(), fetchShipments(), fetchUsers(), fetchTickets(),
          fetchProfilePermissions(), fetchAppSettings(), fetchShipmentLocks(),
          fetchBranches(), getAllToolStays(), fetchFreightOffers()
        ]);

        const syncedCargos = syncCargosWithShipments(dbCargos, dbShipments);
        setClients(dbClients);
        setOwners(dbOwners);
        setDrivers(dbDrivers);
        setVehicles(dbVehicles);
        setProducts(dbProducts);
        setCargos(syncedCargos);
        setShipments(dbShipments);
        setUsers(dbUsers);
        setTickets(dbTickets);
        setFreightOffers(dbFreightOffers);
        setStays(dbStays);
        setBranches(dbBranches);
        setActiveLocks(dbLocks);

        if (dbPermissions) setProfilePermissions(dbPermissions);
        if (dbSettings) {
          if (dbSettings.company_logo) setCompanyLogo(dbSettings.company_logo);
          if (dbSettings.theme_image) setThemeImage(dbSettings.theme_image);
        }

        setNextIds(calculateNextIds(
          dbClients, dbOwners, dbDrivers, dbVehicles,
          dbProducts, dbShipments, dbCargos, dbUsers, dbTickets, dbBranches, dbFreightOffers
        ));
      }

    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      setLoadError('Erro ao conectar ao banco de dados.');
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      loadAllData();
    } else {
      setIsLoading(false);
      fetchAppSettings().then(settings => {
        if (settings) {
          if (settings.company_logo) setCompanyLogo(settings.company_logo);
          if (settings.theme_image) setThemeImage(settings.theme_image);
        }
      });
    }
  }, [currentUser, loadAllData]);

  // Real-time integration com Atualizações Cirúrgicas (Surgical Updates)
  const shipmentsRef = useRef<Shipment[]>([]);
  const cargosRef = useRef<Cargo[]>([]);

  useEffect(() => {
    shipmentsRef.current = shipments;
  }, [shipments]);

  useEffect(() => {
    cargosRef.current = cargos;
  }, [cargos]);

  // Sincronização automática em background ao retornar à aba ou reconectar à rede (Zero F5)
  useEffect(() => {
    if (!currentUser) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[useDatabase] Aba visível novamente. Sincronizando dados em background...');
        loadAllData(true);
      }
    };

    const handleOnline = () => {
      console.log('[useDatabase] Conexão restabelecida. Sincronizando dados em background...');
      loadAllData(true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, [currentUser, loadAllData]);

  // Real-time integration com Atualizações Imediatas e Sincronização Cruzada (Cross-Entity Sync)
  useEffect(() => {
    if (!currentUser) return;

    const handlePostgresChange = async (payload: any) => {
      const { table, eventType, new: newRow, old: oldRow } = payload;
      console.log(`[useDatabase] Realtime ${eventType} em ${table}`);

      try {
        switch (table) {
          case 'cargos': {
            if (eventType === 'INSERT' && newRow) {
              const item = toCargo(newRow);
              setCargos(prev => {
                const combined = [item, ...prev.filter(c => c.id !== item.id && c.id !== `TEMP-${item.sequenceId}`)];
                const synced = syncCargosWithShipments(combined, shipmentsRef.current);
                cargosRef.current = synced;
                return synced;
              });
              const m = item.id?.match(/-(\d+)$/);
              const num = item.sequenceId || (m ? parseInt(m[1], 10) : 0);
              if (num && !isNaN(num)) {
                setNextIds((prev: any) => ({ ...prev, cargo: Math.max(prev.cargo || 0, num + 1) }));
              }
            } else if (eventType === 'UPDATE' && newRow) {
              const item = toCargo(newRow);
              setCargos(prev => {
                const combined = prev.map(c => c.id === item.id ? { ...c, ...item } : c);
                const synced = syncCargosWithShipments(combined, shipmentsRef.current);
                cargosRef.current = synced;
                return synced;
              });
            } else if (eventType === 'DELETE' && oldRow?.id) {
              setCargos(prev => {
                const filtered = prev.filter(c => c.id !== oldRow.id);
                cargosRef.current = filtered;
                return filtered;
              });
            }
            break;
          }

          case 'shipments': {
            if (eventType === 'INSERT' && newRow) {
              const item = toShipment(newRow);
              setShipments(prev => {
                const updated = [item, ...prev.filter(s => s.id !== item.id)];
                shipmentsRef.current = updated;
                // Sincroniza imediatamente o volume agendado/carregado de todas as cargas na tela de todos os usuários
                setCargos(prevCargos => {
                  const synced = syncCargosWithShipments(prevCargos, updated);
                  cargosRef.current = synced;
                  return synced;
                });
                return updated;
              });
              // Atualiza o contador de IDs de embarques para todos os usuários imediatamente
              const m = item.id?.match(/-(\d+)$/);
              if (m) {
                const num = parseInt(m[1], 10);
                if (!isNaN(num)) {
                  setNextIds((prev: any) => ({ ...prev, shipment: Math.max(prev.shipment || 0, num + 1) }));
                }
              }
            } else if (eventType === 'UPDATE' && newRow) {
              const item = toShipment(newRow);
              setShipments(prev => {
                const updated = prev.map(s => {
                  if (s.id !== item.id) return s;
                  return {
                    ...s,
                    ...item,
                    documents: item.documents || s.documents,
                    history: (item.history && item.history.length > 0) ? item.history : s.history,
                  };
                });
                shipmentsRef.current = updated;
                // Sincroniza imediatamente o volume agendado/carregado de todas as cargas na tela de todos os usuários
                setCargos(prevCargos => {
                  const synced = syncCargosWithShipments(prevCargos, updated);
                  cargosRef.current = synced;
                  return synced;
                });
                return updated;
              });
            } else if (eventType === 'DELETE' && oldRow?.id) {
              setShipments(prev => {
                const updated = prev.filter(s => s.id !== oldRow.id);
                shipmentsRef.current = updated;
                setCargos(prevCargos => {
                  const synced = syncCargosWithShipments(prevCargos, updated);
                  cargosRef.current = synced;
                  return synced;
                });
                return updated;
              });
            }
            break;
          }

          case 'freight_offers': {
            if (eventType === 'INSERT' && newRow) {
              const item = toFreightOffer(newRow);
              setFreightOffers(prev => {
                if (!item.displayId) {
                  const highest = prev.reduce((max, o) => {
                    const match = (o.displayId || o.id || '').match(/^OFR-(\d+)$/i);
                    return match ? Math.max(max, parseInt(match[1], 10)) : max;
                  }, 500);
                  item.displayId = `OFR-${highest + 1}`;
                }
                return [item, ...prev.filter(f => f.id !== item.id)];
              });
              const m = (item.displayId || item.id || '').match(/-(\d+)$/);
              if (m) {
                const num = parseInt(m[1], 10);
                if (!isNaN(num)) setNextIds((prev: any) => ({ ...prev, freightOffer: Math.max(prev.freightOffer || 0, num + 1) }));
              }
            } else if (eventType === 'UPDATE' && newRow) {
              const item = toFreightOffer(newRow);
              setFreightOffers(prev => prev.map(f => {
                if (f.id !== item.id) return f;
                return {
                  ...item,
                  displayId: item.displayId || f.displayId
                };
              }));
            } else if (eventType === 'DELETE' && oldRow?.id) {
              setFreightOffers(prev => prev.filter(f => f.id !== oldRow.id));
            }
            break;
          }

          case 'tickets': {
            if (eventType === 'INSERT' && newRow) {
              const item = toTicket(newRow);
              setTickets(prev => [item, ...prev.filter(t => t.id !== item.id)]);
              const m = item.id?.match(/-(\d+)$/);
              if (m) {
                const num = parseInt(m[1], 10);
                if (!isNaN(num)) setNextIds((prev: any) => ({ ...prev, ticket: Math.max(prev.ticket || 0, num + 1) }));
              }
            } else if (eventType === 'UPDATE' && newRow) {
              const item = toTicket(newRow);
              setTickets(prev => prev.map(t => t.id === item.id ? item : t));
            } else if (eventType === 'DELETE' && oldRow?.id) {
              setTickets(prev => prev.filter(t => t.id !== oldRow.id));
            }
            break;
          }

          case 'drivers': {
            if (eventType === 'INSERT' && newRow) {
              const item = toDriver(newRow);
              setDrivers(prev => [item, ...prev.filter(d => d.id !== item.id)]);
              const m = item.id?.match(/-(\d+)$/);
              if (m) {
                const num = parseInt(m[1], 10);
                if (!isNaN(num)) setNextIds((prev: any) => ({ ...prev, driver: Math.max(prev.driver || 0, num + 1) }));
              }
            } else if (eventType === 'UPDATE' && newRow) {
              const item = toDriver(newRow);
              setDrivers(prev => prev.map(d => d.id === item.id ? item : d));
            } else if (eventType === 'DELETE' && oldRow?.id) {
              setDrivers(prev => prev.filter(d => d.id !== oldRow.id));
            }
            break;
          }

          case 'vehicles': {
            if (eventType === 'INSERT' && newRow) {
              const item = toVehicle(newRow);
              setVehicles(prev => [item, ...prev.filter(v => v.id !== item.id)]);
              const m = item.id?.match(/-(\d+)$/);
              if (m) {
                const num = parseInt(m[1], 10);
                if (!isNaN(num)) setNextIds((prev: any) => ({ ...prev, vehicle: Math.max(prev.vehicle || 0, num + 1) }));
              }
            } else if (eventType === 'UPDATE' && newRow) {
              const item = toVehicle(newRow);
              setVehicles(prev => prev.map(v => v.id === item.id ? item : v));
            } else if (eventType === 'DELETE' && oldRow?.id) {
              setVehicles(prev => prev.filter(v => v.id !== oldRow.id));
            }
            break;
          }

          case 'clients': {
            if (eventType === 'INSERT' && newRow) {
              const item = toClient(newRow);
              setClients(prev => [item, ...prev.filter(c => c.id !== item.id)]);
              const m = item.id?.match(/-(\d+)$/);
              if (m) {
                const num = parseInt(m[1], 10);
                if (!isNaN(num)) setNextIds((prev: any) => ({ ...prev, client: Math.max(prev.client || 0, num + 1) }));
              }
            } else if (eventType === 'UPDATE' && newRow) {
              const item = toClient(newRow);
              setClients(prev => prev.map(c => c.id === item.id ? item : c));
            } else if (eventType === 'DELETE' && oldRow?.id) {
              setClients(prev => prev.filter(c => c.id !== oldRow.id));
            }
            break;
          }

          case 'owners': {
            if (eventType === 'INSERT' && newRow) {
              const item = toOwner(newRow);
              setOwners(prev => [item, ...prev.filter(o => o.id !== item.id)]);
              const m = item.id?.match(/-(\d+)$/);
              if (m) {
                const num = parseInt(m[1], 10);
                if (!isNaN(num)) setNextIds((prev: any) => ({ ...prev, owner: Math.max(prev.owner || 0, num + 1) }));
              }
            } else if (eventType === 'UPDATE' && newRow) {
              const item = toOwner(newRow);
              setOwners(prev => prev.map(o => o.id === item.id ? item : o));
            } else if (eventType === 'DELETE' && oldRow?.id) {
              setOwners(prev => prev.filter(o => o.id !== oldRow.id));
            }
            break;
          }

          case 'products': {
            if (eventType === 'INSERT' && newRow) {
              const item = toProduct(newRow);
              setProducts(prev => [item, ...prev.filter(p => p.id !== item.id)]);
              const m = item.id?.match(/-(\d+)$/);
              if (m) {
                const num = parseInt(m[1], 10);
                if (!isNaN(num)) setNextIds((prev: any) => ({ ...prev, product: Math.max(prev.product || 0, num + 1) }));
              }
            } else if (eventType === 'UPDATE' && newRow) {
              const item = toProduct(newRow);
              setProducts(prev => prev.map(p => p.id === item.id ? item : p));
            } else if (eventType === 'DELETE' && oldRow?.id) {
              setProducts(prev => prev.filter(p => p.id !== oldRow.id));
            }
            break;
          }

          case 'branches': {
            if (eventType === 'INSERT' && newRow) {
              const item = toBranch(newRow);
              setBranches(prev => [item, ...prev.filter(b => b.id !== item.id)]);
              const m = item.id?.match(/-(\d+)$/);
              if (m) {
                const num = parseInt(m[1], 10);
                if (!isNaN(num)) setNextIds((prev: any) => ({ ...prev, branch: Math.max(prev.branch || 0, num + 1) }));
              }
            } else if (eventType === 'UPDATE' && newRow) {
              const item = toBranch(newRow);
              setBranches(prev => prev.map(b => b.id === item.id ? item : b));
            } else if (eventType === 'DELETE' && oldRow?.id) {
              setBranches(prev => prev.filter(b => b.id !== oldRow.id));
            }
            break;
          }

          case 'app_users': {
            if (eventType === 'INSERT' && newRow) {
              const item = toUser(newRow);
              setUsers(prev => [item, ...prev.filter(u => u.id !== item.id)]);
              const m = item.id?.match(/-(\d+)$/);
              if (m) {
                const num = parseInt(m[1], 10);
                if (!isNaN(num)) setNextIds((prev: any) => ({ ...prev, user: Math.max(prev.user || 0, num + 1) }));
              }
            } else if (eventType === 'UPDATE' && newRow) {
              const item = toUser(newRow);
              setUsers(prev => prev.map(u => u.id === item.id ? item : u));
            } else if (eventType === 'DELETE' && oldRow?.id) {
              setUsers(prev => prev.filter(u => u.id !== oldRow.id));
            }
            break;
          }

          case 'shipment_locks': {
            const dbLocks = await fetchShipmentLocks();
            setActiveLocks(dbLocks);
            break;
          }

          case 'profile_permissions': {
            if (newRow?.permissions) {
              setProfilePermissions(newRow.permissions);
            } else {
              const dbPermissions = await fetchProfilePermissions();
              if (dbPermissions) setProfilePermissions(dbPermissions);
            }
            break;
          }

          case 'app_settings': {
            if (newRow) {
              if (newRow.company_logo !== undefined) setCompanyLogo(newRow.company_logo);
              if (newRow.theme_image !== undefined) setThemeImage(newRow.theme_image);
            }
            break;
          }

          case 'tool_stays': {
            const dbStays = await getAllToolStays();
            setStays(dbStays);
            break;
          }

          default:
            // Tabela desconhecida: recarga em background
            loadAllData(true);
        }
      } catch (err) {
        console.error(`[useDatabase] Erro ao processar evento realtime de ${table}:`, err);
        loadAllData(true);
      }
    };

    const channelId = `db_changes_${Math.random().toString(36).substring(2, 9)}`;
    const channel = supabase
      .channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public' }, handlePostgresChange)
      .subscribe((status, err) => {
        console.log(`[useDatabase] Realtime status: ${status}`, err || '');
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[useDatabase] Conexão Realtime interrompida. Executando sincronização em background...');
          loadAllData(true);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser, loadAllData]);

  return {
    clients, setClients,
    owners, setOwners,
    drivers, setDrivers,
    vehicles, setVehicles,
    products, setProducts,
    cargos, setCargos,
    shipments, setShipments,
    users, setUsers,
    tickets, setTickets,
    freightOffers, setFreightOffers,
    stays, setStays,
    branches, setBranches,
    activeLocks, setActiveLocks,
    profilePermissions, setProfilePermissions,
    isLoading, loadError,
    companyLogo, setCompanyLogo,
    themeImage, setThemeImage,
    nextIds, setNextIds,
    loadAllData,
    isAnyModalActiveRef
  };
}
