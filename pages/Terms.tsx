import React from 'react';

export const Terms: React.FC = () => {
  return (
    <main className="pt-24 pb-24 px-6 md:px-12 max-w-3xl mx-auto animate-fade-in">
      <h1 className="text-4xl font-black uppercase tracking-tighter mb-2">Termeni și Condiții</h1>
      <p className="text-neutral-400 text-sm font-mono mb-12">Ultima actualizare: 6 Februarie 2026</p>

      <div className="space-y-12 text-neutral-700">
        <section>
          <h2 className="text-lg font-bold uppercase tracking-wide mb-4 border-b border-neutral-200 pb-2">1. Identitate Comerciant</h2>
          <p className="leading-relaxed">
            Site-ul <strong>www.oclar.ro</strong> este un serviciu comercial operat de:
            <br /><br />
            <strong>Societatea:</strong> ALTMAR GROUP S.R.L.<br />
            <strong>CUI:</strong> 53181323<br />
            <strong>Nr. Reg. Com:</strong> J2025100368001<br />
            <strong>Sediu Social:</strong> Intrarea Leordeni, Bragadiru, Ilfov.
            <br /><br />
            În cuprinsul acestui document, termenii "noi", "nostru", "Oclar" se referă la societatea ALTMAR GROUP S.R.L.
          </p>
        </section>

        {/* ... Restul sectiunilor raman la fel, doar sectiunea 1 se schimba ... */}
        
        <section>
          <h2 className="text-lg font-bold uppercase tracking-wide mb-4 border-b border-neutral-200 pb-2">2. Produse și Disponibilitate</h2>
          <p className="leading-relaxed mb-4">
            Facem eforturi constante pentru a prezenta cu acuratețe culorile, specificațiile și descrierile produselor. Totuși, nu garantăm că descrierile sunt complet lipsite de erori.
          </p>
        </section>
        
        {/* Poti pastra restul codului original pentru sectiunile 3, 4, 5 */}
        <section>
          <h2 className="text-lg font-bold uppercase tracking-wide mb-4 border-b border-neutral-200 pb-2">3. Plăți și Securitate</h2>
          <p className="leading-relaxed">
             Folosim procesatorul de plăți Stripe. Prețurile sunt afișate în RON și includ TVA.
          </p>
        </section>
        
         <section>
          <h2 className="text-lg font-bold uppercase tracking-wide mb-4 border-b border-neutral-200 pb-2">4. Livrare</h2>
          <p className="leading-relaxed">
            Comenzile sunt procesate în 24-48 de ore. Livrarea pe teritoriul României se face prin curier rapid.
          </p>
        </section>

         <section>
          <h2 className="text-lg font-bold uppercase tracking-wide mb-4 border-b border-neutral-200 pb-2">5. Retururi</h2>
          <p className="leading-relaxed">
            Conform OUG 34/2014, beneficiați de o perioadă de 14 zile calendaristice pentru a vă retrage din contract (retur), fără a fi nevoit să justificați decizia. Oclar extinde această perioadă la 30 de zile.
          </p>
        </section>
      </div>
    </main>
  );
};