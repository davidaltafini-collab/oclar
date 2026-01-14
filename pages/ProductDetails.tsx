import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Product } from '../types';
import { Button } from '../components/Button';
import { useCart } from '../context/CartContext';
import { API_URL, MOCK_PRODUCTS } from '../constants';

export const ProductDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const { addToCart } = useCart();
  
  // Ref for observer
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/products/${id}`);
        if (!res.ok) throw new Error('Product not found');
        const data = await res.json();
        setProduct(data);
        if (data.colors && data.colors.length > 0) {
            setSelectedColor(data.colors[0]);
        }
      } catch (error) {
        // Fallback to mock data
        const found = MOCK_PRODUCTS.find(p => p.id === Number(id));
        setProduct(found || null);
        if (found?.colors && found.colors.length > 0) {
            setSelectedColor(found.colors[0]);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  // Scroll Animations Logic
  useEffect(() => {
     if (loading) return;
     observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
        }
      });
    }, { threshold: 0.1 });

    const elements = document.querySelectorAll('.reveal-on-scroll');
    elements.forEach((el) => observerRef.current?.observe(el));
    return () => observerRef.current?.disconnect();
  }, [loading, product]);


  if (loading) return (
    <div className="min-h-screen pt-20 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-brand-yellow border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!product) return (
    <div className="min-h-screen pt-20 flex flex-col items-center justify-center text-center px-4">
      <h2 className="text-2xl font-bold uppercase mb-4">Produsul nu a fost găsit</h2>
      <Button onClick={() => navigate('/')}>Înapoi la Magazin</Button>
    </div>
  );

  return (
    <div className="pt-20 pb-24 animate-fade-in bg-white min-h-screen">
       {/* Breadcrumbs */}
       <div className="px-6 md:px-12 py-4 border-b border-neutral-100 text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-8 sticky top-16 bg-white/90 backdrop-blur z-20">
         <span className="cursor-pointer hover:text-black transition-colors" onClick={() => navigate('/')}>Acasă</span> 
         <span className="mx-2">/</span> 
         <span className="cursor-pointer hover:text-black transition-colors">{product.category}</span>
         <span className="mx-2">/</span>
         <span className="text-black">{product.name}</span>
       </div>

      {/* 
         LAYOUT FIX: 
         - On Mobile: Flex-col, image scrolls normally with page.
         - On Desktop (md+): Image is sticky so it follows as you read text.
      */}
      <div className="px-4 md:px-12 max-w-7xl mx-auto flex flex-col md:flex-row gap-12 lg:gap-24 items-start">
        
        {/* Image Section */}
        {/* Changed 'sticky top-24' to 'md:sticky md:top-24' so it doesn't get stuck on mobile */}
        <div className="w-full md:w-3/5 relative md:sticky md:top-24">
          <div className="bg-neutral-50 aspect-[4/5] overflow-hidden relative group rounded-3xl shadow-lg transition-all duration-700">
             {/* Glow effect behind image */}
            <div className="absolute inset-0 bg-brand-yellow/0 group-hover:bg-brand-yellow/5 transition-colors duration-500"></div>
            
            <img 
              src={product.imageUrl} 
              alt={product.name} 
              className="w-full h-full object-cover transition-transform duration-1000 ease-in-out cursor-zoom-in"
            />
            <div className="absolute top-4 left-4 bg-black text-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full">
              Lumina Supply
            </div>
            <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur px-3 py-1 text-xs font-mono border border-neutral-200 rounded-lg">
              OCLAR_MODEL_0{product.id}
            </div>
          </div>
        </div>

        {/* Details Section - Scrollable */}
        <div className="w-full md:w-2/5 flex flex-col gap-8 md:py-4 reveal-on-scroll">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <span className="bg-brand-yellow px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-black rounded-full shadow-[0_0_10px_rgba(250,204,21,0.4)]">În Stoc</span>
              <span className="text-neutral-500 text-[10px] font-bold uppercase tracking-widest">{product.category} Series</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter mb-4 leading-[0.9]">
              {product.name}
            </h1>
            <p className="text-3xl font-bold text-neutral-900 tracking-tight flex items-start gap-2">
              {product.price.toFixed(0)} <span className="text-sm mt-1">RON</span>
            </p>
          </div>

          <div className="w-full h-px bg-neutral-200"></div>

          {/* Color Selection */}
          {product.colors && product.colors.length > 0 && (
            <div className="reveal-on-scroll">
                <h3 className="text-xs font-bold uppercase text-neutral-900 tracking-widest mb-3">Alege Culoarea</h3>
                <div className="flex gap-4">
                    {product.colors.map((color) => (
                        <button 
                            key={color}
                            onClick={() => setSelectedColor(color)}
                            className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${selectedColor === color ? 'border-brand-yellow scale-110 shadow-[0_0_10px_rgba(250,204,21,0.5)]' : 'border-transparent hover:border-neutral-300'}`}
                        >
                            <div className="w-8 h-8 rounded-full border border-neutral-100" style={{backgroundColor: color}}></div>
                        </button>
                    ))}
                </div>
            </div>
          )}

          <div className="space-y-6 reveal-on-scroll" style={{transitionDelay: '100ms'}}>
             <h3 className="text-xs font-bold uppercase text-neutral-900 tracking-widest">Descriere</h3>
             <p className="text-neutral-600 leading-loose text-lg font-light">
              {product.description}
            </p>
          </div>

          <div className="bg-neutral-50 p-6 border border-neutral-100 rounded-2xl reveal-on-scroll" style={{transitionDelay: '200ms'}}>
            <h3 className="text-xs font-bold uppercase text-neutral-900 tracking-widest mb-6 flex items-center gap-2">
              <div className="w-2 h-2 bg-black rounded-full"></div>
              Specificații Tehnice
            </h3>
            <ul className="space-y-4">
              {product.details?.map((detail, index) => (
                <li key={index} className="flex items-center justify-between text-sm text-neutral-700 border-b border-neutral-200 pb-2 last:border-0">
                  <span>{detail.split(':')[0]}</span>
                  <span className="font-bold">{detail.split(':')[1] || 'Inclus'}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-4 mt-4 sticky bottom-8 md:static z-30 reveal-on-scroll" style={{transitionDelay: '300ms'}}>
            <Button fullWidth onClick={() => addToCart(product, selectedColor || undefined)} className="py-5 text-base">
              Adaugă în Coș — {product.price.toFixed(0)} RON
            </Button>
            <p className="text-center text-[10px] uppercase tracking-widest text-neutral-400">
              Livrare Gratuită în România • Retur 30 Zile
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
