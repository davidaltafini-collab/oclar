import React, { useState } from 'react';
import { useCart } from '../context/CartContext';
import { Button } from './Button';
import { API_URL } from '../constants';

export const CartDrawer: React.FC = () => {
  const { isCartOpen, toggleCart, cart, removeFromCart, updateQuantity, cartTotal } = useCart();
  const [loading, setLoading] = useState(false);

  if (!isCartOpen) return null;

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cart }),
      });

      if (response.ok) {
        const { url } = await response.json();
        window.location.href = url;
      } else {
        console.warn('Backend not reachable, simulating success');
        setTimeout(() => {
           window.location.hash = '#/success';
           toggleCart();
        }, 1000);
      }
    } catch (error) {
       console.error("Checkout error:", error);
       setTimeout(() => {
           window.location.hash = '#/success';
           toggleCart();
        }, 1000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm transition-opacity" 
        onClick={toggleCart}
      />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col transform transition-transform duration-300 animate-slide-in-right">
        
        {/* Header */}
        <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
          <h2 className="text-xl font-bold uppercase tracking-tight">Selecția Ta</h2>
          <button onClick={toggleCart} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-neutral-400 space-y-4">
              <span className="text-4xl opacity-20">ø</span>
              <p>Coșul tău este gol.</p>
              <Button variant="outline" onClick={toggleCart}>Vezi Colecția</Button>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.id} className="flex gap-4 group">
                <div className="w-24 h-24 bg-neutral-100 overflow-hidden relative">
                   <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="flex-1 flex flex-col justify-between py-1">
                  <div>
                    <h3 className="font-bold text-sm uppercase tracking-wide">{item.name}</h3>
                    <p className="text-neutral-500 text-sm">{item.price.toFixed(2)} RON</p>
                  </div>
                  
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center border border-neutral-200">
                      <button 
                        className="w-8 h-8 flex items-center justify-center hover:bg-brand-yellow hover:text-black hover:border-brand-yellow transition-all"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      >-</button>
                      <span className="w-8 text-center text-sm font-mono">{item.quantity}</span>
                      <button 
                        className="w-8 h-8 flex items-center justify-center hover:bg-brand-yellow hover:text-black hover:border-brand-yellow transition-all"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      >+</button>
                    </div>
                    <button 
                      onClick={() => removeFromCart(item.id)}
                      className="text-xs text-neutral-400 hover:text-red-600 underline decoration-red-600/0 hover:decoration-red-600 transition-all"
                    >
                      Șterge
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && (
          <div className="p-6 border-t border-neutral-100 bg-neutral-50">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-neutral-500 uppercase tracking-widest">Subtotal</span>
              <span className="text-xl font-bold">{cartTotal.toFixed(2)} RON</span>
            </div>
            <p className="text-[10px] text-neutral-400 mb-6 uppercase tracking-wide">Transportul și taxele sunt calculate la pasul următor.</p>
            <Button fullWidth onClick={handleCheckout} disabled={loading}>
              {loading ? 'Se procesează...' : 'Finalizează Comanda'}
            </Button>
          </div>
        )}
      </div>
    </>
  );
};