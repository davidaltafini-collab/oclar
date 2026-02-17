import React, { useState, useEffect } from 'react';
import { API_URL } from '../constants';
import { Button } from '../components/Button';

// ============================================================
// INTERFEȚE
// ============================================================

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

// ============================================================
// COMPONENTE UI REUTILIZABILE
// ============================================================

const ToggleSwitch = ({ checked, onChange, label, subLabel }: {
  checked: boolean, onChange: (v: boolean) => void, label: string, subLabel?: string
}) => (
  <div className="flex flex-col">
    <div className="flex items-center gap-3 cursor-pointer" onClick={() => onChange(!checked)}>
      <div className={`w-11 h-6 rounded-full p-1 transition-colors duration-300 relative ${checked ? 'bg-green-500' : 'bg-neutral-300'}`}>
        <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform duration-300 absolute top-1 left-1 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </div>
      <span className="font-bold text-sm text-neutral-800 select-none">{label}</span>
    </div>
    {subLabel && <span className="text-[10px] text-neutral-400 mt-1 ml-14">{subLabel}</span>}
  </div>
);

const StatusBadge = ({ status }: { status: string }) => {
  const colorMap: Record<string, string> = {
    paid: 'bg-green-50 text-green-700 border-green-200',
    completed: 'bg-green-50 text-green-700 border-green-200',
    pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    cancelled: 'bg-red-50 text-red-700 border-red-200',
    shipped: 'bg-blue-50 text-blue-700 border-blue-200',
    returned: 'bg-orange-50 text-orange-700 border-orange-200',
  };
  const color = colorMap[status] || 'bg-neutral-100 text-neutral-500 border-neutral-200';
  return (
    <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border ${color}`}>
      {status}
    </span>
  );
};

// ============================================================
// ⭐ SECȚIUNEA COMENZI (Componentă separată)
// ============================================================

const OrdersSection = ({ secret }: { secret: string }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [ecoletLoading, setEcoletLoading] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<number[]>([]);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  // Filtre
  const [showHidden, setShowHidden] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');      // ⭐ NOU: card / ramburs
  const [shippingFilter, setShippingFilter] = useState('');    // ⭐ NOU: courier / easybox

  // Automatizare
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [autoOblio, setAutoOblio] = useState(true);
  const [autoEcolet, setAutoEcolet] = useState(true);

  // --- API ---
  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/settings`, { headers: { 'x-admin-secret': secret } });
      const data = await res.json();
      setAutoEnabled(data.automation_enabled === true || data.automation_enabled === 'true');
      setAutoOblio(data.auto_oblio === true || data.auto_oblio !== false);
      setAutoEcolet(data.auto_ecolet === true || data.auto_ecolet !== false);
    } catch (e) { console.error('Settings err:', e); }
  };

  const updateSetting = async (key: string, value: boolean) => {
    if (key === 'automation_enabled') setAutoEnabled(value);
    if (key === 'auto_oblio') setAutoOblio(value);
    if (key === 'auto_ecolet') setAutoEcolet(value);
    await fetch(`${API_URL}/admin/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
      body: JSON.stringify({ key, value })
    });
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      let url = `${API_URL}/admin?type=orders&showHidden=${showHidden}`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;
      if (statusFilter) url += `&status=${statusFilter}`;
      if (paymentFilter) url += `&paymentMethod=${paymentFilter}`;
      if (shippingFilter) url += `&shippingMethod=${shippingFilter}`;

      const res = await fetch(url, { headers: { 'x-admin-secret': secret } });
      const data = await res.json();
      setOrders(data);
      setSelectedOrders([]);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchSettings(); fetchOrders(); }, []);
  useEffect(() => { fetchOrders(); }, [showHidden]);

  // --- SELECȚIE ---
  const visibleOrders = orders.filter(o => o.is_hidden !== 1);
  const allVisibleSelected = selectedOrders.length > 0 && selectedOrders.length === visibleOrders.length;

  const handleSelectAll = () => {
    setSelectedOrders(allVisibleSelected ? [] : visibleOrders.map(o => o.id));
  };

  const toggleSelection = (id: number) => {
    setSelectedOrders(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // --- ACȚIUNI BULK ---
  const handleAction = async (action: 'hide' | 'unhide' | 'oblio' | 'ecolet' | 'csv') => {
    if (!selectedOrders.length) return;
    if (action === 'oblio' && !confirm(`Generezi facturi pentru ${selectedOrders.length} comenzi?`)) return;
    if (action === 'ecolet' && !confirm(`Trimiți ${selectedOrders.length} comenzi la Ecolet?`)) return;

    setLoading(true);
    try {
      if (action === 'hide' || action === 'unhide') {
        await fetch(`${API_URL}/admin/toggle-visibility`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
          body: JSON.stringify({ orderIds: selectedOrders, hide: action === 'hide' })
        });
        fetchOrders();
      }
      else if (action === 'oblio') {
        const res = await fetch(`${API_URL}/admin/send-invoices`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
          body: JSON.stringify({ orderIds: selectedOrders })
        });
        const data = await res.json();
        const ok = data.results?.filter((r: any) => r.success).length || 0;
        alert(`✅ Oblio: ${ok}/${selectedOrders.length} facturi generate.`);
        fetchOrders();
      }
      else if (action === 'ecolet') {
        const res = await fetch(`${API_URL}/admin/ecolet/export`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
          body: JSON.stringify({ orderIds: selectedOrders })
        });
        const data = await res.json();
        const ok = data.results?.filter((r: any) => r.success).length || 0;
        alert(`✅ Ecolet: ${ok}/${selectedOrders.length} comenzi trimise.`);
        fetchOrders();
      }
      else if (action === 'csv') {
        const res = await fetch(`${API_URL}/admin/export-orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
          body: JSON.stringify({ orderIds: selectedOrders, format: 'csv' })
        });
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `export_${Date.now()}.csv`; a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (e) { alert('Eroare: ' + e); }
    finally { setLoading(false); }
  };

  const handleEcoletSync = async () => {
    if (!selectedOrders.length) return;
    setEcoletLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/ecolet/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
        body: JSON.stringify({ orderIds: selectedOrders })
      });
      const data = await res.json();
      const ok = data.results?.filter((r: any) => r.success).length || 0;
      alert(`✅ Sync: ${ok}/${selectedOrders.length} AWB-uri actualizate.`);
      fetchOrders();
    } catch (e) { alert('Eroare sync: ' + e); }
    finally { setEcoletLoading(false); }
  };

  const handleUpdateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;
    const res = await fetch(`${API_URL}/admin`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
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
    if (res.ok) { alert('Salvat!'); setEditingOrder(null); fetchOrders(); }
    else alert('Eroare salvare.');
  };

  const quickDate = (range: 'today' | 'week' | 'month' | 'year') => {
    const now = new Date();
    const end = now.toISOString().split('T')[0];
    let start = '';
    if (range === 'today') start = end;
    else if (range === 'week') start = new Date(now.setDate(now.getDate() - 7)).toISOString().split('T')[0];
    else if (range === 'month') start = new Date(now.setMonth(now.getMonth() - 1)).toISOString().split('T')[0];
    else start = new Date(now.setFullYear(now.getFullYear() - 1)).toISOString().split('T')[0];
    setStartDate(start); setEndDate(new Date().toISOString().split('T')[0]);
  };

  // ============================================================
  // RENDER COMENZI
  // ============================================================
  return (
    <div className="space-y-6">

      {/* ZONA AUTOMATIZARE */}
      <div className="bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-neutral-200">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
            <ToggleSwitch
              checked={autoEnabled}
              onChange={(v) => updateSetting('automation_enabled', v)}
              label="🤖 Auto-Process"
              subLabel="Procesare automată comenzi noi"
            />
            {autoEnabled && (
              <div className="flex flex-col sm:flex-row gap-3 pl-0 sm:pl-6 sm:border-l border-neutral-200">
                <label className="flex items-center gap-2 text-sm font-medium text-neutral-600 cursor-pointer">
                  <input type="checkbox" checked={autoOblio} onChange={e => updateSetting('auto_oblio', e.target.checked)} className="w-4 h-4" />
                  Facturare Oblio
                </label>
                <label className="flex items-center gap-2 text-sm font-medium text-neutral-600 cursor-pointer">
                  <input type="checkbox" checked={autoEcolet} onChange={e => updateSetting('auto_ecolet', e.target.checked)} className="w-4 h-4" />
                  Curier Ecolet
                </label>
              </div>
            )}
          </div>

          {/* Indicator stare */}
          <div className={`px-3 py-1.5 rounded-full text-xs font-bold border ${autoEnabled ? 'bg-green-50 text-green-700 border-green-200' : 'bg-neutral-100 text-neutral-500 border-neutral-200'}`}>
            {autoEnabled ? '● ACTIV' : '○ INACTIV'}
          </div>
        </div>
      </div>

      {/* FILTRE */}
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-4 md:p-5 space-y-4">
        {/* Perioadă rapidă + Toggle arhivă */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <label className="label-admin">Perioadă rapidă</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {(['today','week','month','year'] as const).map(r => (
                <button key={r} onClick={() => quickDate(r)} className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 rounded text-xs font-medium transition-colors">
                  {r === 'today' ? 'Azi' : r === 'week' ? '7 zile' : r === 'month' ? '30 zile' : '1 an'}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => setShowHidden(!showHidden)}
            className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all flex items-center gap-2 whitespace-nowrap ${showHidden ? 'bg-neutral-800 text-white border-neutral-800' : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'}`}
          >
            {showHidden ? '📂 Ascunde Arhiva' : '📂 Arată Arhiva'}
          </button>
        </div>

        {/* Grid filtre - 2 rânduri */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="label-admin">De la</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input-admin py-2 text-xs" />
          </div>
          <div>
            <label className="label-admin">Până la</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input-admin py-2 text-xs" />
          </div>
          <div>
            <label className="label-admin">Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-admin py-2 text-xs">
              <option value="">Toate</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="shipped">Shipped</option>
            </select>
          </div>
          {/* ⭐ FILTRU NOU: Metodă plată */}
          <div>
            <label className="label-admin">Plată</label>
            <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)} className="input-admin py-2 text-xs">
              <option value="">Toate</option>
              <option value="card">💳 Card</option>
              <option value="ramburs">💵 Ramburs</option>
            </select>
          </div>
          {/* ⭐ FILTRU NOU: Metodă livrare */}
          <div>
            <label className="label-admin">Livrare</label>
            <select value={shippingFilter} onChange={e => setShippingFilter(e.target.value)} className="input-admin py-2 text-xs">
              <option value="">Toate</option>
              <option value="courier">🚚 Curier</option>
              <option value="easybox">📦 EasyBox</option>
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={fetchOrders} className="w-full py-2 bg-black text-white rounded-lg text-xs font-bold hover:bg-neutral-800 transition-colors">
              {loading ? '...' : 'Aplică'}
            </button>
          </div>
        </div>
      </div>

      {/* TABEL COMENZI */}
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[780px]">
            <thead className="bg-neutral-50 text-neutral-500 uppercase font-bold text-[10px] tracking-wider border-b border-neutral-100">
              <tr>
                <th className="px-4 py-4 w-10">
                  <input type="checkbox" onChange={handleSelectAll} checked={allVisibleSelected} className="w-4 h-4" />
                </th>
                <th className="px-4 py-4">ID</th>
                <th className="px-4 py-4">Client</th>
                <th className="px-4 py-4">Total</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Factură</th>
                <th className="px-4 py-4">AWB</th>
                <th className="px-4 py-4 text-right">Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {orders.length === 0 && !loading && (
                <tr><td colSpan={8} className="p-10 text-center text-neutral-400">Nu există comenzi.</td></tr>
              )}
              {loading && (
                <tr><td colSpan={8} className="p-10 text-center text-neutral-400">Se încarcă...</td></tr>
              )}
              {!loading && orders.map(order => {
                const isHidden = order.is_hidden === 1;
                return (
                  <tr key={order.id} className={`transition-colors ${isHidden ? 'bg-neutral-100/50 opacity-60' : 'hover:bg-neutral-50'}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selectedOrders.includes(order.id)} onChange={() => toggleSelection(order.id)} className="w-4 h-4" />
                    </td>
                    <td className="px-4 py-3 font-mono">
                      <div className="flex items-center gap-1">
                        <span className="text-neutral-700 font-semibold">#{order.id}</span>
                        {isHidden && <span title="Arhivat">🔒</span>}
                      </div>
                      <div className="text-[10px] text-neutral-400">{new Date(order.created_at).toLocaleDateString('ro-RO')}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-sm text-neutral-900">{order.customer_name}</div>
                      <div className="text-xs text-neutral-400 truncate max-w-[140px]">{order.customer_email}</div>
                      <div className="text-[10px] text-neutral-400 font-mono">{order.customer_phone}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold">{parseFloat(order.total_amount?.toString() || '0').toFixed(2)} RON</div>
                      <div className="text-[10px] text-neutral-500 mt-0.5">
                        {order.payment_method === 'card' ? '💳 Card' : '💵 Ramburs'}
                        {' · '}
                        {order.shipping_method === 'easybox' ? '📦 Locker' : '🚚 Curier'}
                      </div>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                    <td className="px-4 py-3 text-xs font-mono">
                      {order.oblio_invoice_number
                        ? <span className="text-green-600 bg-green-50 px-2 py-1 rounded font-semibold">✓ {order.oblio_invoice_number}</span>
                        : <span className="text-neutral-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {order.awb_number
                        ? <a href={order.label_url || '#'} target="_blank" rel="noreferrer" className="text-blue-600 bg-blue-50 px-2 py-1 rounded hover:underline font-semibold">📦 {order.awb_number}</a>
                        : order.ecolet_status === 'draft'
                          ? <span className="text-orange-500 bg-orange-50 px-2 py-1 rounded">⏳ Draft</span>
                          : <span className="text-neutral-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setEditingOrder(order)} className="text-neutral-400 hover:text-black p-1.5 rounded-lg hover:bg-neutral-100 transition-colors">✏️</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ⭐ BARA DE ACȚIUNI - Design Gemini: Full Width Bottom Bar */}
      {selectedOrders.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-neutral-900 border-t border-neutral-700 shadow-2xl">
          <div className="max-w-7xl mx-auto px-4 py-3">
            {/* Linia 1: Info + Anulare */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="bg-brand-yellow text-black text-xs font-black px-2.5 py-1 rounded-full">
                  {selectedOrders.length}
                </span>
                <span className="text-white text-sm font-medium">
                  {selectedOrders.length === 1 ? 'comandă selectată' : 'comenzi selectate'}
                </span>
              </div>
              <button onClick={() => setSelectedOrders([])} className="text-neutral-400 hover:text-white text-xs transition-colors">
                ✕ Anulează
              </button>
            </div>

            {/* Linia 2: Butoanele de acțiune */}
            <div className="flex flex-wrap gap-2">
              {/* 📄 OBLIO */}
              <button
                onClick={() => handleAction('oblio')}
                disabled={loading}
                className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors border border-neutral-600"
              >
                <span>📄</span>
                <span>Facturi Oblio</span>
              </button>

              {/* 🚚 ECOLET EXPORT */}
              <button
                onClick={() => handleAction('ecolet')}
                disabled={loading}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors"
              >
                <span>🚚</span>
                <span>Trimite Ecolet</span>
              </button>

              {/* 🔄 SYNC AWB */}
              <button
                onClick={handleEcoletSync}
                disabled={ecoletLoading}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors"
              >
                <span>{ecoletLoading ? '⏳' : '🔄'}</span>
                <span>Sync AWB</span>
              </button>

              {/* 📊 CSV */}
              <button
                onClick={() => handleAction('csv')}
                className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors border border-neutral-600"
              >
                <span>📊</span>
                <span>Export CSV</span>
              </button>

              {/* Separator */}
              <div className="hidden sm:block w-px bg-neutral-700 self-stretch mx-1" />

              {/* 🔒 ARHIVEAZĂ / REACTIVEAZĂ */}
              <button
                onClick={() => handleAction(showHidden ? 'unhide' : 'hide')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${showHidden ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'} text-white`}
              >
                <span>{showHidden ? '🔓' : '🔒'}</span>
                <span>{showHidden ? 'Reactivează' : 'Arhivează'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITARE COMANDĂ */}
      {editingOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-black uppercase mb-6 flex justify-between items-center">
              <span>Editare #{editingOrder.id}</span>
              <button onClick={() => setEditingOrder(null)} className="text-neutral-400 hover:text-black">✕</button>
            </h2>
            <form onSubmit={handleUpdateOrder} className="space-y-4">
              <div>
                <label className="label-admin">Status</label>
                <select className="input-admin" value={editingOrder.status} onChange={e => setEditingOrder({ ...editingOrder, status: e.target.value })}>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="shipped">Shipped</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="returned">Returned</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label-admin">Nume</label><input className="input-admin" value={editingOrder.customer_name} onChange={e => setEditingOrder({ ...editingOrder, customer_name: e.target.value })} /></div>
                <div><label className="label-admin">Telefon</label><input className="input-admin" value={editingOrder.customer_phone} onChange={e => setEditingOrder({ ...editingOrder, customer_phone: e.target.value })} /></div>
              </div>
              <div><label className="label-admin">Email</label><input className="input-admin" value={editingOrder.customer_email} onChange={e => setEditingOrder({ ...editingOrder, customer_email: e.target.value })} /></div>
              <div className="border-t pt-4">
                <p className="label-admin mb-3">Adresă Livrare</p>
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div><label className="label-admin">Județ</label><input className="input-admin" value={editingOrder.county || ''} onChange={e => setEditingOrder({ ...editingOrder, county: e.target.value })} /></div>
                  <div><label className="label-admin">Oraș</label><input className="input-admin" value={editingOrder.city || ''} onChange={e => setEditingOrder({ ...editingOrder, city: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2"><label className="label-admin">Stradă</label><input className="input-admin" value={editingOrder.address_line || ''} onChange={e => setEditingOrder({ ...editingOrder, address_line: e.target.value })} /></div>
                  <div><label className="label-admin">Cod Poștal</label><input className="input-admin" value={editingOrder.postal_code || ''} onChange={e => setEditingOrder({ ...editingOrder, postal_code: e.target.value })} /></div>
                </div>
                {editingOrder.shipping_method === 'easybox' && (
                  <div className="mt-3"><label className="label-admin">Locker ID</label><input className="input-admin bg-yellow-50 font-mono text-xs" value={editingOrder.locker_id || ''} onChange={e => setEditingOrder({ ...editingOrder, locker_id: e.target.value })} /></div>
                )}
              </div>
              <div className="flex gap-3 pt-4">
                <Button fullWidth type="submit">Salvează</Button>
                <Button fullWidth variant="outline" type="button" onClick={() => setEditingOrder(null)}>Anulează</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// ⭐ SECȚIUNEA PRODUSE (Componentă separată)
// ============================================================

const ProductsSection = ({ secret }: { secret: string }) => {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);
  const [showForm, setShowForm] = useState(false);

  const fetchProducts = async () => {
    setLoading(true);
    const res = await fetch(`${API_URL}/admin?type=products`, { headers: { 'x-admin-secret': secret } });
    setProducts(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchProducts(); }, []);

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>, isGallery = false) => {
    if (e.target.files?.[0] && editingProduct) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        if (isGallery) setEditingProduct({ ...editingProduct, gallery: [...(editingProduct.gallery || []), base64] });
        else setEditingProduct({ ...editingProduct, imageUrl: base64 });
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    const res = await fetch(`${API_URL}/admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
      body: JSON.stringify(editingProduct)
    });
    if (res.ok) { alert('Salvat!'); setShowForm(false); setEditingProduct(null); fetchProducts(); }
    else alert('Eroare.');
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Ștergi produsul?')) return;
    await fetch(`${API_URL}/admin?id=${id}`, { method: 'DELETE', headers: { 'x-admin-secret': secret } });
    fetchProducts();
  };

  return (
    <div>
      <div className="flex justify-end mb-6">
        <Button onClick={() => {
          setEditingProduct({ name: '', price: 0, stock_quantity: 10, description: '', category: 'Ochelari', imageUrl: '', gallery: [], colors: [], details: [] });
          setShowForm(true);
        }}>+ Adaugă Produs Nou</Button>
      </div>

      {showForm && editingProduct && (
        <div className="bg-white p-8 rounded-2xl shadow-xl mb-8 border border-neutral-200" id="productForm">
          <h3 className="text-xl font-bold mb-6 border-b pb-4">{editingProduct.id ? '✏️ Editează' : '✨ Produs Nou'}</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div><label className="label-admin">Nume Produs</label><input className="input-admin" value={editingProduct.name} onChange={e => setEditingProduct({ ...editingProduct, name: e.target.value })} required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label-admin">Preț (RON)</label><input type="number" step="0.01" className="input-admin font-bold" value={editingProduct.price} onChange={e => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) })} required /></div>
                <div><label className="label-admin text-red-500">Preț Vechi</label><input type="number" step="0.01" className="input-admin text-red-500" value={editingProduct.original_price || ''} onChange={e => setEditingProduct({ ...editingProduct, original_price: e.target.value ? parseFloat(e.target.value) : null })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label-admin">Stoc</label><input type="number" className="input-admin" value={editingProduct.stock_quantity} onChange={e => setEditingProduct({ ...editingProduct, stock_quantity: parseInt(e.target.value) })} required /></div>
                <div><label className="label-admin">Categorie</label><input className="input-admin" value={editingProduct.category} onChange={e => setEditingProduct({ ...editingProduct, category: e.target.value })} required /></div>
              </div>
              <div><label className="label-admin">Descriere</label><textarea className="input-admin h-28 resize-none" value={editingProduct.description} onChange={e => setEditingProduct({ ...editingProduct, description: e.target.value })} required /></div>
              <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200">
                <label className="label-admin mb-2 block">Specificații</label>
                {editingProduct.details.map((spec, idx) => (
                  <div key={idx} className="flex gap-2 mb-2">
                    <input className="input-admin py-1 text-sm bg-white" value={spec} onChange={e => { const d = [...editingProduct.details]; d[idx] = e.target.value; setEditingProduct({ ...editingProduct, details: d }); }} />
                    <button type="button" onClick={() => setEditingProduct({ ...editingProduct, details: editingProduct.details.filter((_, i) => i !== idx) })} className="text-red-500 px-2 hover:bg-red-50 rounded font-bold">×</button>
                  </div>
                ))}
                <Button type="button" variant="outline" className="w-full py-2 text-xs" onClick={() => setEditingProduct({ ...editingProduct, details: [...editingProduct.details, 'Caracteristică: Valoare'] })}>+ Adaugă</Button>
              </div>
            </div>
            <div className="space-y-6">
              <div>
                <label className="label-admin">Imagine Principală</label>
                <div className="border-2 border-dashed border-neutral-300 rounded-xl p-4 text-center cursor-pointer relative group overflow-hidden bg-neutral-50 min-h-[200px] flex items-center justify-center hover:bg-neutral-100 transition-colors">
                  <input type="file" onChange={e => handleImageFile(e, false)} className="absolute inset-0 opacity-0 cursor-pointer z-10" accept="image/*" />
                  {editingProduct.imageUrl ? (
                    <><img src={editingProduct.imageUrl} className="w-full h-full object-contain" alt="Cover" /><div className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-sm">Schimbă</div></>
                  ) : (
                    <div className="text-neutral-400 text-sm"><span className="block text-3xl mb-2">📷</span>Click pentru upload</div>
                  )}
                </div>
              </div>
              <div>
                <label className="label-admin">Galerie</label>
                <div className="grid grid-cols-3 gap-2">
                  {editingProduct.gallery.map((img, idx) => (
                    <div key={idx} className="relative group aspect-square border rounded-lg overflow-hidden bg-white">
                      <img src={img} className="w-full h-full object-cover" alt="Gallery" />
                      <button type="button" onClick={() => { const g = [...editingProduct.gallery]; g.splice(idx, 1); setEditingProduct({ ...editingProduct, gallery: g }); }} className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                    </div>
                  ))}
                  <div className="border-2 border-dashed border-neutral-300 rounded-lg flex items-center justify-center aspect-square cursor-pointer relative hover:bg-neutral-50 text-neutral-300 hover:text-neutral-500 transition-colors">
                    <input type="file" onChange={e => handleImageFile(e, true)} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
                    <span className="text-4xl font-light">+</span>
                  </div>
                </div>
              </div>
              <div>
                <label className="label-admin">Culori (HEX)</label>
                <input className="input-admin" placeholder="#000000, #FFFFFF" value={editingProduct.colors.join(', ')} onChange={e => setEditingProduct({ ...editingProduct, colors: e.target.value.split(',').map(c => c.trim()) })} />
                <div className="flex gap-2 mt-2">
                  {editingProduct.colors.filter(c => c.startsWith('#')).map((c, i) => (
                    <div key={i} className="w-5 h-5 rounded-full border border-neutral-200 shadow-sm" style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="md:col-span-2 flex gap-4 border-t pt-6">
              <Button type="submit" disabled={loading}>{loading ? 'Se salvează...' : 'Salvează'}</Button>
              <Button variant="outline" type="button" onClick={() => setShowForm(false)}>Anulează</Button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map(p => (
          <div key={p.id} className="bg-white p-5 rounded-2xl shadow-sm border border-neutral-100 flex flex-col hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="w-20 h-20 rounded-lg overflow-hidden border border-neutral-100 bg-neutral-50 relative">
                <img src={p.imageUrl} className="w-full h-full object-cover" alt={p.name} />
                {p.gallery?.length > 0 && <div className="absolute bottom-0 right-0 bg-black/50 text-white text-[9px] px-1">+{p.gallery.length}</div>}
              </div>
              <div className="text-right">
                <div className="font-bold text-xl">{p.price} <span className="text-xs font-normal">RON</span></div>
                {p.original_price && p.original_price > p.price && <div className="text-xs text-red-500 line-through">{p.original_price} RON</div>}
                <div className={`mt-2 px-2 py-1 rounded text-[10px] font-bold uppercase inline-block ${p.stock_quantity > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>Stoc: {p.stock_quantity}</div>
              </div>
            </div>
            <h3 className="font-bold text-lg mb-1">{p.name}</h3>
            <p className="text-xs text-neutral-500 line-clamp-2 mb-4 flex-1">{p.description}</p>
            <div className="flex gap-2 border-t border-neutral-100 pt-4">
              <button onClick={() => { setEditingProduct(p); setShowForm(true); setTimeout(() => document.getElementById('productForm')?.scrollIntoView({ behavior: 'smooth' }), 100); }} className="flex-1 bg-neutral-50 hover:bg-neutral-100 py-2 rounded-lg text-xs font-bold uppercase transition-colors">Editează</button>
              <button onClick={() => p.id && handleDelete(p.id)} className="px-3 bg-white border border-red-100 text-red-500 rounded-lg hover:bg-red-50 transition-colors">✕</button>
            </div>
          </div>
        ))}
        {!loading && products.length === 0 && <div className="col-span-full py-12 text-center text-neutral-400">Nu există produse.</div>}
      </div>
    </div>
  );
};

// ============================================================
// ⭐ SECȚIUNEA REDUCERI (Componentă separată)
// ============================================================

const DiscountsSection = ({ secret }: { secret: string }) => {
  const [discounts, setDiscounts] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<Partial<DiscountCode> | null>(null);
  const [showForm, setShowForm] = useState(false);

  const fetchDiscounts = async () => {
    const res = await fetch(`${API_URL}/admin?type=discounts`, { headers: { 'x-admin-secret': secret } });
    setDiscounts(await res.json());
  };

  useEffect(() => { fetchDiscounts(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDiscount) return;
    const method = editingDiscount.id ? 'PUT' : 'POST';
    setLoading(true);
    const res = await fetch(`${API_URL}/admin/discount-codes`, {
      method, headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
      body: JSON.stringify(editingDiscount)
    });
    setLoading(false);
    if (res.ok) { alert('Salvat!'); setShowForm(false); setEditingDiscount(null); fetchDiscounts(); }
    else alert('Eroare.');
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Ștergi codul?')) return;
    await fetch(`${API_URL}/admin/discount-codes?id=${id}`, { method: 'DELETE', headers: { 'x-admin-secret': secret } });
    fetchDiscounts();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Coduri de Reducere</h2>
        <Button onClick={() => { setEditingDiscount({ code: '', discount_type: 'percentage', discount_value: 10, min_order_amount: 0, used_count: 0, valid_from: new Date().toISOString().split('T')[0], is_active: true }); setShowForm(true); }}>+ Adaugă Cod</Button>
      </div>

      {showForm && editingDiscount && (
        <div className="bg-white p-6 rounded-2xl shadow-xl mb-8 border border-neutral-200">
          <h3 className="text-lg font-bold mb-4 border-b pb-2">{editingDiscount.id ? '✏️ Editează' : '✨ Cod Nou'}</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="label-admin">Cod (Ex: VARA20)</label>
              <input className="input-admin uppercase font-mono font-bold text-lg" required value={editingDiscount.code} onChange={e => setEditingDiscount({ ...editingDiscount, code: e.target.value.toUpperCase() })} placeholder="COD-PROMO" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-admin">Tip</label>
                <select className="input-admin" value={editingDiscount.discount_type} onChange={e => setEditingDiscount({ ...editingDiscount, discount_type: e.target.value as any })}>
                  <option value="percentage">Procent (%)</option>
                  <option value="fixed">Sumă Fixă (RON)</option>
                </select>
              </div>
              <div><label className="label-admin">Valoare</label><input type="number" step="0.01" className="input-admin font-bold" required value={editingDiscount.discount_value} onChange={e => setEditingDiscount({ ...editingDiscount, discount_value: parseFloat(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label-admin">Comandă Minimă (RON)</label><input type="number" className="input-admin" value={editingDiscount.min_order_amount} onChange={e => setEditingDiscount({ ...editingDiscount, min_order_amount: parseFloat(e.target.value) })} /></div>
              <div><label className="label-admin">Max Utilizări</label><input type="number" className="input-admin" placeholder="Nelimitat" value={editingDiscount.max_uses || ''} onChange={e => setEditingDiscount({ ...editingDiscount, max_uses: e.target.value ? parseInt(e.target.value) : null })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label-admin">Valabil De La</label><input type="datetime-local" className="input-admin" required value={editingDiscount.valid_from ? new Date(editingDiscount.valid_from).toISOString().slice(0, 16) : ''} onChange={e => setEditingDiscount({ ...editingDiscount, valid_from: e.target.value })} /></div>
              <div><label className="label-admin">Expiră La</label><input type="datetime-local" className="input-admin" value={editingDiscount.valid_until ? new Date(editingDiscount.valid_until).toISOString().slice(0, 16) : ''} onChange={e => setEditingDiscount({ ...editingDiscount, valid_until: e.target.value || null })} /></div>
            </div>
            <div className="flex items-center gap-2 bg-neutral-50 p-3 rounded-lg border border-neutral-100">
              <input type="checkbox" id="disc-active" className="w-5 h-5 accent-black" checked={editingDiscount.is_active} onChange={e => setEditingDiscount({ ...editingDiscount, is_active: e.target.checked })} />
              <label htmlFor="disc-active" className="font-bold text-sm cursor-pointer">Activează codul</label>
            </div>
            <div className="md:col-span-2 flex gap-4">
              <Button type="submit" disabled={loading}>{loading ? 'Se salvează...' : 'Salvează Codul'}</Button>
              <Button variant="outline" type="button" onClick={() => setShowForm(false)}>Anulează</Button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {discounts.map(d => (
          <div key={d.id} className={`p-5 rounded-xl border transition-all ${d.is_active ? 'bg-white border-neutral-200 shadow-sm hover:shadow-md' : 'bg-neutral-50 border-neutral-100 opacity-60 grayscale'}`}>
            <div className="flex justify-between items-start mb-2">
              <div className="font-mono font-black text-xl uppercase tracking-wider bg-yellow-50 text-yellow-800 px-2 py-1 rounded">{d.code}</div>
              <div className="flex gap-2">
                <button onClick={() => { setEditingDiscount(d); setShowForm(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="text-xs bg-black text-white px-2 py-1 rounded font-bold hover:bg-neutral-800">Edit</button>
                <button onClick={() => handleDelete(d.id)} className="text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded border border-red-100 font-bold">Șterge</button>
              </div>
            </div>
            <div className="text-2xl font-black mb-3">-{d.discount_value}{d.discount_type === 'percentage' ? '%' : ' RON'}</div>
            <div className="space-y-1 text-xs text-neutral-500 border-t border-neutral-100 pt-3">
              <div className="flex justify-between"><span>Utilizări:</span><span className="font-bold text-black">{d.used_count} {d.max_uses ? `/ ${d.max_uses}` : '(Nelimitat)'}</span></div>
              <div className="flex justify-between"><span>Min. Comandă:</span><span className="font-bold text-black">{d.min_order_amount} RON</span></div>
              {d.valid_until && <div className="flex justify-between text-orange-600"><span>Expiră:</span><span className="font-bold">{new Date(d.valid_until).toLocaleDateString('ro-RO')}</span></div>}
              <div className="flex justify-between"><span>Status:</span><span className={`font-bold ${d.is_active ? 'text-green-600' : 'text-red-600'}`}>{d.is_active ? 'ACTIV' : 'INACTIV'}</span></div>
            </div>
          </div>
        ))}
        {discounts.length === 0 && <div className="col-span-full py-12 text-center text-neutral-400 border-2 border-dashed border-neutral-200 rounded-xl">Nu există coduri de reducere.</div>}
      </div>
    </div>
  );
};

// ============================================================
// ⭐ COMPONENTA PRINCIPALĂ ADMIN
// ============================================================

export const Admin: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [secret, setSecret] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'discounts'>('orders');

  useEffect(() => {
    const savedSecret = sessionStorage.getItem('admin_secret');
    if (savedSecret) {
      setSecret(savedSecret);
      fetch(`${API_URL}/admin?type=orders`, { headers: { 'x-admin-secret': savedSecret } })
        .then(res => { if (res.ok) setIsAuthenticated(true); })
        .catch(() => sessionStorage.removeItem('admin_secret'));
    }
  }, []);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!secret) return;
    setLoginLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin?type=orders`, { headers: { 'x-admin-secret': secret } });
      if (res.ok) { setIsAuthenticated(true); sessionStorage.setItem('admin_secret', secret); }
      else alert('Cheie de securitate incorectă!');
    } catch { alert('Eroare de conexiune.'); }
    finally { setLoginLoading(false); }
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
              onChange={e => setSecret(e.target.value)}
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
    <div className="min-h-screen bg-neutral-50 pt-20 px-4 pb-32 font-sans">
      <div className="max-w-7xl mx-auto">

        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight">Dashboard</h1>
            <p className="text-neutral-500 text-sm">Centru de Comandă Oclar</p>
          </div>
          <div className="flex bg-white p-1 rounded-xl shadow-sm border border-neutral-200">
            {[
              { id: 'orders', label: 'Comenzi' },
              { id: 'products', label: 'Produse' },
              { id: 'discounts', label: 'Reduceri' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-5 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === tab.id ? 'bg-black text-white shadow-md' : 'text-neutral-500 hover:bg-neutral-50'}`}
              >
                {tab.label}
              </button>
            ))}
            <button
              onClick={() => { setIsAuthenticated(false); sessionStorage.removeItem('admin_secret'); }}
              className="ml-2 px-4 py-2 rounded-lg font-bold text-sm text-red-500 hover:bg-red-50"
              title="Deconectare"
            >✕</button>
          </div>
        </div>

        {/* CONȚINUT PE SECȚIUNI */}
        {activeTab === 'orders' && <OrdersSection secret={secret} />}
        {activeTab === 'products' && <ProductsSection secret={secret} />}
        {activeTab === 'discounts' && <DiscountsSection secret={secret} />}

      </div>

      <style>{`
        .input-admin { width:100%; padding:0.65rem 0.75rem; border:1px solid #e5e5e5; border-radius:0.5rem; outline:none; font-size:0.875rem; transition:border-color 0.2s; background:white; }
        .input-admin:focus { border-color:black; box-shadow:0 0 0 1px black; }
        .label-admin { display:block; font-size:0.7rem; font-weight:700; text-transform:uppercase; color:#737373; margin-bottom:0.3rem; letter-spacing:0.05em; }
        @keyframes fade-in { from{opacity:0} to{opacity:1} }
        .animate-fade-in { animation:fade-in 0.3s ease; }
      `}</style>
    </div>
  );
};