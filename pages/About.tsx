import React, { useEffect, useRef } from 'react';
import Aurora from '../components/Aurora'; // Ajustează calea dacă e nevoie

export const About: React.FC = () => {
  // Simplu hook pentru reveal la scroll (același mecanism ca în Home)
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observerRef.current?.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: "50px" });

    const elements = document.querySelectorAll('.reveal-on-scroll');
    elements.forEach((el) => observerRef.current?.observe(el));

    return () => observerRef.current?.disconnect();
  }, []);

  return (
    <main className="bg-white min-h-screen overflow-hidden">
      
      {/* ================= HERO / MANIFESTO SECTION ================= */}
      {/* Folosim Aurora ca fundal dinamic pentru titlu */}
      <section className="relative h-[80vh] flex flex-col justify-center px-6 md:px-12 border-b border-neutral-100">
        
        {/* Background Animation - Culori brand (Gold, White, Pale Yellow) */}
        <div className="absolute inset-0 z-0">
             <Aurora 
                colorStops={["#FFFFFF", "#FACC15", "#FEF08A"]} 
                blend={0.7} 
                amplitude={1.2} 
                speed={0.5} 
             />
             {/* Un gradient alb de jos în sus pentru a face trecerea fină spre conținut */}
             <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent"></div>
        </div>

        <div className="relative z-10 max-w-[1920px] mx-auto w-full pt-20">
            <span className="text-neutral-500 font-bold uppercase tracking-[0.3em] text-xs md:text-sm block mb-6 animate-slide-up">
               Manifestul Oclar
            </span>
            
            <h1 className="text-[15vw] md:text-[10rem] leading-[0.8] font-black uppercase tracking-tighter text-neutral-950 animate-slide-up-delay drop-shadow-sm mix-blend-multiply">
              Viziune <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-yellow to-neutral-400">
                Clară.
              </span>
            </h1>
        </div>
      </section>

      {/* ================= STORY SECTION ================= */}
      <section className="py-24 px-6 md:px-12 max-w-[1920px] mx-auto">
         <div className="grid grid-cols-1 md:grid-cols-12 gap-12 md:gap-24">
            
            {/* Coloana Stânga - "The Hook" */}
            <div className="md:col-span-5 reveal-on-scroll">
               <h3 className="text-3xl md:text-5xl font-bold uppercase tracking-tight leading-tight mb-8">
                  Tehnologia nu trebuie să ne consume <br/>
                  <span className="text-brand-yellow">Sănătatea.</span>
               </h3>
               <div className="w-24 h-2 bg-neutral-950"></div>
            </div>

            {/* Coloana Dreapta - Povestea */}
            <div className="md:col-span-7 space-y-8 text-lg md:text-xl leading-relaxed text-neutral-600 font-light reveal-on-scroll" style={{transitionDelay: '100ms'}}>
               <p>
                 <strong className="text-black font-bold uppercase tracking-wide">OCLAR</strong> a luat naștere dintr-o nevoie personală după, observând efectele ecranelor asupra propriilor mei ochi. Într-o lume dominată de ecrane, ochii noștri sunt sub asediu constant. 
               </p>
               <p>
                 Lumina albastră artificială este inamicul invizibil al productivității. Durerile de cap, ochii uscați și insomniile au devenit "normalul" toxic al vieții moderne. Noi refuzăm să acceptăm acest lucru.
               </p>
               <p className="text-black font-medium">
                 Misiunea noastră este simplă: să oferim o barieră invizibilă, dar elegantă, între retina ta și lumea digitală. Fără compromisuri la stil.
               </p>
            </div>
         </div>
      </section>

      {/* ================= VALUES GRID ================= */}
      <section className="py-24 bg-neutral-950 text-white relative px-6 md:px-12">
        {/* Accent galben lateral */}
        <div className="absolute top-0 right-12 w-1 h-32 bg-brand-yellow shadow-[0_0_20px_#FACC15]"></div>

        <div className="max-w-[1920px] mx-auto">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-neutral-800 border border-neutral-800">
              
              {/* Value 01 */}
              <div className="bg-neutral-950 p-12 group hover:bg-neutral-900 transition-colors duration-500 reveal-on-scroll">
                 <span className="text-6xl font-black text-neutral-800 group-hover:text-brand-yellow transition-colors duration-300">01.</span>
                 <h4 className="text-2xl font-bold uppercase tracking-widest mt-6 mb-4">Prevenție</h4>
                 <p className="text-neutral-400">
                   Nu vindecăm, ci protejăm. Ochelarii noștri opresc daunele înainte ca acestea să devină permanente.
                 </p>
              </div>

              {/* Value 02 */}
              <div className="bg-neutral-950 p-12 group hover:bg-neutral-900 transition-colors duration-500 reveal-on-scroll" style={{transitionDelay: '100ms'}}>
                 <span className="text-6xl font-black text-neutral-800 group-hover:text-brand-yellow transition-colors duration-300">02.</span>
                 <h4 className="text-2xl font-bold uppercase tracking-widest mt-6 mb-4">Focus</h4>
                 <p className="text-neutral-400">
                   Eliminarea strălucirii ecranelor (glare) reduce efortul cognitiv. Lucrezi mai mult, obosești mai puțin.
                 </p>
              </div>

              {/* Value 03 */}
              <div className="bg-neutral-950 p-12 group hover:bg-neutral-900 transition-colors duration-500 reveal-on-scroll" style={{transitionDelay: '200ms'}}>
                 <span className="text-6xl font-black text-neutral-800 group-hover:text-brand-yellow transition-colors duration-300">03.</span>
                 <h4 className="text-2xl font-bold uppercase tracking-widest mt-6 mb-4">Estetică</h4>
                 <p className="text-neutral-400">
                   Ochelarii de protecție nu trebuie să arate ca echipament medical. Designul nostru este făcut pentru stradă.
                 </p>
              </div>
           </div>
        </div>
      </section>

      {/* ================= LOCATION / IMAGE ================= */}
      <section className="h-[60vh] md:h-[80vh] relative overflow-hidden group">
         <img 
            src="https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=2000" 
            alt="Office vibe" 
            className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-1000 scale-100 group-hover:scale-105"
         />
         <div className="absolute inset-0 bg-black/30 group-hover:bg-transparent transition-colors duration-700"></div>
         
         <div className="absolute bottom-12 left-6 md:left-12 text-white">
            <span className="border border-white/40 bg-black/20 backdrop-blur-md px-4 py-2 font-mono text-xs uppercase tracking-widest">
               Designed in Bucharest, RO
            </span>
         </div>
      </section>

    </main>
  );
};