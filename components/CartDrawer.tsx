import React, { useState, useEffect, useRef } from 'react';
import { useCart } from '../context/CartContext';
import { Button } from './Button';
import { API_URL, ROMANIAN_COUNTIES } from '../constants';

// ⭐ IMPORTURI PENTRU GOOGLE PLACES (FĂRĂ API LOADER WEB COMPONENT)
import '@googlemaps/extended-component-library/place_picker.js';

// ⭐ DEFINIȚII TYPESCRIPT
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'gmpx-place-picker': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { 
        placeholder?: string; 
        ref?: any; 
        style?: React.CSSProperties;
        country?: string;
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

// ⭐ FUNCȚIE PENTRU ÎNCĂRCARE PROGRAMATICĂ GOOGLE MAPS API
const loadGoogleMapsAPI = (apiKey: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Verifică dacă API-ul e deja încărcat
    if (typeof window !== 'undefined' && (window as any).google?.maps) {
      console.log('✅ Google Maps API already loaded');
      resolve();
      return;
    }

    // Verifică dacă scriptul e deja adăugat
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      // Așteaptă încărcarea scriptului existent
      const checkInterval = setInterval(() => {
        if ((window as any).google?.maps) {
          console.log('✅ Google Maps API loaded from existing script');
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!(window as any).google?.maps) {
          reject(new Error('Timeout waiting for existing script'));
        }
      }, 15000);
      return;
    }

    console.log('📦 Loading Google Maps API...');

    // Creează scriptul
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      console.log('✅ Google Maps API loaded successfully');
      resolve();
    };

    script.onerror = (error) => {
      console.error('❌ Failed to load Google Maps API:', error);
      reject(new Error('Failed to load Google Maps API'));
    };

    document.head.appendChild(script);

    // Timeout de siguranță
    setTimeout(() => {
      if (!(window as any).google?.maps) {
        reject(new Error('Google Maps API load timeout'));
      }
    }, 15000);
  });
};

export const CartDrawer: React.FC = () => {
  const { isCartOpen, toggleCart, cart, removeFromCart, updateQuantity, cartTotal } = useCart();

  const [step, setStep] = useState<CheckoutStep>('cart');
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('ramburs');
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>('courier');
  
  const [discountCode, setDiscountCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<{
    code: string;
    amount: number;
  } | null>(null);
  const [discountLoading, setDiscountLoading] = useState(false);
  const [discountError, setDiscountError] = useState('');

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<any>(null);
  
  // ⭐ STATE PENTRU GOOGLE MAPS (SIMPLIFICAT)
  const [googleMapsReady, setGoogleMapsReady] = useState(false);
  const [googleMapsError, setGoogleMapsError] = useState(false);
  const [isLoadingMaps, setIsLoadingMaps] = useState(false);

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

  // ⭐ HELPERE
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

  const toNumber = (v: unknown): number => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    if (typeof v === 'string') {
      const n = Number(v.replace(',', '.'));
      return Number.isFinite(n) ? n : 0;
    }
    return 0;
  };

  // ⭐ ÎNCĂRCARE GOOGLE MAPS API (NOUĂ METODĂ)
  useEffect(() => {
    // Încearcă să ia API key-ul din mai multe surse
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY || 
                   (window as any).__GOOGLE_MAPS_KEY__ ||
    
    
    if (!apiKey || apiKey === 'undefined') {
      console.error('❌ VITE_GOOGLE_MAPS_KEY is not defined in .env file');
      console.log('💡 Add VITE_GOOGLE_MAPS_KEY=your_key to your .env file');
      setGoogleMapsError(true);
      return;
    }
    
    console.log('🔑 Using Google Maps API key:', apiKey.substring(0, 10) + '...');

    // Verifică dacă e deja încărcat
    if ((window as any).google?.maps) {
      console.log('✅ Google Maps API already available');
      setGoogleMapsReady(true);
      return;
    }

    // Încarcă API-ul doar când e nevoie (când drawer-ul e deschis)
    if (isCartOpen && !googleMapsReady && !isLoadingMaps && !googleMapsError) {
      setIsLoadingMaps(true);
      
      loadGoogleMapsAPI(apiKey)
        .then(() => {
          setGoogleMapsReady(true);
          setGoogleMapsError(false);
        })
        .catch((error) => {
          console.error('❌ Error loading Google Maps:', error);
          setGoogleMapsError(true);
        })
        .finally(() => {
          setIsLoadingMaps(false);
        });
    }
  }, [isCartOpen, googleMapsReady, isLoadingMaps, googleMapsError]);

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
      setSelectedLocker(null);
      setValidationErrors({});
    }
  }, [isCartOpen]);

  useEffect(() => {
    if (step === 'details' && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [step]);

  // ⭐ LISTENER PENTRU GOOGLE PICKER
  useEffect(() => {
    const picker = pickerRef.current;
    if (picker && step === 'details' && googleMapsReady) {
        const handlePlaceChange = () => {
            const place = picker.value;
            if (!place || !place.addressComponents) {
                console.warn('⚠️ No address components found');
                return;
            }

            console.log('📍 Place selected:', place);

            const addressComponents = place.addressComponents;
            let street = '', number = '', city = '', county = '', postal = '';

            addressComponents.forEach((component: any) => {
                const types = component.types;
                if (types.includes("route")) street = component.longText;
                if (types.includes("street_number")) number = component.longText;
                if (types.includes("locality")) city = normalizeCity(component.longText);
                if (!city && types.includes("administrative_area_level_2")) city = normalizeCity(component.longText);
                if (types.includes("administrative_area_level_1")) county = normalizeCounty(component.longText);
                if (types.includes("postal_code")) postal = component.longText;
            });

            console.log('✅ Parsed address:', { street, number, city, county, postal });

            setFormData(prev => ({
                ...prev,
                street_name: street,
                street_number: number,
                city: city,
                county: county,
                postalCode: postal,
                address: place.formattedAddress
            }));
            
            if (postal) validateField('postalCode', postal);
        };

        picker.addEventListener('gmpx-placechange', handlePlaceChange);
        
        return () => {
            if (picker) {
                picker.removeEventListener('gmpx-placechange', handlePlaceChange);
            }
        };
    }
  }, [step, googleMapsReady]);

  // ⭐ INTEGRARE WIDGET ECOLET
  useEffect(() => {
    if (shippingMethod === 'easybox' && step === 'details') {
      const scriptId = 'ecolet-widget-script';
      
      if (!document.getElementById(scriptId)) {
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = 'https://widget.ecolet.ro/locker-selector.js';
        script.async = true;
        script.onload = () => {
          console.log('✅ Ecolet widget loaded');
          initEcoletWidget();
        };
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
          console.log('✅ Locker selected:', locker);
          setSelectedLocker({
            lockerId: locker.id,
            lockerName: locker.name,
            city: locker.city,
            county: locker.county
          });
          setFormData(prev => ({
            ...prev,
            city: locker.city,
            county: locker.county
          }));
        }
      });
    }
  };

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
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    validateField(name, value);
  };

  const validateField = (name: string, value: string) => {
    const errors = { ...validationErrors };

    if (name === 'phone') {
      const phoneRegex = /^[0-9]{10,}$/;
      if (value && !phoneRegex.test(value.replace(/\s/g, ''))) {
        errors.phone = 'Telefonul trebuie să conțină minim 10 cifre';
      } else {
        delete errors.phone;
      }
    }

    if (name === 'email' && value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        errors.email = 'Adresă email invalidă';
      } else {
        delete errors.email;
      }
    }

    if (name === 'postalCode') {
      const postalRegex = /^[0-9]{6}$/;
      if (value && !postalRegex.test(value)) {
        errors.postalCode = 'Codul poștal trebuie să aibă 6 cifre';
      } else {
        delete errors.postalCode;
      }
    }

    setValidationErrors(errors);
  };

  const handleSubmitOrder = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();

    const errors: any = {};

    if (!formData.fullName) errors.fullName = 'Numele este obligatoriu';
    if (!formData.phone) errors.phone = 'Telefonul este obligatoriu';
    if (!formData.county) errors.county = 'Județul este obligatoriu';
    if (!formData.city) errors.city = 'Orașul este obligatoriu';

    if (shippingMethod === 'courier') {
      if (!formData.street_name) errors.address = 'Numele străzii este obligatoriu';
      if (!formData.street_number) errors.address = 'Numărul străzii este obligatoriu';
      if (!formData.postalCode) errors.postalCode = 'Codul poștal este obligatoriu pentru livrare curier';
    } else {
      if (!formData.address && !formData.street_name) errors.address = 'Adresa este obligatorie';
    }

    if (shippingMethod === 'easybox' && !selectedLocker) {
      errors.locker = 'Selectează un EasyBox pentru livrare';
    }

    if (Object.keys(errors).length > 0) {
      alert('Te rugăm să completezi toate câmpurile obligatorii corect.');
      setValidationErrors(errors);
      return;
    }

    setLoading(true);

    try {
      const addressObject = {
        line: `${formData.street_name} Nr. ${formData.street_number}, ${formData.details || ''}`.trim(),
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

        {/* Content - Scrollable */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-5 space-y-4">
          {step === 'cart' ? (
            cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="text-6xl mb-4">🛒</div>
                <p className="text-neutral-500 text-lg">Coșul tău este gol</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Produse în coș */}
                {cart.map((item) => (
                  <div key={item.id} className="flex gap-4 p-4 bg-white rounded-xl border border-neutral-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="w-20 h-20 rounded-lg overflow-hidden bg-neutral-50 shrink-0">
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm truncate">{item.name}</h3>
                      <p className="text-xs text-neutral-500 mt-1">{item.price.toFixed(2)} RON</p>
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="w-7 h-7 flex items-center justify-center rounded-full bg-neutral-100 hover:bg-neutral-200 text-sm font-bold"
                        >
                          −
                        </button>
                        <span className="text-sm font-mono w-6 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="w-7 h-7 flex items-center justify-center rounded-full bg-neutral-100 hover:bg-neutral-200 text-sm font-bold"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="shrink-0 text-red-400 hover:text-red-600 p-2"
                    >
                      ✕
                    </button>
                  </div>
                ))}

                {/* Cod reducere */}
                <div className="bg-white p-4 rounded-xl border border-neutral-100 shadow-sm">
                  <label className="text-xs font-bold uppercase text-neutral-500 mb-2 block">
                    Cod Reducere
                  </label>
                  {!appliedDiscount ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={discountCode}
                        onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                        placeholder="Introdu codul"
                        className="flex-1 p-3 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-black"
                      />
                      <Button
                        onClick={handleApplyDiscount}
                        disabled={discountLoading}
                        variant="outline"
                        className="px-4"
                      >
                        {discountLoading ? '...' : 'Aplică'}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-green-600 text-xl">✓</span>
                        <div>
                          <p className="text-sm font-bold text-green-700">{appliedDiscount.code}</p>
                          <p className="text-xs text-green-600">-{discountAmount.toFixed(2)} RON</p>
                        </div>
                      </div>
                      <button
                        onClick={handleRemoveDiscount}
                        className="text-red-500 hover:text-red-700 font-bold"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                  {discountError && (
                    <p className="text-xs text-red-500 mt-2">{discountError}</p>
                  )}
                </div>

                {/* Metoda livrare */}
                <div className="bg-white p-4 rounded-xl border border-neutral-100 shadow-sm space-y-3">
                  <h3 className="text-xs font-bold uppercase text-neutral-500">Metoda Livrare</h3>
                  
                  <div className="grid grid-cols-1 gap-3">
                    <label className={`flex items-center gap-4 p-4 border rounded-xl cursor-pointer transition-all ${
                      shippingMethod === 'easybox'
                        ? 'border-black bg-neutral-50 shadow-inner'
                        : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                    }`}>
                      <input
                        type="radio"
                        name="shipping"
                        checked={shippingMethod === 'easybox'}
                        onChange={() => setShippingMethod('easybox')}
                        className="accent-black w-5 h-5"
                      />
                      <div>
                        <span className="font-bold block text-sm">Easy Box</span>
                        <span className="text-xs text-neutral-500">{SHIPPING_COSTS.easybox.toFixed(2)} RON</span>
                      </div>
                    </label>

                    <label className={`flex items-center gap-4 p-4 border rounded-xl cursor-pointer transition-all ${
                      shippingMethod === 'courier'
                        ? 'border-black bg-neutral-50 shadow-inner'
                        : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                    }`}>
                      <input
                        type="radio"
                        name="shipping"
                        checked={shippingMethod === 'courier'}
                        onChange={() => setShippingMethod('courier')}
                        className="accent-black w-5 h-5"
                      />
                      <div>
                        <span className="font-bold block text-sm">Livrare Curier</span>
                        <span className="text-xs text-neutral-500">{SHIPPING_COSTS.courier.toFixed(2)} RON</span>
                      </div>
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
                    placeholder="Nume Complet *"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-neutral-200 rounded-lg focus:outline-none focus:border-black transition-colors text-base md:text-sm"
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <input
                        name="email"
                        type="email"
                        placeholder="Email (opțional)"
                        value={formData.email}
                        onChange={handleInputChange}
                        className={`w-full p-3 border rounded-lg focus:outline-none focus:border-black transition-colors text-base md:text-sm ${validationErrors.email ? 'border-red-500' : 'border-neutral-200'}`}
                      />
                      {validationErrors.email && (
                        <p className="text-xs text-red-500 mt-1">{validationErrors.email}</p>
                      )}
                    </div>
                    <div>
                      <input
                        required
                        name="phone"
                        placeholder="Telefon *"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className={`w-full p-3 border rounded-lg focus:outline-none focus:border-black transition-colors text-base md:text-sm ${validationErrors.phone ? 'border-red-500' : 'border-neutral-200'}`}
                      />
                      {validationErrors.phone && (
                        <p className="text-xs text-red-500 mt-1">{validationErrors.phone}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Adresa Livrare */}
                <div className="bg-white p-4 rounded-lg shadow-sm space-y-3">
                  <h3 className="font-bold text-sm uppercase text-neutral-500 flex items-center gap-2">
                    Adresa Livrare
                  </h3>
                  
                  {/* ⭐ GOOGLE AUTOCOMPLETE SAU MANUAL */}
                  {isLoadingMaps ? (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
                      <div className="animate-spin inline-block w-6 h-6 border-[3px] border-current border-t-transparent text-blue-600 rounded-full mb-2" />
                      <p className="text-sm text-blue-700">Se încarcă Google Maps...</p>
                    </div>
                  ) : googleMapsReady ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-blue-600 font-bold ml-1 mb-1 block">
                          🔍 Caută Adresa (Stradă și Număr)
                        </label>
                        <gmpx-place-picker 
                          ref={pickerRef} 
                          placeholder="Ex: Strada Libertății 4, București" 
                          id="place-picker"
                          country="ro"
                          style={{ width: '100%' }}
                        />
                      </div>

                      {/* Date Extrase */}
                      {(formData.county || formData.city || formData.street_name) && (
                        <div className="grid grid-cols-2 gap-2 bg-gray-50 p-2 rounded border border-gray-100">
                            <div>
                                <label className="text-[10px] text-gray-400 block">Județ</label>
                                <div className="text-sm font-bold">{formData.county || '-'}</div>
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-400 block">Oraș</label>
                                <div className="text-sm font-bold">{formData.city || '-'}</div>
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-400 block">Stradă</label>
                                <div className="text-sm font-bold">{formData.street_name || '-'}</div>
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-400 block">Număr</label>
                                <div className="text-sm font-bold">{formData.street_number || '-'}</div>
                            </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {googleMapsError && (
                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <p className="text-sm text-yellow-700">⚠️ Google Maps nu s-a putut încărca. Completează manual:</p>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 gap-3">
                        <select
                          name="county"
                          value={formData.county}
                          onChange={handleInputChange}
                          className="w-full p-3 border border-neutral-200 rounded-lg focus:outline-none focus:border-black transition-colors"
                          required
                        >
                          <option value="">Județ *</option>
                          {ROMANIAN_COUNTIES.map(county => (
                            <option key={county} value={county}>{county}</option>
                          ))}
                        </select>

                        <input
                          name="city"
                          placeholder="Oraș *"
                          value={formData.city}
                          onChange={handleInputChange}
                          className="w-full p-3 border border-neutral-200 rounded-lg focus:outline-none focus:border-black transition-colors"
                          required
                        />
                      </div>

                      <input
                        name="street_name"
                        placeholder="Nume Stradă *"
                        value={formData.street_name}
                        onChange={handleInputChange}
                        className="w-full p-3 border border-neutral-200 rounded-lg focus:outline-none focus:border-black transition-colors"
                        required
                      />
                      
                      <input
                        name="street_number"
                        placeholder="Număr *"
                        value={formData.street_number}
                        onChange={handleInputChange}
                        className="w-full p-3 border border-neutral-200 rounded-lg focus:outline-none focus:border-black transition-colors"
                        required
                      />
                    </div>
                  )}

                  {/* Detalii Manuale */}
                  <div>
                    <label className="text-xs text-neutral-400 ml-1 mb-1 block">Detalii Suplimentare (Bl, Sc, Ap):</label>
                    <input
                      name="details"
                      placeholder="Bloc, Scara, Etaj, Ap, Interfon..."
                      value={formData.details}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData(prev => ({
                          ...prev,
                          details: val,
                          address: `${prev.street_name} Nr. ${prev.street_number}, ${val}`
                        }));
                      }}
                      className="w-full p-3 border border-neutral-200 rounded-lg focus:outline-none focus:border-black transition-colors"
                    />
                  </div>

                  {/* COD POȘTAL */}
                  <div>
                    <input
                      required={shippingMethod === 'courier'}
                      name="postalCode"
                      placeholder={`Cod Poștal ${shippingMethod === 'courier' ? '*' : '(opțional)'}`}
                      value={formData.postalCode}
                      onChange={handleInputChange}
                      maxLength={6}
                      className={`w-full p-3 border rounded-lg focus:outline-none focus:border-black transition-colors text-base md:text-sm ${validationErrors.postalCode ? 'border-red-500' : 'border-neutral-200'}`}
                    />
                    {validationErrors.postalCode && (
                      <p className="text-xs text-red-500 mt-1">{validationErrors.postalCode}</p>
                    )}
                    <p className="text-xs text-neutral-400 mt-1">
                      {shippingMethod === 'courier'
                        ? 'Obligatoriu pentru livrare curier (6 cifre)'
                        : 'Opțional pentru EasyBox, necesar pentru factură'}
                    </p>
                  </div>
                </div>

                {shippingMethod === 'easybox' && (
                  <div className="bg-white p-4 rounded-lg shadow-sm space-y-3">
                    <h3 className="font-bold text-sm uppercase text-neutral-500 flex items-center gap-2">
                      📦 Selectează EasyBox
                    </h3>

                    <div id="ecolet-locker-widget" className="border border-neutral-200 rounded-lg p-4 min-h-[200px]">
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
                  <h3 className="font-bold text-sm uppercase text-neutral-500 flex items-center gap-2">
                    Metoda Plată
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
                      <div className="p-2 bg-white rounded-full border border-neutral-100 shadow-sm shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="1" x2="12" y2="23" />
                          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                        </svg>
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
                Continuă spre Checkout
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
                  ? 'Se procesează...'
                  : paymentMethod === 'ramburs'
                    ? `Trimite Comanda (${finalTotal.toFixed(2)} RON)`
                    : `Plătește cu Cardul (${finalTotal.toFixed(2)} RON)`}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ⭐ STILURI */}
      <style>{`
        .pac-container { 
          z-index: 99999 !important; 
        }
        gmpx-place-picker {
          display: block;
          width: 100%;
        }
        gmpx-place-picker input {
          padding: 0.75rem !important;
          border-radius: 0.5rem !important;
          border: 1px solid #e5e5e5 !important;
          width: 100% !important;
          font-size: 0.875rem !important;
          box-sizing: border-box !important;
        }
        gmpx-place-picker input:focus {
          outline: none !important;
          border-color: black !important;
        }
      `}</style>
    </>
  );
};
