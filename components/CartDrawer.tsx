import React, { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import { Button } from './Button';
import { API_URL } from '../constants';

type CheckoutStep = 'cart' | 'details';
type PaymentMethod = 'card' | 'ramburs';

export const CartDrawer: React.FC = () => {
  const { isCartOpen, toggleCart, cart, removeFromCart, updateQuantity, cartTotal } = useCart();
  
  const [step, setStep] = useState<CheckoutStep>('cart');
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('ramburs');
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    county: '',
    city: '',
    address: ''
  });

  // Resetăm starea când se închide coșul
  useEffect(() => {
    if (!isCartOpen) {
      setStep('cart');
      setPaymentMethod('ramburs');
      setLoading(false);
    }
  }, [isCartOpen]);

  if (!isCartOpen) return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (paymentMethod === 'card') {
        const response = await fetch(`${API_URL}/create-checkout-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: cart }),
        });
        
        if (!response.ok) throw new Error('Failed to create checkout session');
        
        const { url } = await response.json();
        if (url) window.location.href = url;
        else throw new Error('No checkout URL received');
        
      } else {
        const response = await fetch(`${API_URL}/create-order-ramburs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerName: formData.fullName,
            customerEmail: formData.email,
            customerPhone: formData.phone,
            address: {
                county: formData.county,
                city: formData.city,
                line: formData.address
            },
            items: cart,
            totalAmount: cartTotal
          }),
        });

        if (!response.ok) throw new Error('Failed to create order');
        
        const result = await response.json();
        
        if (result.success) {
          toggleCart();
          window.location.href = '/#/success';
        } else {
          throw new Error('Order creation failed');
        }
      }

    } catch (error) {
      console.error('Order error:', error);
      alert('A apărut o eroare. Te rugăm să încerci din nou.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={toggleCart} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col animate-slide-in-right">
        
        {/* Header */}
        <div className="p-5 border-b border-neutral-100 flex items-center justify-between bg-white">
          <h2 className="text-xl font-bold uppercase tracking-tight">
            {step === 'cart' ? 'Coșul Tău' : 'Detalii Livrare'}
          </h2>
          <button onClick={toggleCart} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-neutral-50">
          
          {/* STEP 1: CART ITEMS */}
          {step === 'cart' ? (
            cart.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center text-neutral-400">
                  <p>Coșul este gol.</p>
               </div>
            ) : (
              <div className="space-y-6">
                 {cart.map((item) => {
                   const itemKey = `${item.id}-${item.selectedColor || 'default'}`;
                   return (
                    <div key={itemKey} className="flex gap-4 bg-white p-3 rounded-lg shadow-sm">
                       <img src={item.imageUrl} alt={item.name} className="w-20 h-20 object-cover rounded-md" />
                       <div className="flex-1">
                          <h3 className="font-bold text-sm">{item.name}</h3>
                          {item.selectedColor && (
                            <div className="flex items-center gap-2 mt-1">
                              <div className="w-4 h-4 rounded-full border border-neutral-200" style={{backgroundColor: item.selectedColor}}/>
                              <span className="text-xs text-neutral-500">Culoare selectată</span>
                            </div>
                          )}
                          <p className="text-neutral-500 text-sm">{item.price} RON</p>
                          <div className="flex items-center gap-3 mt-2">
                             <button onClick={() => updateQuantity(item.id, item.quantity - 1, item.selectedColor)} className="w-6 h-6 flex items-center justify-center bg-neutral-100 hover:bg-neutral-200 rounded transition-colors">-</button>
                             <span className="font-bold">{item.quantity}</span>
                             <button onClick={() => updateQuantity(item.id, item.quantity + 1, item.selectedColor)} className="w-6 h-6 flex items-center justify-center bg-neutral-100 hover:bg-neutral-200 rounded transition-colors">+</button>
                          </div>
                       </div>
                       <button onClick={() => removeFromCart(item.id, item.selectedColor)} className="text-red-500 text-xs self-start hover:text-red-600 transition-colors">Șterge</button>
                    </div>
                   );
                 })}
              </div>
            )
          ) : (
            
            /* STEP 2: CHECKOUT FORM OPTIMIZAT */
            <form id="checkout-form" onSubmit={handleSubmitOrder} className="space-y-4">
               {/* Secțiunea Date Contact */}
               <div className="bg-white p-4 rounded-lg shadow-sm space-y-3">
                  <h3 className="font-bold text-sm uppercase text-neutral-500 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    Date Contact
                  </h3>
                  <input 
                    required 
                    name="fullName" 
                    placeholder="Nume Complet" 
                    value={formData.fullName} 
                    onChange={handleInputChange} 
                    className="w-full p-3 border border-neutral-200 rounded-lg focus:outline-none focus:border-black transition-colors text-sm" 
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input 
                        required 
                        name="email" 
                        type="email" 
                        placeholder="Email" 
                        value={formData.email} 
                        onChange={handleInputChange} 
                        className="w-full p-3 border border-neutral-200 rounded-lg focus:outline-none focus:border-black transition-colors text-sm" 
                    />
                    <input 
                        required 
                        name="phone" 
                        placeholder="Telefon" 
                        value={formData.phone} 
                        onChange={handleInputChange} 
                        className="w-full p-3 border border-neutral-200 rounded-lg focus:outline-none focus:border-black transition-colors text-sm" 
                    />
                  </div>
               </div>

               {/* Secțiunea Adresă */}
               <div className="bg-white p-4 rounded-lg shadow-sm space-y-3">
                  <h3 className="font-bold text-sm uppercase text-neutral-500 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                    Adresă Livrare
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <input 
                        required 
                        name="county" 
                        placeholder="Județ" 
                        value={formData.county} 
                        onChange={handleInputChange} 
                        className="w-full p-3 border border-neutral-200 rounded-lg focus:outline-none focus:border-black transition-colors text-sm" 
                    />
                    <input 
                        required 
                        name="city" 
                        placeholder="Oraș / Sat" 
                        value={formData.city} 
                        onChange={handleInputChange} 
                        className="w-full p-3 border border-neutral-200 rounded-lg focus:outline-none focus:border-black transition-colors text-sm" 
                    />
                  </div>
                  <textarea 
                    required 
                    name="address" 
                    placeholder="Strada, Număr, Bloc, Etaj..." 
                    value={formData.address} 
                    onChange={handleInputChange} 
                    className="w-full p-3 border border-neutral-200 rounded-lg h-20 resize-none focus:outline-none focus:border-black transition-colors text-sm" 
                  />
               </div>

               {/* Secțiunea Plată */}
               <div className="bg-white p-4 rounded-lg shadow-sm space-y-3">
                  <h3 className="font-bold text-sm uppercase text-neutral-500 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
                    Metodă Plată
                  </h3>
                  
                  <div className="grid grid-cols-1 gap-3">
                    <label className={`relative flex items-center gap-4 p-4 border rounded-xl cursor-pointer transition-all duration-200 ${paymentMethod === 'ramburs' ? 'border-black bg-neutral-50 shadow-inner' : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'}`}>
                        <input 
                        type="radio" 
                        name="payment" 
                        checked={paymentMethod === 'ramburs'} 
                        onChange={() => setPaymentMethod('ramburs')} 
                        className="accent-black w-5 h-5"
                        />
                        <div className="p-2 bg-white rounded-full border border-neutral-100 shadow-sm">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                        </div>
                        <div>
                            <span className="font-bold block text-sm">Plata Ramburs (Cash)</span>
                            <span className="text-xs text-neutral-500">Plătești curierului la livrare</span>
                        </div>
                    </label>

                    <label className={`relative flex items-center gap-4 p-4 border rounded-xl cursor-pointer transition-all duration-200 ${paymentMethod === 'card' ? 'border-black bg-neutral-50 shadow-inner' : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'}`}>
                        <input 
                        type="radio" 
                        name="payment" 
                        checked={paymentMethod === 'card'} 
                        onChange={() => setPaymentMethod('card')} 
                        className="accent-black w-5 h-5"
                        />
                        <div className="p-2 bg-white rounded-full border border-neutral-100 shadow-sm">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
                        </div>
                        <div>
                            <span className="font-bold block text-sm">Card Online</span>
                            <span className="text-xs text-neutral-500">Securizat prin Stripe</span>
                        </div>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-1 opacity-50">
                            <div className="w-8 h-5 bg-neutral-200 rounded"></div>
                            <div className="w-8 h-5 bg-neutral-200 rounded"></div>
                        </div>
                    </label>
                  </div>
               </div>
            </form>
          )}
        </div>

        {/* Footer Modificat: Fără buton de Înapoi și buton principal Full Width */}
        {cart.length > 0 && (
          <div className="p-6 border-t border-neutral-100 bg-white">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-neutral-500 uppercase">Total</span>
              <span className="text-xl font-bold">{cartTotal.toFixed(2)} RON</span>
            </div>
            
            {step === 'cart' ? (
               <Button fullWidth onClick={() => setStep('details')}>
                 Continuă spre Checkout
               </Button>
            ) : (
                // AICI AM MODIFICAT: Doar butonul de submit, full width
               <Button 
                  fullWidth 
                  onClick={handleSubmitOrder} 
                  disabled={loading} 
                  type="submit" 
                  form="checkout-form"
                  className="shadow-xl"
               >
                  {loading ? 'Se procesează...' : (paymentMethod === 'ramburs' ? 'Trimite Comanda' : 'Plătește cu Cardul')}
               </Button>
            )}
          </div>
        )}
      </div>
    </>
  );
};