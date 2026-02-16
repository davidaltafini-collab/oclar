import React, { useState, useEffect } from 'react';
import { API_URL } from '../constants';
import { Button } from '../components/Button';

// --- INTERFEȚE ---
interface AdminProduct {
  id?: number;
  name: string;
  price: number;
  original_price?: number | null;
  stock_quantity: number;
  description: string;
  category: string;
  imageUrl: string;
  gallery: string[];
  colors: string[];
  details: string[];
}

interface Order {
    id: number;
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    total_amount: number;
    subtotal: number;
    shipping_cost: number;
    shipping_method: string;
    discount_code?: string;
    discount_amount: number;
    status: string;
    payment_method: string;
    created_at: string;
    items: string;
    oblio_invoice_number?: string;
    awb_number?: string;
    // Câmpuri necesare pentru editare
    county?: string;
    city?: string;
    address_line?: string;
    postal_code?: string;
    locker_id?: string;
    ecolet_shipment_id?: string;
    label_url?: string;
    ecolet_status?: string;
    // ⭐ CÂMP NOU
    is_hidden?: number; 
}

interface DiscountCode {
  id: number;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_amount: number;
  max_uses: number | null;
  used_count: number;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
}

// --- COMPONENTE UI REUTILIZABILE ---

// Slider Apple Style 🍎
const ToggleSwitch = ({ checked, onChange, label, subLabel }: { checked: boolean, onChange: (v: boolean) => void, label: string, subLabel?: string }) => (
  <div className="flex flex-col">
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => onChange(!checked)}>
        <div className={`w-11 h-6 rounded-full p-1 transition-colors duration-300 ease-in-out relative ${checked ? 'bg-green-500' : 'bg-neutral-300'}`}>
          <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform duration-300 ease-in-out absolute top-1 left-1 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
        </div>
        <span className="font-bold text-sm text-neutral-800 select-none">{label}</span>
      </div>
      {subLabel && <span className="text-[10px] text-neutral-400 mt-1 ml-14">{subLabel}</span>}
  </div>
);

// Badge Status
const StatusBadge = ({ status }: { status: string }) => {
    let color = 'bg-neutral-100 text-neutral-500';
    if (status === 'paid' || status === 'completed') color = 'bg-green-100 text-green-700';
    if (status === 'pending') color = 'bg-yellow-100 text-yellow-700';
    if (status === 'cancelled') color = 'bg-red-100 text-red-700';
    
    return (
        <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border border-transparent ${color}`}>
            {status}
        </span>
    );
};
export const Admin: React.FC = () => {
  // --- STATE-URI ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [secret, setSecret] = useState('');
  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'discounts'>('orders');
  
  // Date
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [discounts, setDiscounts] = useState<DiscountCode[]>([]);
  
  // UI Loading
  const [loading, setLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [ecoletLoading, setEcoletLoading] = useState(false);

  // Filtre & Selecție
  const [selectedOrders, setSelectedOrders] = useState<number[]>([]);
  const [showHidden, setShowHidden] = useState(false); // ⭐ NOU: Toggle Arhivă
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // ⭐ SETĂRI AUTOMATIZARE (Slider Apple)
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [autoOblio, setAutoOblio] = useState(true);
  const [autoEcolet, setAutoEcolet] = useState(true);

  // Formulare (Editare)
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editingDiscount, setEditingDiscount] = useState<Partial<DiscountCode> | null>(null);
  const [showDiscountForm, setShowDiscountForm] = useState(false);

  // --- AUTENTIFICARE ---
  useEffect(() => {
      const savedSecret = sessionStorage.getItem('admin_secret');
      if(savedSecret) {
          setSecret(savedSecret);
          // Validăm token-ul salvat
          fetch(`${API_URL}/admin?type=orders`, { headers: { 'x-admin-secret': savedSecret } })
            .then(res => {
                if(res.ok) {
                    setIsAuthenticated(true);
                    fetchSettings(savedSecret); // Încărcăm setările automatizării
                }
            })
            .catch(() => sessionStorage.removeItem('admin_secret'));
      }
  }, []);

  const handleLogin = async (e?: React.FormEvent) => {
    if(e) e.preventDefault();
    if(!secret) return;

    setLoginLoading(true);
    try {
        const res = await fetch(`${API_URL}/admin?type=orders`, {
            headers: { 'x-admin-secret': secret }
        });
        
        if (res.ok) {
            setIsAuthenticated(true);
            sessionStorage.setItem('admin_secret', secret);
            fetchData('orders');
            fetchSettings(secret);
        } else {
            alert('Cheie de securitate incorectă!');
        }
    } catch (err) {
        alert('Eroare de conexiune la server.');
    } finally {
        setLoginLoading(false);
    }
  };

  // --- API CALLS: SETĂRI & DATE ---

  // 1. Încarcă Setările Automatizării
  const fetchSettings = async (token: string) => {
    try {
      const res = await fetch(`${API_URL}/admin/settings`, {
        headers: { 'x-admin-secret': token }
      });
      const data = await res.json();
      setAutoEnabled(data.automation_enabled || false);
      setAutoOblio(data.auto_oblio !== false);
      setAutoEcolet(data.auto_ecolet !== false);
    } catch (e) { console.error('Settings err:', e); }
  };

  // 2. Salvează Setare (Când muți slider-ul)
  const updateSetting = async (key: string, value: boolean) => {
    // Update Optimist în UI
    if(key === 'automation_enabled') setAutoEnabled(value);
    if(key === 'auto_oblio') setAutoOblio(value);
    if(key === 'auto_ecolet') setAutoEcolet(value);

    // Trimite la Backend
    await fetch(`${API_URL}/admin/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
      body: JSON.stringify({ key, value })
    });
  };

  // 3. Încarcă Datele (Comenzi/Produse)
  const fetchData = async (type: 'orders' | 'products' | 'discounts') => {
    setLoading(true);
    try {
      let url = `${API_URL}/admin?type=${type}`;
      
      // Dacă suntem pe tab-ul comenzi, trimitem și filtrul de "Hidden"
      if (type === 'orders') {
        url += `&showHidden=${showHidden}`; 
        // Filtre clasice
        if (startDate) url += `&startDate=${startDate}`;
        if (endDate) url += `&endDate=${endDate}`;
        if (statusFilter) url += `&status=${statusFilter}`;
      }

      const res = await fetch(url, { headers: { 'x-admin-secret': secret } });
      
      if (res.status === 401) {
        setIsAuthenticated(false);
        return;
      }
      const data = await res.json();
      
      if (type === 'orders') {
        setOrders(data);
        // Resetăm selecția când schimbăm filtrele
        setSelectedOrders([]); 
      }
      if (type === 'products') setProducts(data);
      if (type === 'discounts') setDiscounts(data);

    } catch (err) { console.error(err); } 
    finally { setLoading(false); }
  };

  // Re-fetch când schimbăm tab-ul sau toggle-ul de arhivă
  useEffect(() => {
    if (isAuthenticated) fetchData(activeTab);
  }, [activeTab, showHidden, isAuthenticated]);


  // --- HANDLERS ACȚIUNI BULK ---

  const handleSelectAll = () => {
    if (selectedOrders.length === orders.length) setSelectedOrders([]);
    else setSelectedOrders(orders.map(o => o.id));
  };

  const toggleSelection = (id: number) => {
    setSelectedOrders(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // Handler Generic pentru Acțiuni (Hide, Oblio, Ecolet, CSV)
  const handleAction = async (action: 'hide' | 'unhide' | 'oblio' | 'ecolet' | 'csv') => {
    if (selectedOrders.length === 0) return alert('Selectează comenzi!');
    
    const count = selectedOrders.length;
    
    // Confirmare pentru acțiuni sensibile
    if (action === 'oblio' && !confirm(`Generezi ${count} facturi?`)) return;
    if (action === 'ecolet' && !confirm(`Expediezi ${count} comenzi la Ecolet?`)) return;

    setLoading(true);
    try {
        // 1. HIDE / UNHIDE
        if (action === 'hide' || action === 'unhide') {
            await fetch(`${API_URL}/admin/toggle-visibility`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
                body: JSON.stringify({ orderIds: selectedOrders, hide: action === 'hide' })
            });
            fetchData('orders'); // Refresh listă
        }
        
        // 2. OBLIO MANUAL
        else if (action === 'oblio') {
            const res = await fetch(`${API_URL}/admin/send-invoices`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
                body: JSON.stringify({ orderIds: selectedOrders })
            });
            const data = await res.json();
            alert(`✅ Rezultat Oblio: ${data.results?.length} procesate.`);
            fetchData('orders');
        }

        // 3. ECOLET MANUAL
        else if (action === 'ecolet') {
            const res = await fetch(`${API_URL}/admin/ecolet/export`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
                body: JSON.stringify({ orderIds: selectedOrders })
            });
            alert('✅ Comenzi trimise la Ecolet!');
            fetchData('orders');
        }

        // 4. EXPORT CSV (CONTABIL)
        else if (action === 'csv') {
            const res = await fetch(`${API_URL}/admin/export-orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
                body: JSON.stringify({ orderIds: selectedOrders, format: 'csv' })
            });
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `export_contabil_${Date.now()}.csv`;
            a.click();
        }

    } catch (e) {
        alert('Eroare acțiune: ' + e);
    } finally {
        setLoading(false);
    }
  };

  // --- HANDLERS PRODUSE & REDUCERI (Păstrate din codul vechi) ---
  // (Le includem aici compact ca să nu avem erori de referință)
  const handleProductSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!editingProduct) return;
      await fetch(`${API_URL}/admin/products`, { // URL corectat pt POST
          method: 'POST', headers: {'Content-Type': 'application/json', 'x-admin-secret': secret},
          body: JSON.stringify(editingProduct)
      });
      setShowProductForm(false); fetchData('products');
  };
  const handleDeleteProduct = async (id: number) => {
      if(!confirm('Sigur?')) return;
      await fetch(`${API_URL}/admin/products?id=${id}`, { method: 'DELETE', headers: {'x-admin-secret': secret}});
      fetchData('products');
  };
  const handleDiscountSubmit = async (e: React.FormEvent) => {
      e.preventDefault(); if(!editingDiscount) return;
      const method = editingDiscount.id ? 'PUT' : 'POST';
      await fetch(`${API_URL}/admin/discount-codes`, { method, headers: {'Content-Type': 'application/json', 'x-admin-secret': secret}, body: JSON.stringify(editingDiscount)});
      setShowDiscountForm(false); fetchData('discounts');
  };
  const handleDeleteDiscount = async (id: number) => {
      if(!confirm('Sigur?')) return;
      await fetch(`${API_URL}/admin/discount-codes?id=${id}`, { method: 'DELETE', headers: {'x-admin-secret': secret}});
      fetchData('discounts');
  };
  
  // Handler imagini (pentru produse)
  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>, isGallery: boolean = false) => {
    if (e.target.files && e.target.files[0] && editingProduct) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        if(isGallery) setEditingProduct({...editingProduct, gallery: [...(editingProduct.gallery||[]), base64]});
        else setEditingProduct({...editingProduct, imageUrl: base64});
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };
  // --- RENDER ---

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-100 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-neutral-200">
          <div className="flex justify-center mb-6">
             <div className="w-10 h-10 bg-brand-yellow rounded-full shadow-[0_0_15px_rgba(250,204,21,0.5)]"></div>
          </div>
          <h1 className="text-2xl font-black uppercase mb-2 text-center">Admin Panel</h1>
          <p className="text-center text-neutral-500 mb-8 text-sm">Zona restricționată Oclar</p>
          
          <form onSubmit={handleLogin}>
            <input 
                type="password" 
                placeholder="Cheia de Securitate" 
                className="w-full p-4 border border-neutral-200 rounded-xl mb-4 focus:border-brand-yellow outline-none transition-colors text-center text-lg"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                autoFocus
            />
            <Button fullWidth type="submit" disabled={loginLoading}>
                {loginLoading ? 'Se verifică...' : 'Autentificare'}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 pt-24 px-4 pb-32 animate-fade-in relative font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER & NAVIGARE */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
            <div>
                <h1 className="text-3xl font-black uppercase tracking-tight text-neutral-900">Dashboard</h1>
                <p className="text-neutral-500 text-sm">Centru de Comandă Oclar</p>
            </div>
            
            <div className="flex bg-white p-1 rounded-xl shadow-sm border border-neutral-200 overflow-x-auto">
                {['orders', 'products', 'discounts'].map((tab) => (
                    <button 
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={`px-6 py-2 rounded-lg font-bold text-sm capitalize transition-all ${activeTab === tab ? 'bg-black text-white shadow-md' : 'text-neutral-500 hover:bg-neutral-50'}`}
                    >
                        {tab === 'orders' ? 'Comenzi' : tab === 'products' ? 'Produse' : 'Reduceri'}
                    </button>
                ))}
                <button
                    onClick={() => { setIsAuthenticated(false); sessionStorage.removeItem('admin_secret'); }}
                    className="ml-2 px-4 py-2 rounded-lg font-bold text-sm text-red-500 hover:bg-red-50 transition-colors"
                    title="Deconectare"
                >✕</button>
            </div>
        </div>

        {/* --- CONȚINUT TAB: COMENZI --- */}
        {activeTab === 'orders' && (
            <div className="animate-fade-in space-y-6">
                
                {/* 1. ZONA AUTOMATIZARE & SETĂRI GLOBALE */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-neutral-200 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-6">
                        <ToggleSwitch 
                            checked={autoEnabled} 
                            onChange={(v) => updateSetting('automation_enabled', v)} 
                            label="🤖 Auto-Process" 
                            subLabel="Procesare automată comenzi"
                        />
                        
                        {/* Sub-opțiuni care apar doar dacă Automatizarea e ON */}
                        {autoEnabled && (
                            <div className="flex flex-col sm:flex-row gap-4 pl-6 border-l border-neutral-200 animate-fade-in">
                                <label className="flex items-center gap-2 text-sm font-medium text-neutral-600 cursor-pointer hover:text-black transition-colors">
                                    <input type="checkbox" checked={autoOblio} onChange={e => updateSetting('auto_oblio', e.target.checked)} className="w-4 h-4 rounded text-black focus:ring-0" />
                                    Facturare Oblio
                                </label>
                                <label className="flex items-center gap-2 text-sm font-medium text-neutral-600 cursor-pointer hover:text-black transition-colors">
                                    <input type="checkbox" checked={autoEcolet} onChange={e => updateSetting('auto_ecolet', e.target.checked)} className="w-4 h-4 rounded text-black focus:ring-0" />
                                    Curier Ecolet
                                </label>
                            </div>
                        )}
                    </div>

                    <div className="text-right hidden md:block">
                        <div className="text-xs text-neutral-400 font-mono">Server Status: Online</div>
                        <div className="text-xs text-neutral-400 font-mono">Last Sync: {new Date().toLocaleTimeString()}</div>
                    </div>
                </div>

                {/* 2. FILTRE & CONTROL VIZUALIZARE */}
                <div className="flex flex-wrap gap-4 items-end justify-between bg-white p-4 rounded-xl border border-neutral-200 shadow-sm">
                    <div className="flex flex-wrap gap-3">
                        <div>
                            <label className="label-admin">Status</label>
                            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-admin py-2 text-sm min-w-[120px]">
                                <option value="">Toate</option>
                                <option value="paid">Paid</option>
                                <option value="pending">Pending</option>
                                <option value="completed">Completed</option>
                            </select>
                        </div>
                        <div>
                            <label className="label-admin">Dată Start</label>
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input-admin py-2 text-sm" />
                        </div>
                        <div>
                            <label className="label-admin">Dată Final</label>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input-admin py-2 text-sm" />
                        </div>
                        <div className="flex items-end">
                             <Button onClick={() => fetchData('orders')} variant="outline" className="py-2 text-sm h-[38px]">Aplică</Button>
                        </div>
                    </div>

                    {/* Toggle Arhivă */}
                    <button 
                        onClick={() => setShowHidden(!showHidden)}
                        className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all flex items-center gap-2 ${showHidden ? 'bg-neutral-800 text-white border-neutral-800' : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'}`}
                    >
                        {showHidden ? '📂 Ascunde Arhiva' : '📂 Arată Arhiva'}
                    </button>
                </div>

                {/* 3. TABEL COMENZI */}
                <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-neutral-50 text-neutral-500 uppercase font-bold text-[10px] tracking-wider border-b border-neutral-100">
                                <tr>
                                    <th className="px-6 py-4 w-10"><input type="checkbox" onChange={handleSelectAll} checked={selectedOrders.length === orders.length && orders.length > 0} /></th>
                                    <th className="px-6 py-4">ID</th>
                                    <th className="px-6 py-4">Client</th>
                                    <th className="px-6 py-4">Total</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">Factură</th>
                                    <th className="px-6 py-4">AWB</th>
                                    <th className="px-6 py-4 text-right">Acțiuni</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                                {orders.length === 0 && (
                                    <tr><td colSpan={8} className="p-8 text-center text-neutral-400">Nu există comenzi de afișat.</td></tr>
                                )}
                                {orders.map(order => {
                                    const isHidden = order.is_hidden === 1;
                                    return (
                                        <tr 
                                            key={order.id} 
                                            className={`transition-colors duration-200 ${isHidden ? 'bg-neutral-100/50 text-neutral-400' : 'hover:bg-neutral-50'}`}
                                        >
                                            <td className="px-6 py-4"><input type="checkbox" checked={selectedOrders.includes(order.id)} onChange={() => toggleSelection(order.id)} /></td>
                                            <td className="px-6 py-4 font-mono">
                                                <div className="flex items-center gap-2">
                                                    #{order.id}
                                                    {isHidden && <span title="Arhivat" className="text-lg leading-none">🔒</span>}
                                                </div>
                                                <div className="text-[10px] text-neutral-400">{new Date(order.created_at).toLocaleDateString()}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className={`font-bold ${isHidden ? 'text-neutral-500' : 'text-neutral-900'}`}>{order.customer_name}</div>
                                                <div className="text-xs opacity-70">{order.customer_email}</div>
                                            </td>
                                            <td className="px-6 py-4 font-bold">
                                                {parseFloat(order.total_amount.toString()).toFixed(2)} RON
                                                <div className="text-[10px] font-normal uppercase text-neutral-500">{order.payment_method}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <StatusBadge status={order.status} />
                                            </td>
                                            <td className="px-6 py-4 text-xs font-mono">
                                                {order.oblio_invoice_number ? (
                                                    <span className="text-green-600 bg-green-50 px-2 py-1 rounded">✓ {order.oblio_invoice_number}</span>
                                                ) : <span className="opacity-50">-</span>}
                                            </td>
                                            <td className="px-6 py-4 text-xs">
                                                {order.awb_number ? (
                                                    <a href={order.label_url || '#'} target="_blank" rel="noreferrer" className="text-blue-600 bg-blue-50 px-2 py-1 rounded hover:underline">
                                                        📦 {order.awb_number}
                                                    </a>
                                                ) : (
                                                    order.ecolet_status === 'draft' ? <span className="text-orange-500">⏳ Draft</span> : <span className="opacity-50">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button 
                                                    onClick={() => setEditingOrder(order)} 
                                                    className="text-neutral-400 hover:text-black transition-colors p-2 rounded-full hover:bg-white border border-transparent hover:border-neutral-200"
                                                    title="Editează Comanda"
                                                >
                                                    ✏️
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 4. BARA PLUTITOARE DE ACȚIUNI (FLOATING ACTION BAR) */}
                {selectedOrders.length > 0 && (
                    <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-neutral-900/95 backdrop-blur-md text-white px-2 py-2 pr-6 rounded-full shadow-2xl flex items-center gap-1 z-50 animate-bounce-in border border-neutral-700">
                        <div className="bg-neutral-800 rounded-full px-4 py-2 font-bold text-sm mr-2 shadow-inner">
                            {selectedOrders.length} selectate
                        </div>
                        
                        <button onClick={() => handleAction('oblio')} className="hover:bg-neutral-700 px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2">
                            📄 Oblio
                        </button>
                        
                        <button onClick={() => handleAction('ecolet')} className="hover:bg-neutral-700 px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2">
                            🚚 Ecolet
                        </button>

                        <button onClick={() => handleAction('csv')} className="hover:bg-neutral-700 px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2">
                            📊 CSV
                        </button>

                        <div className="w-px h-6 bg-neutral-700 mx-2"></div>

                        <button 
                            onClick={() => handleAction(showHidden ? 'unhide' : 'hide')} 
                            className={`px-4 py-2 rounded-full text-sm font-bold transition-colors flex items-center gap-2 ${showHidden ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-red-600 hover:bg-red-500 text-white'}`}
                        >
                            {showHidden ? '🔓 Reactivează' : '🔒 Arhivează'}
                        </button>
                    </div>
                )}
            </div>
        )}

        {/* --- CONȚINUT TAB: PRODUSE --- */}
        {activeTab === 'products' && (
            <div className="animate-fade-in">
                <div className="flex justify-end mb-6">
                    <Button onClick={() => {
                        setEditingProduct({ name: '', price: 0, stock_quantity: 10, description: '', category: 'Ochelari', imageUrl: '', gallery: [], colors: [], details: [] });
                        setShowProductForm(true);
                    }}>+ Adaugă Produs Nou</Button>
                </div>

                {showProductForm && editingProduct && (
                    <div className="bg-white p-8 rounded-2xl shadow-xl mb-8 border border-neutral-200 animate-fade-in scroll-mt-24" id="productForm">
                        <h3 className="text-xl font-bold mb-6 flex items-center gap-2 border-b border-neutral-100 pb-4">
                             {editingProduct.id ? '✏️ Editează Produs' : '✨ Produs Nou'}
                        </h3>
                        <form onSubmit={handleProductSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <div><label className="label-admin">Nume Produs</label><input className="input-admin" value={editingProduct.name} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} required /></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="label-admin">Preț (RON)</label><input type="number" step="0.01" className="input-admin font-bold" value={editingProduct.price} onChange={e => setEditingProduct({...editingProduct, price: parseFloat(e.target.value)})} required /></div>
                                    <div><label className="label-admin text-red-500">Preț Vechi</label><input type="number" step="0.01" className="input-admin text-red-500" value={editingProduct.original_price || ''} onChange={e => setEditingProduct({...editingProduct, original_price: e.target.value ? parseFloat(e.target.value) : null})} /></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="label-admin">Stoc</label><input type="number" className="input-admin" value={editingProduct.stock_quantity} onChange={e => setEditingProduct({...editingProduct, stock_quantity: parseInt(e.target.value)})} required /></div>
                                    <div><label className="label-admin">Categorie</label><input className="input-admin" value={editingProduct.category} onChange={e => setEditingProduct({...editingProduct, category: e.target.value})} required /></div>
                                </div>
                                <div><label className="label-admin">Descriere</label><textarea className="input-admin h-32 resize-none" value={editingProduct.description} onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} required /></div>
                            </div>
                            <div className="space-y-6">
                                <div>
                                    <label className="label-admin">Poză Principală</label>
                                    <div className="border-2 border-dashed border-neutral-300 rounded-xl p-4 text-center hover:bg-neutral-50 transition-colors cursor-pointer relative group overflow-hidden bg-neutral-50 min-h-[200px] flex items-center justify-center">
                                        <input type="file" onChange={(e) => handleImageFile(e, false)} className="absolute inset-0 opacity-0 cursor-pointer z-10" accept="image/*" />
                                        {editingProduct.imageUrl ? <img src={editingProduct.imageUrl} className="w-full h-full object-contain" alt="Cover" /> : <div className="text-neutral-400">Click pentru upload</div>}
                                    </div>
                                </div>
                                <div>
                                    <label className="label-admin">Galerie</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {editingProduct.gallery.map((img, idx) => (
                                            <div key={idx} className="relative aspect-square border rounded-lg overflow-hidden bg-white"><img src={img} className="w-full h-full object-cover" alt="Gal" /></div>
                                        ))}
                                        <div className="border-2 border-dashed border-neutral-300 rounded-lg flex items-center justify-center aspect-square hover:bg-neutral-50 cursor-pointer relative">
                                            <input type="file" onChange={(e) => handleImageFile(e, true)} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
                                            <span className="text-2xl text-neutral-300">+</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="md:col-span-2 flex gap-4 border-t border-neutral-100 pt-6">
                                <Button type="submit">Salvează</Button>
                                <Button variant="outline" onClick={() => setShowProductForm(false)} type="button">Anulează</Button>
                            </div>
                        </form>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {products.map(p => (
                        <div key={p.id} className="bg-white p-5 rounded-2xl shadow-sm border border-neutral-100 flex flex-col group hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-4">
                                <div className="w-20 h-20 rounded-lg overflow-hidden border border-neutral-100 bg-neutral-50 relative"><img src={p.imageUrl} className="w-full h-full object-cover" alt={p.name} /></div>
                                <div className="text-right"><div className="font-bold text-xl">{p.price} <span className="text-xs font-normal">RON</span></div><div className={`mt-2 px-2 py-1 rounded text-[10px] font-bold uppercase inline-block ${p.stock_quantity > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>Stoc: {p.stock_quantity}</div></div>
                            </div>
                            <h3 className="font-bold text-lg mb-1">{p.name}</h3>
                            <div className="flex gap-2 border-t border-neutral-100 pt-4 mt-auto">
                                <button onClick={() => { setEditingProduct(p); setShowProductForm(true); setTimeout(() => document.getElementById('productForm')?.scrollIntoView({behavior: 'smooth'}), 100); }} className="flex-1 bg-neutral-50 hover:bg-neutral-100 py-2 rounded-lg text-xs font-bold uppercase">Editează</button>
                                <button onClick={() => p.id && handleDeleteProduct(p.id)} className="px-3 bg-white border border-red-100 text-red-500 rounded-lg hover:bg-red-50">✕</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* --- CONȚINUT TAB: REDUCERI --- */}
        {activeTab === 'discounts' && (
            <div className="animate-fade-in">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold">Coduri de Reducere</h2>
                    <Button onClick={() => { setEditingDiscount({ code: '', discount_type: 'percentage', discount_value: 10, min_order_amount: 0, used_count: 0, valid_from: new Date().toISOString().split('T')[0], is_active: true }); setShowDiscountForm(true); }}>+ Adaugă Cod</Button>
                </div>
                {/* Formular Reduceri (Simplificat vizual pentru concizie, păstrând funcționalitatea) */}
                {showDiscountForm && editingDiscount && (
                    <div className="bg-white p-6 rounded-2xl shadow-xl mb-8 border border-neutral-200">
                        <form onSubmit={handleDiscountSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div><label className="label-admin">Cod</label><input className="input-admin uppercase font-bold" value={editingDiscount.code} onChange={e=>setEditingDiscount({...editingDiscount, code: e.target.value.toUpperCase()})} required /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="label-admin">Tip</label><select className="input-admin" value={editingDiscount.discount_type} onChange={e=>setEditingDiscount({...editingDiscount, discount_type: e.target.value as any})}><option value="percentage">%</option><option value="fixed">RON</option></select></div>
                                <div><label className="label-admin">Valoare</label><input type="number" className="input-admin" value={editingDiscount.discount_value} onChange={e=>setEditingDiscount({...editingDiscount, discount_value: parseFloat(e.target.value)})} required /></div>
                            </div>
                            <div className="md:col-span-2 flex gap-4"><Button type="submit">Salvează</Button><Button variant="outline" onClick={()=>setShowDiscountForm(false)} type="button">Anulează</Button></div>
                        </form>
                    </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {discounts.map(d => (
                        <div key={d.id} className={`p-5 rounded-xl border ${d.is_active ? 'bg-white border-neutral-200' : 'bg-neutral-50 border-neutral-100 opacity-60'}`}>
                            <div className="flex justify-between mb-2"><div className="font-mono font-black text-xl bg-yellow-50 px-2 rounded">{d.code}</div><button onClick={()=>handleDeleteDiscount(d.id)} className="text-red-500 text-xs font-bold">Șterge</button></div>
                            <div className="text-sm">Reducere: <b>{d.discount_value}{d.discount_type === 'percentage' ? '%' : ' RON'}</b></div>
                            <div className="text-xs text-neutral-500 mt-2">Utilizări: {d.used_count}</div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* MODAL EDITARE COMANDĂ (Păstrat minimal pentru a nu bloca pagina) */}
        {editingOrder && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
                <div className="bg-white rounded-2xl p-8 w-full max-w-lg">
                    <h2 className="text-xl font-bold mb-4">Editare Comandă #{editingOrder.id}</h2>
                    {/* Formular simplificat pentru editare status/tracking */}
                    <div className="space-y-4">
                        <div><label className="label-admin">Status</label>
                        <select className="input-admin" value={editingOrder.status} onChange={e=>setEditingOrder({...editingOrder, status: e.target.value})}>
                            <option value="pending">Pending</option><option value="paid">Paid</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
                        </select></div>
                        <div><label className="label-admin">AWB Number</label><input className="input-admin" value={editingOrder.awb_number||''} onChange={e=>setEditingOrder({...editingOrder, awb_number: e.target.value})} /></div>
                        <div className="flex gap-2 pt-4">
                            {/* Aici ar trebui un handler separat de updateOrder, dar momentan folosim logica generică */}
                            <Button onClick={async () => {
                                await fetch(`${API_URL}/admin`, { method: 'PUT', headers: {'Content-Type': 'application/json', 'x-admin-secret': secret}, body: JSON.stringify({ orderId: editingOrder.id, status: editingOrder.status, awb_number: editingOrder.awb_number }) });
                                setEditingOrder(null); fetchData('orders');
                            }}>Salvează</Button>
                            <Button variant="outline" onClick={()=>setEditingOrder(null)}>Anulează</Button>
                        </div>
                    </div>
                </div>
            </div>
        )}

      </div>
      <style>{`
        .input-admin { width: 100%; padding: 0.75rem; border: 1px solid #e5e5e5; border-radius: 0.5rem; outline: none; font-size: 0.875rem; transition: border-color 0.2s; }
        .input-admin:focus { border-color: black; }
        .label-admin { display: block; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: #737373; margin-bottom: 0.35rem; letter-spacing: 0.05em; }
        @keyframes bounce-in { 0% { opacity: 0; transform: translate(-50%, 20px); } 100% { opacity: 1; transform: translate(-50%, 0); } }
        .animate-bounce-in { animation: bounce-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
      `}</style>
    </div>
  );
};