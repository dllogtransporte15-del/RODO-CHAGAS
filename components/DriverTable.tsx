
import React from 'react';
import type { Driver, Owner } from '../types';

interface DriverTableProps {
  drivers: Driver[];
  owners: Owner[];
  onEdit?: (driver: Driver) => void;
  onDelete?: (driverId: string) => void;
}

const DriverTable: React.FC<DriverTableProps> = ({ drivers, owners, onEdit, onDelete }) => {
  const getOwnerName = (ownerId?: string) => {
    if (!ownerId) return 'N/A';
    return owners.find(o => o.id === ownerId)?.name || 'Desconhecido';
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">Nome</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">CPF / CNH</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">Telefone</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">Classificação</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">Proprietário</th>
              {(onEdit || onDelete) && <th scope="col" className="relative px-6 py-3"><span className="sr-only">Ações</span></th>}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {drivers.map((driver) => (
              <tr key={driver.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{driver.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div className="text-gray-900 dark:text-white">{driver.cpf}</div>
                  <div className="text-gray-500 dark:text-gray-400">CNH: {driver.cnh}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{driver.phone}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{driver.classification}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{getOwnerName(driver.ownerId)}</td>
                {(onEdit || onDelete) && (
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {onEdit && <button onClick={() => onEdit(driver)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300">Editar</button>}
                    {onDelete && <button onClick={() => onDelete(driver.id)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 ml-4">Excluir</button>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DriverTable;
