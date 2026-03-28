
import React, { useState, useMemo } from 'react';
import Header from '../components/Header';
import ShipmentTable from '../components/ShipmentTable';
import ShipmentStatusFilter from '../components/ShipmentStatusFilter';
import AttachmentModal from '../components/AttachmentModal';
import EditPriceModal from '../components/EditPriceModal';
import CancelShipmentModal from '../components/CancelShipmentModal';
import HistoryModal from '../components/HistoryModal';
import CadastroAnttModal from '../components/CadastroAnttModal';
import CargoDetailsModal from '../components/CargoDetailsModal';
import TransferShipmentModal from '../components/TransferShipmentModal';
import type { Shipment, Cargo, Client, Driver, User, ProfilePermissions, Product, Vehicle } from '../types';
import { ShipmentStatus, UserProfile } from '../types';
import { can } from '../auth';

interface ShipmentsPageProps {
  shipments: Shipment[];
  cargos: Cargo[];
  clients: Client[];
  products: Product[];
  drivers: Driver[];
  vehicles: Vehicle[];
  currentUser: User;
  profilePermissions: ProfilePermissions;
  users: User[];
  onUpdateAttachment: (shipmentId: string, data: { filesToAttach: { [key: string]: File[] }, bankDetails?: string }) => void;
  onUpdatePrice: (shipmentId: string, data: { newTotal: number, newRate?: number }) => void;
  onConfirmCancel: (shipmentId: string) => void;
  onUpdateAnttAndBankDetails: (shipmentId: string, data: { anttOwnerIdentifier: string; bankDetails?: string }) => void;
  onTransferShipment: (shipmentId: string, newEmbarcadorId: string) => void;
  onMarkArrival: (shipmentId: string) => void;
  onDeleteShipment: (shipmentId: string) => void;
}

const requiredDocumentMap: Partial<Record<ShipmentStatus, string>> = {
    [ShipmentStatus.PreCadastro]: 'Comprovante de Cadastro',
    [ShipmentStatus.AguardandoSeguradora]: 'Comprovação da Liberação da Seguradora',
    [ShipmentStatus.AguardandoCarregamento]: 'Ticket de Carregamento',
    [ShipmentStatus.AguardandoNota]: 'Documentação Fiscal', // Placeholder for multi-doc
    [ShipmentStatus.AguardandoAdiantamento]: 'Comprovante de Adiantamento',
    [ShipmentStatus.AguardandoAgendamento]: 'Comprovante de Agendamento',
    [ShipmentStatus.AguardandoDescarga]: 'Comprovante de Descarga',
    [ShipmentStatus.AguardandoPagamentoSaldo]: 'Comprovante de Pagamento de Saldo',
};

const ShipmentsPage: React.FC<ShipmentsPageProps> = ({ shipments, cargos, clients, products, drivers, vehicles, currentUser, profilePermissions, users, onUpdateAttachment, onUpdatePrice, onConfirmCancel, onUpdateAnttAndBankDetails, onTransferShipment, onMarkArrival, onDeleteShipment }) => {
  const [activeStatus, setActiveStatus] = useState<ShipmentStatus>(ShipmentStatus.AguardandoSeguradora);
  const [isAttachmentModalOpen, setAttachmentModalOpen] = useState(false);
  const [isEditPriceModalOpen, setEditPriceModalOpen] = useState(false);
  const [isCancelModalOpen, setCancelModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isCadastroAnttModalOpen, setCadastroAnttModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [detailsModalCargo, setDetailsModalCargo] = useState<Cargo | null>(null);

  const canUpdate = can('update', currentUser, 'shipments', profilePermissions);
  const canDelete = can('delete', currentUser, 'shipments', profilePermissions);

  const allowedProfilesForActions = [UserProfile.Comercial, UserProfile.Supervisor, UserProfile.Admin, UserProfile.Diretor];
  const canPerformSpecialActions = currentUser && allowedProfilesForActions.includes(currentUser.profile);
  
  const canEditPrice = canUpdate && canPerformSpecialActions;
  const canCancelShipment = canDelete && canPerformSpecialActions;
  const canTransferShipment = canUpdate && canPerformSpecialActions;
  const isClient = currentUser.profile === UserProfile.Cliente;

  const filteredShipments = useMemo(() => {
    return shipments.filter(shipment => shipment.status === activeStatus);
  }, [shipments, activeStatus]);
  
  const handleOpenAttachmentModal = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setAttachmentModalOpen(true);
  };
  
  const handleOpenCadastroAnttModal = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setCadastroAnttModalOpen(true);
  };

  const handleCloseAttachmentModal = () => {
    setAttachmentModalOpen(false);
    setSelectedShipment(null);
  };

  const handleSaveAttachment = (data: { filesToAttach: { [key: string]: File[] }, bankDetails?: string, loadedTonnage?: number, advancePercentage?: number }) => {
    if (!selectedShipment) return;
    onUpdateAttachment(selectedShipment.id, data);
    handleCloseAttachmentModal();
  };
  
  const handleSaveAnttData = (data: { anttOwnerIdentifier: string; bankDetails?: string }) => {
    if (!selectedShipment) return;
    onUpdateAnttAndBankDetails(selectedShipment.id, data);
    setCadastroAnttModalOpen(false);
    setSelectedShipment(null);
  };

  const handleEditPrice = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setEditPriceModalOpen(true);
  };

  const handleCancelShipment = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setCancelModalOpen(true);
  };
  
  const handleOpenTransferModal = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setIsTransferModalOpen(true);
  };

  const handleSavePrice = (data: { newTotal: number, newRate?: number }) => {
    if (!selectedShipment) return;
    onUpdatePrice(selectedShipment.id, data);
    setEditPriceModalOpen(false);
    setSelectedShipment(null);
  };

  const handleConfirmCancel = () => {
    if (!selectedShipment) return;
    onConfirmCancel(selectedShipment.id);
    setCancelModalOpen(false);
    setSelectedShipment(null);
  };
  
  const handleSaveTransfer = (newEmbarcadorId: string) => {
    if (selectedShipment) {
      onTransferShipment(selectedShipment.id, newEmbarcadorId);
    }
    setIsTransferModalOpen(false);
    setSelectedShipment(null);
  };

  const handleShowHistory = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setIsHistoryModalOpen(true);
  };

  const handleShowCargoDetails = (cargo: Cargo) => {
    setDetailsModalCargo(cargo);
  };

  const canUserAdvanceStatus = (shipment: Shipment): { allowed: boolean; reason: string } => {
    const defaultResponse = { allowed: true, reason: '' };
    if (!currentUser) return { allowed: false, reason: 'Usuário não autenticado.' };

    const currentStatus = shipment.status;
    const userProfile = currentUser.profile;

    if (userProfile === UserProfile.Admin) return defaultResponse;

    if (currentStatus === ShipmentStatus.PreCadastro || currentStatus === ShipmentStatus.AguardandoSeguradora) {
        if ([UserProfile.Fiscal, UserProfile.Diretor].includes(userProfile)) return defaultResponse;
        return { allowed: false, reason: 'Apenas Fiscal, Diretor ou Admin podem avançar este status.' };
    }

    if (currentStatus === ShipmentStatus.AguardandoAdiantamento || currentStatus === ShipmentStatus.AguardandoPagamentoSaldo) {
        if ([UserProfile.Financeiro, UserProfile.Diretor].includes(userProfile)) return defaultResponse;
        return { allowed: false, reason: 'Apenas Financeiro, Diretor ou Admin podem avançar.' };
    }


    return defaultResponse;
  };

  return (
    <>
      <Header title="Embarques" />
      <ShipmentStatusFilter 
        shipments={shipments} 
        activeStatus={activeStatus} 
        onStatusChange={setActiveStatus}
        currentUser={currentUser}
      />
      <ShipmentTable 
        shipments={filteredShipments} 
        cargos={cargos}
        users={users}
        vehicles={vehicles}
        onAttach={(canUpdate || isClient) ? handleOpenAttachmentModal : undefined}
        onEditPrice={canEditPrice ? handleEditPrice : undefined}
        onCancel={canCancelShipment ? handleCancelShipment : undefined}
        onTransfer={canTransferShipment ? handleOpenTransferModal : undefined}
        onShowHistory={handleShowHistory}
        onShowCargoDetails={handleShowCargoDetails}
        canUserAdvanceStatus={canUserAdvanceStatus}
        onMarkArrival={onMarkArrival}
        onDelete={onDeleteShipment}
        onOpenCadastroAntt={handleOpenCadastroAnttModal}
        currentUser={currentUser}
        activeStatus={activeStatus}
        clients={clients}
      />
      {selectedShipment && (
        <AttachmentModal
          isOpen={isAttachmentModalOpen}
          onClose={handleCloseAttachmentModal}
          onSave={handleSaveAttachment}
          shipment={selectedShipment}
          documentName={requiredDocumentMap[selectedShipment.status] || 'Documento'}
          currentUser={currentUser}
        />
      )}
      {selectedShipment && (
        <CadastroAnttModal
          isOpen={isCadastroAnttModalOpen}
          onClose={() => setCadastroAnttModalOpen(false)}
          onSave={handleSaveAnttData}
          shipment={selectedShipment}
        />
      )}
      {selectedShipment && (
        <EditPriceModal
            isOpen={isEditPriceModalOpen}
            onClose={() => setEditPriceModalOpen(false)}
            onSave={handleSavePrice}
            shipment={selectedShipment}
        />
      )}
      {selectedShipment && (
        <CancelShipmentModal
            isOpen={isCancelModalOpen}
            onClose={() => setCancelModalOpen(false)}
            onConfirm={handleConfirmCancel}
            shipmentId={selectedShipment.id}
        />
      )}
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
        <TransferShipmentModal
          isOpen={isTransferModalOpen}
          onClose={() => setIsTransferModalOpen(false)}
          onSave={handleSaveTransfer}
          shipment={selectedShipment}
          users={users}
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

export default ShipmentsPage;
