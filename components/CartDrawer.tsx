import React, { useState, useEffect, useRef } from 'react';
import { useCart } from '../context/CartContext';
import { Button } from './Button';
import { API_URL } from '../constants';
import { ROMANIAN_COUNTIES } from '../constants';

// ⭐ IMPORTURI OFICIALE GOOGLE MAPS WEB COMPONENTS
import '@googlemaps/extended-component-library/place_picker.js';
import '@googlemaps/extended-component-library/api_loader.js';

// ⭐ DEFINIȚII TYPESCRIPT PENTRU ELEMENTELE CUSTOM
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'gmpx-place-picker': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { 
        placeholder?: string; 
        ref?: any; 
        style?: React.CSSProperties;
        'for-country'?: string;
      };
      'gmpx-api-loader': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        ref?: any;
      };
    }
  }
  // Interfață pentru widget-ul Ecolet
  interface Window {
    EcoletWidget: {
      init: (config: any) => void;
    }
  }
}

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

  // ⭐ REF-URI PENTRU GOOGLE MAPS
  const pickerRef = useRef<any>(null);
  const loaderRef = useRef<any>(null);
  
  // API Key - Citire din env sau fallback
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY || (window as any).__GOOGLE_MAPS_KEY__;

  // ⭐ STATE PENTRU ECOLET
  const [selectedLocker, setSelectedLocker] = useState<{
    lockerId: string;
    lockerName: string;
    city: string;
    county: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    county: '',
    city: '',
    address: '', // Adresa completă vizuală
    postalCode: '',
    street_name: '',
    street_number: '',
    details: '' 
  });
  
  // ⭐ VALIDĂRI
  const [validationErrors, setValidationErrors] = useState<{
    phone?: string;
    email?: string;
    postalCode?: string;
  }>({});

  const toNumber = (v: unknown): number => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    if (typeof v === 'string') {
      const n = Number(v.replace(',', '.'));
      return Number.isFinite(n) ? n : 0;
    }
    return 0;
  };

  // ⭐ HELPERE PENTRU NORMALIZARE DATE
  const normalizeName = (name: string) => {
    if (!name) return '';
    let clean = name.replace('Județul', '').replace('County', '').trim();
    if (clean === 'Bucharest' || clean === 'București') return 'Bucuresti';
    return clean.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); 
  };

  const normalizeCity = (city: string) => {
      if (!city) return '';
      if (city === 'Bucharest' || city === 'București') return 'Bucuresti';
      return city;
  };

  // ⭐ INITIALIZARE GOOGLE MAPS API (FIX CRITIC: SETARE KEY MANUAL)
  // React șterge atributul 'key' din JSX, așa că îl punem manual prin ref
  useEffect(() => {
    if (loaderRef.current && apiKey) {
      loaderRef.current.key = apiKey;
      loaderRef.current.libraries = ['places'];
      loaderRef.current.region = 'RO'; 
    }
  }, [apiKey, isCartOpen]); // Se execută când se deschide coșul

  // ⭐ LISTENER PENTRU SELECTARE ADRESĂ (GOOGLE PICKER)
  useEffect(() => {
    // Folosim un mic delay pentru a fi siguri că elementul 'gmpx-place-picker' este montat
    const timer = setTimeout(() => {
        const picker = pickerRef.current;
        if (picker && step === 'details') {
          const handlePlaceChange = () => {
            const place = picker.value;
            if (!place) return;

            const addressComponents = place.addressComponents || [];
            let street = '', number = '', city = '', county = '', postal = '';

            // Parsare componente adresă Google
            addressComponents.forEach((component: any) => {
              const types = component.types;
              if (types.includes("route")) street = component.longText;
              if (types.includes("street_number")) number = component.longText;
              if (types.includes("locality")) city = normalizeCity(component.longText);
              // Fallback oraș (uneori apare la sector/admin level 2)
              if (!city && types.includes("administrative_area_level_2")) city = normalizeCity(component.longText);
              if (types.includes("administrative_area_level_1")) county = normalizeName(component.longText);
              if (types.includes("postal_code")) postal = component.longText;
            });

            // Fallback: dacă Google nu dă strada exactă în componente, o luăm din formattedAddress
            if (!street && place.formattedAddress) {
               const parts = place.formattedAddress.split(',');
               if (parts.length > 0) street = parts[0];
            }

            // Construim linia de adresă completă pentru backend/afișare
            const fullAddressLine = `${street || ''} Nr. ${number || ''}`.trim();

            setFormData(prev => ({
              ...prev,
              street_name: street,
              street_number: number,
              city: city,
              county: county,
              postalCode: postal,
              address: fullAddressLine
            }));
            
            // Validăm codul poștal automat dacă există
            if (postal) validateField('postalCode', postal);
          };

          picker.addEventListener('gmpx-placechange', handlePlaceChange);
          
          // Cleanup
          return () => {
            if (picker) picker.removeEventListener('gmpx-placechange', handlePlaceChange);
          };
        }
    }, 100);

    return () => clearTimeout(timer);
  }, [step, isCartOpen]);

  // Resetare stare când se închide coșul
  useEffect(() => {
    if (!isCartOpen) {
      setStep('cart');
      setPaymentMethod('ramburs');
      setShippingMethod('courier');
      setLoading(false);
      setAppliedDiscount(null);
      setDiscountCode('');
      setDiscountError('');
      setSelectedLocker(null);
      setValidationErrors({});
    }
  }, [isCartOpen]);

  // Scroll la top când trecem la detalii
  useEffect(() => {
    if (step === 'details' && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [step]);

  // =================================================================
  // ⭐ FIX-UL PENTRU EASYBOX WIDGET (LOGICĂ DE RETRY)
  // =================================================================
  useEffect(() => {
    // Rulăm doar dacă suntem pe EasyBox și pasul Details
    if (shippingMethod === 'easybox' && step === 'details' && isCartOpen) {
      
      const scriptId = 'ecolet-widget-script';
      
      // Funcția care încearcă să inițializeze widget-ul
      const tryInitWidget = (attempts = 0) => {
        // 1. Verificăm dacă există containerul în HTML
        const container = document.getElementById('ecolet-locker-widget');
        
        // 2. Verificăm dacă scriptul s-a încărcat (avem obiectul global)
        const isScriptLoaded = typeof window !== 'undefined' && window.EcoletWidget;

        if (container && isScriptLoaded) {
          console.log('✅ Ecolet: Container found & Script loaded. Initializing...');
          
          // Curățăm containerul înainte de a randa (evităm dublarea hărții)
          container.innerHTML = ''; 

          window.EcoletWidget.init({
            containerId: 'ecolet-locker-widget',
            onLockerSelected: (locker: any) => {
              console.log('📦 Locker Selected:', locker);
              setSelectedLocker({
                lockerId: locker.id,
                lockerName: locker.name,
                city: locker.city,
                county: locker.county
              });
              // Actualizăm automat orașul și județul în form
              setFormData(prev => ({ 
                ...prev, 
                city: locker.city, 
                county: locker.county 
              }));
            }
          });
        } else {
          // Dacă nu e gata, mai încercăm de maxim 10 ori (la fiecare 300ms)
          if (attempts < 10) {
            console.log(`⏳ Ecolet: Waiting for DOM/Script... (Attempt ${attempts + 1})`);
            setTimeout(() => tryInitWidget(attempts + 1), 300);
          } else {
            console.error('❌ Ecolet: Failed to initialize widget after multiple attempts.');
          }
        }
      };

      // 3. Logică de încărcare script
      if (!document.getElementById(scriptId)) {
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = 'https://widget.ecolet.ro/locker-selector.js'; 
        script.async = true;
        script.onload = () => tryInitWidget(); // Când se termină descărcarea, încearcă init
        document.body.appendChild(script);
      } else {
        // Scriptul există deja, încercăm direct init
        tryInitWidget();
      }
    }
  }, [shippingMethod, step, isCartOpen]);

  // Funcție validare
  const validateField = (name: string, value: string) => {
    const errors = { ...validationErrors };
    if (name === 'phone') {
      const phoneRegex = /^[0-9]{10,}$/;
      if (value && !phoneRegex.test(value.replace(/\s/g, ''))) errors.phone = 'Minim 10 cifre';
      else delete errors.phone;
    }
    if (name === 'email' && value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) errors.email = 'Email invalid';
      else delete errors.email;
    }
    if (name === 'postalCode') {
      const postalRegex = /^[0-9]{6}$/;
      if (value && !postalRegex.test(value)) errors.postalCode = '6 cifre necesare';
      else delete errors.postalCode;
    }
    setValidationErrors(errors);
  };

  // Logică Discount
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
        setAppliedDiscount({ code: data.code, amount: data.discountAmount });
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    validateField(name, value);
  };

  // Submit Comandă
  const handleSubmitOrder = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    const errors: any = {};
    if (!formData.fullName) errors.fullName = 'Numele este obligatoriu';
    if (!formData.phone) errors.phone = 'Telefonul este obligatoriu';
    if (!formData.county) errors.county = 'Județul este obligatoriu';
    
    // Validare Curier
    if (shippingMethod === 'courier') {
         if (!formData.city) errors.city = 'Orașul este obligatoriu';
         if (!formData.street_name) errors.address = 'Selectează adresa din sugestiile Google';
         // Codul postal este recomandat, dar nu critic daca lipseste
    } 

    // Validare Easybox
    if (shippingMethod === 'easybox' && !selectedLocker) {
      errors.locker = 'Selectează un EasyBox pentru livrare';
    }

    if (Object.keys(errors).length > 0) {
      alert('Te rugăm să completezi câmpurile obligatorii.');
      setValidationErrors(errors);
      return;
    }

    setLoading(true);

    try {
      // Calculăm adresa finală pentru DB
      const finalAddressLine = `${formData.street_name} Nr. ${formData.street_number}, ${formData.details}`.trim();

      const orderPayload = {
            customerName: formData.fullName,
            customerEmail: formData.email || null,
            customerPhone: formData.phone,
            
            // Trimitem obiectul de adresă structurat
            address: {
                county: formData.county,
                city: formData.city,
                line: finalAddressLine,
                // Adăugăm și componentele separate pentru Ecolet
                street_name: formData.street_name,
                street_number: formData.street_number,
                details: formData.details,
                postalCode: formData.postalCode
            },
            
            items: cart,
            subtotal,
            shippingMethod,
            shippingCost,
            discountCode: appliedDiscount?.code || null,
            discountAmount,
            totalAmount: finalTotal,
            postalCode: formData.postalCode,
            lockerId: selectedLocker?.lockerId || null,
      };

      if (paymentMethod === 'card') {
        const response = await fetch(`${API_URL}/create-checkout-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderPayload),
        });

        if (!response.ok) throw new Error('Failed to create checkout session');
        const { url } = await response.json();
        if (url) window.location.href = url;
        else throw new Error('No checkout URL received');
      } else {
        const response = await fetch(`${API_URL}/create-order-ramburs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderPayload),
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
      alert('A apărut o eroare. Te rugăm să încerci din nou.');
    } finally {
      setLoading(false);
    }
  };

  if (!isCartOpen) return null;

  // Calcul final
  const subtotal = toNumber(cartTotal);
  const shippingCost = SHIPPING_COSTS[shippingMethod];
  const discountAmount = appliedDiscount ? appliedDiscount.amount : 0;
  const totalBeforeDiscount = subtotal + shippingCost;
  const finalTotal = totalBeforeDiscount - discountAmount;

  return (
    <>
      {/* ⭐ GOOGLE API LOADER - ÎNCĂRCAT MEREU CÂND E DESCHIS CART-UL (FIX LOAD ERROR) */}
      {isCartOpen && apiKey && <gmpx-api-loader ref={loaderRef} />}

      <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={toggleCart} />

      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="p-5 border-b border-neutral-100 flex items-center justify-between bg-white shrink-0">
          <h2 className="text-xl font-bold uppercase tracking-tight">
            {step === 'cart' ? 'Coșul Tău' : 'Detalii Livrare'}
          </h2>
          <button onClick={toggleCart} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">✕</button>
        </div>

        {/* Content */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-5 space-y-4">
          {step === 'cart' ? (
            cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="text-6xl mb-4">🛒</div>
                <p className="text-neutral-500 text-lg">Coșul tău este gol</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Listă produse */}
                {cart.map((item) => (
                  <div key={item.id} className="flex gap-4 p-4 bg-white rounded-xl border border-neutral-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="w-20 h-20 rounded-lg overflow-hidden bg-neutral-50 shrink-0">
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm truncate">{item.name}</h3>
                      <p className="text-xs text-neutral-500 mt-1">{item.price.toFixed(2)} RON</p>
                      <div className="flex items-center gap-2 mt-2">
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-7 h-7 flex items-center justify-center rounded-full bg-neutral-100 hover:bg-neutral-200 text-sm font-bold">−</button>
                        <span className="text-sm font-mono w-6 text-center">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-7 h-7 flex items-center justify-center rounded-full bg-neutral-100 hover:bg-neutral-200 text-sm font-bold">+</button>
                      </div>
                    </div>
                    <button onClick={() => removeFromCart(item.id)} className="shrink-0 text-red-400 hover:text-red-600 p-2">✕</button>
                  </div>
                ))}

                {/* Cod Reducere */}
                <div className="bg-white p-4 rounded-xl border border-neutral-100 shadow-sm">
                  <label className="text-xs font-bold uppercase text-neutral-500 mb-2 block">Cod Reducere</label>
                  {!appliedDiscount ? (
                    <div className="flex gap-2">
                      <input type="text" value={discountCode} onChange={(e) => setDiscountCode(e.target.value.toUpperCase())} placeholder="COD" className="flex-1 p-3 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-black" />
                      <Button onClick={handleApplyDiscount} disabled={discountLoading} variant="outline" className="px-4">{discountLoading ? '...' : 'Aplică'}</Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-green-600 text-xl">✓</span>
                        <div><p className="text-sm font-bold text-green-700">{appliedDiscount.code}</p><p className="text-xs text-green-600">-{discountAmount.toFixed(2)} RON</p></div>
                      </div>
                      <button onClick={handleRemoveDiscount} className="text-red-500 hover:text-red-700 font-bold">✕</button>
                    </div>
                  )}
                  {discountError && <p className="text-xs text-red-500 mt-2">{discountError}</p>}
                </div>

                {/* Metoda Livrare */}
                <div className="bg-white p-4 rounded-xl border border-neutral-100 shadow-sm space-y-3">
                  <h3 className="text-xs font-bold uppercase text-neutral-500">Metoda Livrare</h3>
                  <div className="grid grid-cols-1 gap-3">
                    <label className={`flex items-center gap-4 p-4 border rounded-xl cursor-pointer transition-all ${shippingMethod === 'easybox' ? 'border-black bg-neutral-50 shadow-inner' : 'border-neutral-200 hover:border-neutral-300'}`}>
                      <input type="radio" name="shipping" checked={shippingMethod === 'easybox'} onChange={() => setShippingMethod('easybox')} className="accent-black w-5 h-5" />
                      <div><span className="font-bold block text-sm">Easy Box</span><span className="text-xs text-neutral-500">{SHIPPING_COSTS.easybox.toFixed(2)} RON</span></div>
                    </label>
                    <label className={`flex items-center gap-4 p-4 border rounded-xl cursor-pointer transition-all ${shippingMethod === 'courier' ? 'border-black bg-neutral-50 shadow-inner' : 'border-neutral-200 hover:border-neutral-300'}`}>
                      <input type="radio" name="shipping" checked={shippingMethod === 'courier'} onChange={() => setShippingMethod('courier')} className="accent-black w-5 h-5" />
                      <div><span className="font-bold block text-sm">Livrare Curier</span><span className="text-xs text-neutral-500">{SHIPPING_COSTS.courier.toFixed(2)} RON</span></div>
                    </label>
                  </div>
                </div>
              </div>
            )
          ) : (
              <form id="checkout-form" className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                {/* Date Contact */}
                <div className="bg-white p-4 rounded-lg shadow-sm space-y-3">
                  <h3 className="font-bold text-sm uppercase text-neutral-500 flex items-center gap-2">Date Contact</h3>
                  <input required name="fullName" placeholder="Nume Complet *" value={formData.fullName} onChange={handleInputChange} className="w-full p-3 border border-neutral-200 rounded-lg focus:outline-none focus:border-black transition-colors text-base md:text-sm" />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <input name="email" type="email" placeholder="Email (opțional)" value={formData.email} onChange={handleInputChange} className={`w-full p-3 border rounded-lg focus:outline-none focus:border-black transition-colors text-base md:text-sm ${validationErrors.email ? 'border-red-500' : 'border-neutral-200'}`} />
                      {validationErrors.email && <p className="text-xs text-red-500 mt-1">{validationErrors.email}</p>}
                    </div>
                    <div>
                      <input required name="phone" placeholder="Telefon *" value={formData.phone} onChange={handleInputChange} className={`w-full p-3 border rounded-lg focus:outline-none focus:border-black transition-colors text-base md:text-sm ${validationErrors.phone ? 'border-red-500' : 'border-neutral-200'}`} />
                      {validationErrors.phone && <p className="text-xs text-red-500 mt-1">{validationErrors.phone}</p>}
                    </div>
                  </div>
                </div>

                {/* ADRESA LIVRARE (Doar pentru Curier) */}
                {shippingMethod === 'courier' && (
                  <div className="bg-white p-4 rounded-lg shadow-sm space-y-3">
                    <h3 className="font-bold text-sm uppercase text-neutral-500 flex items-center gap-2">ADRESA LIVRARE</h3>
                    
                    {/* SEARCH BAR GOOGLE */}
                    <div className="mb-2 relative">
                        <label className="text-xs text-blue-600 font-bold ml-1 mb-1 block">🔍 Caută Adresa</label>
                        <gmpx-place-picker 
                            ref={pickerRef} 
                            placeholder="Ex: Strada Libertății 4, București" 
                            style={{ width: '100%' }} 
                        />
                    </div>

                    {/* PANOU INFORMATIV SIMETRIC (READ ONLY) */}
                    <div className="bg-gray-100 p-3 rounded-lg border border-gray-200 text-xs text-gray-700 grid grid-cols-12 gap-3 items-center">
                        {/* Rând 1: Județ (stânga) și Oraș (dreapta) */}
                        <div className="col-span-6 border-b border-gray-200 pb-2">
                          <span className="text-[10px] text-gray-400 uppercase block mb-0.5">Județ</span>
                          <div className="font-bold truncate">{formData.county || '–'}</div>
                        </div>
                        <div className="col-span-6 border-b border-gray-200 pb-2 text-right">
                          <span className="text-[10px] text-gray-400 uppercase block mb-0.5">Oraș</span>
                          <div className="font-bold truncate">{formData.city || '–'}</div>
                        </div>
                        
                        {/* Rând 2: Stradă (lat) și Număr (îngust) */}
                        <div className="col-span-8 border-b border-gray-200 pb-2">
                          <span className="text-[10px] text-gray-400 uppercase block mb-0.5">Stradă</span>
                          <div className="font-bold truncate">{formData.street_name || '–'}</div>
                        </div>
                        <div className="col-span-4 border-b border-gray-200 pb-2 text-right">
                          <span className="text-[10px] text-gray-400 uppercase block mb-0.5">Nr.</span>
                          <div className="font-bold">{formData.street_number || '–'}</div>
                        </div>
                        
                        {/* Rând 3: Cod Poștal */}
                        <div className="col-span-12">
                          <span className="text-[10px] text-gray-400 uppercase block mb-0.5">Cod Poștal</span>
                          <div className="font-bold font-mono tracking-wider">{formData.postalCode || '–'}</div>
                        </div>
                    </div>

                    {/* DETALII EDITABILE */}
                    <div>
                      <label className="text-xs text-neutral-500 ml-1 mb-1 block">Detalii (Bl, Sc, Ap)</label>
                      <input
                        name="details"
                        placeholder="Scara A, Etaj 2, Ap 10, Interfon..."
                        value={formData.details}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData(prev => ({ ...prev, details: val }));
                        }}
                        className="w-full p-3 border border-neutral-200 rounded-lg focus:outline-none focus:border-black transition-colors"
                      />
                    </div>
                  </div>
                )}

                {/* EASYBOX WIDGET */}
                {shippingMethod === 'easybox' && (
                  <div className="bg-white p-4 rounded-lg shadow-sm space-y-3">
                    <h3 className="font-bold text-sm uppercase text-neutral-500 flex items-center gap-2">📦 Selectează EasyBox</h3>
                    {/* AICI ESTE FIX-UL: Container-ul gol așteaptă script-ul */}
                    <div id="ecolet-locker-widget" className="border border-neutral-200 rounded-lg p-4 min-h-[300px] flex items-center justify-center">
                      <p className="text-sm text-neutral-400 text-center">Se încarcă harta EasyBox...</p>
                    </div>
                    {selectedLocker && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <p className="text-sm font-bold text-green-700">✓ EasyBox selectat:</p>
                        <p className="text-xs text-green-600 mt-1">{selectedLocker.lockerName}</p>
                        <p className="text-xs text-green-600">{selectedLocker.city}, {selectedLocker.county}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Plata */}
                <div className="bg-white p-4 rounded-lg shadow-sm space-y-3">
                  <h3 className="font-bold text-sm uppercase text-neutral-500 flex items-center gap-2">Metoda Plată</h3>
                  <div className="grid grid-cols-1 gap-3">
                    <label className={`flex items-center gap-4 p-4 border rounded-xl cursor-pointer transition-all duration-200 ${paymentMethod === 'ramburs' ? 'border-black bg-neutral-50 shadow-inner' : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'}`}>
                      <input type="radio" name="payment" checked={paymentMethod === 'ramburs'} onChange={() => setPaymentMethod('ramburs')} className="accent-black w-5 h-5" />
                      <div className="p-2 bg-white rounded-full border border-neutral-100 shadow-sm shrink-0"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg></div>
                      <div><span className="font-bold block text-sm">Plata Ramburs (Cash)</span><span className="text-xs text-neutral-500">Plătești curierului la livrare</span></div>
                    </label>
                    <label className={`relative flex items-center gap-4 p-4 border rounded-xl cursor-pointer transition-all duration-200 ${paymentMethod === 'card' ? 'border-black bg-neutral-50 shadow-inner' : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'}`}>
                      <input type="radio" name="payment" checked={paymentMethod === 'card'} onChange={() => setPaymentMethod('card')} className="accent-black w-5 h-5" />
                      <div className="p-2 bg-white rounded-full border border-neutral-100 shadow-sm shrink-0"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg></div>
                      <div><span className="font-bold block text-sm">Card Online</span><span className="text-xs text-neutral-500">Securizat prin Stripe</span></div>
                    </label>
                  </div>
                </div>
              </form>
          )}
        </div>

        {/* Footer COMPACT */}
        {cart.length > 0 && (
          <div className="p-4 border-t border-neutral-100 bg-white shrink-0">
            {/* Detalii prețuri - Text mai mic */}
            <div className="space-y-1 mb-3 text-xs">
              <div className="flex justify-between text-neutral-600"><span>Subtotal</span><span>{subtotal.toFixed(2)} RON</span></div>
              <div className="flex justify-between text-neutral-600"><span>Transport</span><span>{shippingCost.toFixed(2)} RON</span></div>
              {appliedDiscount && <div className="flex justify-between text-green-600 font-bold"><span>Reducere</span><span>-{discountAmount.toFixed(2)} RON</span></div>}
            </div>

            {/* Total final */}
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-black">
              <span className="text-xs text-neutral-500 uppercase font-bold">Total</span>
              <span className="text-xl font-black">{finalTotal.toFixed(2)} RON</span>
            </div>

            {step === 'cart' ? (
              <Button fullWidth onClick={() => setStep('details')}>Continuă</Button>
            ) : (
              <Button fullWidth onClick={handleSubmitOrder} disabled={loading} type="button" className="shadow-xl">{loading ? 'Se procesează...' : paymentMethod === 'ramburs' ? `Trimite Comanda (${finalTotal.toFixed(2)} RON)` : `Plătește cu Cardul (${finalTotal.toFixed(2)} RON)`}</Button>
            )}
          </div>
        )}
      </div>

      <style>{`
        .pac-container { z-index: 99999 !important; }
        
        /* FIX LEAFLET PENTRU EASYBOX */
        .leaflet-container { z-index: 999 !important; }

        gmpx-place-picker { display: block; width: 100%; }
        gmpx-place-picker input { padding: 0.75rem !important; border-radius: 0.5rem !important; border: 1px solid #e5e5e5 !important; width: 100% !important; font-size: 0.875rem !important; box-sizing: border-box !important; background-color: white !important; height: auto !important; }
        gmpx-place-picker input:focus { outline: none !important; border-color: black !important; }
        
        /* FIX ZOOM MOBIL: Font size minim 16px pe input-uri */
        @media screen and (max-width: 768px) {
          input, select, textarea, gmpx-place-picker::part(input) {
            font-size: 16px !important;
          }
        }
      `}</style>
    </>
  );
};