import React, { useEffect, useState } from 'react';
import { API_URL } from '../constants';
import { Button } from '../components/Button';

export const Diagnostics: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const addLog = (msg: string) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  const runDiagnostics = async () => {
    setLoading(true);
    setLogs([]);
    
    addLog("🚀 Începere Diagnostic...");

    // TEST 1: Ping Backend (Fără DB)
    try {
      addLog("1. Testare conexiune Frontend -> Backend (/api/ping)...");
      const t1 = performance.now();
      // Notă: Dacă nu ai creat fișierul api/ping.js, acest test va da 404, e ok.
      // Putem testa și cu un simplu fetch la un endpoint care nu există, backend-ul ar trebui să răspundă 404 instant.
      // Dar hai să încercăm status-ul simplificat.
      
      // Testăm statusul. Dacă dă timeout, e clar de la DB.
      addLog("2. Interogare Backend complet (/api/status)...");
      const res = await fetch(`${API_URL}/status`);
      const t2 = performance.now();
      
      if (res.ok) {
        const data = await res.json();
        addLog(`✅ Backend a răspuns în ${(t2 - t1).toFixed(0)}ms`);
        addLog(`📊 Status DB raportat: ${data.database_connection}`);
        if(data.table_orders_exists) addLog(`📦 Tabel comenzi: ${data.table_orders_exists}`);
      } else {
        addLog(`⚠️ Backend a răspuns cu eroare: ${res.status} ${res.statusText}`);
        if (res.status === 504) {
          addLog("Lr: 504 TIMEOUT = Backend-ul merge, dar Baza de Date răspunde prea greu.");
          addLog("Soluție: FreakHosting se mișcă lent la handshake.");
        }
      }

    } catch (error: any) {
      addLog(`❌ Eroare de rețea: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-24 px-6 max-w-4xl mx-auto min-h-screen font-mono text-sm">
      <h1 className="text-2xl font-bold mb-4">Diagnostic Sistem</h1>
      <div className="bg-neutral-100 p-4 rounded mb-4 h-96 overflow-auto border border-neutral-300">
        {logs.map((log, i) => <div key={i} className="mb-1 border-b border-neutral-200 pb-1">{log}</div>)}
      </div>
      <Button onClick={runDiagnostics} disabled={loading} fullWidth>
        {loading ? 'Se testează...' : 'Rulează Test'}
      </Button>
    </div>
  );
};
