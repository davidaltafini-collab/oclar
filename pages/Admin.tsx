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
    county?: string;
    city?: string;
    address_line?: string;
    postal_code?: string;
    locker_id?: string;
    ecolet_shipment_id?: string;
    label_url?: string;
    ecolet_status?: string;
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

// --- COMPONENTE UI ---

// Slider Apple Style 🍎
const ToggleSwitch = ({ checked, onChange, label, subLabel, disabled }: { checked: boolean, onChange: (v: boolean) => void, label: string, subLabel?: string, disabled?: boolean }) => (
  <div className="flex flex-col">
      <div className={`flex items-center gap-3 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`} onClick={() => !disabled && onChange(!checked)}>
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
    let color = 'bg-neutral-100 text-neutral-500 border-neutral-200';
    if (status === 'paid' || status === 'completed') color = 'bg-green-50 text-green-700 border-green-200';
    if (status === 'pending') color = 'bg-yellow-50 text-yellow-700 border-yellow-200';
    if (status === 'cancelled') color = 'bg-red-50 text-red-700 border-red-200';
    
    return (
        <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border ${color}`}>
            {status}
        </span>
    );
};

export const Admin: React.FC = () => {
  // --- STATE-URI ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [secret, setSecret] = useState('');
  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'discounts'>('orders');
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [discounts, setDiscounts] = useState<DiscountCode[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [ecoletLoading, setEcoletLoading] = useState(false);

  const [selectedOrders, setSelectedOrders] = useState<number[]>([]);
  const [showHidden, setShowHidden] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // ⭐ SETĂRI AUTOMATIZARE
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [autoOblio, setAutoOblio] = useState(true);
  const [autoEcolet, setAutoEcolet] = useState(true);

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
          fetch(`${API_URL}/admin?type=orders`, { headers: { 'x-admin-secret': savedSecret } })
            .then(res => {
                if(res.ok) {
                    setIsAuthenticated(true);
                    fetchSettings(savedSecret);
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

  // --- API CALLS ---

  const fetchSettings = async (token: string) => {
    try {
      const res = await fetch(`${API_URL}/admin/settings`, {
        headers: { 'x-admin-secret': token }
      });
      const data = await res.json();
      
      // 🔥 FIX: Convertim corect Boolean din response
      setAutoEnabled(data.automation_enabled === true || data.automation_enabled === 'true');
      setAutoOblio(data.auto_oblio === true || data.auto_oblio === 'true');
      setAutoEcolet(data.auto_ecolet === true || data.auto_ecolet === 'true');
      
      console.log('✅ Settings loaded:', data);
    } catch (e) { 
      console.error('Settings err:', e); 
    }
  };

  const updateSetting = async (key: string, value: boolean) => {
    // Update optimist în UI
    if(key === 'automation_enabled') setAutoEnabled(value);
    if(key === 'auto_oblio') setAutoOblio(value);
    if(key === 'auto_ecolet') setAutoEcolet(value);

    // Trimite la Backend
    try {
      await fetch(`${API_URL}/admin/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
        body: JSON.stringify({ key, value })
      });
      console.log(`✅ Setting saved: ${key} = ${value}`);
    } catch (e) {
      console.error('❌ Error saving setting:', e);
      alert('Eroare la salvare setare!');
    }
  };

  const fetchData = async (type: 'orders' | 'products' | 'discounts') => {
    setLoading(true);
    try {
      let url = `${API_URL}/admin?type=${type}`;
      
      if (type === 'orders') {
        url += `&showHidden=${showHidden}`;
        if (startDate) url += `&startDate=${startDate}`;
        if (endDate) url += `&endDate=${endDate}`;
        if (statusFilter) url += `&status=${statusFilter}`;
      }

      const res = await fetch(url, { headers: { 'x-admin-secret': secret } });
      
      if (res.status === 401) {
        setIsAuthenticated(false);
        sessionStorage.removeItem('admin_secret');
        return;
      }
      const data = await res.json();
      
      if (type === 'orders') {
        setOrders(data);
        setSelectedOrders([]);
      }
      if (type === 'products') setProducts(data);
      if (type === 'discounts') setDiscounts(data);

    } catch (err) { 
      console.error(err); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => {
    if (isAuthenticated) fetchData(activeTab);
  }, [activeTab, showHidden, isAuthenticated]);

  // --- HANDLERS ---

  const handleSelectAll = () => {
    const visibleOrders = orders.filter(o => o.is_hidden !== 1);
    if (selectedOrders.length === visibleOrders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(visibleOrders.map(o => o.id));
    }
  };

  const toggleSelection = (id: number) => {
    setSelectedOrders(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleAction = async (action: 'hide' | 'unhide' | 'oblio' | 'ecolet' | 'csv' | 'xml') => {
    if (selectedOrders.length === 0) return alert('Selectează comenzi!');
    
    const count = selectedOrders.length;
    
    if (action === 'oblio' && !confirm(`Generezi ${count} facturi Oblio?`)) return;
    if (action === 'ecolet' && !confirm(`Expediezi ${count} comenzi la Ecolet?`)) return;

    setLoading(true);
    try {
        if (action === 'hide' || action === 'unhide') {
            await fetch(`${API_URL}/admin/toggle-visibility`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
                body: JSON.stringify({ orderIds: selectedOrders, hide: action === 'hide' })
            });
            fetchData('orders');
        }
        
        else if (action === 'oblio') {
            const res = await fetch(`${API_URL}/admin/send-invoices`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
                body: JSON.stringify({ orderIds: selectedOrders })
            });
            const data = await res.json();
            const success = data.results?.filter((r: any) => r.success).length || 0;
            alert(`✅ Oblio: ${success}/${count} facturi generate.`);
            fetchData('orders');
        }

        else if (action === 'ecolet') {
            const res = await fetch(`${API_URL}/admin/ecolet/export`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
                body: JSON.stringify({ orderIds: selectedOrders })
            });
            const data = await res.json();
            const success = data.results?.filter((r: any) => r.success).length || 0;
            alert(`✅ Ecolet: ${success}/${count} comenzi trimise.`);
            fetchData('orders');
        }

        else if (action === 'csv' || action === 'xml') {
            const res = await fetch(`${API_URL}/admin/export-orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
                body: JSON.stringify({ orderIds: selectedOrders, format: action })
            });
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `export_contabil_${Date.now()}.${action}`;
            a.click();
            window.URL.revokeObjectURL(url);
        }

    } catch (e) {
        alert('Eroare acțiune: ' + e);
    } finally {
        setLoading(false);
    }
  };

  const handleEcoletSync = async () => {
    if (selectedOrders.length === 0) return alert('Selectează comenzi!');
    
    setEcoletLoading(true);
    try {
        const res = await fetch(`${API_URL}/admin/ecolet/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
            body: JSON.stringify({ orderIds: selectedOrders })
        });
        const data = await res.json();
        const success = data.results?.filter((r: any) => r.success).length || 0;
        alert(`✅ Sincronizare: ${success}/${selectedOrders.length} AWB-uri actualizate.`);
        fetchData('orders');
    } catch (e) {
        alert('Eroare sincronizare: ' + e);
    } finally {
        setEcoletLoading(false);
    }
  };

  // --- HANDLERS PRODUSE ---
  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>, isGallery: boolean = false) => {
    if (e.target.files && e.target.files[0] && editingProduct) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        if(isGallery) {
          setEditingProduct({...editingProduct, gallery: [...(editingProduct.gallery||[]), base64]});
        } else {
          setEditingProduct({...editingProduct, imageUrl: base64});
        }
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const removeGalleryImage = (index: number) => {
      if (!editingProduct) return;
      const newGallery = [...editingProduct.gallery];
      newGallery.splice(index, 1);
      setEditingProduct({ ...editingProduct, gallery: newGallery });
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!editingProduct) return;
      
      try {
        const res = await fetch(`${API_URL}/admin`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json', 'x-admin-secret': secret},
          body: JSON.stringify(editingProduct)
        });
        
        if(res.ok) {
          alert('Produs salvat!');
          setShowProductForm(false);
          setEditingProduct(null);
          fetchData('products');
        } else {
          alert('Eroare salvare produs.');
        }
      } catch (e) {
        alert('Eroare rețea.');
      }
  };

  const handleDeleteProduct = async (id: number) => {
      if(!confirm('Ștergi produsul?')) return;
      await fetch(`${API_URL}/admin?id=${id}`, { method: 'DELETE', headers: {'x-admin-secret': secret}});
      fetchData('products');
  };

  // --- HANDLERS REDUCERI ---
  const handleDiscountSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!editingDiscount) return;
      
      const method = editingDiscount.id ? 'PUT' : 'POST';
      try {
        const res = await fetch(`${API_URL}/admin/discount-codes`, {
          method,
          headers: {'Content-Type': 'application/json', 'x-admin-secret': secret},
          body: JSON.stringify(editingDiscount)
        });
        
        if(res.ok) {
          alert('Cod salvat!');
          setShowDiscountForm(false);
          setEditingDiscount(null);
          fetchData('discounts');
        } else {
          alert('Eroare salvare cod.');
        }
      } catch (e) {
        alert('Eroare rețea.');
      }
  };

  const handleDeleteDiscount = async (id: number) => {
      if(!confirm('Ștergi codul?')) return;
      await fetch(`${API_URL}/admin/discount-codes?id=${id}`, { method: 'DELETE', headers: {'x-admin-secret': secret}});
      fetchData('discounts');
  };

  // --- HANDLERS COMENZI ---
  const handleUpdateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;

    try {
        const res = await fetch(`${API_URL}/admin`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-secret': secret
            },
            body: JSON.stringify({
                orderId: editingOrder.id,
                customer_name: editingOrder.customer_name,
                customer_phone: editingOrder.customer_phone,
                customer_email: editingOrder.customer_email,
                status: editingOrder.status,
                county: editingOrder.county,
                city: editingOrder.city,
                address_line: editingOrder.address_line,
                postal_code: editingOrder.postal_code,
                locker_id: editingOrder.locker_id
            })
        });

        if (res.ok) {
            alert('Comandă actualizată!');
            setEditingOrder(null);
            fetchData('orders');
        } else {
            alert('Eroare actualizare.');
        }
    } catch (err) {
        alert('Eroare server.');
    }
  };

  const handleQuickDateFilter = (range: 'today' | 'week' | 'month' | 'year') => {
    const now = new Date();
    const end = now.toISOString().split('T')[0];
    let start = '';

    switch(range) {
      case 'today':
        start = end;
        break;
      case 'week':
        start = new Date(now.setDate(now.getDate() - 7)).toISOString().split('T')[0];
        break;
      case 'month':
        start = new Date(now.setMonth(now.getMonth() - 1)).toISOString().split('T')[0];
        break;
      case 'year':
        start = new Date(now.setFullYear(now.getFullYear() - 1)).toISOString().split('T')[0];
        break;
    }

    setStartDate(start);
    setEndDate(end);
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
    <div className="min-h-screen bg-neutral-50 pt-20 px-4 pb-40 animate-fade-in relative font-sans">
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
                        className={`px-4 md:px-6 py-2 rounded-lg font-bold text-sm capitalize transition-all whitespace-nowrap ${activeTab === tab ? 'bg-black text-white shadow-md' : 'text-neutral-500 hover:bg-neutral-50'}`}
                    >
                        {tab === 'orders' ? 'Comenzi' : tab === 'products' ? 'Produse' : 'Reduceri'}
                    </button>
                ))}
                <button
                    onClick={() => { setIsAuthenticated(false); sessionStorage.removeItem('admin_secret'); }}
                    className="ml-2 px-3 md:px-4 py-2 rounded-lg font-bold text-sm text-red-500 hover:bg-red-50 transition-colors"
                    title="Deconectare"
                >✕</button>
            </div>
        </div>

        {/* --- TAB COMENZI --- */}
        {activeTab === 'orders' && (
            <div className="animate-fade-in space-y-6">
                
                {/* ZONA AUTOMATIZARE */}
                <div className="bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-neutral-200 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 lg:gap-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 w-full lg:w-auto">
                        <ToggleSwitch 
                            checked={autoEnabled} 
                            onChange={(v) => updateSetting('automation_enabled', v)} 
                            label="🤖 Auto-Process" 
                            subLabel="Procesare automată"
                        />
                        
                        {autoEnabled && (
                            <div className="flex flex-col sm:flex-row gap-3 pl-0 sm:pl-6 sm:border-l border-neutral-200 animate-fade-in w-full sm:w-auto">
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

                    <div className="text-right hidden lg:block">
                        <div className="text-xs text-neutral-400 font-mono">Server: Online</div>
                        <div className="text-xs text-neutral-400 font-mono">{new Date().toLocaleTimeString()}</div>
                    </div>
                </div>

                {/* FILTRE */}
                <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-4 md:p-6 space-y-4">
                    <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-end justify-between">
                        <div className="w-full lg:w-auto">
                            <label className="label-admin">Perioadă Rapidă</label>
                            <div className="flex flex-wrap gap-2">
                                <button onClick={() => handleQuickDateFilter('today')} className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 rounded text-xs font-medium transition-colors">Azi</button>
                                <button onClick={() => handleQuickDateFilter('week')} className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 rounded text-xs font-medium transition-colors">7 zile</button>
                                <button onClick={() => handleQuickDateFilter('month')} className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 rounded text-xs font-medium transition-colors">30 zile</button>
                                <button onClick={() => handleQuickDateFilter('year')} className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 rounded text-xs font-medium transition-colors">1 an</button>
                            </div>
                        </div>

                        <button 
                            onClick={() => setShowHidden(!showHidden)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all flex items-center gap-2 whitespace-nowrap ${showHidden ? 'bg-neutral-800 text-white border-neutral-800' : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'}`}
                        >
                            {showHidden ? '📂 Ascunde Arhiva' : '📂 Arată Arhiva'}
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div>
                            <label className="label-admin">Status</label>
                            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-admin py-2 text-sm">
                                <option value="">Toate</option>
                                <option value="paid">Paid</option>
                                <option value="pending">Pending</option>
                                <option value="completed">Completed</option>
                                <option value="cancelled">Cancelled</option>
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
                             <Button onClick={() => fetchData('orders')} variant="outline" className="py-2 text-sm h-[38px] w-full">Aplică</Button>
                        </div>
                    </div>
                </div>

                {/* TABEL COMENZI */}
                <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left min-w-[800px]">
                            <thead className="bg-neutral-50 text-neutral-500 uppercase font-bold text-[10px] tracking-wider border-b border-neutral-100">
                                <tr>
                                    <th className="px-4 md:px-6 py-4 w-10">
                                        <input 
                                            type="checkbox" 
                                            onChange={handleSelectAll} 
                                            checked={selectedOrders.length > 0 && selectedOrders.length === orders.filter(o => o.is_hidden !== 1).length} 
                                            className="w-4 h-4"
                                        />
                                    </th>
                                    <th className="px-4 md:px-6 py-4">ID</th>
                                    <th className="px-4 md:px-6 py-4">Client</th>
                                    <th className="px-4 md:px-6 py-4">Total</th>
                                    <th className="px-4 md:px-6 py-4">Status</th>
                                    <th className="px-4 md:px-6 py-4">Factură</th>
                                    <th className="px-4 md:px-6 py-4">AWB</th>
                                    <th className="px-4 md:px-6 py-4 text-right">Acțiuni</th>
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
                                            className={`transition-colors duration-200 ${isHidden ? 'bg-neutral-100/50 text-neutral-400 opacity-60' : 'hover:bg-neutral-50'}`}
                                        >
                                            <td className="px-4 md:px-6 py-4">
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedOrders.includes(order.id)} 
                                                    onChange={() => toggleSelection(order.id)}
                                                    className="w-4 h-4"
                                                />
                                            </td>
                                            <td className="px-4 md:px-6 py-4 font-mono">
                                                <div className="flex items-center gap-2">
                                                    <span className={isHidden ? 'text-neutral-400' : 'text-neutral-900'}>#{order.id}</span>
                                                    {isHidden && <span title="Arhivat" className="text-base">🔒</span>}
                                                </div>
                                                <div className="text-[10px] text-neutral-400 mt-0.5">{new Date(order.created_at).toLocaleDateString()}</div>
                                            </td>
                                            <td className="px-4 md:px-6 py-4">
                                                <div className={`font-bold text-sm ${isHidden ? 'text-neutral-500' : 'text-neutral-900'}`}>{order.customer_name}</div>
                                                <div className="text-xs opacity-70 truncate max-w-[150px]">{order.customer_email}</div>
                                                <div className="text-xs font-mono opacity-70">{order.customer_phone}</div>
                                            </td>
                                            <td className="px-4 md:px-6 py-4">
                                                <div className="font-bold text-base">{parseFloat(order.total_amount.toString()).toFixed(2)} <span className="text-xs font-normal">RON</span></div>
                                                <div className="text-[10px] font-normal uppercase text-neutral-500 mt-0.5">
                                                    {order.payment_method === 'card' ? '💳 Card' : '💵 Ramburs'}
                                                </div>
                                            </td>
                                            <td className="px-4 md:px-6 py-4">
                                                <StatusBadge status={order.status} />
                                            </td>
                                            <td className="px-4 md:px-6 py-4 text-xs font-mono">
                                                {order.oblio_invoice_number ? (
                                                    <span className="text-green-600 bg-green-50 px-2 py-1 rounded font-semibold inline-block">✓ {order.oblio_invoice_number}</span>
                                                ) : <span className="opacity-50">-</span>}
                                            </td>
                                            <td className="px-4 md:px-6 py-4 text-xs">
                                                {order.awb_number ? (
                                                    <a 
                                                        href={order.label_url || '#'} 
                                                        target="_blank" 
                                                        rel="noreferrer" 
                                                        className="text-blue-600 bg-blue-50 px-2 py-1 rounded hover:underline inline-block font-semibold"
                                                    >
                                                        📦 {order.awb_number}
                                                    </a>
                                                ) : (
                                                    order.ecolet_status === 'draft' ? 
                                                    <span className="text-orange-600 bg-orange-50 px-2 py-1 rounded inline-block">⏳ Draft</span> : 
                                                    <span className="opacity-50">-</span>
                                                )}
                                            </td>
                                            <td className="px-4 md:px-6 py-4 text-right">
                                                <button 
                                                    onClick={() => setEditingOrder(order)} 
                                                    className="text-neutral-400 hover:text-black transition-colors p-2 rounded-full hover:bg-white border border-transparent hover:border-neutral-200 inline-flex items-center justify-center"
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

                {/* 🔥 BARA PLUTITOARE MOBILE-OPTIMIZED */}
                      {selectedOrders.length > 0 && (
                          <div className="fixed bottom-0 left-0 right-0 bg-neutral-900/98 backdrop-blur-md text-white p-3 md:p-4 z-50 border-t border-neutral-700 shadow-2xl animate-bounce-in">
                              <div className="max-w-7xl mx-auto">
                                  {/* Header cu număr selectate */}
                                  <div className="flex items-center justify-between mb-3">
                                      <div className="flex items-center gap-2">
                                          <div className="bg-brand-yellow text-black rounded-full w-6 h-6 flex items-center justify-center text-xs font-black shadow-[0_0_10px_rgba(250,204,21,0.4)]">
                                              {selectedOrders.length}
                                          </div>
                                          <span className="text-sm font-bold text-neutral-200">comenzi selectate</span>
                                      </div>
                                      <button
                                          onClick={() => setSelectedOrders([])}
                                          className="text-xs text-neutral-400 hover:text-white font-medium transition-colors px-2 py-1 rounded hover:bg-white/10"
                                      >
                                          ✕ Anulează
                                      </button>
                                  </div>

                                  {/* --- GRILA DE BUTOANE --- */}
                                  <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2 md:gap-3">

                                      {/* 1. OBLIO */}
                                      <button
                                          onClick={handleSendInvoices}
                                          className="bg-white text-neutral-900 hover:bg-neutral-200 px-4 py-3 md:py-2 rounded-lg text-xs md:text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2"
                                      >
                                          <span className="text-base">📄</span> Oblio
                                      </button>

                                      {/* 2. ECOLET */}
                                      <button
                                          onClick={handleEcoletExport}
                                          className="bg-white text-neutral-900 hover:bg-neutral-200 px-4 py-3 md:py-2 rounded-lg text-xs md:text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2"
                                      >
                                          <span className="text-base">📮</span> Ecolet
                                      </button>

                                      {/* 3. SYNC */}
                                      <button
                                          onClick={handleEcoletSync}
                                          className="bg-neutral-700 text-white hover:bg-neutral-600 px-4 py-3 md:py-2 rounded-lg text-xs md:text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2"
                                      >
                                          <span className="text-base">🔄</span> Sync
                                      </button>

                                      {/* 4. CSV */}
                                      <button
                                          onClick={handleAccountingExport}
                                          className="bg-green-500 text-black hover:bg-green-400 px-4 py-3 md:py-2 rounded-lg text-xs md:text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2"
                                      >
                                          <span className="text-base">📊</span> CSV
                                      </button>

                                      {/* Separator */}
                                      <div className="hidden md:block w-px h-8 bg-neutral-700 mx-2"></div>

                                      {/* 5. HIDE / UNHIDE */}
                                      <button
                                          onClick={() => handleToggleVisibility(!showHidden)}
                                          className={`col-span-2 md:col-span-1 px-4 py-3 md:py-2 rounded-lg text-xs md:text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2 ${showHidden ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-red-600 hover:bg-red-500 text-white'}`}
                                      >
                                          <span className="text-base">{showHidden ? '🔓' : '🔒'}</span>
                                          {showHidden ? 'Reactivează' : 'Arhivează'}
                                      </button>
                                  </div>
                              </div>
                          </div>
                      )}
            </div>
        )}

        {/* TAB PRODUSE - Neschimbat */}
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
                                <div>
                                    <label className="label-admin">Nume Produs</label>
                                    <input 
                                        className="input-admin"
                                        value={editingProduct.name}
                                        onChange={e => setEditingProduct({...editingProduct, name: e.target.value})}
                                        required
                                        placeholder="ex: Oclar Pro Titanium"
                                    />
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="label-admin">Preț Actual (RON)</label>
                                        <input 
                                            type="number" step="0.01"
                                            className="input-admin font-bold"
                                            value={editingProduct.price}
                                            onChange={e => setEditingProduct({...editingProduct, price: parseFloat(e.target.value)})}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="label-admin text-red-500">Preț Vechi (Reducere)</label>
                                        <input 
                                            type="number" step="0.01"
                                            className="input-admin text-red-500"
                                            placeholder="Opțional"
                                            value={editingProduct.original_price || ''}
                                            onChange={e => setEditingProduct({...editingProduct, original_price: e.target.value ? parseFloat(e.target.value) : null})}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="label-admin">Stoc</label>
                                        <input 
                                            type="number" 
                                            className="input-admin"
                                            value={editingProduct.stock_quantity}
                                            onChange={e => setEditingProduct({...editingProduct, stock_quantity: parseInt(e.target.value)})}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="label-admin">Categorie</label>
                                        <input 
                                            className="input-admin"
                                            value={editingProduct.category}
                                            onChange={e => setEditingProduct({...editingProduct, category: e.target.value})}
                                            required
                                            placeholder="ex: Daytime"
                                        />
                                    </div>
                                </div>
                                
                                <div>
                                    <label className="label-admin">Descriere</label>
                                    <textarea 
                                        className="input-admin h-32 resize-none"
                                        value={editingProduct.description}
                                        onChange={e => setEditingProduct({...editingProduct, description: e.target.value})}
                                        required
                                    />
                                </div>

                                <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200">
                                    <label className="label-admin mb-2 block">Specificații Tehnice</label>
                                    {editingProduct.details.map((spec, idx) => (
                                        <div key={idx} className="flex gap-2 mb-2">
                                            <input 
                                                className="input-admin py-1 text-sm bg-white" 
                                                value={spec} 
                                                onChange={(e) => {
                                                    const newSpecs = [...editingProduct.details];
                                                    newSpecs[idx] = e.target.value;
                                                    setEditingProduct({...editingProduct, details: newSpecs});
                                                }}
                                            />
                                            <button type="button" onClick={() => {
                                                const newSpecs = editingProduct.details.filter((_, i) => i !== idx);
                                                setEditingProduct({...editingProduct, details: newSpecs});
                                            }} className="text-red-500 px-2 font-bold hover:bg-red-50 rounded">×</button>
                                        </div>
                                    ))}
                                    <Button 
                                        type="button" 
                                        variant="outline" 
                                        className="w-full py-2 text-xs border-dashed border-neutral-300 hover:border-black" 
                                        onClick={() => setEditingProduct({...editingProduct, details: [...editingProduct.details, "Caracteristică: Valoare"]})}
                                    >
                                        + Adaugă Specificație
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="label-admin">Imagine Principală (Cover)</label>
                                    <div className="border-2 border-dashed border-neutral-300 rounded-xl p-4 text-center hover:bg-neutral-50 transition-colors cursor-pointer relative group overflow-hidden bg-neutral-50 min-h-[200px] flex items-center justify-center">
                                        <input type="file" onChange={(e) => handleImageFile(e, false)} className="absolute inset-0 opacity-0 cursor-pointer z-10" accept="image/*" />
                                        {editingProduct.imageUrl ? (
                                            <>
                                                <img src={editingProduct.imageUrl} className="w-full h-full object-contain" alt="Cover" />
                                                <div className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">Schimbă Poza</div>
                                            </>
                                        ) : (
                                            <div className="text-neutral-400 text-sm">
                                                <span className="block text-2xl mb-2">📷</span>
                                                Click sau Trage o poză aici
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="label-admin">Galerie (Mai multe poze)</label>
                                    <div className="grid grid-cols-3 gap-2 mb-2">
                                        {editingProduct.gallery.map((img, idx) => (
                                            <div key={idx} className="relative group aspect-square border rounded-lg overflow-hidden bg-white shadow-sm">
                                                <img src={img} className="w-full h-full object-cover" alt={`Gallery ${idx}`} />
                                                <button 
                                                    type="button" 
                                                    onClick={() => removeGalleryImage(idx)} 
                                                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-red-600"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ))}
                                        <div className="border-2 border-dashed border-neutral-300 rounded-lg flex items-center justify-center aspect-square hover:bg-neutral-50 cursor-pointer relative text-neutral-300 hover:text-neutral-500 transition-colors">
                                            <input type="file" onChange={(e) => handleImageFile(e, true)} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
                                            <span className="text-4xl font-light">+</span>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="label-admin">Culori Disponibile (HEX)</label>
                                    <input 
                                        className="input-admin"
                                        placeholder="#000000, #FFFFFF" 
                                        value={editingProduct.colors.join(', ')}
                                        onChange={e => setEditingProduct({...editingProduct, colors: e.target.value.split(',').map(c => c.trim())})}
                                    />
                                    <div className="flex gap-2 mt-2 h-6 items-center">
                                        <span className="text-xs text-neutral-400">Preview:</span>
                                        {editingProduct.colors.filter(c => c.startsWith('#')).map((c, i) => (
                                            <div key={i} className="w-5 h-5 rounded-full border border-neutral-200 shadow-sm" style={{backgroundColor: c}}></div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="md:col-span-2 flex gap-4 mt-4 border-t border-neutral-100 pt-6">
                                <Button type="submit" disabled={loading}>
                                    {loading ? 'Se salvează...' : 'Salvează Modificările'}
                                </Button>
                                <Button variant="outline" onClick={() => setShowProductForm(false)} type="button">Anulează</Button>
                            </div>
                        </form>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {products.map(p => (
                        <div key={p.id} className="bg-white p-5 rounded-2xl shadow-sm border border-neutral-100 flex flex-col group hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-4">
                                <div className="w-20 h-20 rounded-lg overflow-hidden border border-neutral-100 bg-neutral-50 relative">
                                    <img src={p.imageUrl} className="w-full h-full object-cover" alt={p.name} />
                                    {p.gallery && p.gallery.length > 0 && (
                                        <div className="absolute bottom-0 right-0 bg-black/50 text-white text-[9px] px-1">+{p.gallery.length}</div>
                                    )}
                                </div>
                                <div className="text-right">
                                    <div className="font-bold text-xl">{p.price} <span className="text-xs font-normal">RON</span></div>
                                    {p.original_price && p.original_price > p.price && (
                                        <div className="text-xs text-red-500 line-through font-mono">
                                            {p.original_price} RON
                                        </div>
                                    )}
                                    <div className={`mt-2 px-2 py-1 rounded text-[10px] font-bold uppercase inline-block ${p.stock_quantity > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                        Stoc: {p.stock_quantity}
                                    </div>
                                </div>
                            </div>
                            
                            <h3 className="font-bold text-lg mb-1">{p.name}</h3>
                            <p className="text-xs text-neutral-500 line-clamp-2 mb-4 flex-1">{p.description}</p>
                            
                            <div className="flex gap-2 border-t border-neutral-100 pt-4">
                                <button 
                                    onClick={() => { 
                                        setEditingProduct(p); 
                                        setShowProductForm(true); 
                                        setTimeout(() => document.getElementById('productForm')?.scrollIntoView({behavior: 'smooth'}), 100);
                                    }}
                                    className="flex-1 bg-neutral-50 hover:bg-neutral-100 text-neutral-900 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors"
                                >
                                    Editează
                                </button>
                                <button 
                                    onClick={() => p.id && handleDeleteProduct(p.id)}
                                    className="px-3 bg-white border border-red-100 text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                                    title="Șterge Produs"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* TAB REDUCERI - Neschimbat */}
        {activeTab === 'discounts' && (
            <div className="animate-fade-in">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold">Coduri de Reducere</h2>
                    <Button onClick={() => {
                        setEditingDiscount({
                            code: '', 
                            discount_type: 'percentage', 
                            discount_value: 10, 
                            min_order_amount: 0, 
                            max_uses: null,
                            used_count: 0,
                            valid_from: new Date().toISOString().split('T')[0],
                            valid_until: null,
                            is_active: true
                        });
                        setShowDiscountForm(true);
                    }}>+ Adaugă Cod Reducere</Button>
                </div>

                {showDiscountForm && editingDiscount && (
                    <div className="bg-white p-6 rounded-2xl shadow-xl mb-8 border border-neutral-200 animate-fade-in">
                         <h3 className="text-lg font-bold mb-4 border-b border-neutral-100 pb-2">
                             {editingDiscount.id ? '✏️ Editează Cod' : '✨ Cod Nou'}
                         </h3>
                         <form onSubmit={handleDiscountSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="label-admin">Cod Reducere (Ex: VARA20)</label>
                                <input 
                                    className="input-admin uppercase font-mono font-bold text-lg" 
                                    required 
                                    value={editingDiscount.code} 
                                    onChange={e => setEditingDiscount({...editingDiscount, code: e.target.value.toUpperCase()})} 
                                    placeholder="COD-PROMO"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label-admin">Tip Reducere</label>
                                    <select 
                                        className="input-admin" 
                                        value={editingDiscount.discount_type} 
                                        onChange={e => setEditingDiscount({...editingDiscount, discount_type: e.target.value as any})}
                                    >
                                        <option value="percentage">Procent (%)</option>
                                        <option value="fixed">Sumă Fixă (RON)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="label-admin">Valoare</label>
                                    <input 
                                        type="number" step="0.01" 
                                        className="input-admin font-bold" 
                                        required 
                                        value={editingDiscount.discount_value} 
                                        onChange={e => setEditingDiscount({...editingDiscount, discount_value: parseFloat(e.target.value)})} 
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label-admin">Comanda Minimă (RON)</label>
                                    <input 
                                        type="number" 
                                        className="input-admin" 
                                        value={editingDiscount.min_order_amount} 
                                        onChange={e => setEditingDiscount({...editingDiscount, min_order_amount: parseFloat(e.target.value)})} 
                                    />
                                </div>
                                <div>
                                    <label className="label-admin">Nr. Maxim Utilizări</label>
                                    <input 
                                        type="number" 
                                        className="input-admin" 
                                        placeholder="Nelimitat" 
                                        value={editingDiscount.max_uses || ''} 
                                        onChange={e => setEditingDiscount({...editingDiscount, max_uses: e.target.value ? parseInt(e.target.value) : null})} 
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label-admin">Valabil De La</label>
                                    <input 
                                        type="datetime-local" 
                                        className="input-admin" 
                                        required 
                                        value={editingDiscount.valid_from ? new Date(editingDiscount.valid_from).toISOString().slice(0, 16) : ''} 
                                        onChange={e => setEditingDiscount({...editingDiscount, valid_from: e.target.value})} 
                                    />
                                </div>
                                <div>
                                    <label className="label-admin">Expiră La (Opțional)</label>
                                    <input 
                                        type="datetime-local" 
                                        className="input-admin" 
                                        value={editingDiscount.valid_until ? new Date(editingDiscount.valid_until).toISOString().slice(0, 16) : ''} 
                                        onChange={e => setEditingDiscount({...editingDiscount, valid_until: e.target.value || null})} 
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-2 bg-neutral-50 p-3 rounded-lg border border-neutral-100">
                                <input 
                                    type="checkbox" 
                                    id="active" 
                                    className="w-5 h-5 accent-black" 
                                    checked={editingDiscount.is_active} 
                                    onChange={e => setEditingDiscount({...editingDiscount, is_active: e.target.checked})} 
                                />
                                <label htmlFor="active" className="font-bold text-sm cursor-pointer select-none">Activează acest cod de reducere</label>
                            </div>

                            <div className="md:col-span-2 flex gap-4 mt-2">
                                <Button type="submit" disabled={loading}>
                                    {loading ? 'Se salvează...' : 'Salvează Codul'}
                                </Button>
                                <Button variant="outline" type="button" onClick={() => setShowDiscountForm(false)}>Anulează</Button>
                            </div>
                         </form>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {discounts.map(d => (
                        <div key={d.id} className={`p-5 rounded-xl border transition-all ${d.is_active ? 'bg-white border-neutral-200 shadow-sm hover:shadow-md' : 'bg-neutral-50 border-neutral-100 opacity-60 grayscale'}`}>
                            <div className="flex justify-between items-start mb-2">
                                <div className="font-mono font-black text-xl uppercase tracking-wider text-brand-yellow-darker bg-yellow-50 px-2 py-1 rounded">
                                    {d.code}
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => { setEditingDiscount(d); setShowDiscountForm(true); window.scrollTo({top: 0, behavior: 'smooth'}); }} 
                                        className="text-xs bg-black text-white px-2 py-1 rounded font-bold hover:bg-neutral-800"
                                    >
                                        Edit
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteDiscount(d.id)} 
                                        className="text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded border border-red-100 font-bold"
                                    >
                                        Șterge
                                    </button>
                                </div>
                            </div>
                            
                            <div className="text-2xl font-black mb-3">
                                -{d.discount_value}{d.discount_type === 'percentage' ? '%' : <span className="text-sm font-normal text-neutral-500"> RON</span>}
                            </div>
                            
                            <div className="space-y-1 text-xs text-neutral-500 border-t border-neutral-100 pt-3">
                                <div className="flex justify-between">
                                    <span>Utilizări:</span>
                                    <span className="font-bold text-black">{d.used_count} {d.max_uses ? `/ ${d.max_uses}` : '(Nelimitat)'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Comandă Minimă:</span>
                                    <span className="font-bold text-black">{d.min_order_amount} RON</span>
                                </div>
                                {d.valid_until && (
                                    <div className="flex justify-between text-orange-600">
                                        <span>Expiră:</span>
                                        <span className="font-bold">{new Date(d.valid_until).toLocaleDateString()}</span>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span>Status:</span>
                                    <span className={`font-bold ${d.is_active ? 'text-green-600' : 'text-red-600'}`}>
                                        {d.is_active ? 'ACTIV' : 'INACTIV'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                    
                    {discounts.length === 0 && (
                        <div className="col-span-full py-12 text-center text-neutral-400 border-2 border-dashed border-neutral-200 rounded-xl">
                            Nu există coduri de reducere create.
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* MODAL EDITARE COMANDĂ */}
        {editingOrder && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 backdrop-blur-sm animate-fade-in">
                <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                    <h2 className="text-xl font-black uppercase mb-6 flex justify-between items-center">
                        <span>Editare Comandă #{editingOrder.id}</span>
                        <button onClick={() => setEditingOrder(null)} className="text-neutral-400 hover:text-black transition-colors">✕</button>
                    </h2>

                    <form onSubmit={handleUpdateOrder} className="space-y-4">
                        <div>
                            <label className="label-admin">Status Comandă</label>
                            <select
                                className="input-admin"
                                value={editingOrder.status}
                                onChange={e => setEditingOrder({ ...editingOrder, status: e.target.value })}
                            >
                                <option value="pending">Pending (În așteptare)</option>
                                <option value="paid">Paid (Plătit)</option>
                                <option value="shipped">Shipped (Livrat)</option>
                                <option value="completed">Completed (Finalizat)</option>
                                <option value="cancelled">Cancelled (Anulat)</option>
                                <option value="returned">Returned (Returnat)</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="label-admin">Nume Client</label>
                                <input
                                    className="input-admin"
                                    value={editingOrder.customer_name}
                                    onChange={e => setEditingOrder({ ...editingOrder, customer_name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="label-admin">Telefon</label>
                                <input
                                    className="input-admin"
                                    value={editingOrder.customer_phone}
                                    onChange={e => setEditingOrder({ ...editingOrder, customer_phone: e.target.value })}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="label-admin">Email</label>
                            <input
                                className="input-admin"
                                value={editingOrder.customer_email}
                                onChange={e => setEditingOrder({ ...editingOrder, customer_email: e.target.value })}
                            />
                        </div>

                        <div className="border-t border-neutral-100 pt-4 mt-2">
                            <p className="text-xs font-bold uppercase text-neutral-400 mb-3">Adresă Livrare & Ecolet</p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-2">
                                <div>
                                    <label className="label-admin">Județ</label>
                                    <input
                                        className="input-admin"
                                        value={editingOrder.county || ''}
                                        onChange={e => setEditingOrder({ ...editingOrder, county: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="label-admin">Oraș</label>
                                    <input
                                        className="input-admin"
                                        value={editingOrder.city || ''}
                                        onChange={e => setEditingOrder({ ...editingOrder, city: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-2">
                                <div className="sm:col-span-2">
                                    <label className="label-admin">Adresă (Stradă, Nr, Bloc)</label>
                                    <input
                                        className="input-admin"
                                        value={editingOrder.address_line || ''}
                                        onChange={e => setEditingOrder({ ...editingOrder, address_line: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="label-admin">Cod Poștal</label>
                                    <input
                                        className="input-admin"
                                        value={editingOrder.postal_code || ''}
                                        placeholder="000000"
                                        onChange={e => setEditingOrder({ ...editingOrder, postal_code: e.target.value })}
                                    />
                                </div>
                            </div>

                            {editingOrder.shipping_method === 'easybox' && (
                                <div>
                                    <label className="label-admin">Locker ID (EasyBox)</label>
                                    <input
                                        className="input-admin bg-yellow-50 font-mono text-xs"
                                        value={editingOrder.locker_id || ''}
                                        onChange={e => setEditingOrder({ ...editingOrder, locker_id: e.target.value })}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 pt-6">
                            <Button fullWidth type="submit" disabled={loading}>
                                {loading ? 'Se salvează...' : 'Salvează Modificările'}
                            </Button>
                            <Button fullWidth variant="outline" type="button" onClick={() => setEditingOrder(null)}>
                                Anulează
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        )}

      </div>
      
      <style>{`
        .input-admin { 
            width: 100%; 
            padding: 0.75rem; 
            border: 1px solid #e5e5e5; 
            border-radius: 0.5rem; 
            transition: all 0.2s; 
            outline: none; 
            font-size: 0.875rem;
        }
        .input-admin:focus { 
            border-color: black; 
            box-shadow: 0 0 0 1px black;
        }
        .label-admin { 
            display: block; 
            font-size: 0.75rem; 
            font-weight: 700; 
            text-transform: uppercase; 
            color: #737373; 
            margin-bottom: 0.35rem; 
            letter-spacing: 0.05em;
        }
        @keyframes fade-in { 
            from { opacity: 0; } 
            to { opacity: 1; } 
        }
        .animate-fade-in { 
            animation: fade-in 0.3s ease-in-out; 
        }
      `}</style>
    </div>
  );
};