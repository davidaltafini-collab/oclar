import React from 'react';

export const Terms: React.FC = () => {
  return (
    <main className="pt-24 pb-24 px-6 md:px-12 max-w-4xl mx-auto animate-fade-in">
      <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter mb-2 text-neutral-900">Termeni și Condiții de Utilizare</h1>
      <p className="text-neutral-500 text-xs font-mono mb-12 border-b pb-4">
        Versiune document: 1.2 | Data intrării în vigoare: 06.02.2026
      </p>

      <div className="space-y-10 text-neutral-700 text-sm leading-relaxed text-justify">
        
        {/* SECTIUNEA 1: IDENTITATE */}
        <section>
          <h2 className="text-base font-bold uppercase tracking-wide mb-3 border-l-4 border-brand-yellow pl-3">1. Dispoziții Generale și Identitatea Comerciantului</h2>
          <p className="mb-3">
            Prezentul document (denumit în continuare "Contract") stabilește termenii și condițiile aplicabile utilizării site-ului <strong>www.oclar.ro</strong> și achiziționării produselor comercializate prin intermediul acestuia.
          </p>
          <p className="mb-3">
            Site-ul este proprietatea exclusivă și este operat de:
            <br />
            <strong>S.C. ALTMAR GROUP S.R.L.</strong> (denumită în continuare "Vânzătorul" sau "Oclar"), persoană juridică de naționalitate română.
          </p>
          <ul className="list-none bg-neutral-100 p-4 rounded-sm text-xs font-mono space-y-1 mb-3">
            <li><strong>Sediu Social:</strong> Intrarea Leordeni, Bragadiru, Jud. Ilfov, România</li>
            <li><strong>Nr. Ord. Reg. Com.:</strong> J2025100368001</li>
            <li><strong>C.U.I.:</strong> 53181323</li>
            <li><strong>Email:</strong> contact@oclar.ro</li>
          </ul>
          <p>
            Accesarea site-ului sau plasarea oricărei comenzi implică acceptarea <strong>explicită, irevocabilă și necondiționată</strong> a acestor Termeni și Condiții. Vânzătorul își rezervă dreptul de a modifica acest document în orice moment, fără notificare prealabilă, versiunea aplicabilă fiind cea afișată la momentul plasării comenzii.
          </p>
        </section>

        {/* SECTIUNEA 2: PROPRIETATE INTELECTUALĂ */}
        <section>
          <h2 className="text-base font-bold uppercase tracking-wide mb-3 border-l-4 border-brand-yellow pl-3">2. Dreptul de Proprietate Intelectuală</h2>
          <p>
            Întregul conținut al site-ului Oclar (inclusiv, dar fără a se limita la: imagini, texte, elemente de grafică web, scripturi, modele 3D, logo-uri, design-ul produselor) este proprietatea <strong>ALTMAR GROUP S.R.L.</strong> și este apărat de Legea dreptului de autor și de legile privind proprietatea intelectuală și industrială. Folosirea fără acordul scris al ALTMAR GROUP S.R.L. a oricăror elemente enumerate mai sus se pedepsește conform legislației în vigoare.
          </p>
        </section>

        {/* SECTIUNEA 3: LIMITAREA RĂSPUNDERII (FOARTE IMPORTANT) */}
        <section>
          <h2 className="text-base font-bold uppercase tracking-wide mb-3 border-l-4 border-brand-yellow pl-3">3. Limitarea Răspunderii</h2>
          <p className="mb-3">
            Vânzătorul nu poate fi făcut răspunzător pentru nicio pierdere, daună, costuri, litigii sau cheltuieli (inclusiv, dar fără a se limita la pierderi de profit, pierderi de date sau întreruperi de activitate) cauzate direct sau indirect de utilizarea site-ului sau de imposibilitatea utilizării acestuia.
          </p>
          <p className="mb-3">
            <strong>Imaginile produselor:</strong> Imaginile sunt prezentate pe site cu titlu de exemplu. Produsele livrate pot diferi ușor de imaginile prezentate (nuanță, textură) datorită modificării caracteristicilor/design-ului de către producători sau a setărilor ecranului dumneavoastră. Vânzătorul nu își asumă răspunderea pentru astfel de diferențe minore.
          </p>
          <p>
            <strong>Erori de preț:</strong> În cazul în care un produs este afișat cu un preț incorect din cauza unei erori tipografice, tehnice sau umane (ex: preț derizoriu), Vânzătorul își rezervă dreptul de a <strong>ANULA</strong> orice comandă plasată pentru acel produs, chiar dacă comanda a fost confirmată automat și cardul a fost debitat (cu returnarea integrală a sumei).
          </p>
        </section>

        {/* SECTIUNEA 4: COMANDA ȘI CONTRACTUL */}
        <section>
          <h2 className="text-base font-bold uppercase tracking-wide mb-3 border-l-4 border-brand-yellow pl-3">4. Încheierea Contractului</h2>
          <p>
            Simpla adăugare a produselor în coș nu echivalează cu rezervarea acestora. Contractul la distanță se consideră încheiat doar în momentul primirii de către Cumpărător a mesajului de confirmare a expedierii comenzii via e-mail. Mesajul automat de "Confirmare a primirii comenzii" nu constituie acceptarea fermă a comenzii.
          </p>
        </section>

        {/* SECTIUNEA 5: LIVRARE */}
        <section>
          <h2 className="text-base font-bold uppercase tracking-wide mb-3 border-l-4 border-brand-yellow pl-3">5. Livrarea și Transferul Riscului</h2>
          <p>
            Proprietatea asupra Bunurilor și riscul de pierdere/deteriorare a acestora se transferă la Cumpărător în momentul predării fizice a Bunurilor către Cumpărător (la livrare). Semnarea de primire a documentului de transport furnizat de curier reprezintă dovada livrării conforme. Cumpărătorul are obligația de a verifica integritatea coletului în prezența curierului. Orice reclamație ulterioară privind integritatea fizică a coletului (lovituri, zgârieturi) nu va fi luată în considerare.
          </p>
        </section>

        {/* SECTIUNEA 6: RETUR (STRATIFICAT) */}
        <section>
          <h2 className="text-base font-bold uppercase tracking-wide mb-3 border-l-4 border-brand-yellow pl-3">6. Dreptul de Retragere (Retur)</h2>
          <p className="mb-3">
            Conform O.U.G. 34/2014, consumatorul persoană fizică are dreptul să se retragă din Contract, respectiv să returneze un Bun, în termen de 14 zile calendaristice, fără invocarea niciunui motiv și fără a suporta alte costuri decât cele de livrare.
          </p>
          <div className="bg-neutral-100 p-4 border-l-2 border-red-500 text-xs">
            <strong>ATENȚIE:</strong> Pentru a fi acceptat la retur, produsul trebuie să fie în <strong>starea exactă în care a fost livrat</strong>:
            <ul className="list-disc pl-4 mt-2 space-y-1">
              <li>Să nu prezinte urme de purtare, zgârieturi, ciobituri sau șocuri mecanice.</li>
              <li>Să aibă toate etichetele originale intacte.</li>
              <li>Să fie în ambalajul original complet, nedeteriorat.</li>
            </ul>
          </div>
          <p className="mt-3">
            Vânzătorul își rezervă dreptul de a refuza returul sau de a reține o sumă din valoarea produsului (diminuarea valorii bunurilor) dacă produsele sunt returnate deteriorate, murdare sau incomplete.
          </p>
        </section>

        {/* SECTIUNEA 7: GARANȚII */}
        <section>
          <h2 className="text-base font-bold uppercase tracking-wide mb-3 border-l-4 border-brand-yellow pl-3">7. Garanția Legală de Conformitate</h2>
          <p>
            Toate produsele comercializate beneficiază de condiții de garanție conforme legislației în vigoare (Legea 449/2003 și O.G. 21/1992). Garanția acoperă lipsa de conformitate existentă la momentul livrării produsului. Garanția NU acoperă daunele provocate de utilizarea necorespunzătoare, neglijență, accidente, contact cu substanțe corozive sau uzura normală.
          </p>
        </section>

         {/* SECTIUNEA 8: FORȚA MAJORĂ */}
         <section>
          <h2 className="text-base font-bold uppercase tracking-wide mb-3 border-l-4 border-brand-yellow pl-3">8. Forța Majoră</h2>
          <p>
            Niciuna din părți nu va fi răspunzătoare pentru neexecutarea obligațiilor sale contractuale, dacă o astfel de neexecutare la termen și/sau în mod corespunzător, total sau parțial este datorată unui eveniment de forță majoră (ex: război, calamități naturale, greve, pandemii, restricții guvernamentale).
          </p>
        </section>

        {/* SECTIUNEA 9: LITIGII */}
        <section>
          <h2 className="text-base font-bold uppercase tracking-wide mb-3 border-l-4 border-brand-yellow pl-3">9. Litigii și Legislația Aplicabilă</h2>
          <p>
            Prezentul Contract este supus legii române. Eventualele litigii apărute între Vânzător și Cumpărător se vor rezolva pe cale amiabilă sau, în cazul în care aceasta nu va fi posibilă, litigiile vor fi soluționate de instanțele judecătorești române competente din raza teritorială a municipiului București/Ilfov.
          </p>
        </section>

      </div>
    </main>
  );
};