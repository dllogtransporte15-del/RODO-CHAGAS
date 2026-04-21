
import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import type { 
  Client, Owner, Driver, Vehicle, Product, Cargo, Shipment, User, Ticket, 
  ProfilePermissions, ShipmentLock 
} from '../types';
import { INITIAL_PERMISSIONS } from '../auth';
import { 
  fetchClients, fetchOwners, fetchDrivers, fetchVehicles, fetchProducts,
  fetchCargos, fetchShipments, fetchUsers, fetchTickets, fetchProfilePermissions,
  fetchAppSettings, fetchShipmentLocks
} from '../lib/db';

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
  const [activeLocks, setActiveLocks] = useState<ShipmentLock[]>([]);
  const [profilePermissions, setProfilePermissions] = useState<ProfilePermissions>(INITIAL_PERMISSIONS);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [themeImage, setThemeImage] = useState<string | null>(null);

  const [nextIds, setNextIds] = useState(() => {
    const saved = localStorage.getItem('rodochagas_nextIds');
    if (saved) return JSON.parse(saved);
    return { client: 100, owner: 100, driver: 100, vehicle: 100, product: 100, shipment: 100, cargo: 100, user: 100, ticket: 1, history: 1000 };
  });

  const isAnyModalActiveRef = useRef(false);

  const loadAllData = useCallback(async (isBackground = false) => {
    // Check both local storage AND actual Supabase session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session && !isBackground) {
        console.warn('[useDatabase] Attempted to load data without a valid Supabase session.');
        setIsLoading(false);
        return;
    }

    if (!isBackground) setIsLoading(true);
    setLoadError(null);
    try {
      const [
        dbClients, dbOwners, dbDrivers, dbVehicles, dbProducts, dbCargos, 
        dbShipments, dbUsers, dbTickets, dbPermissions, dbSettings, dbLocks
      ] = await Promise.all([
        fetchClients(), fetchOwners(), fetchDrivers(), fetchVehicles(), fetchProducts(),
        fetchCargos(), fetchShipments(), fetchUsers(), fetchTickets(),
        fetchProfilePermissions(), fetchAppSettings(), fetchShipmentLocks(),
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
      setActiveLocks(dbLocks);

      if (dbPermissions) setProfilePermissions(dbPermissions);
      if (dbSettings) {
        if (dbSettings.company_logo) setCompanyLogo(dbSettings.company_logo);
        if (dbSettings.theme_image) setThemeImage(dbSettings.theme_image);
      }

      // Update nextIds helper
      const getMaxId = (items: any[], startOffset: number) => {
        if (!items || items.length === 0) return startOffset;
        let maxNum = startOffset - 1;
        for (const item of items) {
          if (item?.id && typeof item.id === 'string' && item.id.includes('-')) {
            const num = parseInt(item.id.split('-')[1], 10);
            if (!isNaN(num) && num > maxNum) maxNum = num;
          }
        }
        return maxNum + 1;
      };

      setNextIds({
        client: getMaxId(dbClients, 100),
        owner: getMaxId(dbOwners, 100),
        driver: getMaxId(dbDrivers, 100),
        vehicle: getMaxId(dbVehicles, 100),
        product: getMaxId(dbProducts, 100),
        shipment: getMaxId(dbShipments, 100),
        cargo: getMaxId(dbCargos, 100),
        user: getMaxId(dbUsers, 100),
        ticket: getMaxId(dbTickets, 1),
        history: 9999,
      });

    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      setLoadError('Erro ao conectar ao banco de dados.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadAllData();
    } else {
      setIsLoading(false);
    }
  }, [currentUser, loadAllData]);

  // Real-time integration
  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase
      .channel('db_changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        if (isAnyModalActiveRef.current) return;
        loadAllData(true);
      })
      .subscribe();

    const lockChannel = supabase
      .channel('lock_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shipment_locks' }, () => {
        fetchShipmentLocks().then(setActiveLocks);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(lockChannel);
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
