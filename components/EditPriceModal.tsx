
import React, { useState, useEffect } from 'react';
import type { Shipment } from '../types';

interface EditPriceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newPrice: number) => void;
  shipment: Shipment;
}

const EditPriceModal: React.FC<EditPriceModalProps> = ({ isOpen, onClose, onSave, shipment }) => {
  const [totalPrice, setTotalPrice] = useState(0);
  const [pricePerTon, setPricePerTon] = useState(0);

  useEffect(() => {
    if (shipment && isOpen) {
      const total = shipment.driverFreightValue;
      const perTon = shipment.shipmentTonnage > 0 ? total / shipment.shipmentTonnage : 0;
      setTotalPrice(total);
      setPricePerTon(perTon);
    }
  }, [shipment, isOpen]);

  const handleTotalPriceChange = (newTotal: number) => {
    setTotalPrice(newTotal);
    if (shipment && shipment.shipmentTonnage > 0) {
      setPricePerTon(newTotal / shipment.shipmentTonnage);
    }
  };

  const handlePricePerTonChange = (newPerTon: number) => {
    setPricePerTon(newPerTon);
    if (shipment) {
      setTotalPrice(newPerTon * shipment.shipmentTonnage);
    }
  };

  const handleSave = () => {
    onSave(totalPrice);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-lg w-full">
        <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">Alterar Preço do Frete</h2>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">Embarque ID: {shipment.id}</p>
        
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="price-per-ton" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Valor por Tonelada
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">R$</span>
                    </div>
                    <input
                      type="number"
                      name="price-per-ton"
                      id="price-per-ton"
                      className="focus:ring-primary focus:border-primary block w-full pl-7 pr-4 sm:text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
                      placeholder="0.00"
                      value={pricePerTon.toFixed(2)}
                      onChange={(e) => handlePricePerTonChange(Number(e.target.value))}
                      step="0.01"
                      disabled={!shipment || shipment.shipmentTonnage <= 0}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="total-price" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Valor Total do Frete
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">R$</span>
                    </div>
                    <input
                      type="number"
                      name="total-price"
                      id="total-price"
                      className="focus:ring-primary focus:border-primary block w-full pl-7 pr-4 sm:text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
                      placeholder="0.00"
                      value={totalPrice.toFixed(2)}
                      onChange={(e) => handleTotalPriceChange(Number(e.target.value))}
                      step="0.01"
                    />
                  </div>
                </div>
            </div>
             <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Alterar um valor recalculará o outro automaticamente com base na tonelagem do embarque ({shipment.shipmentTonnage} ton).
            </p>
        </div>
        
        <div className="mt-8 flex justify-end space-x-4">
          <button type="button" onClick={onClose} className="py-2 px-4 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">
            Cancelar
          </button>
          <button type="button" onClick={handleSave} className="py-2 px-4 bg-primary text-white rounded-lg hover:bg-primary-dark">
            Salvar Alterações
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditPriceModal;