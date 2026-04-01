import React from 'react';

export const Logo: React.FC = () => {
  return (
    <div className="flex justify-center mb-4">
      <img 
        src="/assets/logo/docvia_logo_transparent.png" 
        alt="Docvia Logo" 
        className="h-28 w-auto object-contain drop-shadow-xs"
      />
    </div>
  );
};