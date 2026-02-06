import React from 'react';

export const Privacy: React.FC = () => {
  return (
    <main className="pt-24 pb-24 px-4 md:px-8 max-w-5xl mx-auto animate-fade-in text-neutral-800">
      
      {/* HEADER */}
      <div className="mb-12 border-b border-neutral-200 pb-6">
        <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter mb-4 text-neutral-900">
          Politica de Confidențialitate și Prelucrarea Datelor (GDPR)
        </h1>
        <div className="flex flex-col md:flex-row md:items-center justify-between text-xs font-mono text-neutral-500 gap-2">
          <p>Operator: ALTMAR GROUP S.R.L.</p>
          <p>Responsabil DPO: contact@oclar.ro</p>
          <p>Versiune: 2.1 (Actualizat 06.02.2026)</p>
        </div>
      </div>

      <div className="space-y-12 text-sm leading-relaxed text-justify font-sans">

        {/* 1. ANGAJAMENT */}
        <section>
          <h2 className="text-lg font-bold uppercase mb-4 flex items-center">
            <span className="bg-neutral-900 text-white w-8 h-8 flex items-center justify-center mr-3 text-sm">01</span>
            Angajamentul Nostru
          </h2>
          <p className="mb-3">
            Confidențialitatea datelor dumneavoastră cu caracter personal reprezintă una dintre preocupările principale ale <strong>S.C. ALTMAR GROUP S.R.L.</strong>, cu sediul în Intrarea Leordeni, Bragadiru, Jud. Ilfov, înregistrată la Registrul Comerțului sub nr. J2025100368001, CUI 53181323 (denumită în continuare "Oclar" sau "Operatorul").
          </p>
          <p>
            Prin acest document vă informăm cu privire la prelucrarea datelor dumneavoastră cu caracter personal, în contextul utilizării paginii de internet www.oclar.ro, conform Regulamentului (UE) 2016/679 ("GDPR") și a legislației naționale privind protecția datelor.
          </p>
        </section>

        {/* 2. CATEGORII DE DATE */}
        <section>
          <h2 className="text-lg font-bold uppercase mb-4 flex items-center">
            <span className="bg-neutral-900 text-white w-8 h-8 flex items-center justify-center mr-3 text-sm">02</span>
            Categoriile de Date Prelucrate
          </h2>
          <p className="mb-4">
            Oclar prelucrează datele dumneavoastră doar în măsura în care acest lucru este necesar pentru îndeplinirea scopurilor menționate mai jos. Categoriile de date prelucrate sunt:
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-neutral-50 p-4 border border-neutral-200 rounded-sm">
              <h3 className="font-bold mb-2 text-brand-black">A. Pentru procesarea comenzilor</h3>
              <ul className="list-disc pl-5 space-y-1 text-xs text-neutral-600">
                <li>Nume și prenume</li>
                <li>Număr de telefon</li>
                <li>Adresa de e-mail</li>
                <li>Adresa de facturare și livrare</li>
                <li>Datele companiei (dacă comanda este pe persoană juridică)</li>
              </ul>
            </div>
            
            <div className="bg-neutral-50 p-4 border border-neutral-200 rounded-sm">
              <h3 className="font-bold mb-2 text-brand-black">B. Pentru plăți online (Netopia)</h3>
              <p className="text-xs text-neutral-600 mb-2">
                <strong>IMPORTANT:</strong> Oclar.ro NU stochează datele cardului dumneavoastră.
              </p>
              <ul className="list-disc pl-5 space-y-1 text-xs text-neutral-600">
                <li>Datele sunt introduse direct în platforma securizată Netopia Payments.</li>
                <li>Noi primim doar confirmarea tranzacției (aprobat/respins).</li>
              </ul>
            </div>

            <div className="bg-neutral-50 p-4 border border-neutral-200 rounded-sm">
              <h3 className="font-bold mb-2 text-brand-black">C. Date tehnice (Automate)</h3>
              <ul className="list-disc pl-5 space-y-1 text-xs text-neutral-600">
                <li>Adresa IP</li>
                <li>Tipul browser-ului și sistemul de operare</li>
                <li>Istoricul navigării pe site (prin Cookies)</li>
              </ul>
            </div>

             <div className="bg-neutral-50 p-4 border border-neutral-200 rounded-sm">
              <h3 className="font-bold mb-2 text-brand-black">D. Pentru Marketing</h3>
              <ul className="list-disc pl-5 space-y-1 text-xs text-neutral-600">
                <li>Adresa de e-mail (doar cu consimțământul dvs. pentru Newsletter)</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 3. SCOPURI ȘI TEMEIURI */}
        <section>
          <h2 className="text-lg font-bold uppercase mb-4 flex items-center">
            <span className="bg-neutral-900 text-white w-8 h-8 flex items-center justify-center mr-3 text-sm">03</span>
            Scopurile și Temeiurile Prelucrării
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-left border border-neutral-200">
              <thead className="bg-neutral-100 uppercase font-bold text-neutral-700">
                <tr>
                  <th className="p-3 border-b border-r">Scopul Prelucrării</th>
                  <th className="p-3 border-b">Temeiul Legal (GDPR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                <tr>
                  <td className="p-3 border-r">Preluarea, validarea, expedierea și facturarea comenzii.</td>
                  <td className="p-3"><strong>Executarea contractului</strong> (Art. 6 alin. 1 lit. b) și <strong>Obligație legală</strong> (fiscală).</td>
                </tr>
                <tr>
                  <td className="p-3 border-r">Informarea clienților privind situația comenzii (SMS/Email).</td>
                  <td className="p-3"><strong>Executarea contractului</strong>.</td>
                </tr>
                <tr>
                  <td className="p-3 border-r">Procesarea plăților online și prevenirea fraudelor.</td>
                  <td className="p-3"><strong>Interes legitim</strong> (Art. 6 alin. 1 lit. f) pentru securitate și <strong>Executarea contractului</strong>.</td>
                </tr>
                <tr>
                  <td className="p-3 border-r">Rezolvarea plângerilor, retururilor și garanțiilor.</td>
                  <td className="p-3"><strong>Obligație legală</strong> (Legea protecției consumatorului).</td>
                </tr>
                <tr>
                  <td className="p-3 border-r">Transmiterea de mesaje publicitare (Newsletter).</td>
                  <td className="p-3"><strong>Consimțământul</strong> persoanei vizate (Art. 6 alin. 1 lit. a). Vă puteți dezabona oricând.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 4. DESTINATARII DATELOR - FOARTE IMPORTANT PT NETOPIA */}
        <section>
          <h2 className="text-lg font-bold uppercase mb-4 flex items-center">
            <span className="bg-neutral-900 text-white w-8 h-8 flex items-center justify-center mr-3 text-sm">04</span>
            Cine are acces la datele tale?
          </h2>
          <p className="mb-3">
            Pentru a putea desfășura activitatea și a vă livra produsele, transmitem datele dumneavoastră către parteneri contractuali de încredere ("Persoane Împuternicite"). Aceștia sunt obligați contractual și legal să păstreze confidențialitatea datelor:
          </p>
          <ul className="list-decimal pl-5 space-y-3">
            <li>
              <strong>Procesatorul de plăți: Netopia Payments</strong>
              <p className="text-xs text-neutral-500 mt-1">
                Pentru plățile cu cardul, datele sunt transmise criptat către Netopia. Politica lor de confidențialitate poate fi consultată pe site-ul netopia-payments.com.
              </p>
            </li>
            <li>
              <strong>Companii de curierat (Sameday, Fan Courier, etc.)</strong>
              <p className="text-xs text-neutral-500 mt-1">
                Numele, adresa și telefonul sunt transmise curierului pentru a efectua livrarea.
              </p>
            </li>
            <li>
              <strong>Servicii de facturare (Oblio/SmartBill)</strong>
              <p className="text-xs text-neutral-500 mt-1">
                Datele necesare emiterii facturii fiscale sunt procesate prin softuri de gestiune securizate.
              </p>
            </li>
            <li>
              <strong>Autorități Publice (ANAF, Poliție)</strong>
              <p className="text-xs text-neutral-500 mt-1">
                Doar dacă există o solicitare legală oficială sau pentru apărarea unui interes legitim în justiție.
              </p>
            </li>
          </ul>
        </section>

        {/* 5. DURATA DE STOCARE */}
        <section>
          <h2 className="text-lg font-bold uppercase mb-4 flex items-center">
            <span className="bg-neutral-900 text-white w-8 h-8 flex items-center justify-center mr-3 text-sm">05</span>
            Durata de Stocare a Datelor
          </h2>
          <p className="mb-3">
            Ca principiu general, Oclar va prelucra datele dumneavoastră pe cât timp este necesar pentru realizarea scopurilor de prelucrare menționate.
          </p>
          <ul className="list-disc pl-5 space-y-2 text-sm">
            <li><strong>Date de facturare:</strong> 10 ani (conform Codului Fiscal și Legii Contabilității).</li>
            <li><strong>Date cont client:</strong> Până la ștergerea contului de către utilizator sau după 3 ani de inactivitate.</li>
            <li><strong>Date de marketing:</strong> Până la retragerea consimțământului (dezabonare).</li>
            <li><strong>Cookie-uri:</strong> Conform politicii de cookies (de la o sesiune până la 2 ani).</li>
          </ul>
        </section>

        {/* 6. DREPTURILE UTILIZATORULUI */}
        <section>
          <h2 className="text-lg font-bold uppercase mb-4 flex items-center">
            <span className="bg-neutral-900 text-white w-8 h-8 flex items-center justify-center mr-3 text-sm">06</span>
            Drepturile Dumneavoastră
          </h2>
          <p className="mb-4">
            În conformitate cu GDPR, beneficiați de următoarele drepturi:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="bg-neutral-50 p-3 border border-neutral-200">
              <strong>1. Dreptul de acces:</strong> Puteți solicita confirmarea dacă prelucrăm datele dvs. și o copie a acestora.
            </div>
            <div className="bg-neutral-50 p-3 border border-neutral-200">
              <strong>2. Dreptul la rectificare:</strong> Puteți cere corectarea datelor inexacte.
            </div>
            <div className="bg-neutral-50 p-3 border border-neutral-200">
              <strong>3. Dreptul la ștergere ("Dreptul de a fi uitat"):</strong> Puteți cere ștergerea datelor, dacă nu mai sunt necesare sau v-ați retras acordul (cu excepția datelor fiscale obligatorii).
            </div>
            <div className="bg-neutral-50 p-3 border border-neutral-200">
              <strong>4. Dreptul la restricționarea prelucrării:</strong> Puteți cere suspendarea prelucrării în anumite cazuri.
            </div>
            <div className="bg-neutral-50 p-3 border border-neutral-200">
              <strong>5. Dreptul la portabilitatea datelor:</strong> Puteți cere datele într-un format structurat pentru a le muta la alt operator.
            </div>
            <div className="bg-neutral-50 p-3 border border-neutral-200">
              <strong>6. Dreptul de opoziție:</strong> Vă puteți opune prelucrării în scop de marketing direct.
            </div>
          </div>
          <p className="mt-4 text-sm font-semibold">
            Pentru exercitarea acestor drepturi, vă rugăm să transmiteți o cerere scrisă, datată și semnată la adresa de email: <a href="mailto:contact@oclar.ro" className="text-blue-600 underline">contact@oclar.ro</a>.
          </p>
        </section>

        {/* 7. SECURITATE */}
        <section>
          <h2 className="text-lg font-bold uppercase mb-4 flex items-center">
            <span className="bg-neutral-900 text-white w-8 h-8 flex items-center justify-center mr-3 text-sm">07</span>
            Securitatea Datelor
          </h2>
          <p>
            Oclar