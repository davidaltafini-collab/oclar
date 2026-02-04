import React, { useState, useEffect, useRef } from 'react';
import { useCart } from '../context/CartContext';
import { Button } from './Button';
import { API_URL, ROMANIAN_COUNTIES } from '../constants';

// ⭐ IMPORTURI PENTRU COMPONENTA OFICIALĂ GOOGLE (pe care o ai deja instalată)
import '@googlemaps/extended-component-library/place_picker.js';

// ⭐ DEFINIȚII TYPESCRIPT CA REACT SĂ RECUNOASCĂ COMPONENTA
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'gmpx-place-picker': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { 
        placeholder?: string; 
        ref?: any; 
        style?: React.CSSProperties;
        country?: string; // Restricție pe țară
      };
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

// ⭐ FUNCȚIE ROBUSTĂ PENTRU ÎNCĂRCAREA API-ULUI GOOGLE
// Verifică să nu existe deja scriptul pentru a evita erorile
const loadGoogleMapsAPI = (apiKey: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    // 1. Dacă API-ul e deja încărcat în window
    if (typeof window !== 'undefined' && (window as any).google?.maps?.places) {
      resolve();
      return;
    }

    // 2. Dacă scriptul există deja în <head> dar nu a terminat de încărcat
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      return;
    }

    // 3. Creăm scriptul nou
    const script = document.createElement('script');
    script.type = 'text/javascript';
    // IMPORTANT: libraries=places și loading=async pentru web components
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,marker&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });
};

export const CartDrawer: React.FC = () => {
  const { isCartOpen, toggleCart, cart, removeFromCart, updateQuantity, cartTotal } = useCart();

  const [step, setStep] = useState<CheckoutStep>('cart');
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('ramburs');
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>('courier');
  
  // Discount
  const [discountCode, setDiscountCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; amount: number; } | null>(null);
  const [discountLoading, setDiscountLoading] = useState(false);
  const [discountError, setDiscountError] = useState('');

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Referință către componenta Google Picker
  const pickerRef = useRef<any>(null);
  const [mapsLoaded, setMapsLoaded] = useState(false);

  // Ecolet State
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
    address: '',
    postalCode: '',
    street_name: '',
    street_number: '',
    details: '' 
  });
  
  const [validationErrors, setValidationErrors] = useState<{
    phone?: string;
    email?: string;
    postalCode?: string;
  }>({});

  // ⭐ NORMALIZARE PENTRU ECOLET (CRITIC PENTRU API)
  const normalizeCounty = (googleCounty: string) => {
    if (!googleCounty) return '';
    let clean = googleCounty.replace('Județul', '').replace('County', '').trim();
    if (clean === 'Bucharest' || clean === 'București') return 'Bucuresti';
    return clean.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); 
  };

  const normalizeCity = (googleCity: string) => {
      if (!googleCity) return '';
      if (googleCity === 'Bucharest' || googleCity === 'București') return 'Bucuresti';
      return googleCity;
  };

  // 1. Încărcare Google Maps API la deschiderea drawer-ului
  useEffect(() => {
    if (isCartOpen && !mapsLoaded) {
      const key = import.meta.env.VITE_GOOGLE_MAPS_KEY;
      if (key) {
        loadGoogleMapsAPI(key)
          .then(() => {
             console.log("Google Maps API Loaded");
             setMapsLoaded(true);
          })
          .catch(e => console.error("Google Maps Load Error:", e));
      } else {
        console.error("⚠️ CRITIC: VITE_GOOGLE_MAPS_KEY lipsește din .env sau Vercel!");
      }
    }
  }, [isCartOpen, mapsLoaded]);

  // 2. Listener pentru evenimentul 'gmpx-placechange' de la componenta Google
  useEffect(() => {
    const picker = pickerRef.current;
    
    const handlePlaceChange = () => {
      const place = picker.value;
      if (!place) return;

      console.log("📍 Google Place Selected:", place);

      const addressComponents = place.addressComponents;
      let street = '', number = '', city = '', county = '', postal = '';

      if (addressComponents) {
        addressComponents.forEach((component: any) => {
          const types = component.types;
          if (types.includes("route")) street = component.longText;
          if (types.includes("street_number")) number = component.longText;
          if (types.includes("locality")) city = normalizeCity(component.longText);
          // Fallback dacă localitatea e în admin area 2 (ex: sector)
          if (!city && types.includes("administrative_area_level_2")) city = normalizeCity(component.longText);
          if (types.includes("administrative_area_level_1")) county = normalizeCounty(component.longText);
          if (types.includes("postal_code")) postal = component.longText;
        });
      }

      // Actualizăm state-ul cu datele parsate
      setFormData(prev => ({
        ...prev,
        street_name: street,
        street_number: number,
        city: city,
        county: county, 
        postalCode: postal,
        address: place.formattedAddress // Backup address string
      }));
      
      if (postal) validateField('postalCode', postal);
    };

    if (picker && mapsLoaded) {
      // Custom Elements au nevoie de addEventListener, nu merg cu onChange standard de la React
      picker.addEventListener('gmpx-placechange', handlePlaceChange);
    }

    return () => {
      if (picker) {
        picker.removeEventListener('gmpx-placechange', handlePlaceChange);
      }
    };
  }, [mapsLoaded, step]); // Re-atașăm când se schimbă pasul sau se încarcă hărțile

  const toNumber = (v: unknown): number => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    if (typeof v === 'string') {
      const n = Number(v.replace(',', '.'));
      return Number.isFinite(n) ? n : 0;
    }
    return 0;
  };

  // Resetare la închidere
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

  useEffect(() => {
    if (step === 'details' && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [step]);

  // Încărcare Widget Ecolet (Easybox)
  useEffect(() => {
    if (shippingMethod === 'easybox' && step === 'details') {
      const scriptId = 'ecolet-widget-script';
      if (!document.getElementById(scriptId)) {
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = 'https://widget.ecolet.ro/locker-selector.js';
        script.async = true;
        script.onload = () => initEcoletWidget();
        document.body.appendChild(script);
      } else {
        initEcoletWidget();
      }
    }
  }, [shippingMethod, step]);

  const initEcoletWidget = () => {
    if (typeof window !== 'undefined' && (window as any).EcoletWidget) {
      (window as any).EcoletWidget.init({
        containerId: 'ecolet-locker-widget',
        onLockerSelected: (locker: any) => {
          setSelectedLocker({
            lockerId: locker.id,
            lockerName: locker.name,
            city: locker.city,
            county: locker.county
          });
          setFormData(prev => ({ ...prev, city: locker.city, county: locker.county }));
        }
      });
    }
  };

  if (!isCartOpen) return null;

  const subtotal = toNumber(cartTotal);
  const shippingCost = SHIPPING_COSTS[shippingMethod];
  const discountAmount = appliedDiscount ? appliedDiscount.amount : 0;
  const totalBeforeDiscount = subtotal + shippingCost;
  const finalTotal = totalBeforeDiscount - discountAmount;

  // Logică Discount
  const handleApplyDiscount = async () => {
    if (!discountCode.trim()) { setDiscountError('Introdu un cod'); return; }
    setDiscountLoading(true); setDiscountError('');
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
        setDiscountError(data.message || 'Cod invalid'); setAppliedDiscount(null);
      }
    } catch { setDiscountError('Eroare de conexiune'); } finally { setDiscountLoading(false); }
  };

  const handleRemoveDiscount = () => { setAppliedDiscount(null); setDiscountCode(''); setDiscountError(''); };

  // Handlere Formular
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    validateField(name, value);
  };

  const validateField = (name: string, value: string) => {
    const errors = { ...validationErrors };
    if (name === 'phone') {
      const phoneRegex = /^[0-9]{10,}$/;
      if (value && !phoneRegex.test(value.replace(/\s/g, ''))) errors.phone = 'Telefonul trebuie să conțină minim 10 cifre';
      else delete errors.phone;
    }
    if (name === 'email' && value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) errors.email = 'Adresă email invalidă';
      else delete errors.email;
    }
    if (name === 'postalCode') {
      const postalRegex = /^[0-9]{6}$/;
      if (value && !postalRegex.test(value)) errors.postalCode = 'Codul poștal trebuie să aibă 6 cifre';
      else delete errors.postalCode;
    }
    setValidationErrors(errors);
  };

  // Submitere Comandă
  const handleSubmitOrder = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    const errors: any = {};

    if (!formData.fullName) errors.fullName = 'Numele este obligatoriu';
    if (!formData.phone) errors.phone = 'Telefonul este obligatoriu';
    if (!formData.county) errors.county = 'Județul este obligatoriu';
    if (!formData.city) errors.city = 'Orașul este obligatoriu';
    
    // Validare curier
    if (shippingMethod === 'courier') {
       if (!formData.street_name) errors.address = 'Alege strada din lista Google sau completează manual';
       if (!formData.street_number) errors.street_number = 'Numărul străzii este obligatoriu';
       if (!formData.postalCode) errors.postalCode = 'Codul poștal este obligatoriu';
    } else {
       if (!formData.address && !formData.street_name) errors.address = 'Adresa este obligatorie';
    }

    if (shippingMethod === 'easybox' && !selectedLocker) errors.locker = 'Selectează un EasyBox';

    if (Object.keys(errors).length > 0) {
      alert('Te rugăm să completezi toate câmpurile obligatorii.');
      setValidationErrors(errors);
      return;
    }

    setLoading(true);

    // Construim adresa finală
    const finalAddressString = `${formData.street_name} Nr. ${formData.street_number}, ${formData.details || ''}`.trim();

    const addressObject = {
       line: finalAddressString,
       street_name: formData.street_name,
       street_number: formData.street_number,
       details: formData.details,
       city: formData.city,
       county: formData.county,
       postalCode: formData.postalCode
    };

    const orderPayload = {
        customerName: formData.fullName,
        customerEmail: formData.email || null,
        customerPhone: formData.phone,
        address: addressObject,
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

    try {
      if (paymentMethod === 'card') {
        const response = await fetch(`${API_URL}/create-checkout-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderPayload),
        });
        if (!response.ok) throw new Error('Eroare la crearea sesiunii de plată');
        const { url } = await response.json();
        if (url) window.location.href = url;
      } else {
        const response = await fetch(`${API_URL}/create-order-ramburs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderPayload),
        });
        if (!response.ok) throw new Error('Eroare la crearea comenzii');
        const result = await response.json();
        if (result?.success) {
          toggleCart();
          window.location.href = '/success';
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
        <div className="p-5 border-b border-neutral-100 flex items-center justify-between bg-white shrink-0">
          <h2 className="text-xl font-bold uppercase tracking-tight">{step === 'cart' ? 'Cosul Tau' : 'Detalii Livrare'}</h2>
          <button onClick={toggleCart} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">✕</button>
        </div>

        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-5 space-y-4">
          {step === 'cart' ? (
            // --- PASUL 1: COȘUL ---
            cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="text-6xl mb-4">🛒</div>
                <p className="text-neutral-500 text-lg">Coșul tău este gol</p>
              </div>
            ) : (
              <div className="space-y-4">
                {cart.map((item) => (
                  <div key={`${item.id}-${item.selectedColor || ''}`} className="flex gap-4 p-4 bg-white rounded-xl border border-neutral-100 shadow-sm">
                    <div className="w-20 h-20 rounded-lg overflow-hidden bg-neutral-50 shrink-0">
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm truncate">{item.name}</h3>
                      <p className="text-xs text-neutral-500 mt-1">{item.price.toFixed(2)} RON</p>
                      <div className="flex items-center gap-2 mt-2">
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1, item.selectedColor)} className="w-7 h-7 flex items-center justify-center rounded-full bg-neutral-100 font-bold">−</button>
                        <span className="text-sm font-mono w-6 text-center">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1, item.selectedColor)} className="w-7 h-7 flex items-center justify-center rounded-full bg-neutral-100 font-bold">+</button>
                      </div>
                    </div>
                    <button onClick={() => removeFromCart(item.id, item.selectedColor)} className="shrink-0 text-red-400 p-2">✕</button>
                  </div>
                ))}
                
                {/* Discount */}
                <div className="bg-white p-4 rounded-xl border border-neutral-100 shadow-sm">
                   <label className="text-xs font-bold uppercase text-neutral-500 mb-2 block">Cod Reducere</label>
                   {!appliedDiscount ? (
                      <div className="flex gap-2">
                        <input type="text" value={discountCode} onChange={(e) => setDiscountCode(e.target.value.toUpperCase())} placeholder="Cod" className="flex-1 p-3 border border-neutral-200 rounded-lg text-sm" />
                        <Button onClick={handleApplyDiscount} disabled={discountLoading} variant="outline" className="px-4">{discountLoading ? '...' : 'Aplică'}</Button>
                      </div>
                   ) : (
                      <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                         <span className="text-sm font-bold text-green-700">{appliedDiscount.code} (-{discountAmount} RON)</span>
                         <button onClick={handleRemoveDiscount} className="text-red-500 font-bold">✕</button>
                      </div>
                   )}
                   {discountError && <p className="text-xs text-red-500 mt-2">{discountError}</p>}
                </div>

                {/* Shipping Toggle */}
                <div className="bg-white p-4 rounded-xl border border-neutral-100 shadow-sm space-y-3">
                  <h3 className="text-xs font-bold uppercase text-neutral-500">Metoda Livrare</h3>
                  <label className={`flex items-center gap-4 p-4 border rounded-xl cursor-pointer ${shippingMethod === 'easybox' ? 'border-black bg-neutral-50' : 'border-neutral-200'}`}>
                    <input type="radio" checked={shippingMethod === 'easybox'} onChange={() => setShippingMethod('easybox')} className="accent-black w-5 h-5" />
                    <div><span className="font-bold block text-sm">Easy Box</span><span className="text-xs text-neutral-500">{SHIPPING_COSTS.easybox} RON</span></div>
                  </label>
                  <label className={`flex items-center gap-4 p-4 border rounded-xl cursor-pointer ${shippingMethod === 'courier' ? 'border-black bg-neutral-50' : 'border-neutral-200'}`}>
                    <input type="radio" checked={shippingMethod === 'courier'} onChange={() => setShippingMethod('courier')} className="accent-black w-5 h-5" />
                    <div><span className="font-bold block text-sm">Curier</span><span className="text-xs text-neutral-500">{SHIPPING_COSTS.courier} RON</span></div>
                  </label>
                </div>
              </div>
            )
          ) : (
            // --- PASUL 2: CHECKOUT ---
            <form id="checkout-form" className="space-y-4" onSubmit={(e) => e.preventDefault()}>
               <div className="bg-white p-4 rounded-lg shadow-sm space-y-3">
                  <h3 className="font-bold text-sm uppercase text-neutral-500">Date Contact</h3>
                  <input required name="fullName" placeholder="Nume Complet *" value={formData.fullName} onChange={handleInputChange} className="w-full p-3 border border-neutral-200 rounded-lg" />
                  <div className="grid grid-cols-2 gap-3">
                     <input name="email" type="email" placeholder="Email" value={formData.email} onChange={handleInputChange} className="w-full p-3 border border-neutral-200 rounded-lg" />
                     <input required name="phone" placeholder="Telefon *" value={formData.phone} onChange={handleInputChange} className="w-full p-3 border border-neutral-200 rounded-lg" />
                  </div>
               </div>

               <div className="bg-white p-4 rounded-lg shadow-sm space-y-3">
                  <h3 className="font-bold text-sm uppercase text-neutral-500">Adresa Livrare</h3>
                  
                  {/* ⭐ COMPONENTA SPECIALĂ GOOGLE PICKER */}
                  <div className="col-span-2">
                      <label className="text-xs text-blue-600 font-bold ml-1 mb-1 block">🔍 Caută Adresa (Auto-fill):</label>
                      {!mapsLoaded ? (
                         <div className="p-3 bg-gray-100 rounded text-center text-sm text-gray-500">Se încarcă Google Maps...</div>
                      ) : (
                         <gmpx-place-picker 
                            ref={pickerRef} 
                            placeholder="Începe să scrii strada..." 
                            style={{width: '100%', display: 'block'}}
                            country="ro"
                         ></gmpx-place-picker>
                      )}
                  </div>

                  {/* Câmpuri Editabile (Auto-completate de Google) */}
                  <div className="grid grid-cols-3 gap-3 mt-3">
                     <div className="col-span-2">
                        <label className="text-[10px] text-gray-400">Stradă</label>
                        <input required name="street_name" value={formData.street_name} 
                            onChange={(e) => setFormData(prev => ({...prev, street_name: e.target.value}))} 
                            className="w-full p-3 border border-neutral-200 rounded-lg bg-gray-50" />
                     </div>
                     <div className="col-span-1">
                        <label className="text-[10px] text-gray-400">Număr</label>
                        <input required name="street_number" value={formData.street_number} 
                            onChange={(e) => setFormData(prev => ({...prev, street_number: e.target.value}))} 
                            className="w-full p-3 border border-neutral-200 rounded-lg" />
                     </div>
                  </div>

                  <div className="grid grid-cols-1">
                     <input name="details" placeholder="Detalii: Bloc, Scara, Ap, Interfon..." value={formData.details} 
                        onChange={(e) => setFormData(prev => ({...prev, details: e.target.value}))} 
                        className="w-full p-3 border border-neutral-200 rounded-lg" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                     <select required name="county" value={formData.county} onChange={handleInputChange} className="w-full p-3 border border-neutral-200 rounded-lg bg-white">
                        <option value="">Județ *</option>
                        {ROMANIAN_COUNTIES.map(j => <option key={j} value={j}>{j}</option>)}
                     </select>
                     <input required name="city" placeholder="Oraș *" value={formData.city} onChange={handleInputChange} className="w-full p-3 border border-neutral-200 rounded-lg" />
                  </div>
                  
                  <input required={shippingMethod === 'courier'} name="postalCode" placeholder="Cod Poștal" value={formData.postalCode} onChange={handleInputChange} maxLength={6} className="w-full p-3 border border-neutral-200 rounded-lg" />
               </div>

               {shippingMethod === 'easybox' && (
                  <div className="bg-white p-4 rounded-lg shadow-sm space-y-3">
                     <h3 className="font-bold text-sm uppercase text-neutral-500">📦 EasyBox</h3>
                     <div id="ecolet-locker-widget" className="border border-neutral-200 rounded-lg p-4 min-h-[200px] text-center text-neutral-400">Se încarcă...</div>
                     {selectedLocker && <div className="text-green-600 text-sm font-bold">✓ {selectedLocker.lockerName}</div>}
                  </div>
               )}

               <div className="bg-white p-4 rounded-lg shadow-sm space-y-3">
                  <h3 className="font-bold text-sm uppercase text-neutral-500">Metoda Plată</h3>
                  <label className="flex items-center gap-4 p-4 border rounded-xl cursor-pointer border-neutral-200">
                     <input type="radio" checked={paymentMethod === 'ramburs'} onChange={() => setPaymentMethod('ramburs')} className="accent-black w-5 h-5" />
                     <span className="font-bold text-sm">Ramburs (Cash)</span>
                  </label>
                  <label className="flex items-center gap-4 p-4 border rounded-xl cursor-pointer border-neutral-200">
                     <input type="radio" checked={paymentMethod === 'card'} onChange={() => setPaymentMethod('card')} className="accent-black w-5 h-5" />
                     <span className="font-bold text-sm">Card Online</span>
                  </label>
               </div>
            </form>
          )}
        </div>

        {cart.length > 0 && (
           <div className="p-6 border-t border-neutral-100 bg-white shrink-0">
              <div className="flex justify-between items-center mb-4 pb-4 border-b-2 border-black">
                 <span className="text-sm text-neutral-500 uppercase font-bold">Total</span>
                 <span className="text-2xl font-black">{finalTotal.toFixed(2)} RON</span>
              </div>
              {step === 'cart' ? (
                 <Button fullWidth onClick={() => setStep('details')}>Checkout</Button>
              ) : (
                 <Button fullWidth onClick={handleSubmitOrder} disabled={loading}>{loading ? '...' : 'Plătește'}</Button>
              )}
           </div>
        )}
      </div>

      {/* STYLE-URI PENTRU PICKER-UL GOOGLE CA SĂ ARATE BINE */}
      <style>{`
        gmpx-place-picker input {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid #e5e5e5;
          border-radius: 0.5rem;
          font-size: 1rem;
        }
        gmpx-place-picker input:focus {
           outline: none;
           border-color: black;
        }
      `}</style>
    </>
  );
};