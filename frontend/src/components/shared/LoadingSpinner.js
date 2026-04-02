import React from 'react';

const LoadingSpinner = ({ fullPage = true }) => {
  return (
    <div className={`flex flex-col items-center justify-center space-y-6 ${fullPage ? 'min-h-[60vh]' : 'p-12'} animate-in fade-in duration-500`}>
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 border-4 border-gray-100 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
      </div>
      <p className="text-[10px] font-black text-black uppercase tracking-[0.2em] animate-pulse">
        Fetching Data...
      </p>
    </div>
  );
};

export default LoadingSpinner;
