import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Stripe from 'stripe';
import { pool } from './db.js';
import { sendOrderEmails } from './services/email.js';
import { sendOblioInvoice, generateAWB } from './services/oblio.js';

dotenv.config();

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
});

// --- 1. CONFIGURARE CORS & PARSER ---
// Permite accesul de oriunde (pentru VPS)
app.use(cors({
  origin: '*', 
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-secret', 'stripe-signature']
}));

// Parser JSON cu limită mare pentru imagini base64
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- CONFIGURARE PREȚURI ---
const SHIPPING_COSTS = {
  easybox: 15.00,
  courier: 25.00
};

// --- MIDDLEWARE DE SECURITATE ADMIN ---
const verifyAdmin = (req, res, next) => {
    const secret = req.headers['x-admin-secret'];
    // Verifică cheia din .env
    if (!secret || secret !== process.env.ADMIN_SECRET) {
        return res.status(401).json({ error: 'Acces Neautorizat' });
    }
    next();
};

// ==================================================================
//               ZONA ADMIN: RUTE SPECIFICE (Priority High)
// ==================================================================

// 1. MANAGEMENT CODURI REDUCERE
app.post('/api/admin/discount-codes', verifyAdmin, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const { code, discount_type, discount_value, min_order_amount, max_uses, valid_from, valid_until, is_active } = req.body;
        
        await connection.query(
            `INSERT INTO discount_codes (code, discount_type, discount_value, min_order_amount, max_uses, valid_from, valid_until, is_active, created_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [code, discount_type, discount_value, min_order_amount || 0, max_uses || null, valid_from, valid_until || null, is_active ? 1 : 0]
        );
        res.json({ success: true, message: 'Cod creat' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

app.put('/api/admin/discount-codes', verifyAdmin, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const { id, code, discount_type, discount_value, min_order_amount, max_uses, valid_from, valid_until, is_active } = req.body;
        
        await connection.query(
            `UPDATE discount_codes 
             SET code=?, discount_type=?, discount_value=?, min_order_amount=?, max_uses=?, valid_from=?, valid_until=?, is_active=?
             WHERE id=?`,
            [code, discount_type, discount_value, min_order_amount || 0, max_uses || null, valid_from, valid_until || null, is_active ? 1 : 0, id]
        );
        res.json({ success: true, message: 'Cod actualizat' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

app.delete('/api/admin/discount-codes', verifyAdmin, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.query('DELETE FROM discount_codes WHERE id = ?', [req.query.id]);
        res.json({ success: true, message: 'Cod șters' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

// 2. INTEGRĂRI (OBLIO, AWB, EXPORT)
app.post('/api/admin/send-invoices', verifyAdmin, async (req, res) => {
    const { orderIds } = req.body;
    if (!orderIds || orderIds.length === 0) return res.status(400).json({ error: 'Nicio comandă selectată' });

    let connection;
    const results = [];
    try {
        connection = await pool.getConnection();
        for (const orderId of orderIds) {
            const [orders] = await connection.query('SELECT * FROM orders WHERE id = ?', [orderId]);
            if (orders.length === 0) continue;

            const order = orders[0];
            // Parsing sigur pentru items și adresă
            let items = order.items;
            if (typeof items === 'string') try { items = JSON.parse(items); } catch(e) { items = []; }
            
            let address = order.shipping_address;
            if (typeof address === 'string') {
                try { address = JSON.parse(address); } 
                catch(e) { address = { line1: order.address_line, city: order.city, county: order.county }; }
            }

            const oblioResult = await sendOblioInvoice({
                orderId: order.id,
                customerName: order.customer_name,
                customerEmail: order.customer_email,
                customerPhone: order.customer_phone,
                address,
                items,
                subtotal: order.subtotal,
                shippingCost: order.shipping_cost,
                discountAmount: order.discount_amount,
                discountCode: order.discount_code,
                totalAmount: order.total_amount
            });

            if (oblioResult.success) {
                await connection.query(
                    'UPDATE orders SET oblio_invoice_id = ?, oblio_invoice_number = ? WHERE id = ?',
                    [oblioResult.invoiceId, oblioResult.invoiceNumber, orderId]
                );
            }
            results.push({ orderId, ...oblioResult });
        }
        res.json({ success: true, results });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    } finally {
        if (connection) connection.release();
    }
});

app.post('/api/admin/generate-awb', verifyAdmin, async (req, res) => {
    const { orderIds, courierService } = req.body;
    let connection;
    const results = [];
    try {
        connection = await pool.getConnection();
        for (const orderId of orderIds) {
            const [orders] = await connection.query('SELECT * FROM orders WHERE id = ?', [orderId]);
            if (orders.length === 0) continue;

            const order = orders[0];
            let address = order.shipping_address;
            if (typeof address === 'string') {
                try { address = JSON.parse(address); } 
                catch(e) { address = { line1: order.address_line, city: order.city, county: order.county }; }
            }

            const awbResult = await generateAWB({
                orderId: order.id,
                customerName: order.customer_name,
                customerPhone: order.customer_phone,
                address,
                totalAmount: order.total_amount,
                shippingMethod: order.shipping_method,
                paymentMethod: order.payment_method
            }, courierService);

            if (awbResult.success) {
                await connection.query(
                    'UPDATE orders SET awb_number = ?, awb_courier = ? WHERE id = ?',
                    [awbResult.awbNumber, courierService, orderId]
                );
            }
            results.push({ orderId, ...awbResult });
        }
        res.json({ success: true, results });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    } finally {
        if (connection) connection.release();
    }
});

app.post('/api/admin/export-orders', verifyAdmin, async (req, res) => {
    const { orderIds, format } = req.body;
    let connection;
    try {
        connection = await pool.getConnection();
        const placeholders = orderIds.map(() => '?').join(',');
        const [orders] = await connection.query(`SELECT * FROM orders WHERE id IN (${placeholders})`, orderIds);

        if (format === 'xml') {
            let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<orders>\n';
            orders.forEach(order => {
                xml += `  <order><id>${order.id}</id><client>${order.customer_name}</client><total>${order.total_amount}</total><date>${order.created_at}</date></order>\n`;
            });
            xml += '</orders>';
            res.setHeader('Content-Type', 'application/xml');
            res.setHeader('Content-Disposition', `attachment; filename="orders.xml"`);
            return res.send(xml);
        }

        if (format === 'excel') {
            let csv = 'ID,Client,Email,Telefon,Total,Status,Metoda Plata,Data\n';
            orders.forEach(order => {
                csv += `${order.id},"${order.customer_name}",${order.customer_email},${order.customer_phone},${order.total_amount},${order.status},${order.payment_method},${order.created_at}\n`;
            });
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="orders.csv"`);
            return res.send(csv);
        }

        res.status(400).json({ error: 'Format invalid' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    } finally {
        if (connection) connection.release();
    }
});

// ==================================================================
//               ZONA ADMIN: RUTA GENERALĂ (/api/admin)
// ==================================================================
app.all('/api/admin', verifyAdmin, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();

        // 1. GET DATA (Orders, Products, Discounts)
        if (req.method === 'GET') {
            const { type, startDate, endDate, status } = req.query;
            
            if (type === 'orders') {
                let query = 'SELECT * FROM orders WHERE 1=1';
                const params = [];
                if (startDate) { query += ' AND created_at >= ?'; params.push(startDate); }
                if (endDate) { query += ' AND created_at <= ?'; params.push(endDate + ' 23:59:59'); }
                if (status) { query += ' AND status = ?'; params.push(status); }
                query += ' ORDER BY created_at DESC';
                
                const [orders] = await connection.query(query, params);
                return res.json(orders);
            }
            
            if (type === 'products') {
                const [products] = await connection.query('SELECT * FROM products ORDER BY id DESC');
                const parsed = products.map(p => ({
                    ...p,
                    colors: typeof p.colors === 'string' ? JSON.parse(p.colors) : (p.colors || []),
                    details: typeof p.details === 'string' ? JSON.parse(p.details) : (p.details || []),
                    gallery: typeof p.gallery === 'string' ? JSON.parse(p.gallery) : (p.gallery || []),
                    price: parseFloat(p.price),
                    original_price: p.original_price ? parseFloat(p.original_price) : null
                }));
                return res.json(parsed);
            }

            if (type === 'discounts') {
                const [discounts] = await connection.query('SELECT * FROM discount_codes ORDER BY created_at DESC');
                return res.json(discounts);
            }
            return res.status(400).json({ error: 'Tip invalid' });
        }
        
        // 2. POST (Adăugare/Editare Produse)
        if (req.method === 'POST') {
             const { id, name, description, price, original_price, stock_quantity, category, imageUrl, gallery, colors, details } = req.body;
             
             const status = (stock_quantity && stock_quantity > 0) ? 'active' : 'out_of_stock';
             const galleryJson = JSON.stringify(gallery || []);
             const colorsJson = JSON.stringify(colors || []);
             const detailsJson = JSON.stringify(details || []);

             if (id) {
                 await connection.query(
                     `UPDATE products SET name=?, description=?, price=?, original_price=?, stock_quantity=?, category=?, imageUrl=?, gallery=?, colors=?, details=?, status=?, updated_at=NOW() WHERE id=?`,
                     [name, description, price, original_price || null, stock_quantity || 0, category, imageUrl, galleryJson, colorsJson, detailsJson, status, id]
                 );
                 return res.json({ success: true, message: 'Produs actualizat' });
             } else {
                 await connection.query(
                     `INSERT INTO products (name, description, price, original_price, stock_quantity, category, imageUrl, gallery, colors, details, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                     [name, description, price, original_price || null, stock_quantity || 0, category, imageUrl, galleryJson, colorsJson, detailsJson, status]
                 );
                 return res.json({ success: true, message: 'Produs creat' });
             }
        }
        
        // 3. DELETE (Ștergere Produse)
        if (req.method === 'DELETE') {
             await connection.query('DELETE FROM products WHERE id = ?', [req.query.id]);
             return res.json({ success: true });
        }

        // 4. PUT (Editare Comandă - NOUA FUNCȚIONALITATE)
        if (req.method === 'PUT') {
            const { orderId, ...updateData } = req.body;
            
            // Lista câmpurilor permise pentru editare
            const allowedFields = ['customer_name', 'customer_email', 'customer_phone', 'status', 'county', 'city', 'address_line'];
            const updates = [];
            const values = [];

            for (const [key, value] of Object.entries(updateData)) {
                if (allowedFields.includes(key)) {
                    updates.push(`${key} = ?`);
                    values.push(value);
                }
            }

            if (updates.length > 0) {
                values.push(orderId);
                await connection.query(`UPDATE orders SET ${updates.join(', ')} WHERE id = ?`, values);
            }

            return res.json({ success: true, message: 'Comandă actualizată' });
        }

        return res.status(405).json({ error: 'Metodă nepermisă' });

    } catch (e) {
        console.error('Admin Error:', e);
        res.status(500).json({ error: e.message });
    } finally {
        if(connection) connection.release();
    }
});

// ==================================================================
//               ZONA PUBLICĂ: MAGAZIN & WEBHOOK
// ==================================================================

// 1. Webhook Stripe
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
        return res.status(400).send('Webhook Error: Missing signature/secret');
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      let connection;
      try {
        connection = await pool.getConnection();
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
        const metadata = session.metadata || {};
        
        // FIX CRITIC TRANSPORT: preluare sigură
        let shippingCost = 0;
        if (metadata.shippingCost) shippingCost = parseFloat(metadata.shippingCost);
        else if (metadata.shipping_cost) shippingCost = parseFloat(metadata.shipping_cost);

        const orderData = {
          stripe_session_id: session.id,
          customer_name: session.customer_details?.name || 'Client',
          customer_email: session.customer_details?.email || '',
          customer_phone: session.customer_details?.phone || '',
          shipping_address: JSON.stringify(session.customer_details?.address || {}),
          items: JSON.stringify(lineItems.data.map(item => ({
              name: item.description, quantity: item.quantity, price: (item.amount_total || 0) / 100
          }))),
          subtotal: parseFloat(metadata.subtotal || 0),
          shipping_method: metadata.shippingMethod || 'courier',
          shipping_cost: shippingCost,
          discount_code: metadata.discountCode || null,
          discount_amount: parseFloat(metadata.discountAmount || 0),
          total_amount: (session.amount_total || 0) / 100,
        };

        const [result] = await connection.query(
          `INSERT INTO orders (stripe_session_id, customer_name, customer_email, customer_phone, shipping_address, items, subtotal, shipping_method, shipping_cost, discount_code, discount_amount, total_amount, payment_method, status, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'card', 'paid', NOW())`,
          [orderData.stripe_session_id, orderData.customer_name, orderData.customer_email, orderData.customer_phone, orderData.shipping_address, orderData.items, orderData.subtotal, orderData.shipping_method, orderData.shipping_cost, orderData.discount_code, orderData.discount_amount, orderData.total_amount]
        );

        if (orderData.discount_code) {
             await connection.query('UPDATE discount_codes SET used_count = used_count + 1 WHERE code = ?', [orderData.discount_code]);
        }

        if (orderData.customer_email) {
            await sendOrderEmails({
                orderId: result.insertId.toString(),
                ...orderData,
                address: session.customer_details?.address,
                items: lineItems.data.map(item => ({ name: item.description || 'Produs', quantity: item.quantity || 1, price: (item.amount_total || 0) / 100 })),
                paymentMethod: 'card',
                paymentStatus: 'paid'
            }).catch(err => console.error(err));
        }
      } catch (error) {
        console.error('Error processing webhook:', error);
      } finally {
        if (connection) connection.release();
      }
    }
    res.json({ received: true });
});

// 2. Produse (Public)
app.get('/api/products', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const [rows] = await connection.query('SELECT * FROM products');
        const products = rows.map(p => ({
            ...p,
            details: typeof p.details === 'string' ? JSON.parse(p.details) : p.details,
            colors: typeof p.colors === 'string' ? JSON.parse(p.colors) : p.colors,
            gallery: typeof p.gallery === 'string' ? JSON.parse(p.gallery) : (p.gallery || []),
            price: parseFloat(p.price),
            original_price: p.original_price ? parseFloat(p.original_price) : null
        }));
        res.json(products);
    } catch (e) { res.status(500).json({ error: e.message }); } finally { if(connection) connection.release(); }
});

app.get('/api/products/:id', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const [rows] = await connection.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Produs inexistent' });
        
        const p = rows[0];
        p.details = typeof p.details === 'string' ? JSON.parse(p.details) : p.details;
        p.colors = typeof p.colors === 'string' ? JSON.parse(p.colors) : p.colors;
        p.gallery = typeof p.gallery === 'string' ? JSON.parse(p.gallery) : (p.gallery || []);
        p.price = parseFloat(p.price);
        
        res.json(p);
    } catch (e) { res.status(500).json({ error: e.message }); } finally { if(connection) connection.release(); }
});

// 3. Discount & Shipping (Public)
app.post('/api/validate-discount', async (req, res) => {
    const { code, subtotal } = req.body;
    if (!code) return res.status(400).json({ error: 'Cod lipsă' });

    let connection;
    try {
        connection = await pool.getConnection();
        const [rows] = await connection.query('SELECT * FROM discount_codes WHERE code = ? AND is_active = TRUE', [code.toUpperCase()]);

        if (rows.length === 0) return res.json({ valid: false, message: 'Cod invalid' });
        const discount = rows[0];

        if (discount.valid_until && new Date(discount.valid_until) < new Date()) return res.json({ valid: false, message: 'Cod expirat' });
        if (discount.max_uses && discount.used_count >= discount.max_uses) return res.json({ valid: false, message: 'Cod utilizat maxim' });
        if (subtotal < discount.min_order_amount) return res.json({ valid: false, message: `Minim ${discount.min_order_amount} RON` });

        let discountAmount = discount.discount_type === 'percentage' ? (subtotal * discount.discount_value) / 100 : discount.discount_value;
        discountAmount = Math.min(discountAmount, subtotal);

        res.json({ valid: true, code: discount.code, discountAmount: parseFloat(discountAmount.toFixed(2)), discountType: discount.discount_type, discountValue: discount.discount_value });
    } catch (e) { res.status(500).json({ error: 'Eroare server' }); } finally { if (connection) connection.release(); }
});

app.post('/api/calculate-shipping', (req, res) => {
    const { method } = req.body;
    const cost = SHIPPING_COSTS[method] || SHIPPING_COSTS.courier;
    res.json({ method, cost: parseFloat(cost.toFixed(2)) });
});

// 4. Comandă Ramburs
app.post('/api/create-order-ramburs', async (req, res) => {
    let connection;
    try {
        const body = req.body;
        // FIX CRITIC TRANSPORT
        let shippingCostVal = 0;
        if (body.shippingCost !== undefined) shippingCostVal = parseFloat(body.shippingCost);
        else if (body.shipping_cost !== undefined) shippingCostVal = parseFloat(body.shipping_cost);

        const { customerName, customerEmail, customerPhone, address, items, subtotal, shippingMethod, discountCode, discountAmount, totalAmount } = body;

        connection = await pool.getConnection();
        const [result] = await connection.query(
            `INSERT INTO orders (customer_name, customer_email, customer_phone, county, city, address_line, items, subtotal, shipping_method, shipping_cost, discount_code, discount_amount, total_amount, payment_method, status, created_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ramburs', 'pending', NOW())`,
            [customerName, customerEmail, customerPhone, address.county, address.city, address.line, JSON.stringify(items), subtotal, shippingMethod, shippingCostVal, discountCode, discountAmount, totalAmount]
        );

        if (discountCode) await connection.query('UPDATE discount_codes SET used_count = used_count + 1 WHERE code = ?', [discountCode]);

        if (customerEmail) {
            await sendOrderEmails({
                orderId: result.insertId.toString(),
                customerName, customerEmail, customerPhone,
                address: { line1: address.line, city: address.city, county: address.county },
                subtotal, shippingCost: shippingCostVal, shippingMethod, discountCode, discountAmount, totalAmount, items,
                paymentMethod: 'ramburs', paymentStatus: 'pending'
            }).catch(err => console.error(err));
        }
        res.json({ success: true, orderId: result.insertId });
    } catch (e) { 
        console.error(e);
        res.status(500).json({ error: 'Eroare comandă' }); 
    } finally { 
        if(connection) connection.release(); 
    }
});

// 5. Stripe Session Checkout
app.post('/api/create-checkout-session', async (req, res) => {
    try {
        const body = req.body;
        // FIX CRITIC TRANSPORT
        let shippingCostVal = 0;
        if (body.shippingCost !== undefined) shippingCostVal = parseFloat(body.shippingCost);
        else if (body.shipping_cost !== undefined) shippingCostVal = parseFloat(body.shipping_cost);

        const { items, discountCode, discountAmount, shippingMethod, subtotal } = body;
        const origin = req.headers.origin || process.env.FRONTEND_URL || 'https://oclar.ro';
        
        const lineItems = items.map(item => ({
            price_data: { currency: 'ron', product_data: { name: item.name, images: item.imageUrl ? [item.imageUrl] : [] }, unit_amount: Math.round(item.price * 100) },
            quantity: item.quantity,
        }));

        if (shippingCostVal > 0) {
            lineItems.push({
                price_data: { currency: 'ron', product_data: { name: `Transport (${shippingMethod})` }, unit_amount: Math.round(shippingCostVal * 100) },
                quantity: 1,
            });
        }

        if (discountAmount > 0) {
            lineItems.push({
                price_data: { currency: 'ron', product_data: { name: `Reducere ${discountCode || ''}` }, unit_amount: -Math.round(discountAmount * 100) },
                quantity: 1,
            });
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            locale: 'ro',
            billing_address_collection: 'required',
            shipping_address_collection: { allowed_countries: ['RO'] },
            phone_number_collection: { enabled: true },
            success_url: `${origin}/#/success`,
            cancel_url: `${origin}/#/`,
            metadata: {
                discountCode: discountCode || '',
                discountAmount: discountAmount || 0,
                shippingMethod: shippingMethod || 'courier',
                shippingCost: shippingCostVal, // IMPORTANT: Transmite costul la webhook
                subtotal: subtotal || 0
            }
        });
        res.json({ url: session.url });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Diagnostic & Health Check
app.get('/api/status', (req, res) => res.json({ status: 'Online', service: 'VPS Node.js' }));

// PORNIRE SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 SERVER OCLAR PORNIRE COMPLETĂ (PORT ${PORT})`);
    console.log(`📦 Shipping Config: EasyBox=${SHIPPING_COSTS.easybox} RON, Courier=${SHIPPING_COSTS.courier} RON`);
});
