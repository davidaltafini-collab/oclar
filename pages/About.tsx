import React from 'react';

export const About: React.FC = () => {
  return (
    <main className="pt-24 pb-24 px-6 md:px-12 max-w-5xl mx-auto animate-fade-in">
      <header className="mb-20">
         <span className="text-brand-yellow font-bold uppercase tracking-[0.2em] text-xs block mb-4">
              Manifestul Nostru
         </span>
        <h1 className="text-5xl md:text-8xl font-black uppercase tracking-tighter mb-8 leading-[0.9]">
          Oclar<br/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-yellow to-yellow-600">Total.</span>
        </h1>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-24">
        <div className="space-y-8 text-lg leading-relaxed text-neutral-600 font-light">
          <p>
            <strong className="text-black font-bold uppercase tracking-wide">OCLAR</strong> a luat naștere dintr-o nevoie personală. Într-o lume dominată de ecrane, ochii noștri sunt constant sub asediu. Am început în 2023 cu o întrebare simplă: cum putem proteja vederea fără a sacrifica stilul?
          </p>
          <p>
            Lumina albastră artificială este inamicul invizibil al productivității. Durerile de cap, ochii uscați și insomniile nu ar trebui să fie "normalul" vieții de birou.
          </p>
          <p>
            Misiunea noastră este să oferim o barieră elegantă între tine și lumea digitală. Credem că tehnologia trebuie să ne servească, nu să ne consume sănătatea.
          </p>
        </div>

        <div className="flex flex-col gap-8">
           <div className="bg-neutral-50 p-10 border-l-4 border-brand-yellow shadow-lg">
             <h3 className="text-xl font-bold uppercase tracking-tight mb-6">Valorile Noastre</h3>
             <ul className="space-y-6">
               <li className="flex gap-4 items-start">
                 <span className="font-mono text-brand-yellow text-xl">01</span>
                 <div>
                    <strong className="block uppercase text-xs tracking-widest mb-1">Prevenție</strong>
                    <p className="text-sm text-neutral-500">Protejăm ochii înainte ca problemele să apară.</p>
                 </div>
               </li>
               <li className="flex gap-4 items-start">
                 <span className="font-mono text-brand-yellow text-xl">02</span>
                  <div>
                    <strong className="block uppercase text-xs tracking-widest mb-1">Odihnă</strong>
                    <p className="text-sm text-neutral-500">Somnul este fundamentul performanței. Îl apărăm cu orice preț.</p>
                 </div>
               </li>
               <li className="flex gap-4 items-start">
                 <span className="font-mono text-brand-yellow text-xl">03</span>
                  <div>
                    <strong className="block uppercase text-xs tracking-widest mb-1">Claritate</strong>
                    <p className="text-sm text-neutral-500">Vederea clară duce la o minte clară.</p>
                 </div>
               </li>
             </ul>
           </div>
           
           <div className="aspect-video bg-neutral-900 flex items-center justify-center text-white overflow-hidden relative group">
             <img src="https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=1000" className="opacity-50 group-hover:opacity-80 transition-opacity duration-500 w-full h-full object-cover" />
             <span className="absolute font-mono text-xs uppercase tracking-widest border border-white px-4 py-2 z-10">București, RO</span>
           </div>
        </div>
      </div>
    </main>
  );
};