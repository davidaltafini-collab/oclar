import React from 'react';
import { Link } from 'react-router-dom';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-neutral-950 text-white py-20 px-6 md:px-12 mt-auto border-t border-neutral-900">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
        <div className="md:col-span-2">
          <Link to="/" className="text-3xl font-black uppercase tracking-tighter flex items-center gap-2 mb-6">
            Oclar
            <div className="w-2 h-2 bg-brand-yellow rounded-full"></div>
          </Link>
          <p className="text-neutral-500 text-sm max-w-sm leading-relaxed mb-8">
            Vezi până la capăt. Ochelari proiectați să filtreze zgomotul digital și să protejeze cea mai importantă resursă a ta: vederea.
          </p>
        </div>
        
        <div className="flex flex-col gap-4">
          <h4 className="font-bold uppercase text-[10px] tracking-widest text-neutral-600 mb-2">Explorează</h4>
          <Link to="/" className="text-neutral-400 hover:text-brand-yellow hover:translate-x-1 transition-all text-sm">Colecția Completă</Link>
          <Link to="/about" className="text-neutral-400 hover:text-brand-yellow hover:translate-x-1 transition-all text-sm">Misiunea Noastră</Link>
          <span className="text-neutral-700 text-sm cursor-not-allowed">Jurnal (În curând)</span>
        </div>

        <div className="flex flex-col gap-4">
           <h4 className="font-bold uppercase text-[10px] tracking-widest text-neutral-600 mb-2">Legal</h4>
           <Link to="/terms" className="text-neutral-400 hover:text-brand-yellow hover:translate-x-1 transition-all text-sm">Termeni și Condiții</Link>
           <Link to="/privacy" className="text-neutral-400 hover:text-brand-yellow hover:translate-x-1 transition-all text-sm">Politica de Confidențialitate</Link>
           <a href="mailto:contact@OCLAR.ro" className="text-neutral-400 hover:text-brand-yellow hover:translate-x-1 transition-all text-sm">Suport Clienți</a>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto mt-20 pt-8 border-t border-neutral-900 text-[10px] uppercase tracking-widest text-neutral-600 flex flex-col md:flex-row justify-between items-center gap-4">
        <p>&copy; {new Date().getFullYear()} OclarEyewear S.R.L. Toate drepturile rezervate.</p>
        <p>Proiectat în România.</p>
      </div>
    </footer>
  );
};