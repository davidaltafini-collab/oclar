import React, { useState, useEffect } from 'react';
import { CookieChoice } from '../types';
import { Button } from './Button';

export const CookieConsent: React.FC = () => {
  const [choice, setChoice] = useState<CookieChoice | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const storedChoice = localStorage.getItem('lumina_cookie_consent');
    if (storedChoice) {
      setChoice(storedChoice as CookieChoice);
    }
  }, []);

  const handleChoice = (c: CookieChoice) => {
    localStorage.setItem('lumina_cookie_consent', c);
    setChoice(c);
  };

  if (!mounted || choice) return null;

  return (
    // Am schimbat 'fixed inset-0 ...' cu 'fixed bottom-0 ...' pentru a fi un banner jos
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t-4 border-brand-yellow shadow-[0_-10px_40px_rgba(0,0,0,0.1)] animate-slide-up">
      <div className="max-w-7xl mx-auto px-4 py-6 md:py-4 flex flex-col md:flex-row items-center justify-between gap-6">
        
        <div className="flex-1">
          <h2 className="text-sm font-black uppercase tracking-tighter mb-1">Politica de Cookies</h2>
          <p className="text-neutral-600 text-xs leading-relaxed max-w-2xl">
            Folosim cookies pentru a asigura funcționarea corectă a site-ului Oclar. 
            Continuarea navigării implică acceptarea acestora, conform{' '}
            <a href="/privacy" className="underline hover:text-brand-yellow">Politicii de Confidențialitate</a>.
          </p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
           {/* Butoane mai mici si compacte */}
          <Button 
            variant="outline" 
            onClick={() => handleChoice(CookieChoice.ACCEPTED_ESSENTIAL)}
            className="text-xs px-4 py-2 h-auto whitespace-nowrap"
          >
            Doar Esențiale
          </Button>
          <Button 
            onClick={() => handleChoice(CookieChoice.ACCEPTED_ALL)} 
            className="text-xs px-6 py-2 h-auto whitespace-nowrap"
          >
            Accept Tot
          </Button>
        </div>

      </div>
    </div>
  );
};