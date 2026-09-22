import type { Shipment, User } from '../types';

/**
 * Checks if a user is the generic placeholder 'Embarcador' account.
 */
export const isGenericShipper = (user?: User | null): boolean => {
  if (!user) return false;
  const name = (user.name || '').trim().toLowerCase();
  const email = (user.email || '').trim().toLowerCase();
  return (
    name === 'embarcador' ||
    email === 'embarcador@exemplo.com' ||
    email === 'embarcador@rodochagas.com.br'
  );
};

/**
 * Resolves the actual requester/operator (solicitante) for a given shipment.
 * Prioritizes actual users (Admin, Diretor, Comercial, Supervisor, specific Embarcador)
 * over generic placeholder accounts (e.g. user named 'Embarcador').
 */
export const resolveShipmentRequesterId = (shipment: Shipment, users: User[]): string => {
  const userMap = new Map<string, User>(users.map(u => [u.id, u]));

  const creatorUser = shipment.createdById ? userMap.get(shipment.createdById) : undefined;
  const embarcadorUser = shipment.embarcadorId ? userMap.get(shipment.embarcadorId) : undefined;

  // Case 1: If createdById is a valid specific user (not the generic placeholder), and embarcadorId is generic or not set
  if (creatorUser && !isGenericShipper(creatorUser)) {
    if (!shipment.embarcadorId || isGenericShipper(embarcadorUser)) {
      return creatorUser.id;
    }
  }

  // Case 2: If embarcadorId is set to a real specific user (not generic placeholder)
  if (embarcadorUser && !isGenericShipper(embarcadorUser)) {
    return embarcadorUser.id;
  }

  // Case 3: If createdById is set and matches a known user
  if (shipment.createdById && creatorUser && !isGenericShipper(creatorUser)) {
    return shipment.createdById;
  }

  // Case 4: Check statusHistory for the first specific user
  if (shipment.statusHistory && shipment.statusHistory.length > 0) {
    for (const entry of shipment.statusHistory) {
      if (entry.userId) {
        const histUser = userMap.get(entry.userId);
        if (histUser && !isGenericShipper(histUser)) {
          return histUser.id;
        }
      }
    }
  }

  // Case 5: Check history logs for a specific user
  if (shipment.history && shipment.history.length > 0) {
    for (const entry of shipment.history) {
      if (entry.userId) {
        const histUser = userMap.get(entry.userId);
        if (histUser && !isGenericShipper(histUser)) {
          return histUser.id;
        }
      }
    }
  }

  // Case 6: If createdById is present (even if not currently in user list) and differs from generic embarcadorId
  if (shipment.createdById && (!embarcadorUser || isGenericShipper(embarcadorUser))) {
    return shipment.createdById;
  }

  // Case 7: Fallback to embarcadorId or createdById or unknown
  return shipment.embarcadorId || shipment.createdById || 'UNKNOWN';
};

/**
 * Returns the resolved User details for the requester/solicitante of a shipment.
 */
export const getShipmentRequesterUser = (
  shipment: Shipment,
  users: User[]
): { id: string; name: string; profile?: string; phone?: string } => {
  const requesterId = resolveShipmentRequesterId(shipment, users);
  const user = users.find(u => u.id === requesterId);
  if (user) {
    return {
      id: user.id,
      name: user.name,
      profile: user.profile,
      phone: user.phone,
    };
  }
  return {
    id: requesterId,
    name: `Usuário (${requesterId})`,
    profile: 'Operador',
  };
};
