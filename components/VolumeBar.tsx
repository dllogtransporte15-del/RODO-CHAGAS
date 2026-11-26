import React from 'react';

interface VolumeBarProps {
  loaded: number;
  scheduled: number;
  total: number;
  loadedColor?: string;
  scheduledColor?: string;
  onClick?: () => void;
}

const VolumeBar: React.FC<VolumeBarProps> = ({
  loaded,
  scheduled,
  total,
  loadedColor = 'bg-emerald-500',
  scheduledColor = 'bg-amber-400',
  onClick,
}) => {
  const safeTotal = total > 0 ? total : 1;
  const loadedPercentage = Math.min(100, Math.max(0, (loaded / safeTotal) * 100));
  const scheduledPercentage = Math.min(100 - loadedPercentage, Math.max(0, (scheduled / safeTotal) * 100));
  const available = Math.max(0, total - loaded - scheduled);

  const tooltip = [
    `Carregado: ${loaded.toLocaleString('pt-BR')} t (${loadedPercentage.toFixed(0)}%)`,
    scheduled > 0 ? `Agendado: ${scheduled.toLocaleString('pt-BR')} t (${scheduledPercentage.toFixed(0)}%)` : null,
    total > 0 ? `Disponível: ${available.toLocaleString('pt-BR')} t` : null,
    onClick ? 'Clique para ver embarques' : null,
  ]
    .filter(Boolean)
    .join(' • ');

  return (
    <div
      className={`group relative w-full bg-slate-200/80 dark:bg-slate-700/70 rounded-full h-2.5 flex overflow-hidden ring-1 ring-inset ring-black/5 dark:ring-white/5 ${
        onClick ? 'cursor-pointer hover:ring-blue-400/60 hover:h-3 transition-all duration-200' : ''
      }`}
      onClick={onClick}
      title={tooltip}
      role={onClick ? 'button' : undefined}
    >
      <div
        className={`${loadedColor} h-full transition-all duration-500 ease-out`}
        style={{ width: `${loadedPercentage}%` }}
      />
      <div
        className={`${scheduledColor} h-full transition-all duration-500 ease-out`}
        style={{ width: `${scheduledPercentage}%` }}
      />
    </div>
  );
};

export default VolumeBar;
