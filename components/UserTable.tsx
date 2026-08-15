import React, { useState, useMemo } from 'react';
import type { User } from '../types';
import { UserProfile } from '../types';
import { WhatsAppIcon } from './icons';
import { Building2, Globe, Truck, Users, X } from 'lucide-react';

interface UserTableProps {
  users: User[];
  onEdit?: (user: User) => void;
  onDelete?: (userId: string) => void;
}

type TabType = 'internos' | 'clientes' | 'motoristas' | 'todos';

export const UserTable: React.FC<UserTableProps> = ({ users, onEdit, onDelete }) => {
  const [activeTab, setActiveTab] = useState<TabType>('internos');
  const [filterId, setFilterId] = useState('');
  const [filterName, setFilterName] = useState('');
  const [filterProfile, setFilterProfile] = useState('Todos');
  const [filterStatus, setFilterStatus] = useState('Todos');

  // Generate consistent USR-XXX registration code for each user
  const usersWithDisplayId = useMemo(() => {
    return users.map((user, index) => {
      let displayId = user.id;
      if (!displayId || !/^USR-\d+$/i.test(displayId)) {
        displayId = `USR-${String(101 + index).padStart(3, '0')}`;
      } else {
        displayId = displayId.toUpperCase();
      }
      return {
        ...user,
        displayId
      };
    });
  }, [users]);

  // Tab counts
  const internalCount = useMemo(() => {
    return usersWithDisplayId.filter(u => u.profile !== UserProfile.Cliente && u.profile !== UserProfile.Motorista).length;
  }, [usersWithDisplayId]);

  const clientCount = useMemo(() => {
    return usersWithDisplayId.filter(u => u.profile === UserProfile.Cliente).length;
  }, [usersWithDisplayId]);

  const driverCount = useMemo(() => {
    return usersWithDisplayId.filter(u => u.profile === UserProfile.Motorista).length;
  }, [usersWithDisplayId]);

  const totalCount = usersWithDisplayId.length;

  // Filtered users
  const filteredUsers = useMemo(() => {
    return usersWithDisplayId.filter(user => {
      // 1. Tab filter
      if (activeTab === 'internos') {
        if (user.profile === UserProfile.Cliente || user.profile === UserProfile.Motorista) {
          return false;
        }
      } else if (activeTab === 'clientes') {
        if (user.profile !== UserProfile.Cliente) {
          return false;
        }
      } else if (activeTab === 'motoristas') {
        if (user.profile !== UserProfile.Motorista) {
          return false;
        }
      }

      // 2. ID filter
      if (filterId.trim()) {
        const queryId = filterId.trim().toLowerCase();
        const matchesDisplayId = user.displayId.toLowerCase().includes(queryId);
        const matchesRawId = user.id.toLowerCase().includes(queryId);
        if (!matchesDisplayId && !matchesRawId) return false;
      }

      // 3. Name filter
      if (filterName.trim()) {
        const queryName = filterName.trim().toLowerCase();
        const matchesName = (user.name || '').toLowerCase().includes(queryName);
        const matchesEmail = (user.email || '').toLowerCase().includes(queryName);
        if (!matchesName && !matchesEmail) return false;
      }

      // 4. Profile filter
      if (filterProfile !== 'Todos') {
        if (user.profile !== filterProfile) return false;
      }

      // 5. Status filter
      if (filterStatus !== 'Todos') {
        if (filterStatus === 'Ativo' && !user.active) return false;
        if (filterStatus === 'Inativo' && user.active) return false;
      }

      return true;
    });
  }, [usersWithDisplayId, activeTab, filterId, filterName, filterProfile, filterStatus]);

  const handleClearFilters = () => {
    setFilterId('');
    setFilterName('');
    setFilterProfile('Todos');
    setFilterStatus('Todos');
  };

  const hasActiveFilters = filterId !== '' || filterName !== '' || filterProfile !== 'Todos' || filterStatus !== 'Todos';

  const getWhatsAppUrl = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    const finalDigits = (digits.length === 10 || digits.length === 11) ? `55${digits}` : digits;
    return `https://wa.me/${finalDigits}`;
  };

  const getProfileDisplayName = (profile: UserProfile | string) => {
    if (profile === UserProfile.Admin || String(profile).toLowerCase() === 'admin') {
      return 'Administrador do Sistema';
    }
    return profile;
  };

  return (
    <div className="space-y-4">
      {/* Top Tabs Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-2 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setActiveTab('internos')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
            activeTab === 'internos'
              ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700/50'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Usuários Internos</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
            activeTab === 'internos'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
          }`}>
            {internalCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('clientes')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
            activeTab === 'clientes'
              ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700/50'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>Usuários Externos (Clientes)</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
            activeTab === 'clientes'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
          }`}>
            {clientCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('motoristas')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
            activeTab === 'motoristas'
              ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700/50'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Usuários Externos (Motoristas)</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
            activeTab === 'motoristas'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
          }`}>
            {driverCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('todos')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
            activeTab === 'todos'
              ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700/50'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Todos</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
            activeTab === 'todos'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
          }`}>
            {totalCount}
          </span>
        </button>
      </div>

      {/* Filters Card */}
      <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          {/* Filter ID */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">ID</label>
            <input
              type="text"
              value={filterId}
              onChange={(e) => setFilterId(e.target.value)}
              placeholder="Ex: USR-100..."
              className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-gray-800 dark:text-gray-200 transition-all"
            />
          </div>

          {/* Filter Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Nome</label>
            <input
              type="text"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              placeholder="Filtrar por nome..."
              className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-gray-800 dark:text-gray-200 transition-all"
            />
          </div>

          {/* Filter Profile */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Perfil</label>
            <select
              value={filterProfile}
              onChange={(e) => setFilterProfile(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-gray-800 dark:text-gray-200 transition-all cursor-pointer"
            >
              <option value="Todos">Todos</option>
              <option value={UserProfile.Admin}>Administrador do Sistema</option>
              <option value={UserProfile.Comercial}>Comercial</option>
              <option value={UserProfile.Financeiro}>Financeiro</option>
              <option value={UserProfile.Fiscal}>Fiscal</option>
              <option value={UserProfile.Supervisor}>Supervisor</option>
              <option value={UserProfile.Embarcador}>Embarcador</option>
              <option value={UserProfile.Diretor}>Diretor</option>
              <option value={UserProfile.Cliente}>Cliente</option>
              <option value={UserProfile.Motorista}>Motorista</option>
            </select>
          </div>

          {/* Filter Status */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-gray-800 dark:text-gray-200 transition-all cursor-pointer"
            >
              <option value="Todos">Todos</option>
              <option value="Ativo">Ativo</option>
              <option value="Inativo">Inativo</option>
            </select>
          </div>

          {/* Clear Filters Button */}
          <div>
            <button
              onClick={handleClearFilters}
              disabled={!hasActiveFilters}
              className={`w-full py-2.5 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                hasActiveFilters
                  ? 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 cursor-pointer shadow-sm'
                  : 'bg-gray-50 dark:bg-gray-800/50 text-gray-400 dark:text-gray-600 cursor-not-allowed border border-gray-200 dark:border-gray-700/50'
              }`}
            >
              <X className="w-4 h-4" />
              <span>Limpar Filtros</span>
            </button>
          </div>
        </div>
      </div>

      {/* Users Table Card */}
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50/75 dark:bg-gray-900/50">
              <tr>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">ID</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nome</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Telefone</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Perfil</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                {(onEdit || onDelete) && (
                  <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ações</th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700/60">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-700/40 transition-colors">
                    {/* ID */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold font-mono bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 shadow-xs">
                        {user.displayId}
                      </span>
                    </td>

                    {/* Name */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white">
                      {user.name}
                    </td>

                    {/* Email */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {user.email}
                    </td>

                    {/* Telefone */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {user.phone ? (
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-gray-700 dark:text-gray-300">{user.phone}</span>
                          <a 
                            href={getWhatsAppUrl(user.phone)} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="inline-flex items-center justify-center hover:scale-110 transition-transform text-emerald-500 hover:text-emerald-600"
                            title="Conversar no WhatsApp"
                          >
                            <WhatsAppIcon className="w-4 h-4" />
                          </a>
                        </div>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-600">-</span>
                      )}
                    </td>

                    {/* Perfil */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700 dark:text-gray-300">
                      {getProfileDisplayName(user.profile)}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 inline-flex text-xs font-bold rounded-full border ${
                        user.active 
                          ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800' 
                          : 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600'
                      }`}>
                        {user.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>

                    {/* Ações */}
                    {(onEdit || onDelete) && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {onEdit && (
                          <button 
                            onClick={() => onEdit(user)} 
                            className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 font-bold transition-colors cursor-pointer"
                          >
                            Editar
                          </button>
                        )}
                        {onDelete && (
                          <button 
                            onClick={() => onDelete(user.id)} 
                            className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-bold ml-4 transition-colors cursor-pointer"
                          >
                            Excluir
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                    Nenhum usuário encontrado com os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UserTable;
