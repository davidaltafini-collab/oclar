import React, { useState, useEffect } from 'react';
import { API_URL } from '../constants';
import { Button } from '../components/Button';

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

export const Admin: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [secret, setSecret] = useState('');
  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'discounts'>('orders');
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [discounts, setDiscounts] = useState<DiscountCode[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  // Filtre comenzi
  const [selectedOrders, setSelectedOrders] = useState<number[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Formular Produs
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);

  // Formular Comandă (Editare)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  // Formular Reduceri
  const [editingDiscount, setEditingDiscount] = useState<Partial<DiscountCode> | null>(null);
  const [showDiscountForm, setShowDiscountForm] = useState(false);

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
        } else {
            alert('Cheie de securitate incorectă!');
        }
    } catch (err) {
        alert('Eroare de conexiune la server.');
    } finally {
        setLoginLoading(false);
    }
  };
  
  useEffect(() => {
      const savedSecret = sessionStorage.getItem('admin_secret');
      if(savedSecret) {
          setSecret(savedSecret);
          setIsAuthenticated(true);
      }
  }, []);

  const fetchData = async (type: 'orders' | 'products' | 'discounts') => {
    setLoading(true);
    try {
      let url = `${API_URL}/admin?type=${type}`;
      
      if (type === 'orders') {
        if (startDate) url += `&startDate=${startDate}`;
        if (endDate) url += `&endDate=${endDate}`;
        if (statusFilter) url += `&status=${statusFilter}`;
      }

      const res = await fetch(url, {
        headers: { 'x-admin-secret': secret }
      });
      
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
    if (isAuthenticated) {
      fetchData(activeTab);
    }
  }, [activeTab, isAuthenticated]);

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

  // --- HANDLERS COMENZI ---
  const toggleOrderSelection = (orderId: number) => {
    setSelectedOrders(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  const selectAllOrders = () => {
    if (selectedOrders.length === orders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(orders.map(o => o.id));
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
                address_line: editingOrder.address_line
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

  const handleGenerateAWB = async () => {
    if (selectedOrders.length === 0) {
      alert('Selectează cel puțin o comandă');
      return;
    }

    const courier = prompt('Selectează curier:\n1. fancourier\n2. cargus\n3. gls', 'fancourier');
    if (!courier) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/admin/generate-awb`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': secret
        },
        body: JSON.stringify({ 
          orderIds: selectedOrders,
          courierService: courier
        })
      });

      const result = await response.json();
      
      if (result.success) {
        alert(`AWB generat!\nNote: ${result.results[0]?.message || 'Succes'}`);
        fetchData('orders');
      } else {
        alert('Eroare la generare AWB');
      }
    } catch (error) {
      alert('Eroare de conexiune');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'xml' | 'excel') => {
    if (selectedOrders.length === 0) {
      alert('Selectează cel puțin o comandă');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/admin/export-orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': secret
        },
        body: JSON.stringify({ 
          orderIds: selectedOrders,
          format 
        })
      });

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orders_${Date.now()}.${format === 'xml' ? 'xml' : 'csv'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      alert('Eroare la export');
    }
  };

  // --- HANDLERS REDUCERI (NOU) ---
  const handleDiscountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDiscount) return;

    // Determinăm dacă e creare sau update
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
    <div className="min-h-screen bg-neutral-50 pt-24 px-4 pb-12 animate-fade-in relative">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
            <div>
                <h1 className="text-3xl font-black uppercase tracking-tight">Dashboard</h1>
                <p className="text-neutral-500 text-sm">Gestionează magazinul Oclar</p>
            </div>
            
            <div className="flex bg-white p-1 rounded-xl shadow-sm border border-neutral-200 overflow-x-auto">
                <button 
                    onClick={() => setActiveTab('orders')}
                    className={`px-4 md:px-6 py-2 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'orders' ? 'bg-black text-white shadow-lg' : 'text-neutral-500 hover:bg-neutral-50'}`}
                >
                    Comenzi
                </button>
                <button 
                    onClick={() => setActiveTab('products')}
                    className={`px-4 md:px-6 py-2 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'products' ? 'bg-black text-white shadow-lg' : 'text-neutral-500 hover:bg-neutral-50'}`}
                >
                    Produse
                </button>
                <button 
                    onClick={() => setActiveTab('discounts')}
                    className={`px-4 md:px-6 py-2 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'discounts' ? 'bg-black text-white shadow-lg' : 'text-neutral-500 hover:bg-neutral-50'}`}
                >
                    Reduceri
                </button>
                <button
                    onClick={() => { setIsAuthenticated(false); sessionStorage.removeItem('admin_secret'); }}
                    className="ml-2 px-4 py-2 rounded-lg font-bold text-sm text-red-500 hover:bg-red-50 transition-colors"
                    title="Deconectare"
                >
                    ✕
                </button>
            </div>
        </div>

        {activeTab === 'orders' && (
            <>
              {/* FILTRE ȘI ACȚIUNI */}
              <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  {/* Filtre rapide */}
                  <div>
                    <label className="label-admin">Perioadă Rapidă</label>
                    <div className="flex gap-2">
                      <button onClick={() => handleQuickDateFilter('today')} className="px-3 py-1 bg-neutral-100 hover:bg-neutral-200 rounded text-xs">Azi</button>
                      <button onClick={() => handleQuickDateFilter('week')} className="px-3 py-1 bg-neutral-100 hover:bg-neutral-200 rounded text-xs">7 zile</button>
                      <button onClick={() => handleQuickDateFilter('month')} className="px-3 py-1 bg-neutral-100 hover:bg-neutral-200 rounded text-xs">30 zile</button>
                      <button onClick={() => handleQuickDateFilter('year')} className="px-3 py-1 bg-neutral-100 hover:bg-neutral-200 rounded text-xs">1 an</button>
                    </div>
                  </div>

                  {/* Data start */}
                  <div>
                    <label className="label-admin">De la data</label>
                    <input 
                      type="date" 
                      value={startDate} 
                      onChange={(e) => setStartDate(e.target.value)}
                      className="input-admin"
                    />
                  </div>

                  {/* Data end */}
                  <div>
                    <label className="label-admin">Până la data</label>
                    <input 
                      type="date" 
                      value={endDate} 
                      onChange={(e) => setEndDate(e.target.value)}
                      className="input-admin"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Status filter */}
                  <div>
                    <label className="label-admin">Filtrare Status</label>
                    <select 
                      value={statusFilter} 
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="input-admin"
                    >
                      <option value="">Toate</option>
                      <option value="pending">Pending</option>
                      <option value="paid">Paid</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>

                  <div className="flex items-end">
                    <Button onClick={() => fetchData('orders')} variant="outline" fullWidth>
                      Aplică Filtre
                    </Button>
                  </div>
                </div>

                {/* ACȚIUNI BULK */}
                {selectedOrders.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-neutral-200">
                    <p className="text-sm font-bold mb-3">
                      {selectedOrders.length} comenzi selectate
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={handleSendInvoices} disabled={loading}>
                        📄 Trimite Facturi în Oblio
                      </Button>
                      <Button onClick={handleGenerateAWB} disabled={loading} variant="secondary">
                        📦 Generează AWB
                      </Button>
                      <Button onClick={() => handleExport('xml')} variant="outline">
                        💾 Export XML
                      </Button>
                      <Button onClick={() => handleExport('excel')} variant="outline">
                        📊 Export Excel
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* TABEL COMENZI */}
              <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-neutral-50 text-neutral-500 uppercase font-bold text-[10px] tracking-wider border-b border-neutral-100">
                            <tr>
                                <th className="px-6 py-4">
                                  <input 
                                    type="checkbox" 
                                    checked={selectedOrders.length === orders.length && orders.length > 0}
                                    onChange={selectAllOrders}
                                    className="w-4 h-4"
                                  />
                                </th>
                                <th className="px-6 py-4">ID</th>
                                <th className="px-6 py-4">Client</th>
                                <th className="px-6 py-4">Prețuri</th>
                                <th className="px-6 py-4">Metodă</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Livrare</th>
                                <th className="px-6 py-4">Facturi/AWB</th>
                                <th className="px-6 py-4">Acțiuni</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                            {orders.map(order => (
                                <tr key={order.id} className="hover:bg-neutral-50 transition-colors">
                                    <td className="px-6 py-4">
                                      <input 
                                        type="checkbox"
                                        checked={selectedOrders.includes(order.id)}
                                        onChange={() => toggleOrderSelection(order.id)}
                                        className="w-4 h-4"
                                      />
                                    </td>
                                    <td className="px-6 py-4 font-mono text-neutral-400">#{order.id}</td>
                                    <td className="px-6 py-4">
                                        <div className="font-bold">{order.customer_name}</div>
                                        <div className="text-xs text-neutral-500">{order.customer_email}</div>
                                        <div className="text-xs text-neutral-500 font-mono">{order.customer_phone}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-xs space-y-1">
                                          <div>Subtotal: {parseFloat(order.subtotal?.toString() || '0').toFixed(2)} RON</div>
                                          {order.discount_amount > 0 && (
                                            <div className="text-green-600">Reducere: -{parseFloat(order.discount_amount.toString()).toFixed(2)} RON</div>
                                          )}
                                          <div className="font-bold text-base">Total: {parseFloat(order.total_amount.toString()).toFixed(2)} RON</div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 uppercase text-xs font-bold text-neutral-500">
                                        {order.payment_method === 'card' ? '💳 Card' : '💵 Ramburs'}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border ${
                                            order.status === 'paid' ? 'bg-green-50 text-green-600 border-green-100' : 
                                            order.status === 'pending' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' : 'bg-neutral-100 text-neutral-500'
                                        }`}>
                                            {order.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-xs">
                                      <div>{order.shipping_method === 'easybox' ? '📦 Easy Box' : '🚚 Curier'}</div>
                                      <div className="text-neutral-400 font-bold">{parseFloat(order.shipping_cost?.toString() || '0').toFixed(2)} RON</div>
                                    </td>
                                    <td className="px-6 py-4 text-xs">
                                      {order.oblio_invoice_number ? (
                                        <div className="text-green-600">✓ {order.oblio_invoice_number}</div>
                                      ) : (
                                        <div className="text-neutral-400">-</div>
                                      )}
                                      {order.awb_number && (
                                        <div className="text-blue-600 mt-1">📦 {order.awb_number}</div>
                                      )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <button 
                                            onClick={() => setEditingOrder(order)}
                                            className="text-neutral-500 hover:text-black transition-colors font-bold text-xs border border-neutral-200 px-2 py-1 rounded bg-white shadow-sm"
                                        >
                                            ✏️ Modifică
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {orders.length === 0 && !loading && <div className="p-12 text-center text-neutral-400">Nu există comenzi.</div>}
              </div>

              {/* MODAL EDITARE COMANDĂ */}
              {editingOrder && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in">
                      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                          <h2 className="text-xl font-black uppercase mb-6 flex justify-between items-center">
                              <span>Editare Comandă #{editingOrder.id}</span>
                              <button onClick={() => setEditingOrder(null)} className="text-neutral-400 hover:text-black">✕</button>
                          </h2>
                          
                          <form onSubmit={handleUpdateOrder} className="space-y-4">
                              <div>
                                  <label className="label-admin">Status Comandă</label>
                                  <select 
                                      className="input-admin"
                                      value={editingOrder.status}
                                      onChange={e => setEditingOrder({...editingOrder, status: e.target.value})}
                                  >
                                      <option value="pending">Pending (În așteptare)</option>
                                      <option value="paid">Paid (Plătit)</option>
                                      <option value="shipped">Shipped (Livrat)</option>
                                      <option value="completed">Completed (Finalizat)</option>
                                      <option value="cancelled">Cancelled (Anulat)</option>
                                      <option value="returned">Returned (Returnat)</option>
                                  </select>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                  <div>
                                      <label className="label-admin">Nume Client</label>
                                      <input 
                                          className="input-admin"
                                          value={editingOrder.customer_name}
                                          onChange={e => setEditingOrder({...editingOrder, customer_name: e.target.value})}
                                      />
                                  </div>
                                  <div>
                                      <label className="label-admin">Telefon</label>
                                      <input 
                                          className="input-admin"
                                          value={editingOrder.customer_phone}
                                          onChange={e => setEditingOrder({...editingOrder, customer_phone: e.target.value})}
                                      />
                                  </div>
                              </div>

                              <div>
                                  <label className="label-admin">Email</label>
                                  <input 
                                      className="input-admin"
                                      value={editingOrder.customer_email}
                                      onChange={e => setEditingOrder({...editingOrder, customer_email: e.target.value})}
                                  />
                              </div>

                              <div className="border-t border-neutral-100 pt-4 mt-2">
                                   <p className="text-xs font-bold uppercase text-neutral-400 mb-3">Adresă Livrare</p>
                                   <div className="grid grid-cols-2 gap-4 mb-2">
                                      <div>
                                          <label className="label-admin">Județ</label>
                                          <input 
                                              className="input-admin"
                                              value={editingOrder.county || ''}
                                              onChange={e => setEditingOrder({...editingOrder, county: e.target.value})}
                                          />
                                      </div>
                                      <div>
                                          <label className="label-admin">Oraș</label>
                                          <input 
                                              className="input-admin"
                                              value={editingOrder.city || ''}
                                              onChange={e => setEditingOrder({...editingOrder, city: e.target.value})}
                                          />
                                      </div>
                                   </div>
                                   <div>
                                      <label className="label-admin">Adresă / Stradă</label>
                                      <input 
                                          className="input-admin"
                                          value={editingOrder.address_line || ''}
                                          onChange={e => setEditingOrder({...editingOrder, address_line: e.target.value})}
                                      />
                                   </div>
                              </div>

                              <div className="flex gap-3 pt-6">
                                  <Button fullWidth type="submit">Salvează Modificările</Button>
                                  <Button fullWidth variant="outline" type="button" onClick={() => setEditingOrder(null)}>Anulează</Button>
                              </div>
                          </form>
                      </div>
                  </div>
              )}
            </>
        )}

        {activeTab === 'discounts' && (
            <div>
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
                                <Button type="submit">Salvează Codul</Button>
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

        {activeTab === 'products' && (
            <div>
                <div className="flex justify-end mb-6">
                    <Button onClick={() => {
                        setEditingProduct({
                            name: '', price: 0, original_price: null, stock_quantity: 10, description: '', 
                            category: 'Ochelari', imageUrl: '', gallery: [], colors: [], details: []
                        });
                        setShowProductForm(true);
                    }}>+ Adaugă Produs Nou</Button>
                </div>

                {showProductForm && editingProduct && (
                    <div className="bg-white p-8 rounded-2xl shadow-xl mb-8 border border-neutral-200 animate-fade-in relative scroll-mt-24" id="productForm">
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
                                            <img src={editingProduct.imageUrl} className="w-full h-full object-contain" alt="Cover" />
                                        ) : (
                                            <div className="text-neutral-400 text-sm">
                                                <span className="block text-2xl mb-2">📷</span>
                                                Click sau Trage o poză aici
                                            </div>
                                        )}
                                        {editingProduct.imageUrl && (
                                            <div className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">Schimbă Poza</div>
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
                                <Button type="submit">Salvează Modificările</Button>
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
      `}</style>
    </div>
  );
};
