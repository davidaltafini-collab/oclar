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

  // If already chosen or not mounted yet, render nothing (allows site access)
  if (!mounted || choice) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-white max-w-lg w-full p-8 shadow-2xl border-l-8 border-brand-yellow">
        <h2 className="text-2xl font-black mb-4 uppercase tracking-tighter">Protocol: Consimțământ</h2>
        <p className="text-neutral-600 mb-8 leading-relaxed text-sm">
          Avem nevoie de autorizația ta pentru a continua. Folosim pachete de date (cookies) pentru a asigura stabilitatea sesiunii și pentru a optimiza performanța magazinului. Accesul este restricționat până la efectuarea unei selecții.
        </p>
        
        <div className="flex flex-col gap-3">
          <Button onClick={() => handleChoice(CookieChoice.ACCEPTED_ALL)} fullWidth>
            Acceptă Tot
          </Button>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={() => handleChoice(CookieChoice.ACCEPTED_ESSENTIAL)}>
              Doar Esențiale
            </Button>
            <Button variant="outline" onClick={() => handleChoice(CookieChoice.REJECTED_ALL)}>
              Refuză Tot
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};