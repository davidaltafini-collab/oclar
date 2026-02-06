import React from 'react';

export const Terms: React.FC = () => {
  return (
    <main className="pt-24 pb-24 px-4 md:px-8 max-w-5xl mx-auto animate-fade-in text-neutral-800">
      
      {/* HEADER */}
      <div className="mb-12 border-b border-neutral-200 pb-6">
        <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter mb-4 text-neutral-900">
          Termeni și Condiții
        </h1>
        <div className="flex flex-col md:flex-row md:items-center justify-between text-xs font-mono text-neutral-500 gap-2">
          <p>Operat de: ALTMAR GROUP S.R.L.</p>
          <p>Ultima actualizare: 06.02.2026</p>
          <p>Versiune document: 2.0 (Conform OUG 34/2014)</p>
        </div>
      </div>

      <div className="space-y-12 text-sm leading-relaxed text-justify font-sans">
        
        {/* ARTICOLUL 1 */}
        <section>
          <h2 className="text-lg font-bold uppercase mb-4 flex items-center">
            <span className="bg-neutral-900 text-white w-8 h-8 flex items-center justify-center mr-3 text-sm">01</span>
            Datele de Identificare ale Vânzătorului
          </h2>
          <p className="mb-4">
            Site-ul <strong>www.oclar.ro</strong> este un serviciu comercial furnizat de către:
          </p>
          <div className="bg-neutral-50 border border-neutral-200 p-6 rounded-sm text-sm">
            <ul className="space-y-2">
              <li><strong>Denumire Companie:</strong> S.C. ALTMAR GROUP S.R.L.</li>
              <li><strong>Forma Juridică:</strong> Societate cu Răspundere Limitată, organizată în baza legii române.</li>
              <li><strong>Sediu Social:</strong> Intrarea Leordeni, Bragadiru, Jud. Ilfov, România.</li>
              <li><strong>Număr de ordine în Registrul Comerțului:</strong> J2025100368001</li>
              <li><strong>Cod Unic de Înregistrare (CUI):</strong> 53181323</li>
              <li><strong>Capital Social:</strong> 200 RON</li>
              <li><strong>Email Contact:</strong> contact@oclar.ro</li>
              <li><strong>Telefon:</strong> [Adaugă numărul tău de telefon aici]</li>
            </ul>
          </div>
        </section>

        {/* ARTICOLUL 2 */}
        <section>
          <h2 className="text-lg font-bold uppercase mb-4 flex items-center">
            <span className="bg-neutral-900 text-white w-8 h-8 flex items-center justify-center mr-3 text-sm">02</span>
            Definiții și Termeni
          </h2>
          <p className="mb-2">În cuprinsul prezentului document, următorii termeni vor avea înțelesurile de mai jos:</p>
          <ul className="list-disc pl-5 space-y-2 marker:text-neutral-400">
            <li><strong>Cumpărător / Utilizator:</strong> Orice persoană fizică (consumator) sau juridică care accesează Site-ul, își creează un Cont sau plasează o Comandă.</li>
            <li><strong>Vânzător:</strong> Societatea comercială ALTMAR GROUP S.R.L.</li>
            <li><strong>Comandă:</strong> Un document electronic ce intervine ca formă de comunicare între Vânzător și Cumpărător, prin care Cumpărătorul își exprimă intenția de a achiziționa Bunuri de pe Site.</li>
            <li><strong>Contract:</strong> Comanda confirmată de către Vânzător, prin care Vânzătorul este de acord să livreze Bunurile, iar Cumpărătorul este de acord să le plătească.</li>
            <li><strong>Curier:</strong> Orice persoană de drept public sau privat care prestează servicii de curierat rapid.</li>
          </ul>
        </section>

        {/* ARTICOLUL 3 */}
        <section>
          <h2 className="text-lg font-bold uppercase mb-4 flex items-center">
            <span className="bg-neutral-900 text-white w-8 h-8 flex items-center justify-center mr-3 text-sm">03</span>
            Documente Contractuale
          </h2>
          <p className="mb-3">
            3.1. Prin înregistrarea unei Comenzi pe Site, Cumpărătorul este de acord cu forma de comunicare (e-mail sau telefon) prin care Vânzătorul își derulează operațiunile comerciale.
          </p>
          <p className="mb-3">
            3.2. Notificarea primită de către Cumpărător, după efectuarea Comenzii, are rol de informare și nu reprezintă acceptarea Comenzii. Această notificare se face electronic (e-mail).
          </p>
          <p>
            3.3. Contractul se consideră încheiat între Vânzător și Cumpărător în momentul primirii de către Cumpărător de la Vânzător, prin intermediul poștei electronice și/sau SMS, a notificării de expediere a Comenzii (Confirmarea Comenzii).
          </p>
        </section>

        {/* ARTICOLUL 4 - PREȚURI */}
        <section>
          <h2 className="text-lg font-bold uppercase mb-4 flex items-center">
            <span className="bg-neutral-900 text-white w-8 h-8 flex items-center justify-center mr-3 text-sm">04</span>
            Politica de Prețuri și Vânzare Online
          </h2>
          <p className="mb-3">
            4.1. Toate tarifele aferente Bunurilor prezentate pe Site sunt exprimate în lei (RON) și includ T.V.A., conform legislației în vigoare.
          </p>
          <p className="mb-3">
            4.2. Prețul, modalitatea de plată și termenul de plată sunt specificate în fiecare Comandă. Vânzătorul va emite către Cumpărător o factură pentru Bunurile livrate, obligația Cumpărătorului fiind să furnizeze toate informațiile necesare emiterii facturii conform legislației în vigoare.
          </p>
          <p>
            4.3. Prețul produselor nu include taxele de transport, decât dacă este specificat expres altfel în cadrul unei promoții. Costul transportului va fi adăugat la totalul comenzii înainte de finalizarea acesteia.
          </p>
        </section>

        {/* ARTICOLUL 5 - PLĂȚI */}
        <section>
          <h2 className="text-lg font-bold uppercase mb-4 flex items-center">
            <span className="bg-neutral-900 text-white w-8 h-8 flex items-center justify-center mr-3 text-sm">05</span>
            Modalități de Plată
          </h2>
          <p className="mb-4">Pentru achitarea produselor, Oclar.ro pune la dispoziție următoarele metode de plată:</p>
          
          <div className="space-y-4">
            <div className="border-l-4 border-brand-yellow pl-4">
              <h3 className="font-bold text-base mb-1">A. Plată online cu cardul (Prin Netopia Payments)</h3>
              <p className="text-neutral-600">
                Puteți efectua plata online cu cardul personal sau al firmei dumneavoastră, în condiții de siguranță deplină. Cardurile acceptate la plată sunt cele emise sub siglele VISA (Classic și Electron) și MASTERCARD (inclusiv Maestro).
                <br /><br />
                Nu se percepe niciun comision suplimentar pentru tranzacții. Procesarea datelor de card se face exclusiv pe serverele Netopia Payments. Oclar.ro nu solicită și nu stochează niciun fel de detalii referitoare la cardul dumneavoastră.
              </p>
            </div>

            <div className="border-l-4 border-neutral-300 pl-4">
              <h3 className="font-bold text-base mb-1">B. Plată Ramburs (La livrare)</h3>
              <p className="text-neutral-600">
                Plata se face în numerar curierului care livrează coletul. Această metodă poate implica un cost suplimentar de procesare a rambursului, afișat în coșul de cumpărături înainte de finalizare.
              </p>
            </div>
          </div>
        </section>

        {/* ARTICOLUL 6 - LIVRARE - CRITIC PENTRU NETOPIA */}
        <section>
          <h2 className="text-lg font-bold uppercase mb-4 flex items-center">
            <span className="bg-neutral-900 text-white w-8 h-8 flex items-center justify-center mr-3 text-sm">06</span>
            Livrarea Bunurilor
          </h2>
          <p className="mb-3">
            Vânzătorul se obligă să livreze Bunurile în sistem de curierat door-to-door sau la lockerele Easybox, exclusiv pe teritoriul României.
          </p>

          <h3 className="font-bold mt-4 mb-2">6.1. Termene de Livrare</h3>
          <p className="mb-3">
            Termenul estimativ de livrare este de <strong>24 - 48 de ore lucrătoare</strong> de la confirmarea comenzii, pentru produsele aflate în stoc. În perioadele aglomerate (Black Friday, Sărbători legale), acest termen poate fi extins până la 5 zile lucrătoare.
          </p>

          <h3 className="font-bold mt-4 mb-2">6.2. Costuri de Livrare</h3>
          <ul className="list-disc pl-5 mb-3 space-y-1">
            <li>Livrare la Easybox: <strong>15.00 RON</strong> (TVA inclus)</li>
            <li>Livrare prin Curier Rapid la domiciliu: <strong>25.00 RON</strong> (TVA inclus)</li>
          </ul>

          <h3 className="font-bold mt-4 mb-2">6.3. Recepția Produselor</h3>
          <p>
            Cumpărătorul are obligația de a verifica integritatea ambalajului în prezența curierului. Dacă coletul prezintă urme vizibile de deteriorare, Cumpărătorul are dreptul de a refuza primirea și de a încheia un proces-verbal de constatare împreună cu curierul. Reclamațiile ulterioare privind integritatea fizică a ambalajului nu vor fi luate în considerare.
          </p>
        </section>

        {/* ARTICOLUL 7 - RETUR (OUG 34/2014) */}
        <section>
          <h2 className="text-lg font-bold uppercase mb-4 flex items-center">
            <span className="bg-neutral-900 text-white w-8 h-8 flex items-center justify-center mr-3 text-sm">07</span>
            Politica de Retur (Dreptul de Retragere)
          </h2>
          <p className="mb-3 italic text-neutral-500">
            Conform Ordonanței de Urgență Nr. 34/2014 privind drepturile consumatorilor în cadrul contractelor încheiate cu profesioniștii.
          </p>

          <h3 className="font-bold mt-4 mb-2">7.1. Termenul de Retragere</h3>
          <p className="mb-3">
            Consumatorul (persoana fizică) beneficiază de o perioadă de <strong>14 zile calendaristice</strong> pentru a se retrage din Contract fără a fi nevoit să justifice decizia de retragere și fără a suporta alte costuri decât cele prevăzute la art. 13 alin. (3) și la art. 14 din OUG Nr. 34/2014.
          </p>
          <p className="mb-3">
            Perioada de retragere expiră în termen de 14 zile de la ziua în care Consumatorul sau o parte terță, alta decât transportatorul și care este indicată de Consumator, intră în posesia fizică a produselor.
          </p>

          <h3 className="font-bold mt-4 mb-2">7.2. Exercitarea Dreptului de Retragere</h3>
          <p className="mb-3">
            Pentru a vă exercita dreptul de retragere, trebuie să ne informați cu privire la decizia dumneavoastră de a vă retrage din prezentul contract, utilizând o declarație neechivocă, trimisă prin e-mail la adresa <strong>contact@oclar.ro</strong>.
          </p>

          <h3 className="font-bold mt-4 mb-2">7.3. Consecințele Retragerii</h3>
          <p className="mb-3">
            Dacă vă retrageți, vom rambursa orice sumă pe care am primit-o de la dumneavoastră, cu excepția costurilor suplimentare determinate de faptul că ați ales altă modalitate de livrare decât cel mai ieftin tip de livrare standard oferit de noi, fără întârzieri nejustificate și, în orice caz, nu mai târziu de 14 zile calendaristice de la data la care suntem informați cu privire la decizia dumneavoastră.
          </p>
          <p className="mb-3">
            Vom efectua această rambursare folosind aceeași modalitate de plată ca și cea folosită pentru tranzacția inițială (de regulă virament bancar), cu excepția cazului în care v-ați exprimat acordul expres pentru o altă modalitate de rambursare.
          </p>

          <h3 className="font-bold mt-4 mb-2 text-red-600">7.4. Condiții de returnare a produselor</h3>
          <div className="bg-red-50 p-4 border-l-4 border-red-500 text-sm">
            <p className="mb-2 font-semibold">Produsele returnate trebuie să fie în aceeași stare în care au fost livrate:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Să nu prezinte urme de utilizare excesivă, zgârieturi, ciobituri, lovituri, șocuri mecanice sau electrice;</li>
              <li>Să fie în ambalajul original, cu etichetele intacte;</li>
              <li>Să fie însoțite de toate accesoriile cu care au fost livrate;</li>
              <li>Dacă produsul a fost însoțit de un cadou, acesta trebuie returnat și el.</li>
            </ul>
            <p className="mt-2 text-xs">
              Suntem îndreptățiți să refuzăm returul dacă produsul nu îndeplinește aceste condiții sau să reținem o parte din valoarea acestuia (diminuarea valorii) conform art. 14 alin. 3 din OUG 34/2014.
            </p>
          </div>
        </section>

        {/* ARTICOLUL 8 - GARANȚII */}
        <section>
          <h2 className="text-lg font-bold uppercase mb-4 flex items-center">
            <span className="bg-neutral-900 text-white w-8 h-8 flex items-center justify-center mr-3 text-sm">08</span>
            Garanția Produselor
          </h2>
          <p className="mb-3">
            Toate produsele comercializate de către site-ul nostru beneficiază de condiții de garanție conforme legislației în vigoare (Legea 449/2003 privind vânzarea produselor și garanțiile asociate acestora și O.G. 21/1992 privind protecția consumatorilor).
          </p>
          <p className="mb-3">
            <strong>Garanția legală de conformitate</strong> este de 2 ani de la livrarea produsului. Aceasta acoperă lipsa de conformitate existentă la momentul livrării bunurilor. În cazul în care produsul se defectează în perioada de garanție, cumpărătorul are dreptul la repararea, înlocuirea sau rambursarea contravalorii produsului, conform legii.
          </p>
          <p>
            Garanția se pierde în cazul utilizării necorespunzătoare, supunerii la șocuri mecanice, contactului cu lichide (pentru produsele care nu sunt rezistente la apă) sau intervențiilor neautorizate asupra produsului.
          </p>
        </section>

        {/* ARTICOLUL 9 */}
        <section>
          <h2 className="text-lg font-bold uppercase mb-4 flex items-center">
            <span className="bg-neutral-900 text-white w-8 h-8 flex items-center justify-center mr-3 text-sm">09</span>
            Prelucrarea Datelor cu Caracter Personal
          </h2>
          <p>
            Oclar prelucrează datele dumneavoastră cu caracter personal în conformitate cu Regulamentul (UE) 2016/679 (GDPR). Detalii complete privind prelucrarea datelor, scopurile, temeiul legal și drepturile dumneavoastră sunt disponibile în secțiunea <a href="/privacy" className="underline font-bold text-brand-black">Politica de Confidențialitate</a>, care face parte integrantă din prezentul document.
          </p>
        </section>

        {/* ARTICOLUL 10 - LITIGII */}
        <section>
          <h2 className="text-lg font-bold uppercase mb-4 flex items-center">
            <span className="bg-neutral-900 text-white w-8 h-8 flex items-center justify-center mr-3 text-sm">10</span>
            Litigii și Legislația Aplicabilă
          </h2>
          <p className="mb-3">
            Contractul este supus legii române. Eventualele litigii apărute între Vânzător și Utilizatori / Cumpărători se vor rezolva pe cale amiabilă.
          </p>
          <p className="mb-4">
            Dacă aveți probleme legate de o comandă care nu par a putea fi rezolvate prin e-mail sau cu persoana cu care discutați, puteți lua legătura pentru o conciliere internă gratuită la adresa <strong>contact@oclar.ro</strong>.
          </p>
          <p className="mb-6">
            În cazul în care nu se ajunge la un acord, litigiile vor fi soluționate de instanțele judecătorești române competente din Municipiul București sau județul Ilfov.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <a 
              href="https://anpc.ro" 
              target="_blank" 
              rel="noreferrer" 
              className="flex items-center justify-center p-4 border border-neutral-300 hover:bg-neutral-50 transition-colors rounded text-center"
            >
              <img src="/anpc-sal.svg" alt="ANPC SAL" className="h-8 mr-2" />
              <span className="font-bold text-xs">Autoritatea Națională pentru<br/>Protecția Consumatorilor</span>
            </a>
            <a 
              href="https://ec.europa.eu/consumers/odr" 
              target="_blank" 
              rel="noreferrer" 
              className="flex items-center justify-center p-4 border border-neutral-300 hover:bg-neutral-50 transition-colors rounded text-center"
            >
               <img src="/anpc-sol.svg" alt="ANPC SOL" className="h-8 mr-2" />
               <span className="font-bold text-xs">Platforma SOL<br/>(Soluționarea Online a Litigiilor)</span>
            </a>
          </div>
        </section>

        <section className="pt-8 border-t border-neutral-200 text-xs text-neutral-400 text-center">
          <p>© {new Date().getFullYear()} ALTMAR GROUP S.R.L. Toate drepturile rezervate.</p>
        </section>

      </div>
    </main>
  );
};