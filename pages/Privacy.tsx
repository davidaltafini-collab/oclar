import React from 'react';

export const Privacy: React.FC = () => {
  return (
    <main className="pt-24 pb-24 px-6 md:px-12 max-w-3xl mx-auto animate-fade-in">
      <h1 className="text-4xl font-black uppercase tracking-tighter mb-2">Politica de Confidențialitate</h1>
      <p className="text-neutral-400 text-sm font-mono mb-12">Ultima actualizare: 24 Octombrie 2024</p>

      <div className="space-y-12 text-neutral-700">
        <section>
          <h2 className="text-lg font-bold uppercase tracking-wide mb-4 border-b border-neutral-200 pb-2">Colectarea Datelor</h2>
          <p className="leading-relaxed mb-4">
            La OCLAR, credem în minimalismul datelor. Colectăm doar ceea ce este strict necesar pentru a procesa comanda ta și a-ți îmbunătăți experiența.
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Date de Identitate:</strong> Nume, prenume.</li>
            <li><strong>Date de Contact:</strong> Adresa de livrare, email, număr de telefon.</li>
            <li><strong>Date de Tranzacție:</strong> Detalii despre plățile efectuate (procesate securizat prin terți).</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold uppercase tracking-wide mb-4 border-b border-neutral-200 pb-2">Cum Folosim Datele Tale</h2>
          <p className="leading-relaxed">
            Datele tale sunt folosite exclusiv pentru:
            <br/>1. Procesarea și livrarea comenzii.
            <br/>2. Comunicări legate de comandă.
            <br/>3. Îmbunătățirea site-ului prin analize anonime.
            <br/><br/>
            Noi <strong>nu</strong> vindem datele tale către terți.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold uppercase tracking-wide mb-4 border-b border-neutral-200 pb-2">Cookies</h2>
          <p className="leading-relaxed">
            Folosim cookie-uri pentru a menține produsele în coș și pentru a analiza traficul pe site. Ai control total asupra acceptării cookie-urilor prin fereastra de consimțământ.
          </p>
        </section>

         <section>
          <h2 className="text-lg font-bold uppercase tracking-wide mb-4 border-b border-neutral-200 pb-2">Contact DPO</h2>
          <p className="leading-relaxed">
            Pentru orice întrebări legate de datele tale personale, te rugăm să ne contactezi la:
            <br/>
            <a href="mailto:privacy@OCLAR.ro" className="text-black font-bold border-b border-brand-yellow hover:bg-brand-yellow transition-colors">privacy@OCLAR.ro</a>
          </p>
        </section>
      </div>
    </main>
  );
};