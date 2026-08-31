import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

export const Logo: React.FC<LogoProps> = ({ className = 'h-8 w-8', size }) => {
  return (
    <div
      className={`rounded-full overflow-hidden border-2 border-[#f5c518] shadow-[0_0_12px_rgba(245,197,24,0.3)] shrink-0 bg-[#0c140e] flex items-center justify-center ${className}`}
      style={size ? { width: size, height: size } : undefined}
    >
      <img
        src="/panda_avatar.jpg"
        alt="panda.vault logo"
        className="w-full h-full object-cover"
      />
    </div>
  );
};
