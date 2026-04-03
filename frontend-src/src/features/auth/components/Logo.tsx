import React from 'react';

export const Logo: React.FC = () => {
  return (
    <div className="flex justify-center mb-4">
      <img 
        src="https://raw.githubusercontent.com/Waldric/docvia-frontend/refs/heads/waru-branch/public/assets/favicon/docvia_favicon.png" 
        alt="Docvia Logo" 
        className="h-28 w-auto object-contain drop-shadow-xs"
      />
    </div>
  );
};