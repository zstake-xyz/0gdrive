import React from 'react';

export function PoweredBy() {
  return (
    <div 
      className="fixed bottom-5 right-5 z-50 animate-fade-in-up"
      style={{ animationDelay: '1s', opacity: 0 }}
    >
      <a
        href="https://x.com/stv_8000"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block"
      >
        <div className="bg-gray-800 text-white text-xs font-bold py-2 px-3 rounded-full shadow-lg hover:bg-gray-700 transition-colors duration-300">
          Powered by Stv
        </div>
      </a>
    </div>
  );
} 