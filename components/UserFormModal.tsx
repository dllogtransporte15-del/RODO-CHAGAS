
import React, { useState, useEffect } from 'react';
import type { User, Client, Branch } from '../types';
import { UserProfile } from '../types';
import { useToast } from '../hooks/useToast';
import { autoFormatInput } from '../utils/formatters';
import { Percent, ShieldAlert } from 'lucide-react';

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (user: User | Omit<User, 'id'>) => void;
  userToEdit: User | null;
  clients: Client[];
  branches: Branch[];
  users?: User[];
  currentUser?: User;
}

const UserFormModal: React.FC<UserFormModalProps> = ({ isOpen, onClose, onSave, userToEdit, clients, branches, users = [], currentUser }) => {
  const { showToast } = useToast();
  const isAdmin = !currentUser || currentUser.profile === UserProfile.Admin || currentUser.profile === UserProfile.Diretor;

  const getInitialState = (): Omit<User, 'id'> => ({
    name: '',
    email: '',
    phone: '',
    profile: UserProfile.Comercial,
    active: true,
    password: '',
    clientId: undefined,
    leaderId: undefined,
    branchId: undefined,
    leaderProfitCommissionRate: 25,
    leaderRevenueCommissionRate: 1.5,
  });

  const [user, setUser] = useState<Omit<User, 'id' | 'password'> & { password?: string }>(getInitialState());

  useEffect(() => {
    if (isOpen) {
        if(userToEdit) {
            const { password, ...userWithoutPass } = userToEdit;
            setUser({
              ...userWithoutPass,
              password: '',
              leaderProfitCommissionRate: userToEdit.leaderProfitCommissionRate ?? 25,
              leaderRevenueCommissionRate: userToEdit.leaderRevenueCommissionRate ?? 1.5,
            }); // Don't load existing password
        } else {
            setUser(getInitialState());
        }
    }
  }, [userToEdit, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const formattedValue = autoFormatInput(name, value);

    if (name === 'leaderProfitCommissionRate' || name === 'leaderRevenueCommissionRate') {
      const num = value === '' ? 0 : Number(value);
      setUser(prev => ({ ...prev, [name]: isNaN(num) ? 0 : num }));
      return;
    }

    let updatedValue: any = formattedValue;
    if (type === 'checkbox') {
        updatedValue = (e.target as HTMLInputElement).checked;
    }
    
    setUser(prev => {
      const newState = { ...prev, [name]: updatedValue };
      if (name === 'profile') {
        if (value !== UserProfile.Cliente) {
          delete newState.clientId;
        }
        if (value !== UserProfile.AgenciadorEmbarque) {
          delete newState.leaderId;
        }
        if (value === UserProfile.AgenciadorLider) {
          if (newState.leaderProfitCommissionRate === undefined) newState.leaderProfitCommissionRate = 25;
          if (newState.leaderRevenueCommissionRate === undefined) newState.leaderRevenueCommissionRate = 1.5;
        }
      }
      return newState;
    });
  };

  const potentialLeaders = React.useMemo(() => {
    const leaders = users.filter(u => u.profile === UserProfile.AgenciadorLider);
    if (leaders.length > 0) return leaders;
    // Fallback caso ainda não tenha nenhum perfil 'Gestor GO', permite selecionar Supervisor ou Coordenador
    return users.filter(u => [UserProfile.Supervisor, UserProfile.Coordenador, UserProfile.Admin].includes(u.profile));
  }, [users]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (user.profile === UserProfile.Cliente && !user.clientId) {
      showToast('Por favor, selecione um cliente para associar a este usuário.', 'warning');
      return;
    }

    if (user.profile === UserProfile.AgenciadorEmbarque && !user.leaderId) {
      showToast('Por favor, vincule o Embarcador GO a um Gestor GO.', 'warning');
      return;
    }

    const userToSave: any = { ...user };

    if (user.profile === UserProfile.AgenciadorLider) {
      userToSave.leaderProfitCommissionRate = user.leaderProfitCommissionRate !== undefined
        ? Number(user.leaderProfitCommissionRate) 
        : 25;
      userToSave.leaderRevenueCommissionRate = user.leaderRevenueCommissionRate !== undefined
        ? Number(user.leaderRevenueCommissionRate) 
        : 1.5;
    }

    if (userToEdit) {
      userToSave.id = userToEdit.id;
      // If password field is empty on edit, don't change it
      if (!user.password) {
        delete userToSave.password;
      }
    } else {
      // Password is required for new users
      if (!user.password) {
        showToast('O campo de senha é obrigatório para novos usuários.', 'warning');
        return;
      }
    }

    onSave(userToSave);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-2xl w-full">
        <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">{userToEdit ? 'Editar Usuário' : 'Novo Usuário'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input name="name" value={user.name} onChange={handleChange} placeholder="Nome Completo" className="p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" required />
          <input name="email" value={user.email} onChange={handleChange} type="email" placeholder="Email de Acesso" className="p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" required />
          <input name="phone" value={user.phone || ''} onChange={handleChange} placeholder="Telefone" className="p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" />
          <input name="password" value={user.password} onChange={handleChange} type="password" placeholder={userToEdit ? 'Nova Senha (deixe em branco para manter)' : 'Senha'} className="p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Perfil de Acesso</label>
            <select name="profile" value={user.profile} onChange={handleChange} className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600">
              {Object.values(UserProfile).map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* Configurações de Comissionamento Híbrido para Gestor GO */}
          {user.profile === UserProfile.AgenciadorLider && (
            <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-50/80 to-blue-50/50 dark:from-indigo-950/40 dark:to-blue-950/20 border border-indigo-200/80 dark:border-indigo-800/60 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs">
                    <Percent className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                      Regra de Comissionamento Híbrida (Gestor GO)
                    </h4>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      Configuração das alíquotas de comissionamento individual do gestor
                    </p>
                  </div>
                </div>
                {!isAdmin && (
                  <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold bg-amber-100/80 dark:bg-amber-900/40 px-2 py-0.5 rounded flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3" /> Apenas Admin edita
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Comissão s/ Lucro Líquido (Equipe/Próprio) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      name="leaderProfitCommissionRate"
                      disabled={!isAdmin}
                      value={user.leaderProfitCommissionRate ?? 25}
                      onChange={handleChange}
                      className="p-2 pr-8 w-full border rounded-lg dark:bg-gray-700 dark:border-gray-600 font-bold text-sm text-gray-800 dark:text-white disabled:opacity-60 disabled:cursor-not-allowed focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="25"
                      required
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">%</span>
                  </div>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                    Padrão: <strong>25%</strong> sobre o lucro líquido (fretes da equipe/próprios).
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Comissão Cargas de Terceiros (% s/ Lucro Líquido) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      name="leaderRevenueCommissionRate"
                      disabled={!isAdmin}
                      value={user.leaderRevenueCommissionRate ?? 1.5}
                      onChange={handleChange}
                      className="p-2 pr-8 w-full border rounded-lg dark:bg-gray-700 dark:border-gray-600 font-bold text-sm text-gray-800 dark:text-white disabled:opacity-60 disabled:cursor-not-allowed focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="1.5"
                      required
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">%</span>
                  </div>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                    Padrão: <strong>1,5%</strong> sobre o lucro líquido (embarques externos).
                  </p>
                </div>
              </div>
            </div>
          )}

          {user.profile === UserProfile.AgenciadorEmbarque && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Gestor GO Vinculado <span className="text-red-500">*</span>
              </label>
              <select 
                name="leaderId" 
                value={user.leaderId || ''} 
                onChange={handleChange} 
                className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" 
                required
              >
                <option value="">Selecione o Gestor GO...</option>
                {potentialLeaders.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.profile})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                O Embarcador GO responde diretamente a este Gestor GO.
              </p>
            </div>
          )}

          {user.profile === UserProfile.Cliente && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Associar ao Cliente</label>
              <select name="clientId" value={user.clientId || ''} onChange={handleChange} className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" required>
                <option value="" disabled>Selecione um cliente...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.nomeFantasia}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Filial Associada</label>
            <select name="branchId" value={user.branchId || ''} onChange={handleChange} className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600">
              <option value="">Sem filial (Padrão)</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.city}-{b.state})</option>)}
            </select>
            <p className="text-[10px] text-gray-500 mt-1">Usuários sem filial verão dados de todas as filiais (perfil admin/diretor).</p>
          </div>

          <div className="flex items-center">
            <input type="checkbox" id="active" name="active" checked={user.active} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"/>
            <label htmlFor="active" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">Usuário Ativo</label>
          </div>

          <div className="mt-8 flex justify-between items-center">
            <div>
              {userToEdit && (
                <button 
                  type="button" 
                  onClick={() => {
                    setUser(prev => ({ ...prev, password: 'rodo2026', requirePasswordChange: true }));
                    showToast('Senha resetada para "rodo2026". Atenção: A alteração só será gravada ao clicar em "SALVAR".', 'info', 6000);
                  }} 
                  className="py-2 px-4 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.757l3.9-3.9a.75.75 0 111.06 1.06l-4.5 4.5a.75.75 0 01-1.06 0l-4.5-4.5a.75.75 0 111.06-1.06l3.9 3.9V3.75a.75.75 0 011.5 0v10.493z" clipRule="evenodd" />
                  </svg>
                  Resetar Senha
                </button>
              )}
            </div>
            <div className="flex space-x-4">
              <button type="button" onClick={onClose} className="py-2 px-4 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">
                Cancelar
              </button>
              <button type="submit" className="py-2 px-4 bg-primary text-white rounded-lg hover:bg-primary-dark shadow-md">
                Salvar
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserFormModal;