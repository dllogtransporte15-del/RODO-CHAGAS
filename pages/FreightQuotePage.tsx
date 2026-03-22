import React from 'react';
import FreightQuote from '../components/FreightQuote';
import { User } from '../types';

interface FreightQuotePageProps {
  currentUser: User;
}

const FreightQuotePage: React.FC<FreightQuotePageProps> = ({ currentUser }) => {
  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-500">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Simulador de Fretes</h2>
        <p className="text-gray-600">
          Integração com mapas para traçar rotas e cálculo detalhado de margens e lucro líquido. 
        </p>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <FreightQuote companyId={currentUser.clientId || currentUser.id} />
      </div>
    </div>
  );
};

export default FreightQuotePage;
