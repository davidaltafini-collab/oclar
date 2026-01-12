import React, { useState } from 'react';
import { useCart } from '../context/CartContext';
import { Button } from './Button';
import { API_URL } from '../constants';

// Tipuri pentru formular
type CheckoutStep = 'cart' | 'details';
type PaymentMethod = 'card' | 'ramburs';

export const CartDrawer: React.FC = () => {
  const { isCartOpen, toggleCart, cart, removeFromCart, updateQuantity, cartTotal } = useCart();
  
  // State-uri pentru formular
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

  if (!isCartOpen) return null;

  // Handler pentru input-uri
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // 1. Funcția FINALĂ de Comandă
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (paymentMethod === 'card') {
        // --- FLUX CARD (Stripe) ---
        // Putem trimite datele la Stripe sau doar produsele
        const response = await fetch(`${API_URL}/create-checkout-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: cart }),
        });
        
        const { url } = await response.json();
        if (url) window.location.href = url;
        
      } else {
        // --- FLUX RAMBURS ---
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

        if (response.ok) {
           alert('Comanda a fost plasată cu succes! Vei primi un email de confirmare.');
           toggleCart();
           window.location.reload(); // Resetăm coșul (sau implementează o funcție clearCart)
        } else {
           throw new Error('Eroare la salvarea comenzii.');
        }
      }

    } catch (error) {
      console.error(error);
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
          <button onClick={toggleCart} className="p-2 hover:bg-neutral-100 rounded-full">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-neutral-50">
          
          {/* PASUL 1: LISTA PRODUSE */}
          {step === 'cart' ? (
            cart.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center text-neutral-400">
                  <p>Coșul este gol.</p>
               </div>
            ) : (
              <div className="space-y-6">
                 {cart.map((item) => (
                    <div key={item.id} className="flex gap-4 bg-white p-3 rounded-lg shadow-sm">
                       <img src={item.imageUrl} className="w-20 h-20 object-cover rounded-md" />
                       <div className="flex-1">
                          <h3 className="font-bold text-sm">{item.name}</h3>
                          <p className="text-neutral-500 text-sm">{item.price} RON</p>
                          <div className="flex items-center gap-3 mt-2">
                             <button onClick={() => updateQuantity(item.id, item.quantity - 1)}>-</button>
                             <span>{item.quantity}</span>
                             <button onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</button>
                          </div>
                       </div>
                       <button onClick={() => removeFromCart(item.id)} className="text-red-500 text-xs self-start">Șterge</button>
                    </div>
                 ))}
              </div>
            )
          ) : (
            
            /* PASUL 2: FORMULAR DATE */
            <form id="checkout-form" onSubmit={handleSubmitOrder} className="space-y-4">
               <div className="bg-white p-4 rounded-lg shadow-sm space-y-3">
                  <h3 className="font-bold text-sm uppercase text-neutral-500">Date Contact</h3>
                  <input required name="fullName" placeholder="Nume Complet" value={formData.fullName} onChange={handleInputChange} className="w-full p-2 border rounded" />
                  <input required name="email" type="email" placeholder="Email" value={formData.email} onChange={handleInputChange} className="w-full p-2 border rounded" />
                  <input required name="phone" placeholder="Telefon" value={formData.phone} onChange={handleInputChange} className="w-full p-2 border rounded" />
               </div>

               <div className="bg-white p-4 rounded-lg shadow-sm space-y-3">
                  <h3 className="font-bold text-sm uppercase text-neutral-500">Adresă Livrare</h3>
                  <input required name="county" placeholder="Județ" value={formData.county} onChange={handleInputChange} className="w-full p-2 border rounded" />
                  <input required name="city" placeholder="Oraș / Sat" value={formData.city} onChange={handleInputChange} className="w-full p-2 border rounded" />
                  <textarea required name="address" placeholder="Strada, Număr, Bloc, Etaj..." value={formData.address} onChange={handleInputChange} className="w-full p-2 border rounded h-20" />
               </div>

               <div className="bg-white p-4 rounded-lg shadow-sm space-y-3">
                  <h3 className="font-bold text-sm uppercase text-neutral-500">Metodă Plată</h3>
                  
                  <label className={`flex items-center gap-3 p-3 border rounded cursor-pointer ${paymentMethod === 'ramburs' ? 'border-black bg-neutral-50' : ''}`}>
                     <input type="radio" name="payment" checked={paymentMethod === 'ramburs'} onChange={() => setPaymentMethod('ramburs')} />
                     <div>
                        <span className="font-bold block">Ramburs la Curier</span>
                        <span className="text-xs text-neutral-500">Plătești cash când vine coletul</span>
                     </div>
                  </label>

                  <label className={`flex items-center gap-3 p-3 border rounded cursor-pointer ${paymentMethod === 'card' ? 'border-black bg-neutral-50' : ''}`}>
                     <input type="radio" name="payment" checked={paymentMethod === 'card'} onChange={() => setPaymentMethod('card')} />
                     <div>
                        <span className="font-bold block">Card Online</span>
                        <span className="text-xs text-neutral-500">Securizat prin Stripe</span>
                     </div>
                  </label>
               </div>
            </form>
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && (
          <div className="p-6 border-t border-neutral-100 bg-white">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-neutral-500 uppercase">Total</span>
              <span className="text-xl font-bold">{cartTotal.toFixed(2)} RON</span>
            </div>
            
            {step === 'cart' ? (
               <Button fullWidth onClick={() => setStep('details')}>Continuă spre Checkout</Button>
            ) : (
               <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep('cart')}>Înapoi</Button>
                  <Button fullWidth onClick={handleSubmitOrder} disabled={loading} type="submit" form="checkout-form">
                     {loading ? 'Se procesează...' : (paymentMethod === 'ramburs' ? 'Trimite Comanda' : 'Plătește cu Cardul')}
                  </Button>
               </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};
