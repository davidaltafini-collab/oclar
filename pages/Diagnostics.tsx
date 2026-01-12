import React, { useEffect, useState } from 'react';
import { API_URL } from '../constants';
import { Button } from '../components/Button';

export const Diagnostics: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading,pKsetLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState<any>(null);

  const addLog = (msg: string) => setLogs(prev => [...prev, `[${newJAte().toLocaleTimeString()}] ${msg}`]);

  const runDiagnostics = async () => {
    setLoading(true);
    setLogs([]);
    setApiStatus(null);
    
    addLog("1. Inițializare diagnostic...");
    addLog(`Checking Environment: ${import.meta.env.MODE}`);
    addLog(`Target API URL: ${API_URL}`);

    const startTime = performance.now();

    try {
      addLog("2. Se încearcă conectarea la Backend (/api/status)...");
      
      // Încercăm să apelăm endpoint-ul de status
      const res = await fetch(`${API_URL}/status`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      const endTime = performance.now();
      const latency = (endTime - startTime).toFixed(0);
      addLog(`Răspuns primit în ${latency}ms.`);

      if (!res.ok) {
        throw new Error(`HTTP Error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      setApiStatus(data);
      addLog("3. Backend contactat cu succes.");

      // Verificăm statusul bazei de date returnat de backend
      if (data.database_connection && data.database_connection.includes('SUCCESS')) {
        addLog("✅ CONEXIUNE DB: REUȘITĂ");
      } else {
        addLog("❌ CONEXIUNE DB: EȘUATĂ");
        addLog(`Eroare DB: ${data.error_message || 'Necunoscută'}`);
      }

    } catch (error: any) {
      addLog(`❌ EROARE CRITICĂ: ${error.message}`);
      if (error.message.includes('Failed to fetch')) {
        addLog("Sugestie: Backend-ul nu răspunde. Verifică dacă API-ul rulează sau dacă URL-ul este corect.");
      }
    } finally {
      setLoading(false);
      addLog("Diagnostic finalizat.");
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  return (
    <div className="pt-24 px-6 md:px-12 max-w-4xl mx-auto min-h-screen font-mono text-sm">
      <h1 className="text-3xl font-bold mb-6 uppercase">System Diagnostics</h1>
      
      <div className="bg-neutral-100 p-6 rounded-xl mb-8 border border-neutral-200">
        <h2 className="font-bold mb-4 uppercase text-neutral-500">Raport Live</h2>
        <div className="space-y-2 mb-6 h-64 overflow-y-auto bg-white p-4 rounded border border-neutral-300 shadow-inner">
          {logs.map((log, i) => (
            <div key={i} className={`pb-1 border-b border-neutral-50 last:border-0 ${log.includes('❌') ? 'text-red-600 font-bold' : log.includes('✅') ? 'text-green-600 font-bold' : 'text-neutral-700'}`}>
              {log}
            </div>
          ))}
          {loading && <div className="animate-pulse text-brand-yellow">Se procesează...</div>}
        </div>
        
        <Button onClick={runDiagnostics} disabled={loading} fullWidth>
          {loading ? 'Se rulează...' : 'Rulează din nou'}
        </Button>
      </div>

      {apiStatus && (
        <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-lg">
          <h2 className="font-bold mb-4 uppercase text-neutral-500">Detalii Tehnice Backend</h2>
          <pre className="bg-neutral-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs">
            {JSON.stringify(apiStatus, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
