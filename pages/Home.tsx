import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Product } from '../types';
import { Button } from '../components/Button';
import { useCart } from '../context/CartContext';
import { API_URL, MOCK_PRODUCTS } from '../constants';
import { Oclar3D } from '../components/Oclar3D';

// Helper simplu pentru conversie preț
const toNumber = (value: any) => {
  const num = parseFloat(value);
  return isNaN(num) ? 0 : num;
};

export const Home: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToCart } = useCart();
    
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch(`${API_URL}/products`);
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setProducts(data);
      } catch (error) {
        console.warn('Using mock data:', error);
        setProducts(MOCK_PRODUCTS);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  // OPTIMIZARE SCROLL ANIMATIONS
  useEffect(() => {
    if (loading) return;

    const timeoutId = setTimeout(() => {
      observerRef.current = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observerRef.current?.unobserve(entry.target);
          }
        });
      }, { 
        threshold: 0.1,
        rootMargin: "50px"
      });

      const elements = document.querySelectorAll('.reveal-on-scroll');
      elements.forEach((el) => observerRef.current?.observe(el));
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      observerRef.current?.disconnect();
    };
  }, [loading, products]);

  return (
    <main className="bg-white overflow-hidden">
      {/* ================= HERO SECTION ================= */}
      <section className="relative min-h-screen border-b border-neutral-100 bg-white overflow-hidden">
        
        {/* ---------------- DESKTOP LAYOUT (>768px) ---------------- */}
        <div className="hidden md:flex w-full h-screen items-center relative max-w-[1920px] mx-auto px-12">
          {/* COLOANA TEXT DESKTOP */}
          <div className="w-[55%] relative z-20 pt-10 pointer-events-none">
            <div className="overflow-hidden mb-6 pointer-events-auto">
               <span className="text-brand-yellow font-bold uppercase tracking-[0.2em] text-xs md:text-sm block animate-slide-up">
                 Eyewear for the Digital Age
               </span>
            </div>
            
            <h1 className="text-[6rem] lg:text-[8rem] xl:text-[10rem] font-black uppercase tracking-tighter mb-8 leading-[0.85] text-neutral-950 animate-slide-up-delay drop-shadow-xl pointer-events-auto select-none">
              Vezi <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-neutral-800 to-neutral-500 hover:text-brand-yellow transition-colors duration-700 cursor-default">
                Până la
              </span> <br/>
              Capăt.
            </h1>
            
            <p className="text-neutral-500 max-w-lg text-lg md:text-xl leading-relaxed mb-12 animate-fade-in opacity-0 pointer-events-auto" style={{animationDelay: '0.6s', animationFillMode: 'forwards'}}>
              Ochelari premium anti-lumină albastră. O soluție simplă pentru o problemă modernă.
            </p>
            
            <div className="flex gap-6 animate-fade-in opacity-0 pointer-events-auto" style={{animationDelay: '0.8s', animationFillMode: 'forwards'}}>
               <Button onClick={() => document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth' })}>
                 Vezi Toată Colecția
               </Button>
               <Link to="/about">
                 <Button variant="outline">Misiunea Noastră</Button>
               </Link>
            </div>
          </div>

          {/* COLOANA 3D DESKTOP */}
          <div className="absolute right-0 top-0 w-[55%] h-full z-10 flex items-center justify-center">
             <div className="absolute w-[600px] h-[600px] bg-brand-yellow/20 rounded-full blur-[100px] pointer-events-none animate-pulse-glow"></div>
             <Oclar3D
               autoRotate
               intensity={0.4}
               autoRotateSpeed={0.003}
               dragSensitivity={0.008}
               className="w-full h-full"
             />
          </div>
        </div>

        {/* ---------------- MOBILE LAYOUT (<768px) - FIXED STRUCTURE ---------------- */}
        <div className="md:hidden relative w-full h-[100svh] overflow-hidden bg-white">
           
           {/* 1. 3D MODEL - BACKGROUND LAYER (Dar interactiv) */}
           {/* Îl punem pe tot ecranul ca să fie MARE */}
           <div className="absolute inset-0 z-10">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-brand-yellow/20 rounded-full blur-[80px] pointer-events-none"></div>
              <Oclar3D
                autoRotate
                intensity={0.5}
                autoRotateSpeed={0.004}
                dragSensitivity={0.02}
                className="w-full h-full"
              />
           </div>

           {/* 2. TITLU - ANCORAT SUS (FIXED VISUAL) */}
           <div className="absolute top-0 left-0 w-full z-20 px-5 pt-24 pointer-events-none">
              <span className="text-brand-yellow font-bold uppercase tracking-[0.2em] text-[10px] block mb-2 animate-slide-up">
                  Eyewear for the Digital Age
              </span>
              <h1 className="text-[5rem] leading-[0.85] font-black uppercase tracking-tighter text-neutral-950 animate-slide-up-delay drop-shadow-lg">
                Totul <br/>
                <span className="text-neutral-400">
                  Pentru
                </span> <br/>
                Ochii Tăi.
              </h1>
           </div>

           {/* 3. BUTOANE - ANCORATE JOS (FIXED VISUAL) */}
           <div className="absolute bottom-0 left-0 w-full z-30 px-5 pb-8 pt-12 bg-gradient-to-t from-white via-white/90 to-transparent">
              <p className="text-neutral-600 text-sm font-medium mb-5 text-center leading-tight">
                  Ochelari premium anti-lumină albastră.
              </p>
              
              <div className="flex flex-col gap-3">
                 <Button fullWidth onClick={() => document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth' })}>
                   Vezi Colecția
                 </Button>
                 <Link to="/about">
                   <Button fullWidth variant="outline" className="bg-white/80 backdrop-blur-md">Misiunea Noastră</Button>
                 </Link>
              </div>
           </div>
        </div>
      </section>

      {/* ================= CORE VALUES ================= */}
      <section className="py-32 px-6 md:px-12 bg-neutral-950 text-white relative">
        <div className="absolute top-0 left-12 w-1 h-24 bg-brand-yellow shadow-[0_0_15px_#FACC15]"></div>
        
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter mb-20 text-center md:text-left reveal-on-scroll">
            Esența Noastră
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-24">
             {/* ... Value items (păstrate la fel) ... */}
            <div className="group reveal-on-scroll">
              <span className="text-6xl font-black text-neutral-800 group-hover:text-brand-yellow transition-colors duration-500">01.</span>
              <h3 className="text-xl font-bold uppercase tracking-wide mt-4 mb-2">Protecție Preventivă</h3>
              <p className="text-neutral-400 leading-relaxed">
                Nu aștepta simptomele. Ochelarii noștri formează un scut invizibil între retină și radiațiile nocive.
              </p>
            </div>
            <div className="group reveal-on-scroll" style={{transitionDelay: '100ms'}}>
              <span className="text-6xl font-black text-neutral-800 group-hover:text-brand-yellow transition-colors duration-500">02.</span>
              <h3 className="text-xl font-bold uppercase tracking-wide mt-4 mb-2">Calitatea Vieții</h3>
              <p className="text-neutral-400 leading-relaxed">
                Mai mult decât protecție oculară. Prin blocarea luminii albastre seara, stimulăm melatonina.
              </p>
            </div>
            <div className="group reveal-on-scroll" style={{transitionDelay: '200ms'}}>
              <span className="text-6xl font-black text-neutral-800 group-hover:text-brand-yellow transition-colors duration-500">03.</span>
              <h3 className="text-xl font-bold uppercase tracking-wide mt-4 mb-2">Simplitate Radicală</h3>
              <p className="text-neutral-400 leading-relaxed">
                O soluție simplă pentru o problemă complexă. Fără software, fără setări complicate.
              </p>
            </div>
             <div className="group reveal-on-scroll" style={{transitionDelay: '300ms'}}>
              <span className="text-6xl font-black text-neutral-800 group-hover:text-brand-yellow transition-colors duration-500">04.</span>
              <h3 className="text-xl font-bold uppercase tracking-wide mt-4 mb-2">Accesibil & Premium</h3>
              <p className="text-neutral-400 leading-relaxed">
                Design de lux, materiale durabile (acetat, titan), la un preț care respectă munca ta.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= SHOP SECTION ================= */}
      <section id="shop" className="py-32 px-4 md:px-12 max-w-screen-2xl mx-auto bg-white min-h-[600px]">
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 border-b-2 border-black pb-6 reveal-on-scroll">
          <h3 className="text-5xl font-black uppercase tracking-tighter">Colecția</h3>
          {!loading && <span className="text-sm font-bold uppercase tracking-widest mt-4 md:mt-0">{products.length} Modele Disponibile</span>}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
             <div className="w-12 h-12 border-4 border-neutral-200 border-t-brand-yellow rounded-full animate-spin mb-4"></div>
             <p className="text-xs uppercase font-bold tracking-widest text-neutral-400">Se încarcă colecția...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-20">
            {products.map((product, index) => {
              // CALCUL PREȚURI
              const price = toNumber(product.price);
              const original = toNumber(product.original_price); // Asigură-te că API-ul returnează acest field
              const hasDiscount = original > price;

              return (
                <div key={product.id} className="group flex flex-col cursor-pointer reveal-on-scroll" style={{transitionDelay: `${index * 50}ms`}}> 
                  
                  <Link to={`/product/${product.id}`} className="block relative overflow-hidden bg-neutral-100 mb-8 aspect-[4/5] isolate rounded-2xl shadow-sm hover:shadow-2xl hover:shadow-brand-yellow/20 transition-all duration-500">
                    <div className="w-full h-full overflow-hidden">
                        <img 
                        src={product.imageUrl} 
                        alt={product.name}
                        className="w-full h-full object-cover object-center grayscale group-hover:grayscale-0 scale-100 group-hover:scale-110 transition-transform duration-700 ease-in-out will-change-transform"
                        loading="lazy"
                      />
                    </div>
                    
                    {/* Badge Reducere (Opțional) */}
                    {hasDiscount && (
                       <div className="absolute top-4 left-4 bg-red-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest z-10">
                         Sale
                       </div>
                    )}
                    
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                      <span className="bg-gray-100/30 text-black px-6 py-3 font-bold uppercase tracking-wider text-sm border border-black rounded-full transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 shadow-xl">
                        Vezi Detalii
                      </span>
                    </div>
                  </Link>
                  
                  <div className="flex flex-col gap-2 px-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-[0.15em] mb-1 block">{product.category}</span>
                        <Link to={`/product/${product.id}`}>
                          <h2 className="text-2xl font-black uppercase tracking-tight group-hover:text-brand-yellow transition-colors duration-200 leading-none">
                            {product.name}
                          </h2>
                        </Link>
                      </div>
                      
                      {/* PREȚ CU REDUCERE */}
                      <div className="flex flex-col items-end">
                        {hasDiscount && (
                           <span className="text-sm text-neutral-400 line-through decoration-1 font-medium">
                             {original.toFixed(0)} RON
                           </span>
                        )}
                        <span className={`font-bold text-lg ${hasDiscount ? 'text-red-600' : 'text-black'}`}>
                          {price.toFixed(0)} RON
                        </span>
                      </div>
                    </div>

                    <p className="text-sm text-neutral-500 line-clamp-2 leading-relaxed">{product.description}</p>
                    
                    {product.colors && (
                      <div className="flex gap-2 mt-2">
                        {product.colors.map((c, i) => (
                          <div key={i} className="w-3 h-3 rounded-full border border-neutral-200" style={{backgroundColor: c}}></div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <button 
                    onClick={() => addToCart(product)}
                    className="mt-6 py-3 border border-neutral-200 hover:border-black hover:bg-black hover:text-white uppercase font-bold text-xs tracking-widest transition-colors duration-300 w-full rounded-xl self-start px-8"
                  >
                    Adaugă în Coș
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Impact Section */}
      <section className="py-24 px-6 md:px-12 bg-neutral-50 border-t border-neutral-200">
         <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-16 reveal-on-scroll">
            <div className="w-full md:w-1/2">
               <h3 className="text-4xl font-black uppercase tracking-tighter mb-6">Investiție în tine.</h3>
               <p className="text-lg text-neutral-600 mb-8 leading-relaxed">
                 Expunerea prelungită la lumina albastră suprimă melatonina și provoacă oboseală digitală. Ochelarii Oclarnu sunt doar un accesoriu, ci o unealtă de productivitate și sănătate.
               </p>
            </div>
            <div className="w-full md:w-1/2 aspect-video bg-neutral-200 relative overflow-hidden group rounded-3xl shadow-2xl">
               <img src="https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&q=80&w=1000" alt="OclarLifestyle" className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-1000" />
            </div>
         </div>
      </section>
    </main>
  );
};