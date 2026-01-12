import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  fullWidth = false, 
  className = '', 
  ...props 
}) => {
  // Added rounded-full and backlight-btn class
  const baseStyles = "relative px-8 py-4 font-bold uppercase tracking-wider text-sm transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed rounded-full overflow-hidden";
  
  const variants = {
    primary: "backlight-btn bg-brand-yellow text-black hover:bg-yellow-300 border border-brand-yellow shadow-lg shadow-yellow-400/20 hover:shadow-yellow-400/50 hover:-translate-y-1",
    secondary: "bg-neutral-900 text-white hover:bg-neutral-800 border border-neutral-900 shadow-lg hover:shadow-xl hover:-translate-y-1",
    outline: "bg-transparent text-neutral-900 border border-neutral-300 hover:border-neutral-900 hover:bg-neutral-50",
    ghost: "bg-transparent text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100/50"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};