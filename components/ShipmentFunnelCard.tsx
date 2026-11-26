import React, { useState, useMemo } from 'react';
import { ShipmentStatus } from '../types';
import { Eye, EyeOff, BarChart3, Filter as FunnelIcon, Sparkles } from 'lucide-react';

interface ShipmentFunnelData {
  label: ShipmentStatus;
  value: number;
}

interface ShipmentFunnelCardProps {
  title: string;
  data: ShipmentFunnelData[];
  className?: string;
  onStageClick?: (stage: ShipmentFunnelData) => void;
}

const STAGE_STYLES: Record<string, { bar: string; dot: string; badge: string }> = {
  [ShipmentStatus.Pendente]: {
    bar: 'from-slate-400 to-slate-500',
    dot: 'bg-slate-400',
    badge: 'bg-slate-500/15 text-slate-400',
  },
  [ShipmentStatus.AguardandoSeguradora]: {
    bar: 'from-amber-500 to-orange-500',
    dot: 'bg-amber-400',
    badge: 'bg-amber-500/15 text-amber-400',
  },
  [ShipmentStatus.PreCadastro]: {
    bar: 'from-violet-500 to-purple-500',
    dot: 'bg-violet-400',
    badge: 'bg-violet-500/15 text-violet-400',
  },
  [ShipmentStatus.AguardandoCarregamento]: {
    bar: 'from-blue-500 to-indigo-500',
    dot: 'bg-blue-400',
    badge: 'bg-blue-500/15 text-blue-400',
  },
  [ShipmentStatus.AguardandoNota]: {
    bar: 'from-cyan-500 to-sky-500',
    dot: 'bg-cyan-400',
    badge: 'bg-cyan-500/15 text-cyan-400',
  },
  [ShipmentStatus.AguardandoAdiantamento]: {
    bar: 'from-teal-500 to-emerald-500',
    dot: 'bg-teal-400',
    badge: 'bg-teal-500/15 text-teal-400',
  },
  [ShipmentStatus.AguardandoAgendamento]: {
    bar: 'from-indigo-500 to-blue-600',
    dot: 'bg-indigo-400',
    badge: 'bg-indigo-500/15 text-indigo-400',
  },
  [ShipmentStatus.AguardandoDescarga]: {
    bar: 'from-emerald-500 to-green-500',
    dot: 'bg-emerald-400',
    badge: 'bg-emerald-500/15 text-emerald-400',
  },
  [ShipmentStatus.AguardandoPagamentoSaldo]: {
    bar: 'from-orange-500 to-rose-500',
    dot: 'bg-orange-400',
    badge: 'bg-orange-500/15 text-orange-400',
  },
};

const DEFAULT_STYLE = {
  bar: 'from-blue-500 to-indigo-600',
  dot: 'bg-blue-500',
  badge: 'bg-blue-500/15 text-blue-400',
};

const ShipmentFunnelCard: React.FC<ShipmentFunnelCardProps> = ({
  title,
  data,
  className = '',
  onStageClick,
}) => {
  const [hideEmpty, setHideEmpty] = useState(false);
  const [viewMode, setViewMode] = useState<'bars' | 'funnel'>('bars');
  const [hoveredStage, setHoveredStage] = useState<string | null>(null);
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

  const total = useMemo(() => data.reduce((sum, item) => sum + item.value, 0), [data]);
  const maxValue = useMemo(() => Math.max(...data.map((item) => item.value), 1), [data]);

  const visibleData = useMemo(
    () => (hideEmpty ? data.filter((item) => item.value > 0) : data),
    [data, hideEmpty]
  );

  const activeLabel = hoveredStage ?? selectedStage;
  const activeItem = useMemo(
    () => (activeLabel ? data.find((d) => d.label === activeLabel) ?? null : null),
    [activeLabel, data]
  );

  const handleStageClick = (item: ShipmentFunnelData) => {
    setSelectedStage((prev) => (prev === item.label ? null : item.label));
    onStageClick?.(item);
  };

  return (
    <div
      className={`bg-white/95 dark:bg-slate-800/90 backdrop-blur-sm p-6 rounded-2xl shadow-lg shadow-slate-900/5 dark:shadow-black/25 border border-slate-200/80 dark:border-slate-700/60 transition-all duration-300 hover:border-slate-300 dark:hover:border-slate-600/80 ${className}`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white">
            {title}
          </h3>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400">
            {total} {total === 1 ? 'embarque' : 'embarques'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setHideEmpty((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              hideEmpty
                ? 'bg-blue-500/15 border-blue-500/40 text-blue-600 dark:text-blue-400'
                : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700/70 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'
            }`}
            title={hideEmpty ? 'Mostrar todas as etapas' : 'Ocultar etapas zeradas'}
          >
            {hideEmpty ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{hideEmpty ? 'Mostrar todas' : 'Ocultar zerados'}</span>
          </button>

          <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-700/70">
            <button
              type="button"
              onClick={() => setViewMode('bars')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'bars'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="Visualização em Barras"
            >
              <BarChart3 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('funnel')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'funnel'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="Visualização em Funil Centralizado"
            >
              <FunnelIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Stage list */}
      <div className="space-y-2.5">
        {visibleData.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400">
            Nenhum embarque ativo nas etapas exibidas.
          </div>
        ) : (
          visibleData.map((item, index) => {
            const pctOfMax = (item.value / maxValue) * 100;
            const pctOfTotal = total > 0 ? (item.value / total) * 100 : 0;
            const style = STAGE_STYLES[item.label] || DEFAULT_STYLE;
            const isActive = activeLabel === item.label;
            const isDimmed = activeLabel !== null && !isActive;

            return (
              <button
                key={item.label}
                type="button"
                onMouseEnter={() => setHoveredStage(item.label)}
                onMouseLeave={() => setHoveredStage(null)}
                onClick={() => handleStageClick(item)}
                className={`w-full text-left p-2.5 rounded-xl transition-all duration-200 border ${
                  isActive
                    ? 'bg-slate-100/90 dark:bg-slate-700/50 border-blue-500/40 shadow-sm'
                    : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-700/25'
                } ${isDimmed ? 'opacity-50' : 'opacity-100'}`}
              >
                <div className="flex justify-between items-center mb-1.5 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 w-4 tabular-nums">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${style.dot} ${
                        item.value > 0 ? 'shadow-sm' : 'opacity-40'
                      }`}
                    />
                    <span className="font-semibold text-slate-700 dark:text-slate-200 truncate">
                      {item.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-400 tabular-nums">
                      {pctOfTotal.toFixed(1).replace('.', ',')}%
                    </span>
                    <span
                      className={`font-extrabold tabular-nums px-2 py-0.5 rounded-md text-xs ${
                        item.value > 0
                          ? style.badge
                          : 'bg-slate-100 dark:bg-slate-700/50 text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {item.value}
                    </span>
                  </div>
                </div>

                {/* Progress / Funnel Bar */}
                <div
                  className={`w-full bg-slate-200/80 dark:bg-slate-700/60 rounded-full h-3 overflow-hidden flex ${
                    viewMode === 'funnel' ? 'justify-center' : 'justify-start'
                  }`}
                >
                  <div
                    className={`bg-gradient-to-r ${style.bar} h-3 rounded-full transition-all duration-500 ease-out relative`}
                    style={{
                      width: `${item.value > 0 ? Math.max(pctOfMax, 4) : 0}%`,
                    }}
                  />
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Interactive Footer Insight */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs">
        {activeItem ? (
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
            <Sparkles className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span>
              <strong>{activeItem.label}</strong>: {activeItem.value}{' '}
              {activeItem.value === 1 ? 'embarque' : 'embarques'} (
              {total > 0 ? ((activeItem.value / total) * 100).toFixed(1).replace('.', ',') : '0,0'}% do funil)
            </span>
          </div>
        ) : (
          <span className="text-slate-400 dark:text-slate-500">
            Clique ou passe o mouse em uma etapa para inspecionar
          </span>
        )}
        {selectedStage && (
          <button
            type="button"
            onClick={() => setSelectedStage(null)}
            className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
          >
            Limpar
          </button>
        )}
      </div>
    </div>
  );
};

export default ShipmentFunnelCard;
