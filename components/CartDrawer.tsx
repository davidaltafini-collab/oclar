import React, { useState, useEffect, useRef } from 'react';
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

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    county: '',
    city: '',
    address: '',
  });

  // Normalizeaza orice valoare (number/string/null) in number sigur pentru toFixed
  const toNumber = (v: unknown): number => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    if (typeof v === 'string') {
      const n = Number(v.replace(',', '.'));
      return Number.isFinite(n) ? n : 0;
    }
    return 0;
  };

  // Resetam starea cand se inchide cosul
  useEffect(() => {
    if (!isCartOpen) {
      setStep('cart');
      setPaymentMethod('ramburs');
      setLoading(false);
    }
  }, [isCartOpen]);

  // Scroll to top cand trecem la detalii
  useEffect(() => {
    if (step === 'details' && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [step]);

  if (!isCartOpen) return null;

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmitOrder = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();

    // Validare simpla
    if (!formData.fullName || !formData.phone || !formData.address || !formData.county || !formData.city) {
      alert('Te rugam sa completezi toate campurile obligatorii.');
      return;
    }

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
            customerEmail: formData.email || null,
            customerPhone: formData.phone,
            address: {
              county: formData.county,
              city: formData.city,
              line: formData.address,
            },
            items: cart,
            totalAmount: toNumber(cartTotal),
          }),
        });

        if (!response.ok) throw new Error('Failed to create order');

        const result = await response.json();

        if (result?.success) {
          toggleCart();
          window.location.href = '/#/success';
        } else {
          throw new Error('Order creation failed');
        }
      }
    } catch (error) {
      console.error('Order error:', error);
      alert('A aparut o eroare. Te rugam sa incerci din nou.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={toggleCart} />

      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="p-5 border-b border-neutral-100 flex items-center justify-between bg-white shrink-0">
          <h2 className="text-xl font-bold uppercase tracking-tight">
            {step === 'cart' ? 'Cosul Tau' : 'Detalii Livrare'}
          </h2>
          <button onClick={toggleCart} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
            ✕
          </button>
        </div>

        {/* Content */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-6 bg-neutral-50 scroll-smooth">
          {step === 'cart' ? (
            cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-neutral-400">
                <p>Cosul este gol.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {cart.map((item: any) => {
                  const itemKey = `${item.id}-${item.selectedColor || 'default'}`;

                  const price = toNumber(item.price);
                  const original = toNumber(item.original_price);

                  return (
                    <div key={itemKey} className="flex gap-4 bg-white p-3 rounded-lg shadow-sm">
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-20 h-20 object-cover rounded-md"
                      />

                      <div className="flex-1">
                        <h3 className="font-bold text-sm">{item.name}</h3>

                        <div className="flex items-center gap-2">
                          <p className="text-neutral-900 font-bold text-sm">{price.toFixed(2)} RON</p>

                          {original > 0 && original > price && (
                            <p className="text-xs text-red-500 line-through font-mono">
                              {original.toFixed(2)} RON
                            </p>
                          )}
                        </div>

                        {item.selectedColor && (
                          <div className="flex items-center gap-2 mt-1">
                            <div
                              className="w-4 h-4 rounded-full border border-neutral-200"
                              style={{ backgroundColor: item.selectedColor }}
                            />
                            <span className="text-xs text-neutral-500">Culoare selectata</span>
                          </div>
                        )}

                        <div className="flex items-center gap-3 mt-2">
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1, item.selectedColor)}
                            className="w-6 h-6 flex items-center justify-center bg-neutral-100 hover:bg-neutral-200 rounded transition-colors"
                            type="button"
                          >
                            -
                          </button>
                          <span className="font-bold">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1, item.selectedColor)}
                            className="w-6 h-6 flex items-center justify-center bg-neutral-100 hover:bg-neutral-200 rounded transition-colors"
                            type="button"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <button
                        onClick={() => removeFromCart(item.id, item.selectedColor)}
                        className="text-red-500 text-xs self-start hover:text-red-600 transition-colors"
                        type="button"
                      >
                        Sterge
                      </button>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <form id="checkout-form" className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              {/* Date Contact */}
              <div className="bg-white p-4 rounded-lg shadow-sm space-y-3">
                <h3 className="font-bold text-sm uppercase text-neutral-500 flex items-center gap-2">
                  Date Contact
                </h3>

                <input
                  required
                  name="fullName"
                  placeholder="Nume Complet"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  className="w-full p-3 border border-neutral-200 rounded-lg focus:outline-none focus:border-black transition-colors text-base md:text-sm"
                />

                <div className="grid grid-cols-2 gap-3">
                  <input
                    name="email"
                    type="email"
                    placeholder="Email (optional)"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-neutral-200 rounded-lg focus:outline-none focus:border-black transition-colors text-base md:text-sm"
                  />
                  <input
                    required
                    name="phone"
                    placeholder="Telefon"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-neutral-200 rounded-lg focus:outline-none focus:border-black transition-colors text-base md:text-sm"
                  />
                </div>
              </div>

              {/* Adresa */}
              <div className="bg-white p-4 rounded-lg shadow-sm space-y-3">
                <h3 className="font-bold text-sm uppercase text-neutral-500 flex items-center gap-2">
                  Adresa Livrare
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <input
                    required
                    name="county"
                    placeholder="Judet"
                    value={formData.county}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-neutral-200 rounded-lg focus:outline-none focus:border-black transition-colors text-base md:text-sm"
                  />
                  <input
                    required
                    name="city"
                    placeholder="Oras / Sat"
                    value={formData.city}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-neutral-200 rounded-lg focus:outline-none focus:border-black transition-colors text-base md:text-sm"
                  />
                </div>

                <textarea
                  required
                  name="address"
                  placeholder="Strada, Numar, Bloc, Etaj..."
                  value={formData.address}
                  onChange={handleInputChange}
                  className="w-full p-3 border border-neutral-200 rounded-lg h-20 resize-none focus:outline-none focus:border-black transition-colors text-base md:text-sm"
                />
              </div>

              {/* Plata (cu icon-uri) */}
              <div className="bg-white p-4 rounded-lg shadow-sm space-y-3">
                <h3 className="font-bold text-sm uppercase text-neutral-500 flex items-center gap-2">
                  Metoda Plata
                </h3>

                <div className="grid grid-cols-1 gap-3">
                  {/* RAMBURS */}
                  <label
                    className={`relative flex items-center gap-4 p-4 border rounded-xl cursor-pointer transition-all duration-200 ${
                      paymentMethod === 'ramburs'
                        ? 'border-black bg-neutral-50 shadow-inner'
                        : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      checked={paymentMethod === 'ramburs'}
                      onChange={() => setPaymentMethod('ramburs')}
                      className="accent-black w-5 h-5"
                    />

                    <div className="p-2 bg-white rounded-full border border-neutral-100 shadow-sm shrink-0">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#16a34a"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="12" y1="1" x2="12" y2="23" />
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                      </svg>
                    </div>

                    <div>
                      <span className="font-bold block text-sm">Plata Ramburs (Cash)</span>
                      <span className="text-xs text-neutral-500">Platesti curierului la livrare</span>
                    </div>
                  </label>

                  {/* CARD */}
                  <label
                    className={`relative flex items-center gap-4 p-4 border rounded-xl cursor-pointer transition-all duration-200 ${
                      paymentMethod === 'card'
                        ? 'border-black bg-neutral-50 shadow-inner'
                        : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      checked={paymentMethod === 'card'}
                      onChange={() => setPaymentMethod('card')}
                      className="accent-black w-5 h-5"
                    />

                    <div className="p-2 bg-white rounded-full border border-neutral-100 shadow-sm shrink-0">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#2563eb"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                        <line x1="1" y1="10" x2="23" y2="10" />
                      </svg>
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

        {/* Footer (in afara formului) */}
        {cart.length > 0 && (
          <div className="p-6 border-t border-neutral-100 bg-white shrink-0">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-neutral-500 uppercase">Total</span>
              <span className="text-xl font-bold">{toNumber(cartTotal).toFixed(2)} RON</span>
            </div>

            {step === 'cart' ? (
              <Button fullWidth onClick={() => setStep('details')}>
                Continua spre Checkout
              </Button>
            ) : (
              <Button
                fullWidth
                onClick={handleSubmitOrder}
                disabled={loading}
                type="button"
                className="shadow-xl"
              >
                {loading
                  ? 'Se proceseaza...'
                  : paymentMethod === 'ramburs'
                    ? 'Trimite Comanda'
                    : 'Plateste cu Cardul'}
              </Button>
            )}
          </div>
        )}
      </div>
    </>
  );
};
