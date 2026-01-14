import React, { useEffect, useState } from 'react';
import { API_URL } from '../constants';
import { Button } from '../components/Button';

interface DiagnosticResult {
  timestamp?: string;
  database_connection?: string;
  environment_variables?: {
    DB_HOST?: string;
    DB_USER?: string;
    DB_PASS?: string;
    DB_NAME?: string;
  };
  tables_check?: {
    orders?: string;
    products?: string;
  };
  error_message?: string;
  error_code?: string;
}

export const Diagnostics: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [diagnosticData, setDiagnosticData] = useState<DiagnosticResult | null>(null);

  const addLog = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    const emoji = type === 'success' ? '✅' : type === 'error' ? '❌' : '🔍';
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${emoji} ${msg}`]);
  };

  const runDiagnostics = async () => {
    setLoading(true);
    setLogs([]);
    setDiagnosticData(null);
    
    addLog("Începere Diagnostic Complete...", 'info');

    // TEST 1: Verificare API disponibil
    try {
      addLog("TEST 1: Verificare dacă API-ul răspunde...", 'info');
      const response = await fetch(`${API_URL}/diagnostics`);
      const data = await response.json();
      
      setDiagnosticData(data);
      
      if (response.ok) {
        addLog("API-ul răspunde corect!", 'success');
      } else {
        addLog(`API răspunde cu status: ${response.status}`, 'error');
      }

      // TEST 2: Verificare Environment Variables
      addLog("TEST 2: Verificare Environment Variables...", 'info');
      if (data.environment_variables) {
        Object.entries(data.environment_variables).forEach(([key, value]) => {
          if (value.includes('✅')) {
            addLog(`${key}: ${value}`, 'success');
          } else {
            addLog(`${key}: ${value} - LIPSEȘTE!`, 'error');
          }
        });
      }

      // TEST 3: Verificare Database Connection
      addLog("TEST 3: Verificare conexiune Database...", 'info');
      if (data.database_connection?.includes('✅')) {
        addLog(`Database: ${data.database_connection}`, 'success');
      } else {
        addLog(`Database: ${data.database_connection || 'FAILED'}`, 'error');
        if (data.error_message) {
          addLog(`Eroare: ${data.error_message}`, 'error');
        }
      }

      // TEST 4: Verificare Tabele
      addLog("TEST 4: Verificare existență tabele...", 'info');
      if (data.tables_check) {
        Object.entries(data.tables_check).forEach(([table, status]) => {
          if (status.includes('✅')) {
            addLog(`Tabel '${table}': ${status}`, 'success');
          } else {
            addLog(`Tabel '${table}': ${status}`, 'error');
          }
        });
      }

      // CONCLUZIE
      const allGood = 
        data.database_connection?.includes('✅') &&
        data.tables_check?.orders?.includes('✅') &&
        data.tables_check?.products?.includes('✅');

      if (allGood) {
        addLog("🎉 TOATE TESTELE AU TRECUT! Site-ul ar trebui să funcționeze.", 'success');
      } else {
        addLog("⚠️ AU FOST GĂSITE PROBLEME - Vezi detaliile mai sus", 'error');
      }

    } catch (error: any) {
      addLog(`Eroare critică: ${error.message}`, 'error');
      addLog("Posibile cauze:", 'error');
      addLog("1. API-ul nu este deployed pe Vercel", 'error');
      addLog("2. URL-ul API este greșit în constants.ts", 'error');
      addLog("3. Endpoint-ul /api/diagnostics nu există", 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-24 px-6 max-w-5xl mx-auto min-h-screen pb-12">
      <div className="mb-8">
        <h1 className="text-4xl font-black uppercase tracking-tighter mb-2">Diagnostic Sistem</h1>
        <p className="text-neutral-500">Verificare completă a conexiunii cu baza de date și API</p>
      </div>

      {/* Console Output */}
      <div className="bg-neutral-950 text-green-400 p-6 rounded-lg mb-6 h-96 overflow-auto font-mono text-sm border border-neutral-800">
        {logs.length === 0 ? (
          <div className="text-neutral-600 flex items-center justify-center h-full">
            Apasă butonul pentru a rula diagnosticul...
          </div>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="mb-2 leading-relaxed">
              {log}
            </div>
          ))
        )}
      </div>

      {/* Diagnostic Data Card */}
      {diagnosticData && (
        <div className="bg-white border border-neutral-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-bold mb-4 uppercase tracking-tight">Detalii Tehnice</h3>
          <pre className="bg-neutral-50 p-4 rounded text-xs overflow-auto max-h-96">
            {JSON.stringify(diagnosticData, null, 2)}
          </pre>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4">
        <Button onClick={runDiagnostics} disabled={loading} fullWidth>
          {loading ? '⏳ Se testează...' : '🔍 Rulează Diagnostic'}
        </Button>
        
        <Button 
          variant="outline" 
          onClick={() => window.open(`${API_URL}/diagnostics`, '_blank')}
        >
          📊 Vezi Raw JSON
        </Button>
      </div>

      {/* Help Section */}
      <div className="mt-12 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <h3 className="font-bold text-yellow-900 mb-2 flex items-center gap-2">
          <span>💡</span> Ghid Rapid de Rezolvare
        </h3>
        <ul className="text-sm text-yellow-800 space-y-2">
          <li>• Dacă vezi ❌ la Environment Variables → Setează-le în Vercel Dashboard</li>
          <li>• Dacă vezi ❌ la Database Connection → Verifică Remote MySQL în FreakHosting</li>
          <li>• Dacă vezi ❌ la Tabele → Rulează SQL-ul de creare tabele în phpMyAdmin</li>
          <li>• După orice modificare → Fă Redeploy în Vercel!</li>
        </ul>
      </div>
    </div>
  );
};