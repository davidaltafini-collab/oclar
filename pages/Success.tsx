import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { Button } from '../components/Button';

export const Success: React.FC = () => {
  const { clearCart } = useCart();

  useEffect(() => {
    clearCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center animate-fade-in">
      <div className="w-20 h-20 bg-green-50 text-green-600 rounded-full flex items-center justify-center mb-8 border-2 border-green-100">
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
      </div>
      <h1 className="text-5xl font-black uppercase tracking-tighter mb-4">Comandă Confirmată</h1>
      <p className="text-neutral-500 max-w-md mb-8 leading-relaxed">
        Îți mulțumim pentru achiziție. Un email de confirmare a fost trimis către tine. Pregătim ochelarii tăi pentru livrare cu cea mai mare grijă.
      </p>
      <Link to="/">
        <Button>Înapoi la Magazin</Button>
      </Link>
    </div>
  );
};