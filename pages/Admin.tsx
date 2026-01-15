import React, { useState, useEffect } from 'react';
import { API_URL } from '../constants';
import { Button } from '../components/Button';

// Tipuri adaptate la baza ta de date
interface AdminProduct {
  id?: number;
  name: string;
  price: number;
  original_price?: number | null; // Asta e "Prețul vechi"
  stock_quantity: number;         // Asta e "Stocul"
  description: string;
  category: string;
  imageUrl: string;
  colors: string[];
}

export const Admin: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [secret, setSecret] = useState('');
  const [activeTab, setActiveTab] = useState<'orders' | 'products'>('orders');
  
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(false);

  // Formular Produs
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Funcție Login
  const handleLogin = () => {
    if(secret) {
        setIsAuthenticated(true);
        // Salvăm secretul temporar în sesiune pentru refresh
        sessionStorage.setItem('admin_secret', secret);
    }
  };
  
  // Auto-login la refresh dacă există cheia
  useEffect(() => {
      const savedSecret = sessionStorage.getItem('admin_secret');
      if(savedSecret) {
          setSecret(savedSecret);
          setIsAuthenticated(true);
      }
  }, []);

  const fetchData = async (type: 'orders' | 'products') => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin?type=${type}`, {
        headers: { 'x-admin-secret': secret }
      });
      if (res.status === 401) {
        alert('Sesiune expirată sau parolă greșită!');
        setIsAuthenticated(false);
        sessionStorage.removeItem('admin_secret');
        return;
      }
      const data = await res.json();
      if (type === 'orders') setOrders(data);
      if (type === 'products') setProducts(data);
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
            setShowForm(false);
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

  // --- RENDER ---

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-100 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-neutral-200">
          <div className="flex justify-center mb-6">
             <div className="w-10 h-10 bg-brand-yellow rounded-full"></div>
          </div>
          <h1 className="text-2xl font-black uppercase mb-2 text-center">Admin Panel</h1>
          <p className="text-center text-neutral-500 mb-8 text-sm">Zona restricționată Oclar</p>
          
          <input 
            type="password" 
            placeholder="Cheia de Securitate" 
            className="w-full p-4 border border-neutral-200 rounded-xl mb-4 focus:border-brand-yellow outline-none transition-colors"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
          />
          <Button fullWidth onClick={handleLogin}>Autentificare</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 pt-24 px-4 pb-12 animate-fade-in">
      <div className="max-w-7xl mx-auto">
        {/* Header Dashboard */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
            <div>
                <h1 className="text-3xl font-black uppercase tracking-tight">Dashboard</h1>
                <p className="text-neutral-500 text-sm">Gestionează magazinul Oclar</p>
            </div>
            
            <div className="flex bg-white p-1 rounded-xl shadow-sm border border-neutral-200">
                <button 
                    onClick={() => setActiveTab('orders')}
                    className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'orders' ? 'bg-black text-white shadow-lg' : 'text-neutral-500 hover:bg-neutral-50'}`}
                >
                    Comenzi
                </button>
                <button 
                    onClick={() => setActiveTab('products')}
                    className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'products' ? 'bg-black text-white shadow-lg' : 'text-neutral-500 hover:bg-neutral-50'}`}
                >
                    Produse & Stoc
                </button>
            </div>
        </div>

        {/* --- TAB COMENZI --- */}
        {activeTab === 'orders' && (
            <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-neutral-50 text-neutral-500 uppercase font-bold text-[10px] tracking-wider border-b border-neutral-100">
                            <tr>
                                <th className="px-6 py-4">ID</th>
                                <th className="px-6 py-4">Client</th>
                                <th className="px-6 py-4">Total</th>
                                <th className="px-6 py-4">Plată</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Produse</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                            {orders.map(order => (
                                <tr key={order.id} className="hover:bg-neutral-50 transition-colors">
                                    <td className="px-6 py-4 font-mono text-neutral-400">#{order.id}</td>
                                    <td className="px-6 py-4">
                                        <div className="font-bold">{order.customer_name}</div>
                                        <div className="text-xs text-neutral-500">{order.customer_email}</div>
                                        <div className="text-xs text-neutral-500">{order.customer_phone}</div>
                                    </td>
                                    <td className="px-6 py-4 font-bold">{order.total_amount} RON</td>
                                    <td className="px-6 py-4 uppercase text-xs font-bold text-neutral-500">{order.payment_method}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border ${
                                            order.status === 'paid' ? 'bg-green-50 text-green-600 border-green-100' : 
                                            order.status === 'pending' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' : 'bg-neutral-100 text-neutral-500'
                                        }`}>
                                            {order.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-xs text-neutral-600">
                                        {(() => {
                                            try {
                                                const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
                                                return items.map((i: any, idx: number) => (
                                                    <div key={idx} className="mb-1 last:mb-0">
                                                        <span className="font-bold">{i.quantity}x</span> {i.name}
                                                    </div>
                                                ));
                                            } catch (e) { return 'Eroare date'; }
                                        })()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {orders.length === 0 && !loading && <div className="p-12 text-center text-neutral-400">Nu există comenzi încă.</div>}
            </div>
        )}

        {/* --- TAB PRODUSE --- */}
        {activeTab === 'products' && (
            <div>
                <div className="flex justify-end mb-6">
                    <Button onClick={() => {
                        setEditingProduct({
                            name: '', price: 0, original_price: null, stock_quantity: 10, description: '', 
                            category: 'Ochelari', imageUrl: '', colors: []
                        });
                        setShowForm(true);
                    }}>+ Adaugă Produs Nou</Button>
                </div>

                {/* Formular Adăugare/Editare */}
                {showForm && editingProduct && (
                    <div className="bg-white p-8 rounded-2xl shadow-xl mb-8 border border-neutral-200 animate-fade-in relative">
                        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                             {editingProduct.id ? '✏️ Editează Produs' : '✨ Produs Nou'}
                        </h3>
                        
                        <form onSubmit={handleProductSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <label className="block text-xs font-bold uppercase text-neutral-500">Nume Produs</label>
                                <input 
                                    className="w-full p-3 border border-neutral-200 rounded-lg"
                                    value={editingProduct.name}
                                    onChange={e => setEditingProduct({...editingProduct, name: e.target.value})}
                                    required
                                />
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold uppercase text-neutral-500 mb-1">Preț Actual (RON)</label>
                                        <input 
                                            type="number" className="w-full p-3 border border-neutral-200 rounded-lg font-bold"
                                            value={editingProduct.price}
                                            onChange={e => setEditingProduct({...editingProduct, price: parseFloat(e.target.value)})}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase text-red-500 mb-1">Preț Vechi (Reducere)</label>
                                        <input 
                                            type="number" 
                                            className="w-full p-3 border border-neutral-200 rounded-lg text-neutral-500"
                                            placeholder="Opțional"
                                            value={editingProduct.original_price || ''}
                                            onChange={e => setEditingProduct({...editingProduct, original_price: e.target.value ? parseFloat(e.target.value) : null})}
                                        />
                                        <p className="text-[10px] text-neutral-400 mt-1">Dacă completezi, va apărea ca "Redus de la X"</p>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase text-green-600 mb-1">Stoc Disponibil</label>
                                    <input 
                                        type="number" className="w-full p-3 border border-neutral-200 rounded-lg"
                                        value={editingProduct.stock_quantity}
                                        onChange={e => setEditingProduct({...editingProduct, stock_quantity: parseInt(e.target.value)})}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-neutral-500 mb-1">URL Imagine</label>
                                    <input 
                                        className="w-full p-3 border border-neutral-200 rounded-lg"
                                        value={editingProduct.imageUrl}
                                        onChange={e => setEditingProduct({...editingProduct, imageUrl: e.target.value})}
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase text-neutral-500 mb-1">Culori (Coduri HEX)</label>
                                    <input 
                                        placeholder="ex: #000000, #FFFFFF" 
                                        className="w-full p-3 border border-neutral-200 rounded-lg"
                                        value={editingProduct.colors.join(', ')}
                                        onChange={e => setEditingProduct({...editingProduct, colors: e.target.value.split(',').map(c => c.trim())})}
                                    />
                                    <div className="flex gap-2 mt-2 h-4">
                                        {editingProduct.colors.map((c, i) => (
                                            <div key={i} className="w-4 h-4 rounded-full border border-neutral-200" style={{backgroundColor: c}}></div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase text-neutral-500 mb-1">Descriere</label>
                                    <textarea 
                                        className="w-full p-3 border border-neutral-200 rounded-lg h-24 resize-none"
                                        value={editingProduct.description}
                                        onChange={e => setEditingProduct({...editingProduct, description: e.target.value})}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="md:col-span-2 flex gap-4 mt-4 border-t border-neutral-100 pt-6">
                                <Button type="submit">Salvează Modificările</Button>
                                <Button variant="outline" onClick={() => setShowForm(false)} type="button">Anulează</Button>
                            </div>
                        </form>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {products.map(p => (
                        <div key={p.id} className="bg-white p-5 rounded-2xl shadow-sm border border-neutral-100 flex flex-col group hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-4">
                                <img src={p.imageUrl} className="w-20 h-20 rounded-lg object-cover bg-neutral-50 border border-neutral-100" />
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
                                    onClick={() => { setEditingProduct(p); setShowForm(true); window.scrollTo({top:0, behavior:'smooth'}); }}
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
    </div>
  );
};