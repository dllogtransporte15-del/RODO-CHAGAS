
import React from 'react';

interface HeaderProps {
  title: string;
  children?: React.ReactNode;
}

const Header: React.FC<HeaderProps> = ({ title, children }) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 dark:from-white dark:via-slate-100 dark:to-slate-300">
            {title}
          </span>
        </h1>
        <div className="h-1 w-12 bg-gradient-to-r from-[#1D3B8D] to-[#F16421] rounded-full mt-2" />
      </div>
      <div className="flex items-center flex-wrap gap-3">
        {children}
      </div>
    </div>
  );
};

export default Header;


