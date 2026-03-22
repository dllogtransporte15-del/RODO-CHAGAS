import React from 'react';
import StayCalculator from '../components/StayCalculator';
import { User } from '../types';

interface LayoverCalculatorPageProps {
  currentUser: User;
}

const LayoverCalculatorPage: React.FC<LayoverCalculatorPageProps> = ({ currentUser }) => {
  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-indigo-500">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Cálculo de Estadias</h2>
        <p className="text-gray-600">
          Utilize esta ferramenta para calcular o valor de estadias de forma precisa e emitir relatórios ou CSV. O histórico fica salvo localmente por sessão.
        </p>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <StayCalculator companyId={currentUser.clientId || currentUser.id} />
      </div>
    </div>
  );
};

export default LayoverCalculatorPage;
