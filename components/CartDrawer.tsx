import React, { useState, useEffect, useRef } from 'react';
import { useCart } from '../context/CartContext';
import { Button } from './Button';
import { API_URL } from '../constants';

type CheckoutStep = 'cart' | 'details';
type PaymentMethod = 'card' | 'ramburs';
type ShippingMethod = 'easybox' | 'courier';

const SHIPPING_COSTS = {
  easybox: 15.00,
  courier: 25.00
};

export const CartDrawer: React.FC = () => {
  const { isCartOpen, toggleCart, cart, removeFromCart, updateQuantity, cartTotal } = useCart();

  const [step, setStep] = useState<CheckoutStep>('cart');
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('ramburs');
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>('courier');
  
  // Discount state
  const [discountCode, setDiscountCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<{
    code: string;
    amount: number;
  } | null>(null);
  const [discountLoading, setDiscountLoading] = useState(false);
  const [discountError, setDiscountError] = useState('');

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    county: '',
    city: '',
    address: '',
  });

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
      setShippingMethod('courier');
      setLoading(false);
      setAppliedDiscount(null);
      setDiscountCode('');
      setDiscountError('');
    }
  }, [isCartOpen]);

  useEffect(() => {
    if (step === 'details' && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [step]);

  if (!isCartOpen) return null;

  // CALCULE PREȚURI
  const subtotal = toNumber(cartTotal);
  const shippingCost = SHIPPING_COSTS[shippingMethod];
  const discountAmount = appliedDiscount ? appliedDiscount.amount : 0;
  const totalBeforeDiscount = subtotal + shippingCost;
  const finalTotal = totalBeforeDiscount - discountAmount;

  // APLICARE COD REDUCERE
  const handleApplyDiscount = async () => {
    if (!discountCode.trim()) {
      setDiscountError('Introdu un cod');
      return;
    }

    setDiscountLoading(true);
    setDiscountError('');

    try {
      const response = await fetch(`${API_URL}/validate-discount`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: discountCode.trim(), subtotal })
      });

      const data = await response.json();

      if (data.valid) {
        setAppliedDiscount({
          code: data.code,
          amount: data.discountAmount
        });
        setDiscountError('');
      } else {
        setDiscountError(data.message || 'Cod invalid');
        setAppliedDiscount(null);
      }
    } catch (error) {
      setDiscountError('Eroare de conexiune');
    } finally {
      setDiscountLoading(false);
    }
  };

  const handleRemoveDiscount = () => {
    setAppliedDiscount(null);
    setDiscountCode('');
    setDiscountError('');
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmitOrder = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();

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
          body: JSON.stringify({ 
            items: cart,
            subtotal,
            shippingMethod,
            shippingCost,
            discountCode: appliedDiscount?.code || null,
            discountAmount
          }),
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
            subtotal,
            shippingMethod,
            shippingCost,
            discountCode: appliedDiscount?.code || null,
            discountAmount,
            totalAmount: finalTotal,
          }),
        });

        if (!response.ok) throw new Error('Failed to create order');

        const result = await response.json();

        if (result?.success) {
          toggleCart();
          window.location.href = '/success';
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
                {/* PRODUSE */}
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

                {/* COD REDUCERE */}
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <h3 className="font-bold text-sm uppercase text-neutral-500 mb-3">Cod Reducere</h3>
                  
                  {appliedDiscount ? (
                    <div className="flex items-center justify-between bg-green-50 border border-green-200 p-3 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-green-600 font-bold">✓</span>
                        <div>
                          <p className="font-bold text-sm">{appliedDiscount.code}</p>
                          <p className="text-xs text-green-600">-{appliedDiscount.amount.toFixed(2)} RON</p>
                        </div>
                      </div>
                      <button
                        onClick={handleRemoveDiscount}
                        className="text-red-500 text-sm hover:text-red-600"
                        type="button"
                      >
                        Elimină
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Introdu codul"
                        value={discountCode}
                        onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                        className="flex-1 p-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-black"
                      />
                      <button
                        onClick={handleApplyDiscount}
                        disabled={discountLoading}
                        className="px-4 py-2 bg-black text-white text-sm font-bold rounded-lg hover:bg-neutral-800 disabled:opacity-50"
                        type="button"
                      >
                        {discountLoading ? '...' : 'Aplică'}
                      </button>
                    </div>
                  )}
                  
                  {discountError && (
                    <p className="text-xs text-red-500 mt-2">{discountError}</p>
                  )}
                </div>

                {/* OPȚIUNI LIVRARE */}
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <h3 className="font-bold text-sm uppercase text-neutral-500 mb-3">Livrare</h3>
                  
                  <div className="space-y-2">
                    <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                      shippingMethod === 'courier' ? 'border-black bg-neutral-50' : 'border-neutral-200 hover:border-neutral-300'
                    }`}>
                      <input
                        type="radio"
                        name="shipping"
                        checked={shippingMethod === 'courier'}
                        onChange={() => setShippingMethod('courier')}
                        className="accent-black w-4 h-4"
                      />
                      <div className="flex-1">
                        <p className="font-bold text-sm">Curier la adresă</p>
                        <p className="text-xs text-neutral-500">Livrare 1-3 zile</p>
                      </div>
                      <span className="font-bold">{SHIPPING_COSTS.courier.toFixed(2)} RON</span>
                    </label>

                    <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                      shippingMethod === 'easybox' ? 'border-black bg-neutral-50' : 'border-neutral-200 hover:border-neutral-300'
                    }`}>
                      <input
                        type="radio"
                        name="shipping"
                        checked={shippingMethod === 'easybox'}
                        onChange={() => setShippingMethod('easybox')}
                        className="accent-black w-4 h-4"
                      />
                      <div className="flex-1">
                        <p className="font-bold text-sm">Easy Box / Locker</p>
                        <p className="text-xs text-neutral-500">Ridicare din locker</p>
                      </div>
                      <span className="font-bold">{SHIPPING_COSTS.easybox.toFixed(2)} RON</span>
                    </label>
                  </div>
                </div>
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

              {/* Plata */}
              <div className="bg-white p-4 rounded-lg shadow-sm space-y-3">
                <h3 className="font-bold text-sm uppercase text-neutral-500 flex items-center gap-2">
                  Metoda Plata
                </h3>

                <div className="grid grid-cols-1 gap-3">
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
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="1" x2="12" y2="23" />
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                      </svg>
                    </div>

                    <div>
                      <span className="font-bold block text-sm">Plata Ramburs (Cash)</span>
                      <span className="text-xs text-neutral-500">Platesti curierului la livrare</span>
                    </div>
                  </label>

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
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                        <line x1="1" y1="10" x2="23" y2="10" />
                      </svg>
                    </div>

                    <div>
                      <span className="font-bold block text-sm">Card Online</span>
                      <span className="text-xs text-neutral-500">Securizat prin Stripe</span>
                    </div>
                  </label>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Footer cu prețuri */}
        {cart.length > 0 && (
          <div className="p-6 border-t border-neutral-100 bg-white shrink-0">
            {/* Detalii prețuri */}
            <div className="space-y-2 mb-4 text-sm">
              <div className="flex justify-between text-neutral-600">
                <span>Subtotal produse</span>
                <span>{subtotal.toFixed(2)} RON</span>
              </div>
              
              <div className="flex justify-between text-neutral-600">
                <span>Transport ({shippingMethod === 'easybox' ? 'Easy Box' : 'Curier'})</span>
                <span>{shippingCost.toFixed(2)} RON</span>
              </div>

              {appliedDiscount && (
                <div className="flex justify-between text-green-600 font-bold">
                  <span>Reducere ({appliedDiscount.code})</span>
                  <span>-{discountAmount.toFixed(2)} RON</span>
                </div>
              )}

              {appliedDiscount && (
                <div className="flex justify-between text-neutral-400 line-through text-xs pt-2 border-t border-neutral-100">
                  <span>Fără reducere</span>
                  <span>{totalBeforeDiscount.toFixed(2)} RON</span>
                </div>
              )}
            </div>

            {/* Total final */}
            <div className="flex justify-between items-center mb-4 pb-4 border-b-2 border-black">
              <span className="text-sm text-neutral-500 uppercase font-bold">Total de plată</span>
              <span className="text-2xl font-black">{finalTotal.toFixed(2)} RON</span>
            </div>

            {appliedDiscount && (
              <p className="text-center text-sm text-green-600 mb-4">
                ✓ Ai economisit <strong>{discountAmount.toFixed(2)} RON</strong>!
              </p>
            )}

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
                    ? `Trimite Comanda (${finalTotal.toFixed(2)} RON)`
                    : `Plateste cu Cardul (${finalTotal.toFixed(2)} RON)`}
              </Button>
            )}
          </div>
        )}
      </div>
    </>
  );
};
