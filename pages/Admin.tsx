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
  const [showHidden, setShowHidden] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // ⭐ SETĂRI AUTOMATIZARE
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [autoOblio, setAutoOblio] = useState(true);
  const [autoEcolet, setAutoEcolet] = useState(true);

  // Formulare
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

  // --- API CALLS: SETĂRI & DATE ---

  // Încarcă Setările Automatizării
  const fetchSettings = async (token: string) => {
    try {
      const res = await fetch(`${API_URL}/admin/settings`, {
        headers: { 'x-admin-secret': token }
      });
      if (res.ok) {
        const data = await res.json();
        setAutoEnabled(data.automation_enabled || false);
        setAutoOblio(data.auto_oblio !== false);
        setAutoEcolet(data.auto_ecolet !== false);
      }
    } catch (e) { console.error('Settings err:', e); }
  };

  // Salvează Setare
  const updateSetting = async (key: string, value: boolean) => {
    if(key === 'automation_enabled') setAutoEnabled(value);
    if(key === 'auto_oblio') setAutoOblio(value);
    if(key === 'auto_ecolet') setAutoEcolet(value);

    await fetch(`${API_URL}/admin/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
      body: JSON.stringify({ key, value })
    });
  };

  // Încarcă Datele
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

    } catch (err) { console.error(err); } 
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (isAuthenticated) fetchData(activeTab);
  }, [activeTab, showHidden, isAuthenticated]);

  // --- HANDLERS SELECȚIE ---
  const handleSelectAll = () => {
    if (selectedOrders.length === orders.length) setSelectedOrders([]);
    else setSelectedOrders(orders.map(o => o.id));
  };

  const toggleSelection = (id: number) => {
    setSelectedOrders(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // --- HANDLERS ACȚIUNI BULK (COMPLET DIN AMBELE CODURI) ---
  
  // Toggle Vizibilitate (Hide/Unhide)
  const handleToggleVisibility = async (hide: boolean) => {
      if (selectedOrders.length === 0) return alert('Selectează comenzi!');
      
      try {
          await fetch(`${API_URL}/admin/toggle-visibility`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
              body: JSON.stringify({ orderIds: selectedOrders, hide })
          });
          fetchData('orders');
          setSelectedOrders([]); 
      } catch (e) {
          alert('Eroare conexiune');
      }
  };

  // Export CSV Contabil (Client-Side)
  const handleAccountingExport = () => {
      if (selectedOrders.length === 0) return alert('Selectează comenzi!');

      const ordersToExport = orders.filter(o => selectedOrders.includes(o.id));

      let csvContent = "data:text/csv;charset=utf-8,";
      csvContent += "Data,Nr. Document,Client,Adresa,Total (RON),Baza Impozabila,TVA (19%),Metoda Plata,Status\n";

      ordersToExport.forEach(order => {
          const date = new Date(order.created_at).toLocaleDateString('ro-RO');
          const total = parseFloat(order.total_amount.toString());
          const baza = (total / 1.19).toFixed(2);
          const tva = (total - (total / 1.19)).toFixed(2);

          const cleanAddress = (order.address_line || '').replace(/,/g, ' ') + ' ' + (order.city || '');

          const row = [
              date,
              `CMD-${order.id}`,
              `"${order.customer_name}"`,
              `"${cleanAddress}"`,
              total.toFixed(2),
              baza,
              tva,
              order.payment_method,
              order.status
          ].join(",");

          csvContent += row + "\r\n";
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Export_Contabil_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
  };

  // Trimite Facturi Oblio
  const handleSendInvoices = async () => {
    if (selectedOrders.length === 0) {
      alert('Selectează cel puțin o comandă');
      return;
    }

    if (!confirm(`Trimitem ${selectedOrders.length} facturi în Oblio?`)) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/admin/send-invoices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': secret
        },
        body: JSON.stringify({ orderIds: selectedOrders })
      });

      const result = await response.json();
      
      if (result.success) {
        alert(`Facturi trimise cu succes!\nSucces: ${result.results.filter((r: any) => r.success).length}/${result.results.length}`);
        fetchData('orders');
      } else {
        alert('Eroare la trimitere facturi');
      }
    } catch (error) {
      alert('Eroare de conexiune');
    } finally {
      setLoading(false);
    }
  };

  // Export Comenzi la Ecolet (Draft)
  const handleEcoletExport = async () => {
      if (selectedOrders.length === 0) {
          alert('Selectează cel puțin o comandă');
          return;
      }

      if (!confirm(`Vrei să trimiți ${selectedOrders.length} comenzi la Ecolet ca draft?`)) {
          return;
      }

      setEcoletLoading(true);
      try {
          const res = await fetch(`${API_URL}/admin/ecolet/export`, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'x-admin-secret': secret
              },
              body: JSON.stringify({ orderIds: selectedOrders })
          });

          if (!res.ok) throw new Error('Eroare la exportul Ecolet');

          const data = await res.json();

          const successCount = data.results.filter((r: any) => r.success).length;
          const failCount = data.results.filter((r: any) => !r.success).length;

          alert(`✅ Export finalizat:\n${successCount} comenzi exportate cu succes\n${failCount} erori`);

          fetchData('orders');
      } catch (error) {
          console.error('❌ Ecolet export error:', error);
          alert('Eroare la exportul către Ecolet');
      } finally {
          setEcoletLoading(false);
      }
  };

  // Sincronizare AWB-uri din Ecolet
  const handleEcoletSync = async () => {
      if (selectedOrders.length === 0) {
          alert('Selectează cel puțin o comandă');
          return;
      }

      if (!confirm(`Vrei să sincronizezi AWB-urile pentru ${selectedOrders.length} comenzi?`)) {
          return;
      }

      setEcoletLoading(true);
      try {
          const res = await fetch(`${API_URL}/admin/ecolet/sync`, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'x-admin-secret': secret
              },
              body: JSON.stringify({ orderIds: selectedOrders })
          });

          if (!res.ok) throw new Error('Eroare la sincronizarea Ecolet');

          const data = await res.json();

          const successCount = data.results.filter((r: any) => r.success).length;
          const failCount = data.results.filter((r: any) => !r.success).length;

          alert(`✅ Sincronizare finalizată:\n${successCount} AWB-uri sincronizate\n${failCount} încă în așteptare`);

          fetchData('orders');
      } catch (error) {
          console.error('❌ Ecolet sync error:', error);
          alert('Eroare la sincronizarea AWB-urilor');
      } finally {
          setEcoletLoading(false);
      }
  };

  // Filtre Rapide de Dată
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

  // --- HANDLERS PRODUSE ---
  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>, isGallery: boolean = false) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      
      reader.onloadend = () => {
        const base64String = reader.result as string;
        if (editingProduct) {
            if (isGallery) {
                setEditingProduct({
                    ...editingProduct,
                    gallery: [...(editingProduct.gallery || []), base64String]
                });
            } else {
                setEditingProduct({
                    ...editingProduct,
                    imageUrl: base64String
                });
            }
        }
      };
      reader.readAsDataURL(file);
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
    if (!editingProduct) return;

    try {
        const res = await fetch(`${API_URL}/admin`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-admin-secret': secret 
            },
            body: JSON.stringify(editingProduct)
        });
        
        if (res.ok) {
            alert('Produs salvat cu succes!');
            setShowProductForm(false);
            setEditingProduct(null);
            fetchData('products');
        } else {
            alert('Eroare la salvare.');
        }
    } catch (err) {
        alert('Eroare de rețea.');
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (!confirm('Ești sigur? Această acțiune este ireversibilă!')) return;
    try {
        await fetch(`${API_URL}/admin?id=${id}`, {
            method: 'DELETE',
            headers: { 'x-admin-secret': secret }
        });
        fetchData('products');
    } catch (err) { console.error(err); }
  };

  // --- HANDLERS REDUCERI ---
  const handleDiscountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDiscount) return;

    const method = editingDiscount.id ? 'PUT' : 'POST';

    try {
        const res = await fetch(`${API_URL}/admin/discount-codes`, {
            method: method,
            headers: { 
                'Content-Type': 'application/json',
                'x-admin-secret': secret 
            },
            body: JSON.stringify(editingDiscount)
        });
        
        if (res.ok) {
            alert('Cod salvat cu succes!');
            setShowDiscountForm(false);
            setEditingDiscount(null);
            fetchData('discounts');
        } else {
            alert('Eroare la salvare cod.');
        }
    } catch (err) {
        alert('Eroare rețea.');
    }
  };

  const handleDeleteDiscount = async (id: number) => {
    if (!confirm('Ești sigur că vrei să ștergi acest cod?')) return;
    try {
        await fetch(`${API_URL}/admin/discount-codes?id=${id}`, {
            method: 'DELETE',
            headers: { 'x-admin-secret': secret }
        });
        fetchData('discounts');
    } catch (err) { console.error(err); }
  };

  // --- HANDLER UPDATE COMANDĂ ---
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
            alert('Comandă actualizată cu succes!');
            setEditingOrder(null);
            fetchData('orders');
        } else {
            alert('Eroare la actualizare comandă.');
        }
    } catch (err) {
        alert('Eroare server.');
    }
  };

  // --- RENDER LOGIN ---
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

  // --- RENDER MAIN DASHBOARD ---
  return (
    <div className="min-h-screen bg-neutral-50 pt-[8vh] px-[2vw] pb-[15vh] md:pt-24 md:px-4 md:pb-32 animate-fade-in relative font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER & NAVIGARE */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-[3vh] md:mb-8 gap-4">
            <div>
                <h1 className="text-[6vw] md:text-3xl font-black uppercase tracking-tight text-neutral-900">Dashboard</h1>
                <p className="text-neutral-500 text-[3vw] md:text-sm">Centru de Comandă Oclar</p>
            </div>
            
            <div className="flex bg-white p-1 rounded-xl shadow-sm border border-neutral-200 overflow-x-auto w-full md:w-auto">
                {['orders', 'products', 'discounts'].map((tab) => (
                    <button 
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={`px-[4vw] md:px-6 py-2 rounded-lg font-bold text-[3vw] md:text-sm capitalize transition-all whitespace-nowrap ${activeTab === tab ? 'bg-black text-white shadow-md' : 'text-neutral-500 hover:bg-neutral-50'}`}
                    >
                        {tab === 'orders' ? 'Comenzi' : tab === 'products' ? 'Produse' : 'Reduceri'}
                    </button>
                ))}
                <button
                    onClick={() => { setIsAuthenticated(false); sessionStorage.removeItem('admin_secret'); }}
                    className="ml-2 px-[3vw] md:px-4 py-2 rounded-lg font-bold text-[3vw] md:text-sm text-red-500 hover:bg-red-50 transition-colors"
                    title="Deconectare"
                >✕</button>
            </div>
        </div>

        {/* --- TAB: COMENZI --- */}
        {activeTab === 'orders' && (
            <div className="animate-fade-in space-y-[2vh] md:space-y-6">
                
                {/* ZONA AUTOMATIZARE */}
                <div className="bg-white p-[2vh] md:p-5 rounded-2xl shadow-sm border border-neutral-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-[2vh] md:gap-6">
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-[2vh] md:gap-6 w-full md:w-auto">
                        <ToggleSwitch 
                            checked={autoEnabled} 
                            onChange={(v) => updateSetting('automation_enabled', v)} 
                            label="🤖 Auto-Process" 
                            subLabel="Procesare automată comenzi"
                        />
                        
                        {autoEnabled && (
                            <div className="flex flex-col sm:flex-row gap-[1.5vh] md:gap-4 pl-0 md:pl-6 md:border-l border-neutral-200 animate-fade-in w-full md:w-auto">
                                <label className="flex items-center gap-2 text-[3vw] md:text-sm font-medium text-neutral-600 cursor-pointer hover:text-black transition-colors">
                                    <input type="checkbox" checked={autoOblio} onChange={e => updateSetting('auto_oblio', e.target.checked)} className="w-4 h-4 rounded text-black focus:ring-0" />
                                    Facturare Oblio
                                </label>
                                <label className="flex items-center gap-2 text-[3vw] md:text-sm font-medium text-neutral-600 cursor-pointer hover:text-black transition-colors">
                                    <input type="checkbox" checked={autoEcolet} onChange={e => updateSetting('auto_ecolet', e.target.checked)} className="w-4 h-4 rounded text-black focus:ring-0" />
                                    Curier Ecolet
                                </label>
                            </div>
                        )}
                    </div>

                    <div className="text-right hidden md:block">
                        <div className="text-[2vw] md:text-xs text-neutral-400 font-mono">Server Status: Online</div>
                        <div className="text-[2vw] md:text-xs text-neutral-400 font-mono">Last Sync: {new Date().toLocaleTimeString()}</div>
                    </div>
                </div>

                {/* FILTRE */}
                <div className="flex flex-col md:flex-row flex-wrap gap-[1.5vh] md:gap-4 items-start md:items-end justify-between bg-white p-[2vh] md:p-4 rounded-xl border border-neutral-200 shadow-sm">
                    {/* Filtre Rapide - Doar pe desktop */}
                    <div className="hidden md:flex gap-2">
                        <button onClick={() => handleQuickDateFilter('today')} className="px-3 py-1 bg-neutral-100 hover:bg-neutral-200 rounded text-xs">Azi</button>
                        <button onClick={() => handleQuickDateFilter('week')} className="px-3 py-1 bg-neutral-100 hover:bg-neutral-200 rounded text-xs">7 zile</button>
                        <button onClick={() => handleQuickDateFilter('month')} className="px-3 py-1 bg-neutral-100 hover:bg-neutral-200 rounded text-xs">30 zile</button>
                    </div>

                    <div className="flex flex-wrap gap-[1.5vh] md:gap-3 w-full md:w-auto">
                        <div className="flex-1 min-w-[25vw] md:min-w-0">
                            <label className="label-admin">Status</label>
                            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-admin py-2 text-[3vw] md:text-sm w-full">
                                <option value="">Toate</option>
                                <option value="paid">Paid</option>
                                <option value="pending">Pending</option>
                                <option value="completed">Completed</option>
                            </select>
                        </div>
                        <div className="flex-1 min-w-[25vw] md:min-w-0">
                            <label className="label-admin">Start</label>
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input-admin py-2 text-[3vw] md:text-sm w-full" />
                        </div>
                        <div className="flex-1 min-w-[25vw] md:min-w-0">
                            <label className="label-admin">Final</label>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input-admin py-2 text-[3vw] md:text-sm w-full" />
                        </div>
                        <div className="flex items-end gap-2 w-full md:w-auto">
                             <Button onClick={() => fetchData('orders')} variant="outline" className="py-2 text-[3vw] md:text-sm h-[5vh] md:h-[38px] flex-1 md:flex-initial">Aplică</Button>
                             <button 
                                onClick={() => setShowHidden(!showHidden)}
                                className={`px-[3vw] md:px-4 py-2 rounded-lg text-[3vw] md:text-sm font-bold border transition-all flex items-center gap-2 h-[5vh] md:h-auto ${showHidden ? 'bg-neutral-800 text-white border-neutral-800' : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'}`}
                            >
                                {showHidden ? '📂 Ascunde' : '📂 Arhiva'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* TABEL COMENZI */}
                <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-[2.5vw] md:text-sm text-left">
                            <thead className="bg-neutral-50 text-neutral-500 uppercase font-bold text-[2vw] md:text-[10px] tracking-wider border-b border-neutral-100">
                                <tr>
                                    <th className="px-[2vw] md:px-6 py-[1.5vh] md:py-4 w-[8vw] md:w-10"><input type="checkbox" onChange={handleSelectAll} checked={selectedOrders.length === orders.length && orders.length > 0} className="w-[3vw] h-[3vw] md:w-4 md:h-4" /></th>
                                    <th className="px-[2vw] md:px-6 py-[1.5vh] md:py-4">ID</th>
                                    <th className="px-[2vw] md:px-6 py-[1.5vh] md:py-4">Client</th>
                                    <th className="px-[2vw] md:px-6 py-[1.5vh] md:py-4">Total</th>
                                    <th className="px-[2vw] md:px-6 py-[1.5vh] md:py-4">Status</th>
                                    <th className="px-[2vw] md:px-6 py-[1.5vh] md:py-4 hidden md:table-cell">Factură</th>
                                    <th className="px-[2vw] md:px-6 py-[1.5vh] md:py-4 hidden md:table-cell">AWB</th>
                                    <th className="px-[2vw] md:px-6 py-[1.5vh] md:py-4 text-right">Act</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                                {orders.length === 0 && (
                                    <tr><td colSpan={8} className="p-[3vh] md:p-8 text-center text-neutral-400 text-[3vw] md:text-base">Nu există comenzi de afișat.</td></tr>
                                )}
                                {orders.map(order => {
                                    const isHidden = order.is_hidden === 1;
                                    return (
                                        <tr 
                                            key={order.id} 
                                            className={`transition-colors duration-200 ${isHidden ? 'bg-neutral-100/50 text-neutral-400' : 'hover:bg-neutral-50'}`}
                                        >
                                            <td className="px-[2vw] md:px-6 py-[1.5vh] md:py-4"><input type="checkbox" checked={selectedOrders.includes(order.id)} onChange={() => toggleSelection(order.id)} className="w-[3vw] h-[3vw] md:w-4 md:h-4" /></td>
                                            <td className="px-[2vw] md:px-6 py-[1.5vh] md:py-4 font-mono">
                                                <div className="flex items-center gap-1">
                                                    #{order.id}
                                                    {isHidden && <span title="Arhivat" className="text-[4vw] md:text-lg leading-none">🔒</span>}
                                                </div>
                                                <div className="text-[2vw] md:text-[10px] text-neutral-400">{new Date(order.created_at).toLocaleDateString()}</div>
                                            </td>
                                            <td className="px-[2vw] md:px-6 py-[1.5vh] md:py-4">
                                                <div className={`font-bold text-[2.8vw] md:text-sm ${isHidden ? 'text-neutral-500' : 'text-neutral-900'}`}>{order.customer_name}</div>
                                                <div className="text-[2.2vw] md:text-xs opacity-70 truncate max-w-[30vw] md:max-w-none">{order.customer_email}</div>
                                            </td>
                                            <td className="px-[2vw] md:px-6 py-[1.5vh] md:py-4 font-bold text-[3vw] md:text-sm">
                                                {parseFloat(order.total_amount.toString()).toFixed(2)} RON
                                                <div className="text-[2vw] md:text-[10px] font-normal uppercase text-neutral-500">{order.payment_method}</div>
                                            </td>
                                            <td className="px-[2vw] md:px-6 py-[1.5vh] md:py-4">
                                                <StatusBadge status={order.status} />
                                            </td>
                                            <td className="px-[2vw] md:px-6 py-[1.5vh] md:py-4 text-[2.5vw] md:text-xs font-mono hidden md:table-cell">
                                                {order.oblio_invoice_number ? (
                                                    <span className="text-green-600 bg-green-50 px-2 py-1 rounded">✓ {order.oblio_invoice_number}</span>
                                                ) : <span className="opacity-50">-</span>}
                                            </td>
                                            <td className="px-[2vw] md:px-6 py-[1.5vh] md:py-4 text-[2.5vw] md:text-xs hidden md:table-cell">
                                                {order.awb_number ? (
                                                    <a href={order.label_url || '#'} target="_blank" rel="noreferrer" className="text-blue-600 bg-blue-50 px-2 py-1 rounded hover:underline">
                                                        📦 {order.awb_number}
                                                    </a>
                                                ) : (
                                                    order.ecolet_status === 'draft' ? <span className="text-orange-500">⏳</span> : <span className="opacity-50">-</span>
                                                )}
                                            </td>
                                            <td className="px-[2vw] md:px-6 py-[1.5vh] md:py-4 text-right">
                                                <button 
                                                    onClick={() => setEditingOrder(order)} 
                                                    className="text-neutral-400 hover:text-black transition-colors p-[1vh] md:p-2 rounded-full hover:bg-white border border-transparent hover:border-neutral-200 text-[4vw] md:text-base"
                                                    title="Editează"
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

                {/* FLOATING ACTION BAR */}
                {selectedOrders.length > 0 && (
                    <div className="fixed bottom-[2vh] md:bottom-8 left-1/2 transform -translate-x-1/2 bg-neutral-900/95 backdrop-blur-md text-white px-[1vw] md:px-2 py-[1vh] md:py-2 pr-[3vw] md:pr-6 rounded-full shadow-2xl flex items-center gap-[1vw] md:gap-1 z-50 animate-bounce-in border border-neutral-700 max-w-[95vw] overflow-x-auto">
                        <div className="bg-neutral-800 rounded-full px-[2vw] md:px-4 py-[1vh] md:py-2 font-bold text-[2.5vw] md:text-sm mr-[1vw] md:mr-2 shadow-inner whitespace-nowrap">
                            {selectedOrders.length} sel
                        </div>
                        
                        <button onClick={handleSendInvoices} className="hover:bg-neutral-700 px-[2vw] md:px-4 py-[1vh] md:py-2 rounded-full text-[2.5vw] md:text-sm font-medium transition-colors flex items-center gap-1 whitespace-nowrap">
                            📄 <span className="hidden sm:inline">Oblio</span>
                        </button>
                        
                        <button onClick={handleEcoletExport} className="hover:bg-neutral-700 px-[2vw] md:px-4 py-[1vh] md:py-2 rounded-full text-[2.5vw] md:text-sm font-medium transition-colors flex items-center gap-1 whitespace-nowrap">
                            🚚 <span className="hidden sm:inline">Ecolet</span>
                        </button>

                        <button onClick={handleAccountingExport} className="hover:bg-neutral-700 px-[2vw] md:px-4 py-[1vh] md:py-2 rounded-full text-[2.5vw] md:text-sm font-medium transition-colors flex items-center gap-1 whitespace-nowrap">
                            📊 <span className="hidden sm:inline">CSV</span>
                        </button>

                        <div className="w-px h-[3vh] md:h-6 bg-neutral-700 mx-[1vw] md:mx-2"></div>

                        <button 
                            onClick={() => handleToggleVisibility(showHidden ? false : true)} 
                            className={`px-[2vw] md:px-4 py-[1vh] md:py-2 rounded-full text-[2.5vw] md:text-sm font-bold transition-colors flex items-center gap-1 whitespace-nowrap ${showHidden ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'}`}
                        >
                            {showHidden ? '🔓' : '🔒'} <span className="hidden sm:inline">{showHidden ? 'Reactiv' : 'Arhiv'}</span>
                        </button>
                    </div>
                )}
            </div>
        )}

        {/* --- TAB: PRODUSE --- */}
        {activeTab === 'products' && (
            <div className="animate-fade-in">
                <div className="flex justify-end mb-[2vh] md:mb-6">
                    <Button onClick={() => {
                        setEditingProduct({ name: '', price: 0, stock_quantity: 10, description: '', category: 'Ochelari', imageUrl: '', gallery: [], colors: [], details: [] });
                        setShowProductForm(true);
                    }} className="text-[3vw] md:text-sm">+ Produs Nou</Button>
                </div>

                {showProductForm && editingProduct && (
                    <div className="bg-white p-[2vh] md:p-8 rounded-2xl shadow-xl mb-[2vh] md:mb-8 border border-neutral-200 animate-fade-in" id="productForm">
                        <h3 className="text-[4vw] md:text-xl font-bold mb-[2vh] md:mb-6 flex items-center gap-2 border-b border-neutral-100 pb-[1vh] md:pb-4">
                             {editingProduct.id ? '✏️ Editează' : '✨ Nou'}
                        </h3>
                        <form onSubmit={handleProductSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-[2vh] md:gap-8">
                            <div className="space-y-[1.5vh] md:space-y-4">
                                <div><label className="label-admin">Nume</label><input className="input-admin text-[3vw] md:text-sm" value={editingProduct.name} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} required /></div>
                                <div className="grid grid-cols-2 gap-[1.5vh] md:gap-4">
                                    <div><label className="label-admin">Preț</label><input type="number" step="0.01" className="input-admin font-bold text-[3vw] md:text-sm" value={editingProduct.price} onChange={e => setEditingProduct({...editingProduct, price: parseFloat(e.target.value)})} required /></div>
                                    <div><label className="label-admin">Preț Vechi</label><input type="number" step="0.01" className="input-admin text-[3vw] md:text-sm" value={editingProduct.original_price || ''} onChange={e => setEditingProduct({...editingProduct, original_price: e.target.value ? parseFloat(e.target.value) : null})} /></div>
                                </div>
                                <div className="grid grid-cols-2 gap-[1.5vh] md:gap-4">
                                    <div><label className="label-admin">Stoc</label><input type="number" className="input-admin text-[3vw] md:text-sm" value={editingProduct.stock_quantity} onChange={e => setEditingProduct({...editingProduct, stock_quantity: parseInt(e.target.value)})} required /></div>
                                    <div><label className="label-admin">Categorie</label><input className="input-admin text-[3vw] md:text-sm" value={editingProduct.category} onChange={e => setEditingProduct({...editingProduct, category: e.target.value})} required /></div>
                                </div>
                                <div><label className="label-admin">Descriere</label><textarea className="input-admin h-[12vh] md:h-32 resize-none text-[3vw] md:text-sm" value={editingProduct.description} onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} required /></div>
                            </div>
                            <div className="space-y-[2vh] md:space-y-6">
                                <div>
                                    <label className="label-admin">Poză Principală</label>
                                    <div className="border-2 border-dashed border-neutral-300 rounded-xl p-[2vh] md:p-4 text-center hover:bg-neutral-50 transition-colors cursor-pointer relative overflow-hidden bg-neutral-50 min-h-[20vh] md:min-h-[200px] flex items-center justify-center">
                                        <input type="file" onChange={(e) => handleImageFile(e, false)} className="absolute inset-0 opacity-0 cursor-pointer z-10" accept="image/*" />
                                        {editingProduct.imageUrl ? <img src={editingProduct.imageUrl} className="w-full h-full object-contain" alt="Cover" /> : <div className="text-neutral-400 text-[3vw] md:text-sm">Click pentru upload</div>}
                                    </div>
                                </div>
                                <div>
                                    <label className="label-admin">Galerie</label>
                                    <div className="grid grid-cols-3 gap-[1vh] md:gap-2">
                                        {editingProduct.gallery.map((img, idx) => (
                                            <div key={idx} className="relative aspect-square border rounded-lg overflow-hidden bg-white group">
                                                <img src={img} className="w-full h-full object-cover" alt="Gal" />
                                                <button 
                                                    type="button" 
                                                    onClick={() => removeGalleryImage(idx)}
                                                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-[4vh] h-[4vh] md:w-5 md:h-5 text-[2.5vw] md:text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                >×</button>
                                            </div>
                                        ))}
                                        <div className="border-2 border-dashed border-neutral-300 rounded-lg flex items-center justify-center aspect-square hover:bg-neutral-50 cursor-pointer relative">
                                            <input type="file" onChange={(e) => handleImageFile(e, true)} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
                                            <span className="text-[6vw] md:text-2xl text-neutral-300">+</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="md:col-span-2 flex gap-[1.5vh] md:gap-4 border-t border-neutral-100 pt-[2vh] md:pt-6">
                                <Button type="submit" className="text-[3vw] md:text-sm">Salvează</Button>
                                <Button variant="outline" onClick={() => setShowProductForm(false)} type="button" className="text-[3vw] md:text-sm">Anulează</Button>
                            </div>
                        </form>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[2vh] md:gap-6">
                    {products.map(p => (
                        <div key={p.id} className="bg-white p-[2vh] md:p-5 rounded-2xl shadow-sm border border-neutral-100 flex flex-col group hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-[1.5vh] md:mb-4">
                                <div className="w-[15vw] h-[15vw] md:w-20 md:h-20 rounded-lg overflow-hidden border border-neutral-100 bg-neutral-50 relative"><img src={p.imageUrl} className="w-full h-full object-cover" alt={p.name} /></div>
                                <div className="text-right">
                                    <div className="font-bold text-[4vw] md:text-xl">{p.price} <span className="text-[2.5vw] md:text-xs font-normal">RON</span></div>
                                    <div className={`mt-[0.5vh] md:mt-2 px-2 py-1 rounded text-[2vw] md:text-[10px] font-bold uppercase inline-block ${p.stock_quantity > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>Stoc: {p.stock_quantity}</div>
                                </div>
                            </div>
                            <h3 className="font-bold text-[3.5vw] md:text-lg mb-[0.5vh] md:mb-1">{p.name}</h3>
                            <div className="flex gap-[1vh] md:gap-2 border-t border-neutral-100 pt-[1.5vh] md:pt-4 mt-auto">
                                <button onClick={() => { setEditingProduct(p); setShowProductForm(true); setTimeout(() => document.getElementById('productForm')?.scrollIntoView({behavior: 'smooth'}), 100); }} className="flex-1 bg-neutral-50 hover:bg-neutral-100 py-[1vh] md:py-2 rounded-lg text-[2.5vw] md:text-xs font-bold uppercase">Edit</button>
                                <button onClick={() => p.id && handleDeleteProduct(p.id)} className="px-[2vw] md:px-3 bg-white border border-red-100 text-red-500 rounded-lg hover:bg-red-50 text-[3vw] md:text-base">✕</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* --- TAB: REDUCERI --- */}
        {activeTab === 'discounts' && (
            <div className="animate-fade-in">
                <div className="flex justify-between items-center mb-[2vh] md:mb-6">
                    <h2 className="text-[4vw] md:text-xl font-bold">Coduri Reducere</h2>
                    <Button onClick={() => { setEditingDiscount({ code: '', discount_type: 'percentage', discount_value: 10, min_order_amount: 0, used_count: 0, valid_from: new Date().toISOString().split('T')[0], is_active: true }); setShowDiscountForm(true); }} className="text-[3vw] md:text-sm">+ Cod</Button>
                </div>

                {showDiscountForm && editingDiscount && (
                    <div className="bg-white p-[2vh] md:p-6 rounded-2xl shadow-xl mb-[2vh] md:mb-8 border border-neutral-200">
                        <form onSubmit={handleDiscountSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-[2vh] md:gap-6">
                            <div><label className="label-admin">Cod</label><input className="input-admin uppercase font-bold text-[3vw] md:text-sm" value={editingDiscount.code} onChange={e=>setEditingDiscount({...editingDiscount, code: e.target.value.toUpperCase()})} required /></div>
                            <div className="grid grid-cols-2 gap-[1.5vh] md:gap-4">
                                <div><label className="label-admin">Tip</label><select className="input-admin text-[3vw] md:text-sm" value={editingDiscount.discount_type} onChange={e=>setEditingDiscount({...editingDiscount, discount_type: e.target.value as any})}><option value="percentage">%</option><option value="fixed">RON</option></select></div>
                                <div><label className="label-admin">Val</label><input type="number" className="input-admin text-[3vw] md:text-sm" value={editingDiscount.discount_value} onChange={e=>setEditingDiscount({...editingDiscount, discount_value: parseFloat(e.target.value)})} required /></div>
                            </div>
                            <div className="md:col-span-2 flex gap-[1.5vh] md:gap-4"><Button type="submit" className="text-[3vw] md:text-sm">Salvează</Button><Button variant="outline" onClick={()=>setShowDiscountForm(false)} type="button" className="text-[3vw] md:text-sm">Anulează</Button></div>
                        </form>
                    </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-[2vh] md:gap-4">
                    {discounts.map(d => (
                        <div key={d.id} className={`p-[2vh] md:p-5 rounded-xl border ${d.is_active ? 'bg-white border-neutral-200' : 'bg-neutral-50 border-neutral-100 opacity-60'}`}>
                            <div className="flex justify-between mb-[1vh] md:mb-2">
                                <div className="font-mono font-black text-[4vw] md:text-xl bg-yellow-50 px-2 rounded">{d.code}</div>
                                <button onClick={()=>handleDeleteDiscount(d.id)} className="text-red-500 text-[2.5vw] md:text-xs font-bold">Șterge</button>
                            </div>
                            <div className="text-[3vw] md:text-sm">Reducere: <b>{d.discount_value}{d.discount_type === 'percentage' ? '%' : ' RON'}</b></div>
                            <div className="text-[2.5vw] md:text-xs text-neutral-500 mt-[1vh] md:mt-2">Utilizări: {d.used_count}</div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* MODAL EDITARE COMANDĂ */}
        {editingOrder && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-[2vw] md:p-4 backdrop-blur-sm">
                <div className="bg-white rounded-2xl p-[3vh] md:p-8 w-full max-w-[90vw] md:max-w-lg max-h-[85vh] overflow-y-auto">
                    <h2 className="text-[4vw] md:text-xl font-bold mb-[2vh] md:mb-4 flex justify-between items-center">
                        <span>Editare #{editingOrder.id}</span>
                        <button onClick={() => setEditingOrder(null)} className="text-neutral-400 hover:text-black text-[5vw] md:text-2xl">✕</button>
                    </h2>
                    <form onSubmit={handleUpdateOrder} className="space-y-[1.5vh] md:space-y-4">
                        <div>
                            <label className="label-admin">Status</label>
                            <select className="input-admin text-[3vw] md:text-sm" value={editingOrder.status} onChange={e=>setEditingOrder({...editingOrder, status: e.target.value})}>
                                <option value="pending">Pending</option>
                                <option value="paid">Paid</option>
                                <option value="completed">Completed</option>
                                <option value="cancelled">Cancelled</option>
                            </select>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-[1.5vh] md:gap-4">
                            <div><label className="label-admin">Nume</label><input className="input-admin text-[3vw] md:text-sm" value={editingOrder.customer_name} onChange={e=>setEditingOrder({...editingOrder, customer_name: e.target.value})} /></div>
                            <div><label className="label-admin">Telefon</label><input className="input-admin text-[3vw] md:text-sm" value={editingOrder.customer_phone} onChange={e=>setEditingOrder({...editingOrder, customer_phone: e.target.value})} /></div>
                        </div>
                        
                        <div><label className="label-admin">Email</label><input className="input-admin text-[3vw] md:text-sm" value={editingOrder.customer_email} onChange={e=>setEditingOrder({...editingOrder, customer_email: e.target.value})} /></div>
                        
                        <div className="border-t border-neutral-100 pt-[1.5vh] md:pt-4">
                            <p className="text-[2.5vw] md:text-xs font-bold uppercase text-neutral-400 mb-[1vh] md:mb-3">Adresă Livrare</p>
                            <div className="grid grid-cols-2 gap-[1.5vh] md:gap-4 mb-[1vh] md:mb-2">
                                <div><label className="label-admin">Județ</label><input className="input-admin text-[3vw] md:text-sm" value={editingOrder.county || ''} onChange={e=>setEditingOrder({...editingOrder, county: e.target.value})} /></div>
                                <div><label className="label-admin">Oraș</label><input className="input-admin text-[3vw] md:text-sm" value={editingOrder.city || ''} onChange={e=>setEditingOrder({...editingOrder, city: e.target.value})} /></div>
                            </div>
                            <div className="grid grid-cols-3 gap-[1.5vh] md:gap-4">
                                <div className="col-span-2"><label className="label-admin">Adresă</label><input className="input-admin text-[3vw] md:text-sm" value={editingOrder.address_line || ''} onChange={e=>setEditingOrder({...editingOrder, address_line: e.target.value})} /></div>
                                <div><label className="label-admin">Cod</label><input className="input-admin text-[3vw] md:text-sm" value={editingOrder.postal_code || ''} onChange={e=>setEditingOrder({...editingOrder, postal_code: e.target.value})} /></div>
                            </div>
                            {editingOrder.shipping_method === 'easybox' && (
                                <div className="mt-[1.5vh] md:mt-2"><label className="label-admin">Locker ID</label><input className="input-admin bg-yellow-50 font-mono text-[3vw] md:text-xs" value={editingOrder.locker_id || ''} onChange={e=>setEditingOrder({...editingOrder, locker_id: e.target.value})} /></div>
                            )}
                        </div>
                        
                        <div className="flex gap-[1.5vh] md:gap-3 pt-[2vh] md:pt-6">
                            <Button fullWidth type="submit" className="text-[3vw] md:text-sm">Salvează</Button>
                            <Button fullWidth variant="outline" onClick={()=>setEditingOrder(null)} type="button" className="text-[3vw] md:text-sm">Anulează</Button>
                        </div>
                    </form>
                </div>
            </div>
        )}

      </div>
      
      <style>{`
        .input-admin { width: 100%; padding: 0.75rem; border: 1px solid #e5e5e5; border-radius: 0.5rem; outline: none; transition: border-color 0.2s; }
        .input-admin:focus { border-color: black; }
        .label-admin { display: block; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: #737373; margin-bottom: 0.35rem; letter-spacing: 0.05em; }
        @keyframes bounce-in { 0% { opacity: 0; transform: translate(-50%, 20px); } 100% { opacity: 1; transform: translate(-50%, 0); } }
        .animate-bounce-in { animation: bounce-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        @media (max-width: 768px) {
          .input-admin { padding: 0.5rem; }
        }
      `}</style>
    </div>
  );
};