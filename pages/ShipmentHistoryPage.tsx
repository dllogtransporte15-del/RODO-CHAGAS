
import React, { useState, useMemo } from 'react';
import Header from '../components/Header';
import ShipmentTable from '../components/ShipmentTable';
import ShipmentHistoryFilter from '../components/ShipmentHistoryFilter';
import HistoryModal from '../components/HistoryModal';
import AttachmentModal from '../components/AttachmentModal';
import CargoDetailsModal from '../components/CargoDetailsModal';
import type { Shipment, Cargo, User, Product, Client, Vehicle } from '../types';
import { ShipmentStatus } from '../types';

interface ShipmentHistoryPageProps {
  shipments: Shipment[];
  cargos: Cargo[];
  users: User[];
  currentUser: User;
  clients: Client[];
  products: Product[];
  vehicles: Vehicle[];
  onDeleteShipment: (shipmentId: string) => void;
}

const ShipmentHistoryPage: React.FC<ShipmentHistoryPageProps> = ({ shipments, cargos, users, currentUser, clients, products, vehicles, onDeleteShipment }) => {
  const [activeStatus, setActiveStatus] = useState<ShipmentStatus>(ShipmentStatus.Finalizado);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isAttachmentModalOpen, setAttachmentModalOpen] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [detailsModalCargo, setDetailsModalCargo] = useState<Cargo | null>(null);

  const filteredShipments = useMemo(() => {
    return shipments.filter(shipment => shipment.status === activeStatus);
  }, [shipments, activeStatus]);

  const handleShowHistory = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setIsHistoryModalOpen(true);
  };
  
  const handleOpenAttachmentModal = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setAttachmentModalOpen(true);
  };
  
  const handleDummySave = (data: { filesToAttach: { [key: string]: File[] }, bankDetails?: string, loadedTonnage?: number, advancePercentage?: number, route?: string }) => {
    // This is a read-only page, but the modal needs a function
    setAttachmentModalOpen(false);
  };

  const handleShowCargoDetails = (cargo: Cargo) => {
    setDetailsModalCargo(cargo);
  };

  return (
    <>
      <Header title="Histórico de Embarques" />
      <ShipmentHistoryFilter 
        shipments={shipments} 
        activeStatus={activeStatus} 
        onStatusChange={setActiveStatus}
      />
      <ShipmentTable 
        shipments={filteredShipments} 
        cargos={cargos}
        users={users}
        vehicles={vehicles}
        onShowHistory={handleShowHistory}
        onAttach={handleOpenAttachmentModal} // Allow viewing attachments
        onShowCargoDetails={handleShowCargoDetails}
        onDelete={onDeleteShipment}
        currentUser={currentUser}
        activeStatus={activeStatus}
        clients={clients}
      />
      {selectedShipment && (
        <HistoryModal
            isOpen={isHistoryModalOpen}
            onClose={() => setIsHistoryModalOpen(false)}
            history={selectedShipment.history}
            users={users}
            title={`Histórico do Embarque ${selectedShipment.id}`}
        />
      )}
      {selectedShipment && (
        <AttachmentModal
            isOpen={isAttachmentModalOpen}
            onClose={() => setAttachmentModalOpen(false)}
            onSave={handleDummySave} // No saving on this page
            shipment={selectedShipment}
            cargo={cargos.find(c => c.id === selectedShipment.cargoId)}
            documentName="Documento"
            currentUser={currentUser}
        />
      )}
       {detailsModalCargo && (
          <CargoDetailsModal
            isOpen={!!detailsModalCargo}
            onClose={() => setDetailsModalCargo(null)}
            cargo={detailsModalCargo}
            client={clients.find(c => c.id === detailsModalCargo.clientId)}
            product={products.find(p => p.id === detailsModalCargo.productId)}
            commercialUser={users.find(u => u.id === detailsModalCargo.createdById)}
          />
      )}
    </>
  );
};

export default ShipmentHistoryPage;
