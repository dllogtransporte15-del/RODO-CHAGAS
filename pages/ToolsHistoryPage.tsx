import React from 'react';
import ToolsHistory from '../components/ToolsHistory';
import { User } from '../types';

interface ToolsHistoryPageProps {
  currentUser: User;
  companyLogo: string | null;
}

const ToolsHistoryPage: React.FC<ToolsHistoryPageProps> = ({ currentUser, companyLogo }) => {
  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-indigo-500">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Histórico de Ferramentas</h2>
        <p className="text-gray-600">
          Consulte o histórico de estadias e cotações registradas.
        </p>
      </div>

      <ToolsHistory companyId={currentUser.clientId || currentUser.id} companyLogo={companyLogo} />
    </div>
  );
};

export default ToolsHistoryPage;
