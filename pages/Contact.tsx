import React from 'react';

export const Contact: React.FC = () => {
  return (
    <main className="pt-24 pb-24 px-4 md:px-8 max-w-5xl mx-auto animate-fade-in text-neutral-800">
      
      {/* HEADER */}
      <div className="mb-12 border-b border-neutral-200 pb-6">
        <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter mb-4 text-neutral-900">
          Contact
        </h1>
        <p className="text-neutral-500 font-mono text-xs">
          Suntem aici pentru tine.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        
        {/* COLOANA 1: DATE FIRMĂ (CRITIC PENTRU NETOPIA) */}
        <div className="space-y-8">
          <section>
            <h2 className="text-xl font-bold uppercase mb-4 text-brand-black border-l-4 border-brand-yellow pl-3">
              Date de Identificare
            </h2>
            <div className="bg-neutral-50 p-6 border border-neutral-200 rounded-sm text-sm space-y-3">
              <p><strong>Denumire Fiscală:</strong> SC ALTMAR GROUP S.R.L.</p>
              <p><strong>Cod Unic de Înregistrare (CUI):</strong> 53181323</p>
              <p><strong>Nr. Reg. Comerțului:</strong> J2025100368001</p>
              <p><strong>Sediul Social:</strong> Intrarea Leordeni, Bragadiru, Jud. Ilfov, România</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold uppercase mb-4 text-brand-black border-l-4 border-brand-yellow pl-3">
              Suport Clienți
            </h2>
            <div className="text-sm space-y-3 text-neutral-700">
              <p className="flex items-center gap-2">
                <span className="font-bold">Email:</span> 
                <a href="mailto:contact@oclar.ro" className="underline hover:text-brand-yellow transition-colors">contact@oclar.ro</a>
              </p>
              <p className="flex items-center gap-2">
                <span className="font-bold">Telefon:</span> 
                {/* INLOCUIESTE CU NUMARUL TAU REAL - OBLIGATORIU PT NETOPIA */}
                <a href="tel:+40700000000" className="underline hover:text-brand-yellow transition-colors">07xx xxx xxx</a>
              </p>
              <p className="flex items-center gap-2">
                <span className="font-bold">Program:</span> 
                <span>Luni - Vineri, 09:00 - 18:00</span>
              </p>
              <p className="text-xs text-neutral-500 mt-2">
                *Timpul mediu de răspuns la email: 24 ore lucrătoare.
              </p>
            </div>
          </section>
        </div>

        {/* COLOANA 2: FORMULAR SIMPLU */}
        <div className="bg-white p-6 border border-neutral-200 shadow-sm">
            <h3 className="font-bold text-lg mb-4 uppercase">Trimite-ne un mesaj</h3>
            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                <div>
                    <label className="block text-xs font-bold uppercase mb-1">Numele Tău</label>
                    <input type="text" className="w-full border border-neutral-300 p-2 text-sm focus:border-brand-yellow outline-none" placeholder="Ex: Popescu Ion" />
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase mb-1">Email</label>
                    <input type="email" className="w-full border border-neutral-300 p-2 text-sm focus:border-brand-yellow outline-none" placeholder="email@exemplu.ro" />
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase mb-1">Mesaj</label>
                    <textarea className="w-full border border-neutral-300 p-2 text-sm h-32 focus:border-brand-yellow outline-none" placeholder="Cu ce te putem ajuta?"></textarea>
                </div>
                <button className="w-full bg-neutral-900 text-white py-3 text-sm font-bold uppercase hover:bg-brand-yellow hover:text-black transition-all">
                    Trimite Mesaj
                </button>
            </form>
        </div>

      </div>
    </main>
  );
};