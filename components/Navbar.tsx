import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';

export const Navbar: React.FC = () => {
  const { toggleCart, cart } = useCart();
  const location = useLocation();

  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      {/* Desktop & Mobile Top Bar */}
      <nav className="fixed top-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-b border-neutral-100 h-16 flex items-center justify-between px-6 md:px-12 transition-all duration-300">
        
        <Link to="/" className="text-xl font-black tracking-tighter uppercase flex items-center gap-2 group">
          <div className="w-4 h-4 bg-black group-hover:bg-brand-yellow transition-colors duration-300"></div>
          OCLAR
        </Link>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-8">
          <Link 
            to="/" 
            className={`text-xs font-bold uppercase tracking-widest hover:text-brand-yellow transition-colors ${isActive('/') ? 'text-black' : 'text-neutral-400'}`}
          >
            Magazin
          </Link>
          <Link 
            to="/about" 
            className={`text-xs font-bold uppercase tracking-widest hover:text-brand-yellow transition-colors ${isActive('/about') ? 'text-black' : 'text-neutral-400'}`}
          >
            Misiune
          </Link>
        </div>

        <button 
          onClick={toggleCart} 
          className="relative group p-2"
          aria-label="Deschide Coșul"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:stroke-brand-yellow transition-colors">
            <circle cx="9" cy="21" r="1"></circle>
            <circle cx="20" cy="21" r="1"></circle>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
          </svg>
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-brand-yellow text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full text-black">
              {cartCount}
            </span>
          )}
        </button>
      </nav>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-neutral-100 flex justify-around items-center h-16 pb-safe">
        <Link to="/" className={`flex flex-col items-center gap-1 p-2 ${isActive('/') ? 'text-black' : 'text-neutral-400'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
          </svg>
          <span className="text-[9px] uppercase font-bold tracking-widest">Magazin</span>
        </Link>
        <button onClick={toggleCart} className="flex flex-col items-center gap-1 p-2 text-neutral-400">
           <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="21" r="1"></circle>
            <circle cx="20" cy="21" r="1"></circle>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
          </svg>
          <span className="text-[9px] uppercase font-bold tracking-widest">Coș ({cartCount})</span>
        </button>
      </div>
    </>
  );
};