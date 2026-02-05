import React from 'react';
import { Link } from 'react-router-dom';

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-neutral-950 text-white pt-20 pb-10 px-6 md:px-12 mt-auto border-t border-neutral-900">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
        <div className="md:col-span-2">
          <Link to="/" className="text-3xl font-black uppercase tracking-tighter flex items-center gap-2 mb-6">
            Oclar
            <div className="w-2 h-2 bg-brand-yellow rounded-full"></div>
          </Link>
          <p className="text-neutral-500 text-sm max-w-sm leading-relaxed mb-8">
            Vezi până la capăt. Ochelari proiectați să filtreze zgomotul digital.
          </p>
          
          {/* Sectiune Date Legale - Discret */}
          <div className="text-[10px] text-neutral-600 font-mono space-y-1">
            <p>Operat de: SC ALTMAR GROUP S.R.L.</p>
            <p>CUI: 53181323 | Reg. Com: J2025100368001</p>
            <p>Adresa: Intrarea Leordeni, Bragadiru, Ilfov</p>
          </div>
        </div>
        
        <div className="flex flex-col gap-4">
          <h4 className="font-bold uppercase text-[10px] tracking-widest text-neutral-600 mb-2">Explorează</h4>
          <Link to="/" className="text-neutral-400 hover:text-brand-yellow hover:translate-x-1 transition-all text-sm">Colecția</Link>
          <Link to="/about" className="text-neutral-400 hover:text-brand-yellow hover:translate-x-1 transition-all text-sm">Despre Noi</Link>
        </div>

        <div className="flex flex-col gap-4">
           <h4 className="font-bold uppercase text-[10px] tracking-widest text-neutral-600 mb-2">Legal</h4>
           <Link to="/terms" className="text-neutral-400 hover:text-brand-yellow hover:translate-x-1 transition-all text-sm">Termeni și Condiții</Link>
           <Link to="/privacy" className="text-neutral-400 hover:text-brand-yellow hover:translate-x-1 transition-all text-sm">Confidențialitate</Link>
           <a href="https://anpc.ro" target="_blank" rel="noopener noreferrer" className="text-neutral-400 hover:text-brand-yellow hover:translate-x-1 transition-all text-sm">ANPC</a>
        </div>
      </div>
      
      {/* Stickere ANPC - Centrate sau la final */}
      <div className="max-w-7xl mx-auto border-t border-neutral-900 pt-8 flex flex-col md:flex-row justify-between items-center gap-6">
        
        {/* Imaginile ANPC - SAL si SOL */}
        <div className="flex gap-4">
          <a href="https://anpc.ro/ce-este-sal/" target="_blank" rel="noopener noreferrer">
            <img src="/anpc-sal.svg" alt="ANPC SAL" className="h-6 w-auto opacity-80 hover:opacity-100 transition-opacity" />
          </a>
          <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer">
            <img src="/anpc-sol.svg" alt="ANPC SOL" className="h-6 w-auto opacity-80 hover:opacity-100 transition-opacity" />
          </a>
        </div>

        <div className="text-[10px] uppercase tracking-widest text-neutral-600 text-center md:text-right">
          <p>&copy; {currentYear} Oclar (ALTMAR GROUP S.R.L.). Toate drepturile rezervate.</p>
        </div>
      </div>
    </footer>
  );
};