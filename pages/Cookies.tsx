import React from 'react';

export const Cookies: React.FC = () => {
  return (
    <main className="pt-24 pb-24 px-4 md:px-8 max-w-5xl mx-auto animate-fade-in text-neutral-800">
      
      <div className="mb-12 border-b border-neutral-200 pb-6">
        <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter mb-4 text-neutral-900">
          Politica de Cookie-uri
        </h1>
        <p className="text-neutral-500 font-mono text-xs">
          Actualizat: 06.02.2026 | Conform GDPR & ePrivacy Directive
        </p>
      </div>

      <div className="space-y-8 text-sm leading-relaxed text-justify font-sans">
        
        <section>
          <h2 className="font-bold text-lg mb-2">1. Ce sunt cookie-urile?</h2>
          <p>
            Cookie-urile sunt fișiere text de mici dimensiuni, formate din litere și numere, care sunt stocate pe computerul, terminalul mobil sau alte echipamente ale unui utilizator de pe care se accesează internetul. Cookie-ul este instalat prin solicitarea emisă de către un web-server unui browser (ex: Chrome, Safari) și este complet "pasiv" (nu conține programe software, viruși sau spyware și nu poate accesa informațiile de pe hard drive-ul utilizatorului).
          </p>
        </section>

        <section>
          <h2 className="font-bold text-lg mb-2">2. La ce folosim cookie-urile?</h2>
          <p className="mb-2">Site-ul www.oclar.ro folosește cookie-uri pentru a oferi utilizatorilor o experiență de navigare plăcută și completă:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Funcționalitate Coș:</strong> Pentru a păstra produsele în coșul de cumpărături cât timp navigați.</li>
            <li><strong>Analiză Trafic:</strong> Pentru a înțelege câți vizitatori avem (prin Google Analytics - date anonimizate).</li>
            <li><strong>Performanță:</strong> Pentru a încărca paginile mai rapid.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold text-lg mb-2">3. Ce cookie-uri folosim?</h2>
          <div className="overflow-x-auto border border-neutral-200">
             <table className="min-w-full text-xs text-left">
                <thead className="bg-neutral-100 font-bold uppercase">
                   <tr>
                      <th className="p-2 border-b">Nume Cookie</th>
                      <th className="p-2 border-b">Scop</th>
                      <th className="p-2 border-b">Durata</th>
                   </tr>
                </thead>
                <tbody>
                   <tr>
                      <td className="p-2 border-b font-mono">PHPSESSID / session_id</td>
                      <td className="p-2 border-b">Esențial. Păstrează sesiunea de logare și coșul.</td>
                      <td className="p-2 border-b">Sesiune (se șterge la închiderea browserului)</td>
                   </tr>
                   <tr>
                      <td className="p-2 border-b font-mono">cookie_consent</td>
                      <td className="p-2 border-b">Reține acceptul dvs. privind politica de cookies.</td>
                      <td className="p-2 border-b">12 luni</td>
                   </tr>
                   <tr>
                      <td className="p-2 border-b font-mono">_ga, _gid</td>
                      <td className="p-2 border-b">Google Analytics. Analizează traficul anonim.</td>
                      <td className="p-2 border-b">2 ani / 24 ore</td>
                   </tr>
                </tbody>
             </table>
          </div>
        </section>

        <section>
          <h2 className="font-bold text-lg mb-2">4. Cum pot opri cookie-urile?</h2>
          <p>
            Vă puteți configura browserul să respingă fișierele cookie. Dezactivarea și refuzul de a primi cookie-uri pot face anumite secțiuni / pagini impracticabile sau dificil de vizitat și folosit (de exemplu, nu veți putea finaliza o comandă online).
            <br/><br/>
            Mai multe informații despre setările browser-ului:
            <a href="https://support.google.com/chrome/answer/95647?hl=ro" target="_blank" className="text-blue-600 underline ml-1">Chrome</a>, 
            <a href="https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer" target="_blank" className="text-blue-600 underline ml-1">Firefox</a>, 
            <a href="https://support.apple.com/ro-ro/guide/safari/sfri11471/mac" target="_blank" className="text-blue-600 underline ml-1">Safari</a>.
          </p>
        </section>

      </div>
    </main>
  );
};