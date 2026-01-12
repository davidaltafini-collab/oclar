import React from 'react';

export const Terms: React.FC = () => {
  return (
    <main className="pt-24 pb-24 px-6 md:px-12 max-w-3xl mx-auto animate-fade-in">
      <h1 className="text-4xl font-black uppercase tracking-tighter mb-2">Termeni și Condiții</h1>
      <p className="text-neutral-400 text-sm font-mono mb-12">Ultima actualizare: 24 Octombrie 2024</p>

      <div className="space-y-12 text-neutral-700">
        <section>
          <h2 className="text-lg font-bold uppercase tracking-wide mb-4 border-b border-neutral-200 pb-2">1. Introducere</h2>
          <p className="leading-relaxed">
            Bine ați venit la OclarEyewear. Prin accesarea site-ului nostru și achiziționarea produselor noastre, sunteți de acord să respectați acești Termeni și Condiții. Vă rugăm să îi citiți cu atenție.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold uppercase tracking-wide mb-4 border-b border-neutral-200 pb-2">2. Produse și Disponibilitate</h2>
          <p className="leading-relaxed mb-4">
            Facem eforturi constante pentru a prezenta cu acuratețe culorile, specificațiile și descrierile produselor. Totuși, nu garantăm că descrierile sunt complet lipsite de erori.
          </p>
          <p className="leading-relaxed">
            <strong>Stoc Limitat:</strong> Adăugarea unui produs în coș nu garantează rezervarea acestuia până la finalizarea comenzii.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold uppercase tracking-wide mb-4 border-b border-neutral-200 pb-2">3. Plăți și Securitate</h2>
          <p className="leading-relaxed">
            Folosim procesatorul de plăți Stripe pentru tranzacții securizate. Nu stocăm datele cardului dumneavoastră pe serverele noastre. Prețurile sunt afișate în RON și includ TVA.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold uppercase tracking-wide mb-4 border-b border-neutral-200 pb-2">4. Livrare</h2>
          <p className="leading-relaxed">
            Comenzile sunt procesate în 24-48 de ore. Livrarea pe teritoriul României se face prin curier rapid și durează de obicei 1-3 zile lucrătoare.
          </p>
        </section>

         <section>
          <h2 className="text-lg font-bold uppercase tracking-wide mb-4 border-b border-neutral-200 pb-2">5. Retururi</h2>
          <p className="leading-relaxed">
            Acceptăm retururi în termen de 30 de zile de la livrare, cu condiția ca produsul să fie în starea originală, fără urme de uzură.
          </p>
        </section>
      </div>
    </main>
  );
};