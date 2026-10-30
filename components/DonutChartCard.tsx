import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface DonutChartData {
  label: string;
  value: number;
  color: string;
}

interface DonutChartCardProps {
  title: string;
  data: DonutChartData[];
  unit?: string;
  initialLimit?: number;
}

const DonutChartCard: React.FC<DonutChartCardProps> = ({ 
  title, 
  data, 
  unit = '', 
  initialLimit = 15 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const total = data.reduce((sum, item) => sum + item.value, 0);

  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const hasMore = data.length > initialLimit;
  const displayedData = (hasMore && !isExpanded) ? data.slice(0, initialLimit) : data;

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4">{title}</h3>
      <div className="flex flex-col md:flex-row items-center justify-center gap-6">
        <div className="relative w-48 h-48 flex-shrink-0">
          <svg className="w-full h-full" viewBox="-100 -100 200 200" transform="rotate(-90)">
            <circle
              className="stroke-gray-200 dark:stroke-gray-700"
              r={radius}
              cx="0"
              cy="0"
              fill="transparent"
              strokeWidth="25"
            />
            {data.map((item, index) => {
              if (item.value === 0) return null;
              const percentage = total > 0 ? (item.value / total) * 100 : 0;
              const dash = (percentage * circumference) / 100;
              
              // This is a workaround for Tailwind JIT not picking up dynamic classes
              const colorMap: Record<string, string> = {
                'bg-blue-500': 'stroke-blue-500',
                'bg-blue-400': 'stroke-blue-400',
                'bg-blue-300': 'stroke-blue-300',
                'bg-gray-500': 'stroke-gray-500',
                'bg-gray-400': 'stroke-gray-400',
                'bg-emerald-500': 'stroke-emerald-500',
                'bg-orange-500': 'stroke-orange-500',
                'bg-purple-500': 'stroke-purple-500',
                'bg-red-500': 'stroke-red-500',
                'bg-yellow-500': 'stroke-yellow-500',
                'bg-pink-500': 'stroke-pink-500',
                'bg-indigo-500': 'stroke-indigo-500',
              };
              const strokeColor = colorMap[item.color] || 'stroke-gray-500';

              const currentOffset = offset;
              offset += dash;

              return (
                <circle
                  key={index}
                  className={strokeColor}
                  r={radius}
                  cx="0"
                  cy="0"
                  fill="transparent"
                  strokeWidth="25"
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-currentOffset}
                  style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <span className="text-xl font-bold text-gray-800 dark:text-white">
                {total.toLocaleString('pt-BR')}
                {unit && <span className="text-xs ml-0.5">{unit}</span>}
              </span>
              <span className="block text-sm text-gray-500 dark:text-gray-400">Total</span>
            </div>
          </div>
        </div>
        <div className="w-full md:w-auto flex-1 max-w-md">
          <ul className="space-y-2">
            {displayedData.map((item, index) => (
              <li key={index} className="flex items-center text-sm">
                <span className={`w-3 h-3 rounded-full mr-3 shrink-0 ${item.color}`}></span>
                <span className="text-gray-600 dark:text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis mr-1" title={item.label}>
                  {item.label}:
                </span>
                <span className="font-semibold ml-auto text-gray-800 dark:text-gray-200 shrink-0">
                  {item.value.toLocaleString('pt-BR')} {unit}
                </span>
              </li>
            ))}
          </ul>
          {hasMore && (
            <div className="mt-3 pt-2 text-center border-t border-gray-100 dark:border-gray-700/60">
              <button
                type="button"
                onClick={() => setIsExpanded(prev => !prev)}
                className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 py-1.5 px-3 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors w-full sm:w-auto"
                title={isExpanded ? 'Recolher lista' : `Exibir todos os ${data.length} clientes`}
              >
                {isExpanded ? (
                  <>
                    <span>Exibir menos</span>
                    <ChevronUp className="w-3.5 h-3.5" />
                  </>
                ) : (
                  <>
                    <span>Exibir mais</span>
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
