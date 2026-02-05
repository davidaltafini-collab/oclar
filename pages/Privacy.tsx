import React from 'react';

export const Privacy: React.FC = () => {
  return (
    <main className="pt-24 pb-24 px-6 md:px-12 max-w-4xl mx-auto animate-fade-in">
      <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter mb-2 text-neutral-900">Politica de Confidențialitate și GDPR</h1>
      <p className="text-neutral-500 text-xs font-mono mb-12 border-b pb-4">
        Operator de date: ALTMAR GROUP S.R.L. | Actualizat: 06.02.2026
      </p>

      <div className="space-y-10 text-neutral-700 text-sm leading-relaxed text-justify">
        
        <section>
          <h2 className="text-base font-bold uppercase tracking-wide mb-3 border-l-4 border-brand-yellow pl-3">1. Angajamentul Nostru</h2>
          <p>
            Confidențialitatea datelor dumneavoastră este prioritară pentru <strong>ALTMAR GROUP S.R.L.</strong>. Ne aliniem strict prevederilor Regulamentului (UE) 2016/679 (“GDPR”) și legislației din România. Acest document explică ce date colectăm, de ce, și ce drepturi aveți.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold uppercase tracking-wide mb-3 border-l-4 border-brand-yellow pl-3">2. Ce date colectăm și Temeiul Legal</h2>
          <p className="mb-4">
            Colectăm datele strict necesare pentru a vă putea vinde și livra produsele. Temeiul principal al prelucrării este <strong>Executarea Contractului</strong> (Art. 6 alin. 1 lit. b GDPR).
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-left border border-neutral-200">
              <thead className="bg-neutral-100 uppercase font-bold">
                <tr>
                  <th className="p-3 border-b">Tip Date</th>
                  <th className="p-3 border-b">Scopul Prelucrării</th>
                  <th className="p-3 border-b">Temei Legal</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-3 border-b">Nume, Prenume, Adresă, Telefon</td>
                  <td className="p-3 border-b">Livrarea comenzii, Facturare (obligatoriu legal)</td>
                  <td className="p-3 border-b">Contract & Obligație Legală</td>
                </tr>
                <tr>
                  <td className="p-3 border-b">Email</td>
                  <td className="p-3 border-b">Confirmare comandă, Status livrare</td>
                  <td className="p-3 border-b">Contract</td>
                </tr>
                <tr>
                  <td className="p-3 border-b">IP, Date Browser (Cookies)</td>
                  <td className="p-3 border-b">Securitate site, Statistici, Marketing</td>
                  <td className="p-3 border-b">Interes Legitim / Consimțământ</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-base font-bold uppercase tracking-wide mb-3 border-l-4 border-brand-yellow pl-3">3. Cine are acces la datele tale?</h2>
          <p>
            Nu vindem datele tale. Le transmitem doar partenerilor contractuali strict necesari pentru finalizarea comenzii, care la rândul lor sunt obligați să respecte GDPR:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li><strong>Curieri:</strong> (ex: Sameday, Fan Courier) pentru a livra coletul.</li>
            <li><strong>Procesatori de plăți:</strong> (ex: Stripe) pentru securizarea tranzacției bancare.</li>
            <li><strong>Servicii IT/Contabilitate:</strong> Furnizori care asigură mentenanța site-ului sau evidența contabilă obligatorie.</li>
            <li><strong>Autorități Publice:</strong> Doar la solicitarea expresă și legală a acestora (ex: ANAF).</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold uppercase tracking-wide mb-3 border-l-4 border-brand-yellow pl-3">4. Durata de stocare</h2>
          <p>
            Datele din facturi sunt păstrate conform termenului legal de arhivare financiar-contabilă (10 ani). Datele conturilor inactive pot fi șterse după o perioadă de 3 ani de la ultima activitate.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold uppercase tracking-wide mb-3 border-l-4 border-brand-yellow pl-3">5. Drepturile Dumneavoastră</h2>
          <p className="mb-2">
            Conform GDPR, aveți următoarele drepturi:
          </p>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            <li className="bg-neutral-50 p-2 border"><strong>Dreptul de acces:</strong> Să cereți o copie a datelor.</li>
            <li className="bg-neutral-50 p-2 border"><strong>Dreptul la rectificare:</strong> Să corectați datele greșite.</li>
            <li className="bg-neutral-50 p-2 border"><strong>Dreptul la ștergere:</strong> ("Dreptul de a fi uitat"), cu excepția datelor din facturi.</li>
            <li className="bg-neutral-50 p-2 border"><strong>Dreptul la portabilitate:</strong> Să mutați datele la alt operator.</li>
          </ul>
          <p className="mt-4">
            Pentru exercitarea acestor drepturi, vă rugăm să ne scrieți la: <a href="mailto:contact@oclar.ro" className="font-bold underline">contact@oclar.ro</a>.
          </p>
        </section>

      </div>
    </main>
  );
};