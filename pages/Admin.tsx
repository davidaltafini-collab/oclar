import React, { useState, useEffect } from 'react';

const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET || '';
const API_BASE = import.meta.env.VITE_API_BASE || 'https://oclar.ro';

interface Order {
  id: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  county: string;
  city: string;
  address_line: string;
  items: string;
  subtotal: number;
  shipping_method: 'easybox' | 'courier';
  shipping_cost: number;
  discount_code: string | null;
  discount_amount: number;
  total_amount: number;
  payment_method: string;
  status: string;
  oblio_invoice_id: string | null;
  oblio_invoice_number: string | null;
  awb_number: string | null;
  awb_courier: string | null;
  created_at: string;
}

interface Product {
  id?: number;
  name: string;
  description: string;
  price: number;
  original_price: number | null;
  stock_quantity: number;
  category: string;
  imageUrl: string;
  gallery: string[];
  colors: string[];
  details: Array<{ label: string; value: string }>;
  status: string;
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
  created_at: string;
}

export default function Admin() {
  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'discounts'>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [discounts, setDiscounts] = useState<DiscountCode[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<number[]>([]);
  
  // Filtre comenzi
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Edit forms
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingDiscount, setEditingDiscount] = useState<DiscountCode | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (activeTab === 'orders') fetchOrders();
    if (activeTab === 'products') fetchProducts();
    if (activeTab === 'discounts') fetchDiscounts();
  }, [activeTab]);

  const fetchOrders = async (filters = {}) => {
    try {
      const params = new URLSearchParams(filters as any);
      const res = await fetch(`${API_BASE}/api/admin?type=orders&${params}`, {
        headers: { 'x-admin-secret': ADMIN_SECRET }
      });
      const data = await res.json();
      setOrders(data);
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin?type=products`, {
        headers: { 'x-admin-secret': ADMIN_SECRET }
      });
      const data = await res.json();
      setProducts(data);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchDiscounts = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin?type=discounts`, {
        headers: { 'x-admin-secret': ADMIN_SECRET }
      });
      const data = await res.json();
      setDiscounts(data);
    } catch (error) {
      console.error('Error fetching discounts:', error);
    }
  };

  const handleQuickDateFilter = (range: string) => {
    const now = new Date();
    let start = new Date();
    
    switch (range) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        break;
      case 'week':
        start.setDate(now.getDate() - 7);
        break;
      case 'month':
        start.setDate(now.getDate() - 30);
        break;
      case 'year':
        start.setFullYear(now.getFullYear() - 1);
        break;
    }
    
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(now.toISOString().split('T')[0]);
  };

  const handleApplyFilters = () => {
    const filters: any = {};
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (statusFilter !== 'all') filters.status = statusFilter;
    fetchOrders(filters);
  };

  const toggleOrderSelection = (orderId: number) => {
    setSelectedOrders(prev =>
      prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
    );
  };

  const selectAllOrders = () => {
    if (selectedOrders.length === orders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(orders.map(o => o.id));
    }
  };

  const handleSendInvoices = async () => {
    if (selectedOrders.length === 0) {
      alert('Selectează cel puțin o comandă');
      return;
    }

    if (!confirm(`Trimiți ${selectedOrders.length} facturi în Oblio?`)) return;

    try {
      const res = await fetch(`${API_BASE}/api/admin/send-invoices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': ADMIN_SECRET
        },
        body: JSON.stringify({ orderIds: selectedOrders })
      });

      const data = await res.json();
      if (data.success) {
        alert(`Facturi trimise cu succes: ${data.results.filter((r: any) => r.success).length}/${selectedOrders.length}`);
        fetchOrders();
      }
    } catch (error) {
      alert('Eroare la trimitere facturi');
    }
  };

  const handleGenerateAWB = async () => {
    if (selectedOrders.length === 0) {
      alert('Selectează cel puțin o comandă');
      return;
    }

    const courier = prompt('Serviciu curier (fancourier/cargus/gls):', 'fancourier');
    if (!courier) return;

    try {
      const res = await fetch(`${API_BASE}/api/admin/generate-awb`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': ADMIN_SECRET
        },
        body: JSON.stringify({ orderIds: selectedOrders, courierService: courier })
      });

      const data = await res.json();
      if (data.success) {
        alert(`AWB generate: ${data.results.filter((r: any) => r.success).length}/${selectedOrders.length}`);
        fetchOrders();
      }
    } catch (error) {
      alert('Eroare la generare AWB');
    }
  };

  const handleExport = async (format: 'xml' | 'excel') => {
    if (selectedOrders.length === 0) {
      alert('Selectează cel puțin o comandă');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/admin/export-orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': ADMIN_SECRET
        },
        body: JSON.stringify({ orderIds: selectedOrders, format })
      });

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `comenzi.${format === 'xml' ? 'xml' : 'csv'}`;
      a.click();
    } catch (error) {
      alert('Eroare la export');
    }
  };

  const handleUpdateOrder = async () => {
    if (!editingOrder) return;

    try {
      const res = await fetch(`${API_BASE}/api/admin`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': ADMIN_SECRET
        },
        body: JSON.stringify({
          orderId: editingOrder.id,
          customer_name: editingOrder.customer_name,
          customer_email: editingOrder.customer_email,
          customer_phone: editingOrder.customer_phone,
          status: editingOrder.status,
          county: editingOrder.county,
          city: editingOrder.city,
          address_line: editingOrder.address_line
        })
      });

      const data = await res.json();
      if (data.success) {
        alert('Comandă actualizată cu succes');
        setEditingOrder(null);
        fetchOrders();
      }
    } catch (error) {
      alert('Eroare la actualizare comandă');
    }
  };

  const handleSaveProduct = async () => {
    if (!editingProduct) return;

    try {
      const res = await fetch(`${API_BASE}/api/admin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': ADMIN_SECRET
        },
        body: JSON.stringify(editingProduct)
      });

      const data = await res.json();
      if (data.success) {
        alert(editingProduct.id ? 'Produs actualizat' : 'Produs creat');
        setEditingProduct(null);
        fetchProducts();
      }
    } catch (error) {
      alert('Eroare la salvare produs');
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (!confirm('Ștergi acest produs?')) return;

    try {
      const res = await fetch(`${API_BASE}/api/admin?id=${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-secret': ADMIN_SECRET }
      });

      if (res.ok) {
        alert('Produs șters');
        fetchProducts();
      }
    } catch (error) {
      alert('Eroare la ștergere');
    }
  };

  const handleSaveDiscount = async () => {
    if (!editingDiscount) return;

    try {
      const res = await fetch(`${API_BASE}/api/admin/discount-codes`, {
        method: editingDiscount.id ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': ADMIN_SECRET
        },
        body: JSON.stringify(editingDiscount)
      });

      const data = await res.json();
      if (data.success) {
        alert(editingDiscount.id ? 'Cod actualizat' : 'Cod creat');
        setEditingDiscount(null);
        fetchDiscounts();
      }
    } catch (error) {
      alert('Eroare la salvare cod');
    }
  };

  const handleDeleteDiscount = async (id: number) => {
    if (!confirm('Ștergi acest cod?')) return;

    try {
      const res = await fetch(`${API_BASE}/api/admin/discount-codes?id=${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-secret': ADMIN_SECRET }
      });

      if (res.ok) {
        alert('Cod șters');
        fetchDiscounts();
      }
    } catch (error) {
      alert('Eroare la ștergere');
    }
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '20px' }}>Panel Admin OCLAR</h1>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #e5e7eb' }}>
        <button
          onClick={() => setActiveTab('orders')}
          style={{
            padding: '10px 20px',
            background: activeTab === 'orders' ? '#000' : 'transparent',
            color: activeTab === 'orders' ? '#fff' : '#000',
            border: 'none',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          📦 Comenzi ({orders.length})
        </button>
        <button
          onClick={() => setActiveTab('products')}
          style={{
            padding: '10px 20px',
            background: activeTab === 'products' ? '#000' : 'transparent',
            color: activeTab === 'products' ? '#fff' : '#000',
            border: 'none',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          🛍️ Produse ({products.length})
        </button>
        <button
          onClick={() => setActiveTab('discounts')}
          style={{
            padding: '10px 20px',
            background: activeTab === 'discounts' ? '#000' : 'transparent',
            color: activeTab === 'discounts' ? '#fff' : '#000',
            border: 'none',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          🎟️ Coduri Reducere ({discounts.length})
        </button>
      </div>

      {/* TAB: COMENZI */}
      {activeTab === 'orders' && (
        <>
          {/* Filtre și Acțiuni */}
          <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '15px' }}>Filtre și Acțiuni</h3>
            
            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' }}>
              <button onClick={() => handleQuickDateFilter('today')} style={quickFilterButtonStyle}>Azi</button>
              <button onClick={() => handleQuickDateFilter('week')} style={quickFilterButtonStyle}>7 zile</button>
              <button onClick={() => handleQuickDateFilter('month')} style={quickFilterButtonStyle}>30 zile</button>
              <button onClick={() => handleQuickDateFilter('year')} style={quickFilterButtonStyle}>1 an</button>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' }}>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={inputStyle}
                placeholder="De la"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={inputStyle}
                placeholder="Până la"
              />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={inputStyle}>
                <option value="all">Toate statusurile</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <button onClick={handleApplyFilters} style={{ ...buttonStyle, background: '#3b82f6' }}>
                🔍 Aplică Filtre
              </button>
            </div>

            {selectedOrders.length > 0 && (
              <div style={{ padding: '15px', background: '#f0f9ff', borderRadius: '6px', marginTop: '15px' }}>
                <p style={{ fontWeight: '600', marginBottom: '10px' }}>
                  {selectedOrders.length} comenzi selectate
                </p>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button onClick={handleSendInvoices} style={{ ...buttonStyle, background: '#10b981' }}>
                    📄 Trimite Facturi în Oblio
                  </button>
                  <button onClick={handleGenerateAWB} style={{ ...buttonStyle, background: '#8b5cf6' }}>
                    📦 Generează AWB
                  </button>
                  <button onClick={() => handleExport('xml')} style={{ ...buttonStyle, background: '#f59e0b' }}>
                    💾 Export XML
                  </button>
                  <button onClick={() => handleExport('excel')} style={{ ...buttonStyle, background: '#ef4444' }}>
                    📊 Export Excel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Tabel Comenzi */}
          <div style={{ background: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                  <th style={thStyle}>
                    <input
                      type="checkbox"
                      checked={selectedOrders.length === orders.length && orders.length > 0}
                      onChange={selectAllOrders}
                    />
                  </th>
                  <th style={thStyle}>ID</th>
                  <th style={thStyle}>Client</th>
                  <th style={thStyle}>Prețuri</th>
                  <th style={thStyle}>Metodă</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Livrare</th>
                  <th style={thStyle}>Facturi/AWB</th>
                  <th style={thStyle}>Acțiuni</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={tdStyle}>
                      <input
                        type="checkbox"
                        checked={selectedOrders.includes(order.id)}
                        onChange={() => toggleOrderSelection(order.id)}
                      />
                    </td>
                    <td style={tdStyle}>#{order.id}</td>
                    <td style={tdStyle}>
                      <div style={{ fontSize: '14px' }}>
                        <strong>{order.customer_name}</strong><br />
                        <span style={{ fontSize: '12px', color: '#6b7280' }}>{order.customer_email}</span><br />
                        <span style={{ fontSize: '12px', color: '#6b7280' }}>{order.customer_phone}</span>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ fontSize: '13px' }}>
                        <div>Subtotal: {order.subtotal?.toFixed(2)} RON</div>
                        {order.discount_amount > 0 && (
                          <div style={{ color: '#10b981', fontWeight: '600' }}>
                            Reducere: -{order.discount_amount.toFixed(2)} RON
                          </div>
                        )}
                        <div style={{ fontWeight: '700', fontSize: '14px', marginTop: '4px' }}>
                          Total: {order.total_amount.toFixed(2)} RON
                        </div>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        background: order.payment_method === 'card' ? '#dbeafe' : '#fef3c7',
                        color: order.payment_method === 'card' ? '#1e40af' : '#92400e'
                      }}>
                        {order.payment_method === 'card' ? '💳 Card' : '💵 Ramburs'}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        background: order.status === 'paid' ? '#d1fae5' : '#fef3c7',
                        color: order.status === 'paid' ? '#065f46' : '#92400e'
                      }}>
                        {order.status}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ fontSize: '13px' }}>
                        <div>
                          {order.shipping_method === 'easybox' ? '📦 Easy Box' : '🚚 Curier'}
                        </div>
                        <div style={{ color: '#6b7280' }}>
                          {order.shipping_cost?.toFixed(2)} RON
                        </div>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ fontSize: '12px' }}>
                        {order.oblio_invoice_number && (
                          <div style={{ color: '#10b981', marginBottom: '4px' }}>
                            ✓ {order.oblio_invoice_number}
                          </div>
                        )}
                        {order.awb_number && (
                          <div style={{ color: '#3b82f6' }}>
                            📦 {order.awb_number}
                          </div>
                        )}
                        {!order.oblio_invoice_number && !order.awb_number && (
                          <span style={{ color: '#9ca3af' }}>-</span>
                        )}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <button
                        onClick={() => setEditingOrder(order)}
                        style={{ ...actionButtonStyle, background: '#3b82f6' }}
                      >
                        ✏️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Modal Edit Comandă */}
          {editingOrder && (
            <div style={modalOverlayStyle}>
              <div style={modalStyle}>
                <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '20px' }}>
                  Editează Comanda #{editingOrder.id}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <input
                    type="text"
                    placeholder="Nume client"
                    value={editingOrder.customer_name}
                    onChange={(e) => setEditingOrder({ ...editingOrder, customer_name: e.target.value })}
                    style={inputStyle}
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={editingOrder.customer_email}
                    onChange={(e) => setEditingOrder({ ...editingOrder, customer_email: e.target.value })}
                    style={inputStyle}
                  />
                  <input
                    type="tel"
                    placeholder="Telefon"
                    value={editingOrder.customer_phone}
                    onChange={(e) => setEditingOrder({ ...editingOrder, customer_phone: e.target.value })}
                    style={inputStyle}
                  />
                  <input
                    type="text"
                    placeholder="Județ"
                    value={editingOrder.county || ''}
                    onChange={(e) => setEditingOrder({ ...editingOrder, county: e.target.value })}
                    style={inputStyle}
                  />
                  <input
                    type="text"
                    placeholder="Oraș"
                    value={editingOrder.city || ''}
                    onChange={(e) => setEditingOrder({ ...editingOrder, city: e.target.value })}
                    style={inputStyle}
                  />
                  <input
                    type="text"
                    placeholder="Adresă"
                    value={editingOrder.address_line || ''}
                    onChange={(e) => setEditingOrder({ ...editingOrder, address_line: e.target.value })}
                    style={inputStyle}
                  />
                  <select
                    value={editingOrder.status}
                    onChange={(e) => setEditingOrder({ ...editingOrder, status: e.target.value })}
                    style={inputStyle}
                  >
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                    <button onClick={handleUpdateOrder} style={{ ...buttonStyle, flex: 1, background: '#10b981' }}>
                      💾 Salvează
                    </button>
                    <button onClick={() => setEditingOrder(null)} style={{ ...buttonStyle, flex: 1, background: '#6b7280' }}>
                      ❌ Anulează
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* TAB: PRODUSE */}
      {activeTab === 'products' && (
        <>
          <button
            onClick={() => setEditingProduct({
              name: '',
              description: '',
              price: 0,
              original_price: null,
              stock_quantity: 0,
              category: 'Ochelari de vedere',
              imageUrl: '',
              gallery: [],
              colors: [],
              details: [],
              status: 'active'
            })}
            style={{ ...buttonStyle, marginBottom: '20px', background: '#10b981' }}
          >
            ➕ Adaugă Produs Nou
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
            {products.map((product) => (
              <div key={product.id} style={{
                background: '#fff',
                padding: '20px',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}>
                <img src={product.imageUrl} alt={product.name} style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '6px', marginBottom: '15px' }} />
                <h4 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '10px' }}>{product.name}</h4>
                <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '10px' }}>{product.description}</p>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '20px', fontWeight: '700' }}>{product.price} RON</span>
                  {product.original_price && (
                    <span style={{ fontSize: '16px', color: '#9ca3af', textDecoration: 'line-through' }}>
                      {product.original_price} RON
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '15px' }}>
                  Stoc: {product.stock_quantity} buc
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setEditingProduct(product)} style={{ ...actionButtonStyle, flex: 1, background: '#3b82f6' }}>
                    ✏️ Editează
                  </button>
                  <button onClick={() => handleDeleteProduct(product.id!)} style={{ ...actionButtonStyle, flex: 1, background: '#ef4444' }}>
                    🗑️ Șterge
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Modal Edit/Add Product */}
          {editingProduct && (
            <div style={modalOverlayStyle}>
              <div style={{ ...modalStyle, maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
                <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '20px' }}>
                  {editingProduct.id ? 'Editează Produs' : 'Adaugă Produs Nou'}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <input
                    type="text"
                    placeholder="Nume produs"
                    value={editingProduct.name}
                    onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                    style={inputStyle}
                  />
                  <textarea
                    placeholder="Descriere"
                    value={editingProduct.description}
                    onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                    style={{ ...inputStyle, minHeight: '80px' }}
                  />
                  <input
                    type="number"
                    placeholder="Preț (RON)"
                    value={editingProduct.price}
                    onChange={(e) => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) })}
                    style={inputStyle}
                  />
                  <input
                    type="number"
                    placeholder="Preț original (opțional)"
                    value={editingProduct.original_price || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, original_price: e.target.value ? parseFloat(e.target.value) : null })}
                    style={inputStyle}
                  />
                  <input
                    type="number"
                    placeholder="Stoc"
                    value={editingProduct.stock_quantity}
                    onChange={(e) => setEditingProduct({ ...editingProduct, stock_quantity: parseInt(e.target.value) })}
                    style={inputStyle}
                  />
                  <select
                    value={editingProduct.category}
                    onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                    style={inputStyle}
                  >
                    <option value="Ochelari de vedere">Ochelari de vedere</option>
                    <option value="Ochelari de soare">Ochelari de soare</option>
                    <option value="Lentile de contact">Lentile de contact</option>
                    <option value="Accesorii">Accesorii</option>
                  </select>
                  <input
                    type="url"
                    placeholder="URL imagine principală"
                    value={editingProduct.imageUrl}
                    onChange={(e) => setEditingProduct({ ...editingProduct, imageUrl: e.target.value })}
                    style={inputStyle}
                  />
                  <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                    <button onClick={handleSaveProduct} style={{ ...buttonStyle, flex: 1, background: '#10b981' }}>
                      💾 Salvează
                    </button>
                    <button onClick={() => setEditingProduct(null)} style={{ ...buttonStyle, flex: 1, background: '#6b7280' }}>
                      ❌ Anulează
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* TAB: CODURI REDUCERE */}
      {activeTab === 'discounts' && (
        <>
          <button
            onClick={() => setEditingDiscount({
              id: 0,
              code: '',
              discount_type: 'percentage',
              discount_value: 0,
              min_order_amount: 0,
              max_uses: null,
              used_count: 0,
              valid_from: new Date().toISOString().split('T')[0],
              valid_until: null,
              is_active: true,
              created_at: ''
            })}
            style={{ ...buttonStyle, marginBottom: '20px', background: '#10b981' }}
          >
            ➕ Adaugă Cod Nou
          </button>

          <div style={{ background: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                  <th style={thStyle}>Cod</th>
                  <th style={thStyle}>Tip</th>
                  <th style={thStyle}>Valoare</th>
                  <th style={thStyle}>Comandă Min</th>
                  <th style={thStyle}>Utilizări</th>
                  <th style={thStyle}>Valabilitate</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Acțiuni</th>
                </tr>
              </thead>
              <tbody>
                {discounts.map((discount) => (
                  <tr key={discount.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ ...tdStyle, fontWeight: '700', fontFamily: 'monospace' }}>
                      {discount.code}
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        background: discount.discount_type === 'percentage' ? '#dbeafe' : '#fef3c7',
                        color: discount.discount_type === 'percentage' ? '#1e40af' : '#92400e'
                      }}>
                        {discount.discount_type === 'percentage' ? '📊 Procent' : '💵 Fix'}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {discount.discount_type === 'percentage' 
                        ? `${discount.discount_value}%` 
                        : `${discount.discount_value} RON`}
                    </td>
                    <td style={tdStyle}>
                      {discount.min_order_amount > 0 ? `${discount.min_order_amount} RON` : '-'}
                    </td>
                    <td style={tdStyle}>
                      {discount.max_uses 
                        ? `${discount.used_count}/${discount.max_uses}` 
                        : `${discount.used_count}/∞`}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ fontSize: '12px' }}>
                        <div>De la: {new Date(discount.valid_from).toLocaleDateString('ro-RO')}</div>
                        {discount.valid_until && (
                          <div>Până: {new Date(discount.valid_until).toLocaleDateString('ro-RO')}</div>
                        )}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        background: discount.is_active ? '#d1fae5' : '#fee2e2',
                        color: discount.is_active ? '#065f46' : '#991b1b'
                      }}>
                        {discount.is_active ? '✓ Activ' : '✗ Inactiv'}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button
                          onClick={() => setEditingDiscount(discount)}
                          style={{ ...actionButtonStyle, background: '#3b82f6' }}
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteDiscount(discount.id)}
                          style={{ ...actionButtonStyle, background: '#ef4444' }}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Modal Edit/Add Discount */}
          {editingDiscount && (
            <div style={modalOverlayStyle}>
              <div style={modalStyle}>
                <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '20px' }}>
                  {editingDiscount.id ? 'Editează Cod Reducere' : 'Adaugă Cod Nou'}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <input
                    type="text"
                    placeholder="Cod (ex: SUMMER2024)"
                    value={editingDiscount.code}
                    onChange={(e) => setEditingDiscount({ ...editingDiscount, code: e.target.value.toUpperCase() })}
                    style={{ ...inputStyle, fontFamily: 'monospace', fontWeight: '700' }}
                  />
                  <select
                    value={editingDiscount.discount_type}
                    onChange={(e) => setEditingDiscount({ ...editingDiscount, discount_type: e.target.value as 'percentage' | 'fixed' })}
                    style={inputStyle}
                  >
                    <option value="percentage">Procent (%)</option>
                    <option value="fixed">Sumă fixă (RON)</option>
                  </select>
                  <input
                    type="number"
                    placeholder={editingDiscount.discount_type === 'percentage' ? 'Procent (ex: 20)' : 'Sumă (RON)'}
                    value={editingDiscount.discount_value}
                    onChange={(e) => setEditingDiscount({ ...editingDiscount, discount_value: parseFloat(e.target.value) })}
                    style={inputStyle}
                  />
                  <input
                    type="number"
                    placeholder="Comandă minimă (RON) - opțional"
                    value={editingDiscount.min_order_amount}
                    onChange={(e) => setEditingDiscount({ ...editingDiscount, min_order_amount: parseFloat(e.target.value) || 0 })}
                    style={inputStyle}
                  />
                  <input
                    type="number"
                    placeholder="Utilizări maxime - opțional (lasă gol pentru nelimitat)"
                    value={editingDiscount.max_uses || ''}
                    onChange={(e) => setEditingDiscount({ ...editingDiscount, max_uses: e.target.value ? parseInt(e.target.value) : null })}
                    style={inputStyle}
                  />
                  <div>
                    <label style={{ fontSize: '14px', color: '#6b7280', marginBottom: '5px', display: 'block' }}>
                      Valabil de la:
                    </label>
                    <input
                      type="date"
                      value={editingDiscount.valid_from.split('T')[0]}
                      onChange={(e) => setEditingDiscount({ ...editingDiscount, valid_from: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '14px', color: '#6b7280', marginBottom: '5px', display: 'block' }}>
                      Valabil până la (opțional):
                    </label>
                    <input
                      type="date"
                      value={editingDiscount.valid_until ? editingDiscount.valid_until.split('T')[0] : ''}
                      onChange={(e) => setEditingDiscount({ ...editingDiscount, valid_until: e.target.value || null })}
                      style={inputStyle}
                    />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={editingDiscount.is_active}
                      onChange={(e) => setEditingDiscount({ ...editingDiscount, is_active: e.target.checked })}
                    />
                    <span style={{ fontSize: '14px' }}>Cod activ</span>
                  </label>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                    <button onClick={handleSaveDiscount} style={{ ...buttonStyle, flex: 1, background: '#10b981' }}>
                      💾 Salvează
                    </button>
                    <button onClick={() => setEditingDiscount(null)} style={{ ...buttonStyle, flex: 1, background: '#6b7280' }}>
                      ❌ Anulează
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Styles
const buttonStyle = {
  padding: '10px 16px',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: '600',
  color: '#fff',
  transition: 'opacity 0.2s'
};

const quickFilterButtonStyle = {
  ...buttonStyle,
  background: '#6b7280',
  padding: '8px 12px',
  fontSize: '13px'
};

const actionButtonStyle = {
  padding: '6px 10px',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '14px',
  color: '#fff',
  fontWeight: '600'
};

const inputStyle = {
  padding: '10px',
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  fontSize: '14px'
};

const thStyle = {
  padding: '12px',
  textAlign: 'left' as const,
  fontSize: '13px',
  fontWeight: '600',
  color: '#374151'
};

const tdStyle = {
  padding: '12px',
  fontSize: '14px'
};

const modalOverlayStyle = {
  position: 'fixed' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000
};

const modalStyle = {
  background: '#fff',
  padding: '30px',
  borderRadius: '12px',
  maxWidth: '500px',
  width: '90%',
  boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
};
