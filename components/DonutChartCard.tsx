import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, PieChart, CircleDot, Search, ArrowUpDown, X, Pin } from 'lucide-react';

export interface DonutChartData {
  label: string;
  value: number;
  color: string;
}

interface DonutChartCardProps {
  title: string;
  data: DonutChartData[];
  unit?: string;
  initialLimit?: number;
  onItemClick?: (item: DonutChartData) => void;
}

const COLOR_HEX_MAP: Record<string, string> = {
  'bg-blue-500': '#3b82f6',
  'bg-blue-400': '#60a5fa',
  'bg-blue-300': '#93c5fd',
  'bg-gray-500': '#6b7280',
  'bg-gray-400': '#9ca3af',
  'bg-emerald-500': '#10b981',
  'bg-orange-500': '#f97316',
  'bg-purple-500': '#a855f7',
  'bg-red-500': '#ef4444',
  'bg-yellow-500': '#eab308',
  'bg-pink-500': '#ec4899',
  'bg-indigo-500': '#6366f1',
  'bg-cyan-500': '#06b6d4',
  'bg-teal-500': '#14b8a6',
  'bg-amber-500': '#f59e0b',
};

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180.0;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeSectorPath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number
): string {
  const sweep = Math.min(endAngle - startAngle, 359.999);
  const adjustedEnd = startAngle + sweep;
  const largeArc = sweep > 180 ? 1 : 0;

  const p1 = polarToCartesian(cx, cy, outerR, startAngle);
  const p2 = polarToCartesian(cx, cy, outerR, adjustedEnd);

  if (innerR <= 0) {
    return [
      `M ${cx} ${cy}`,
      `L ${p1.x} ${p1.y}`,
      `A ${outerR} ${outerR} 0 ${largeArc} 1 ${p2.x} ${p2.y}`,
      'Z',
    ].join(' ');
  }

  const p3 = polarToCartesian(cx, cy, innerR, adjustedEnd);
  const p4 = polarToCartesian(cx, cy, innerR, startAngle);

  return [
    `M ${p1.x} ${p1.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${p4.x} ${p4.y}`,
    'Z',
  ].join(' ');
}

const DonutChartCard: React.FC<DonutChartCardProps> = ({
  title,
  data,
  unit = '',
  initialLimit = 10,
  onItemClick,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [chartMode, setChartMode] = useState<'donut' | 'pie'>('donut');
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const [pinnedLabel, setPinnedLabel] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'desc' | 'asc' | 'alpha'>('desc');

  const total = useMemo(() => data.reduce((sum, item) => sum + item.value, 0), [data]);

  const activeLabel = hoveredLabel ?? pinnedLabel;
  const activeItem = useMemo(
    () => (activeLabel ? data.find((d) => d.label === activeLabel) ?? null : null),
    [activeLabel, data]
  );

  // Build SVG slices with angles
  const slices = useMemo(() => {
    let currentAngle = 0;
    return data
      .filter((item) => item.value > 0)
      .map((item) => {
        const percentage = total > 0 ? (item.value / total) * 100 : 0;
        const angleSpan = total > 0 ? (item.value / total) * 360 : 0;
        const startAngle = currentAngle;
        const endAngle = currentAngle + angleSpan;
        const midAngle = startAngle + angleSpan / 2;
        currentAngle = endAngle;
        const hex = COLOR_HEX_MAP[item.color] || '#6b7280';
        return {
          ...item,
          percentage,
          startAngle,
          endAngle,
          midAngle,
          hex,
        };
      });
  }, [data, total]);

  // Filter & sort legend items
  const processedLegend = useMemo(() => {
    let list = [...data];
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter((item) => item.label.toLowerCase().includes(q));
    }
    if (sortBy === 'desc') {
      list.sort((a, b) => b.value - a.value);
    } else if (sortBy === 'asc') {
      list.sort((a, b) => a.value - b.value);
    } else {
      list.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
    }
    return list;
  }, [data, searchTerm, sortBy]);

  const hasMore = processedLegend.length > initialLimit;
  const displayedData =
    hasMore && !isExpanded && !searchTerm.trim()
      ? processedLegend.slice(0, initialLimit)
      : processedLegend;

  const handleTogglePin = (item: DonutChartData) => {
    setPinnedLabel((prev) => (prev === item.label ? null : item.label));
    onItemClick?.(item);
  };

  const cycleSort = () => {
    setSortBy((prev) => (prev === 'desc' ? 'alpha' : prev === 'alpha' ? 'asc' : 'desc'));
  };

  const sortLabel = sortBy === 'desc' ? 'Maior' : sortBy === 'asc' ? 'Menor' : 'A–Z';

  return (
    <div className="bg-white/95 dark:bg-slate-800/90 backdrop-blur-sm p-6 rounded-2xl shadow-lg shadow-slate-900/5 dark:shadow-black/25 border border-slate-200/80 dark:border-slate-700/60 transition-all duration-300 hover:border-slate-300 dark:hover:border-slate-600/80">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5 min-w-0">
          <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white truncate">
            {title}
          </h3>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300 shrink-0">
            {data.length} {data.length === 1 ? 'item' : 'itens'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {pinnedLabel && (
            <button
              type="button"
              onClick={() => setPinnedLabel(null)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-400 hover:bg-blue-500/25 transition-colors"
              title="Limpar seleção fixada"
            >
              <Pin className="w-3 h-3" />
              <span>Limpar</span>
              <X className="w-3 h-3" />
            </button>
          )}
          <div
            className="inline-flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-700/70"
            role="group"
            aria-label="Tipo de gráfico"
          >
            <button
              type="button"
              onClick={() => setChartMode('donut')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                chartMode === 'donut'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="Visualização em Rosca"
            >
              <CircleDot className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Rosca</span>
            </button>
            <button
              type="button"
              onClick={() => setChartMode('pie')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                chartMode === 'pie'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="Visualização em Pizza"
            >
              <PieChart className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Pizza</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col md:flex-row items-center md:items-start justify-center gap-6">
        {/* Interactive Chart Area - fixed width on md+ so legend never shifts horizontally */}
        <div className="flex flex-col items-center w-full md:w-[260px] shrink-0">
          <div className="relative w-52 h-52 sm:w-56 sm:h-56 select-none">
            <svg className="w-full h-full overflow-visible" viewBox="-115 -115 230 230">
              {/* Background Track Ring (Donut mode) */}
              {chartMode === 'donut' && (
                <circle
                  cx="0"
                  cy="0"
                  r="78"
                  fill="transparent"
                  className="stroke-slate-200/70 dark:stroke-slate-700/50"
                  strokeWidth="26"
                />
              )}

              {slices.length === 0 && (
                <circle
                  cx="0"
                  cy="0"
                  r={chartMode === 'donut' ? 78 : 88}
                  fill={chartMode === 'pie' ? 'rgba(148,163,184,0.15)' : 'transparent'}
                  className="stroke-slate-200 dark:stroke-slate-700"
                  strokeWidth={chartMode === 'donut' ? 26 : 2}
                />
              )}

              {/* Visual Slices (pointer-events-none, anchored in place with glow & opacity animation) */}
              {slices.map((slice) => {
                const isActive = activeLabel === slice.label;
                const isDimmed = activeLabel !== null && !isActive;

                const outerR = chartMode === 'donut' ? (isActive ? 94 : 91) : isActive ? 96 : 92;
                const innerR = chartMode === 'donut' ? (isActive ? 63 : 65) : 0;

                const pathD = describeSectorPath(0, 0, outerR, innerR, slice.startAngle, slice.endAngle);

                return (
                  <path
                    key={`visual-${slice.label}`}
                    d={pathD}
                    fill={slice.hex}
                    className="pointer-events-none transition-[opacity,filter] duration-200 ease-out"
                    style={{
                      opacity: isDimmed ? 0.35 : 1,
                      filter: isActive ? `drop-shadow(0 0 12px ${slice.hex}99)` : 'none',
                      stroke: isActive
                        ? 'rgba(255, 255, 255, 0.45)'
                        : chartMode === 'pie'
                        ? 'rgba(15, 23, 42, 0.35)'
                        : 'rgba(15, 23, 42, 0.25)',
                      strokeWidth: isActive ? 2 : slices.length > 1 ? 1.5 : 0,
                    }}
                  />
                );
              })}

              {/* Static Hit-Target Layer (never moves or resizes, preventing hover flicker) */}
              {slices.map((slice) => {
                const hitOuterR = chartMode === 'donut' ? 96 : 98;
                const hitInnerR = chartMode === 'donut' ? 62 : 0;
                const hitPathD = describeSectorPath(0, 0, hitOuterR, hitInnerR, slice.startAngle, slice.endAngle);

                return (
                  <path
                    key={`hit-${slice.label}`}
                    d={hitPathD}
                    fill="transparent"
                    onMouseEnter={() => setHoveredLabel(slice.label)}
                    onMouseLeave={() => setHoveredLabel(null)}
                    onClick={() => handleTogglePin(slice)}
                    className="cursor-pointer outline-none"
                  >
                    <title>
                      {slice.label}: {slice.value.toLocaleString('pt-BR')} {unit} ({slice.percentage.toFixed(1).replace('.', ',')}%)
                    </title>
                  </path>
                );
              })}
            </svg>

            {/* Center Readout (Donut mode) */}
            {chartMode === 'donut' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-28 h-28 rounded-full flex flex-col items-center justify-center text-center px-2 transition-all duration-200">
                  {activeItem ? (
                    <>
                      <span
                        className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-1"
                        style={{
                          backgroundColor: `${COLOR_HEX_MAP[activeItem.color] || '#3b82f6'}22`,
                          color: COLOR_HEX_MAP[activeItem.color] || '#60a5fa',
                        }}
                      >
                        {total > 0 ? ((activeItem.value / total) * 100).toFixed(1).replace('.', ',') : '0,0'}%
                      </span>
                      <span className="text-lg font-extrabold text-slate-900 dark:text-white leading-tight">
                        {activeItem.value.toLocaleString('pt-BR')}
                        {unit && <span className="text-xs font-semibold ml-0.5 text-slate-500 dark:text-slate-400">{unit}</span>}
                      </span>
                      <span
                        className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mt-0.5 max-w-[104px] truncate"
                        title={activeItem.label}
                      >
                        {activeItem.label}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-xl font-extrabold text-slate-900 dark:text-white leading-tight">
                        {total.toLocaleString('pt-BR')}
                        {unit && <span className="text-xs font-semibold ml-0.5 text-slate-500 dark:text-slate-400">{unit}</span>}
                      </span>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                        Total Geral
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Interactive Readout Pill (fixed height & max-width to prevent any layout shift) */}
          <div className="mt-2 h-8 w-full flex items-center justify-center overflow-hidden">
            {activeItem ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 text-xs shadow-sm whitespace-nowrap max-w-full">
                <span className={`w-2 h-2 rounded-full shrink-0 ${activeItem.color}`} />
                <span className="font-semibold text-slate-800 dark:text-slate-100 truncate min-w-0">
                  {activeItem.label}
                </span>
                <span className="text-slate-500 dark:text-slate-400 shrink-0">•</span>
                <span className="font-bold text-blue-600 dark:text-blue-400 shrink-0 tabular-nums">
                  {activeItem.value.toLocaleString('pt-BR')} {unit}
                </span>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0 tabular-nums">
                  ({total > 0 ? ((activeItem.value / total) * 100).toFixed(1).replace('.', ',') : '0'}%)
                </span>
              </div>
            ) : (
              <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                Passe o mouse ou clique para destacar
              </span>
            )}
          </div>
        </div>

        {/* Interactive Legend Area */}
        <div className="w-full flex-1 min-w-0">
          {/* Search & Sort toolbar when list is sizable */}
          {data.length > 4 && (
            <div className="flex items-center gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filtrar na lista..."
                  className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={cycleSort}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors shrink-0"
                title="Alternar ordenação"
              >
                <ArrowUpDown className="w-3 h-3 text-blue-500" />
                <span>{sortLabel}</span>
              </button>
            </div>
          )}

          {/* Legend List */}
          <ul className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
            {displayedData.length === 0 ? (
              <li className="text-xs text-center text-slate-400 py-6">
                Nenhum item encontrado para "{searchTerm}".
              </li>
            ) : (
              displayedData.map((item) => {
                const pct = total > 0 ? (item.value / total) * 100 : 0;
                const isActive = activeLabel === item.label;
                const isPinned = pinnedLabel === item.label;
                const isDimmed = activeLabel !== null && !isActive;

                return (
                  <li key={item.label}>
                    <button
                      type="button"
                      onMouseEnter={() => setHoveredLabel(item.label)}
                      onMouseLeave={() => setHoveredLabel(null)}
                      onClick={() => handleTogglePin(item)}
                      className={`w-full text-left px-2.5 py-2 rounded-xl transition-colors duration-150 border ${
                        isActive
                          ? 'bg-slate-100/90 dark:bg-slate-700/60 border-blue-500/40 shadow-sm'
                          : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-700/30'
                      } ${isDimmed ? 'opacity-45' : 'opacity-100'}`}
                    >
                      <div className="flex items-center gap-2.5 text-sm">
                        <span
                          className={`w-3 h-3 rounded-full shrink-0 transition-shadow duration-150 ${item.color} ${
                            isActive ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-800 ring-blue-400/70' : ''
                          }`}
                        />
                        <span
                          className="text-slate-700 dark:text-slate-200 font-medium truncate flex-1"
                          title={item.label}
                        >
                          {item.label}
                        </span>
                        {isPinned && <Pin className="w-3 h-3 text-blue-500 shrink-0" />}
                        <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-400 tabular-nums shrink-0">
                          {pct.toFixed(1).replace('.', ',')}%
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white tabular-nums shrink-0 min-w-[64px] text-right">
                          {item.value.toLocaleString('pt-BR')} {unit}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })
            )}
          </ul>

          {hasMore && !searchTerm.trim() && (
            <div className="mt-3 pt-2.5 text-center border-t border-slate-100 dark:border-slate-700/60">
              <button
                type="button"
                onClick={() => setIsExpanded((prev) => !prev)}
                className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 py-1.5 px-4 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                {isExpanded ? (
                  <>
                    <span>Exibir menos</span>
                    <ChevronUp className="w-3.5 h-3.5" />
                  </>
                ) : (
                  <>
                    <span>Exibir mais (+{processedLegend.length - initialLimit})</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DonutChartCard;
