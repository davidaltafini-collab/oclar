import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Product } from '../types';
import { Button } from '../components/Button';
import { useCart } from '../context/CartContext';
import { API_URL, MOCK_PRODUCTS } from '../constants';
import { Oclar3D } from '../components/Oclar3D';

export const Home: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToCart } = useCart();

  const observerRef = useRef<IntersectionObserver | null>(null);

  const toNumber = (v: unknown): number => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    if (typeof v === 'string') {
      const n = Number(v.replace(',', '.'));
      return Number.isFinite(n) ? n : 0;
    }
    return 0;
  };

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

  useEffect(() => {
    if (loading) return;

    const timeoutId = setTimeout(() => {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              observerRef.current?.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.1, rootMargin: '50px' }
      );

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
      {/* HERO - Text MARE pe mobil, yellow glow în spate model pe PC */}
      <section className="relative min-h-screen flex flex-col justify-center bg-white pb-20 md:pb-24 overflow-hidden border-b border-neutral-100">
        {/* Background effects - Yellow glow for contrast */}
        <div className="absolute top-1/2 right-1/4 w-[1000px] h-[1000px] bg-brand-yellow/15 rounded-full blur-[150px] pointer-events-none animate-pulse-glow hidden md:block" />
        
        {/* DESKTOP LAYOUT - Asimetric */}
        <div className="hidden md:flex w-full h-screen items-center">
          {/* TEXT COLUMN - 30% stânga */}
          <div className="w-[30%] pl-12 pr-8 relative z-20">
            <div className="overflow-hidden mb-4">
              <span className="text-brand-yellow font-bold uppercase tracking-[0.2em] text-xs block animate-slide-up">
                Eyewear for the Digital Age
              </span>
            </div>

            <h1 className="text-7xl lg:text-8xl font-black uppercase tracking-tighter mb-6 leading-[0.85] text-neutral-950 animate-slide-up-delay">
              Vezi <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-neutral-800 to-neutral-500">
                Până
              </span>{' '}
              <br />
              la <br />
              Capăt.
            </h1>

            <p
              className="text-neutral-500 text-base leading-relaxed mb-6 animate-fade-in opacity-0"
              style={{ animationDelay: '0.6s', animationFillMode: 'forwards' }}
            >
              Ochelari premium anti-lumină albastră. O soluție simplă pentru o problemă modernă.
            </p>

            {/* Buttons - YELLOW primary, white outline secondary */}
            <div
              className="flex flex-col gap-3 animate-fade-in opacity-0"
              style={{ animationDelay: '0.8s', animationFillMode: 'forwards' }}
            >
              <button
                onClick={() => document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth' })}
                className="group relative px-6 py-3 bg-brand-yellow text-black font-bold uppercase text-xs tracking-widest overflow-hidden transition-all duration-300 hover:bg-yellow-400 hover:shadow-lg hover:shadow-brand-yellow/50 rounded-lg"
              >
                <span className="relative z-10">Vezi Toată Colecția</span>
              </button>
              
              <Link to="/about">
                <button className="w-full px-6 py-3 bg-white text-black font-bold uppercase text-xs tracking-widest border-2 border-black transition-all duration-300 hover:border-brand-yellow hover:text-brand-yellow rounded-lg">
                  Misiunea Noastră
                </button>
              </Link>
            </div>
          </div>

          {/* 3D MODEL - 70% dreapta, URIAȘ cu yellow glow în spate */}
          <div className="w-[70%] h-full relative">
            <Oclar3D
              autoRotate
              intensity={0.2}
              autoRotateSpeed={0.004}
              dragSensitivity={0.006}
              className="w-full h-full"
            />
          </div>
        </div>

        {/* MOBILE LAYOUT - TEXT MULT MAI MARE */}
        <div className="md:hidden flex flex-col min-h-screen justify-center px-6 pt-20">
          {/* Text - 3X MAI MARE */}
          <div className="mb-6">
            <div className="overflow-hidden mb-3">
              <span className="text-brand-yellow font-bold uppercase tracking-[0.2em] text-sm block animate-slide-up">
                Eyewear for the Digital Age
              </span>
            </div>

            <h1 className="text-[15vw] sm:text-8xl font-black uppercase tracking-tighter mb-4 leading-[0.85] text-neutral-950 animate-slide-up-delay">
              Vezi <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-neutral-800 to-neutral-500">
                Până la
              </span>{' '}
              Capăt.
            </h1>
          </div>

          {/* 3D Model - Fixed height în pixeli */}
          <div className="w-full" style={{ height: '350px' }}>
            <Oclar3D
              autoRotate
              intensity={0.15}
              autoRotateSpeed={0.004}
              dragSensitivity={0.01}
              className="w-full h-full"
            />
          </div>

          {/* Paragraf + Butoane - mai sus, mai compacte */}
          <div className="mt-4">
            <p
              className="text-neutral-500 text-lg leading-relaxed mb-5 animate-fade-in opacity-0"
              style={{ animationDelay: '0.6s', animationFillMode: 'forwards' }}
            >
              Ochelari premium anti-lumină albastră. O soluție simplă pentru o problemă modernă.
            </p>

            <div
              className="flex flex-col gap-3 animate-fade-in opacity-0 pb-6"
              style={{ animationDelay: '0.8s', animationFillMode: 'forwards' }}
            >
              <button
                onClick={() => document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth' })}
                className="w-full px-6 py-3.5 bg-brand-yellow text-black font-bold uppercase text-xs tracking-widest rounded-lg active:scale-95 transition-transform shadow-md"
              >
                Vezi Toată Colecția
              </button>
              
              <Link to="/about" className="w-full">
                <button className="w-full px-6 py-3.5 bg-white text-black font-bold uppercase text-xs tracking-widest border-2 border-black rounded-lg active:scale-95 transition-transform">
                  Misiunea Noastră
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Core Values Section */}
      <section className="py-32 px-6 md:px-12 bg-neutral-950 text-white relative">
        <div className="absolute top-0 left-12 w-1 h-24 bg-brand-yellow shadow-[0_0_15px_#FACC15]" />

        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter mb-20 text-center md:text-left reveal-on-scroll">
            Esența Noastră
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-24">
            <div className="group reveal-on-scroll">
              <span className="text-6xl font-black text-neutral-800 group-hover:text-brand-yellow transition-colors duration-500">
                01.
              </span>
              <h3 className="text-xl font-bold uppercase tracking-wide mt-4 mb-2">Protecție Preventivă</h3>
              <p className="text-neutral-400 leading-relaxed">
                Nu aștepta simptomele. Ochelarii noștri formează un scut invizibil între retină și radiațiile nocive.
              </p>
            </div>

            <div className="group reveal-on-scroll" style={{ transitionDelay: '100ms' }}>
              <span className="text-6xl font-black text-neutral-800 group-hover:text-brand-yellow transition-colors duration-500">
                02.
              </span>
              <h3 className="text-xl font-bold uppercase tracking-wide mt-4 mb-2">Calitatea Vieții</h3>
              <p className="text-neutral-400 leading-relaxed">
                Mai mult decât protecție oculară. Prin blocarea luminii albastre seara, stimulăm melatonina.
              </p>
            </div>

            <div className="group reveal-on-scroll" style={{ transitionDelay: '200ms' }}>
              <span className="text-6xl font-black text-neutral-800 group-hover:text-brand-yellow transition-colors duration-500">
                03.
              </span>
              <h3 className="text-xl font-bold uppercase tracking-wide mt-4 mb-2">Simplitate Radicală</h3>
              <p className="text-neutral-400 leading-relaxed">
                O soluție simplă pentru o problemă complexă. Fără software, fără setări complicate.
              </p>
            </div>

            <div className="group reveal-on-scroll" style={{ transitionDelay: '300ms' }}>
              <span className="text-6xl font-black text-neutral-800 group-hover:text-brand-yellow transition-colors duration-500">
                04.
              </span>
              <h3 className="text-xl font-bold uppercase tracking-wide mt-4 mb-2">Accesibil & Premium</h3>
              <p className="text-neutral-400 leading-relaxed">
                Design de lux, materiale durabile (acetat, titan), la un preț care respectă munca ta.
              </p>
            </div>

            <div
              className="group md:col-span-2 lg:col-span-2 bg-neutral-900 p-8 border border-neutral-800 hover:border-brand-yellow transition-colors duration-500 rounded-3xl relative overflow-hidden reveal-on-scroll"
              style={{ transitionDelay: '400ms' }}
            >
              <div className="absolute inset-0 bg-brand-yellow/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <span className="text-sm font-bold text-brand-yellow uppercase tracking-widest mb-2 block relative z-10">
                Motto-ul Nostru
              </span>
              <h3 className="text-3xl md:text-5xl font-black uppercase tracking-tighter italic relative z-10">
                "Vezi până la capăt."
              </h3>
              <p className="text-neutral-500 mt-4 max-w-lg relative z-10">
                Fie că e vorba de un proiect important, un joc competitiv sau un maraton de filme. Rămâi OCLARat,
                rămâi protejat.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Product Grid */}
      <section id="shop" className="py-32 px-4 md:px-12 max-w-screen-2xl mx-auto bg-white min-h-[600px]">
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 border-b-2 border-black pb-6 reveal-on-scroll">
          <h3 className="text-5xl font-black uppercase tracking-tighter">Colecția</h3>
          {!loading && (
            <span className="text-sm font-bold uppercase tracking-widest mt-4 md:mt-0">
              {products.length} Modele Disponibile
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-neutral-200 border-t-brand-yellow rounded-full animate-spin mb-4" />
            <p className="text-xs uppercase font-bold tracking-widest text-neutral-400">Se încarcă colecția...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-20">
            {products.map((product, index) => {
              const price = toNumber(product.price);
              const original = toNumber((product as any).original_price);
              const hasDiscount = original > 0 && original > price;

              return (
                <div
                  key={product.id}
                  className="group flex flex-col cursor-pointer reveal-on-scroll"
                  style={{ transitionDelay: `${index * 50}ms` }}
                >
                  <Link
                    to={`/product/${product.id}`}
                    className="block relative overflow-hidden bg-neutral-100 mb-8 aspect-[4/5] isolate rounded-2xl shadow-sm hover:shadow-2xl hover:shadow-brand-yellow/20 transition-all duration-500"
                  >
                    <div className="w-full h-full overflow-hidden">
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover object-center grayscale group-hover:grayscale-0 scale-100 group-hover:scale-110 transition-transform duration-700 ease-in-out will-change-transform"
                        loading="lazy"
                      />
                    </div>

                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                      <span className="bg-gray-100/30 text-black px-6 py-3 font-bold uppercase tracking-wider text-sm border border-black rounded-full transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 shadow-xl">
                        Vezi Detalii
                      </span>
                    </div>
                  </Link>

                  <div className="flex flex-col gap-2 px-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-[0.15em] mb-1 block">
                          {product.category}
                        </span>
                        <Link to={`/product/${product.id}`}>
                          <h2 className="text-2xl font-black uppercase tracking-tight group-hover:text-brand-yellow transition-colors duration-200 leading-none">
                            {product.name}
                          </h2>
                        </Link>
                      </div>

                      <div className="text-right leading-none">
                        <div className="font-bold text-lg">{price.toFixed(0)} RON</div>
                        {hasDiscount && (
                          <div className="text-xs text-red-500 line-through font-mono mt-1">
                            {original.toFixed(0)} RON
                          </div>
                        )}
                      </div>
                    </div>

                    <p className="text-sm text-neutral-500 line-clamp-2 leading-relaxed">{product.description}</p>

                    {product.colors && (
                      <div className="flex gap-2 mt-2">
                        {product.colors.map((c, i) => (
                          <div
                            key={i}
                            className="w-3 h-3 rounded-full border border-neutral-200"
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => addToCart(product)}
                    className="mt-6 py-3 bg-brand-yellow text-black hover:bg-yellow-400 uppercase font-bold text-xs tracking-widest transition-all duration-300 w-full rounded-xl shadow-sm hover:shadow-md"
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
              Expunerea prelungită la lumina albastră suprimă melatonina și provoacă oboseală digitală. Ochelarii Oclar
              nu sunt doar un accesoriu, ci o unealtă de productivitate și sănătate.
            </p>
          </div>

          <div className="w-full md:w-1/2 aspect-video bg-neutral-200 relative overflow-hidden group rounded-3xl shadow-2xl">
            <img
              src="https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&q=80&w=1000"
              alt="OclarLifestyle"
              className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-1000"
            />
          </div>
        </div>
      </section>
    </main>
  );
};