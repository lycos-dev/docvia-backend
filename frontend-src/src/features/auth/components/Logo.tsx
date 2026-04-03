import React from 'react';

export const Logo: React.FC = () => {
  return (
    <div className="flex justify-center mb-4">
      <img 
        src="https://raw.githubusercontent.com/Waldric/docvia-frontend/refs/heads/waru-branch/public/favorite_icon/docvia_favicon.png" 
        className="h-28 w-auto object-contain drop-shadow-xs"
      />
    </div>
  );
};