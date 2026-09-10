
import React from 'react';

interface CardProps {
  title: string;
  value: string;
  icon: React.ReactElement;
  colorClass: string;
}

const Card: React.FC<CardProps> = ({ title, value, icon, colorClass }) => {
  return (
    <div className="bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-white/10 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.08)] dark:shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] p-5 flex items-center relative overflow-hidden transition-all duration-200 hover:border-slate-300 dark:hover:border-white/20 hover:bg-white dark:hover:bg-slate-900/90 group">
      {/* Top Accent Line matching LoginPage */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#1D3B8D] via-[#F16421] to-[#1D3B8D] opacity-40 group-hover:opacity-100 transition-opacity" />
      
      <div className={`p-3 rounded-xl ${colorClass} shadow-md flex items-center justify-center border border-black/5 dark:border-white/10 shrink-0`}>
        {icon}
      </div>
      <div className="ml-4 flex-1 min-w-0">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">{title}</p>
        <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5 truncate">{value}</p>
      </div>
    </div>
  );
};

export default Card;


