import React from 'react';
import { Link } from 'react-router-dom';
// @ts-ignore - Ignorăm eroarea de tipare dacă pachetul nu are definiții TS incluse
import NTPLogo from 'ntp-logo-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-neutral-950 text-white pt-20 pb-10 px-6 md:px-12 mt-auto border-t border-neutral-900">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
        
        {/* COLOANA 1: BRAND & DATE FIRMĂ */}
        <div className="md:col-span-1">
          <Link to="/" className="text-3xl font-black uppercase tracking-tighter flex items-center gap-2 mb-6">
            Oclar
            <div className="w-2 h-2 bg-brand-yellow rounded-full"></div>
          </Link>
          <p className="text-neutral-500 text-sm leading-relaxed mb-6">
            Vezi până la capăt. Ochelari proiectați să filtreze zgomotul digital.
          </p>
          
          <div className="text-[10px] text-neutral-600 font-mono space-y-1 border-l-2 border-neutral-800 pl-3">
            <p className="font-bold text-neutral-500">SC ALTMAR GROUP S.R.L.</p>
            <p>CUI: 53181323</p>
            <p>Reg. Com: J2025100368001</p>
            <p>Adresa: Intrarea Leordeni, Bragadiru, Ilfov</p>
            <p>Email: contact@oclar.ro</p>
          </div>
        </div>
        
        {/* COLOANA 2: LINKURI RAPIDE */}
        <div className="flex flex-col gap-4 md:pl-12">
          <h4 className="font-bold uppercase text-[10px] tracking-widest text-neutral-600 mb-2">Explorează</h4>
          <Link to="/" className="text-neutral-400 hover:text-brand-yellow hover:translate-x-1 transition-all text-sm">Colecția</Link>
          <Link to="/about" className="text-neutral-400 hover:text-brand-yellow hover:translate-x-1 transition-all text-sm">Povestea Noastră</Link>
          <Link to="/diagnostics" className="text-neutral-400 hover:text-brand-yellow hover:translate-x-1 transition-all text-sm">Testare</Link>
        </div>

        {/* COLOANA 3: LEGAL */}
        <div className="flex flex-col gap-4">
           <h4 className="font-bold uppercase text-[10px] tracking-widest text-neutral-600 mb-2">Informații Legale</h4>
           <Link to="/terms" className="text-neutral-400 hover:text-brand-yellow hover:translate-x-1 transition-all text-sm">Termeni și Condiții</Link>
           <Link to="/privacy" className="text-neutral-400 hover:text-brand-yellow hover:translate-x-1 transition-all text-sm">Politica de Confidențialitate</Link>
           <a href="https://anpc.ro" target="_blank" rel="noopener noreferrer" className="text-neutral-400 hover:text-brand-yellow hover:translate-x-1 transition-all text-sm">ANPC</a>
        </div>

        {/* COLOANA 4: PLĂȚI & NETOPIA (COMPONENTA OFICIALĂ) */}
        <div className="flex flex-col gap-4">
            <h4 className="font-bold uppercase text-[10px] tracking-widest text-neutral-600 mb-2">Plăți Securizate</h4>
            <p className="text-xs text-neutral-500 mb-2">
              Plățile sunt procesate securizat prin:
            </p>
            
            {/* Componenta Oficială Netopia 
                color="#0b0b0b" -> Îi spune componentei că fundalul e negru, deci va afișa text alb.
            */}
            <div className="w-fit hover:opacity-90 transition-opacity">
              <NTPLogo 
                color="#0b0b0b" 
                version="horizontal" 
                secret="160509" 
              />
            </div>
            
            <div className="flex gap-2 mt-2">
                 <img src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" alt="Visa" className="h-6 opacity-60 grayscale hover:grayscale-0 transition-all"/>
                 <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" alt="Mastercard" className="h-6 opacity-60 grayscale hover:grayscale-0 transition-all"/>
            </div>
        </div>
      </div>
      
     {/* STICKERE ANPC */}
      <div className="max-w-7xl mx-auto border-t border-neutral-900 pt-8 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex gap-4">
          <a href="https://anpc.ro/ce-este-sal/" target="_blank" rel="noopener noreferrer" className="opacity-80 hover:opacity-100 transition-opacity">
            <img src="/anpc-sal.svg" alt="ANPC SAL" className="h-6 w-auto" />
          </a>
          <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer" className="opacity-80 hover:opacity-100 transition-opacity">
            <img src="/anpc-sol.svg" alt="ANPC SOL" className="h-6 w-auto" />
          </a>
        </div>
        <div className="text-[10px] uppercase tracking-widest text-neutral-600 text-center md:text-right font-mono">
          <p>&copy; {new Date().getFullYear()} Oclar (ALTMAR GROUP S.R.L.). Toate drepturile rezervate.</p>
        </div>
      </div>
    </footer>
  );
};