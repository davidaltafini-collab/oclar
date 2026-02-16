import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Stripe from 'stripe';
import { pool } from './db.js'; 
import { sendOrderEmails } from './services/email.js';
import { sendOblioInvoice, generateAWB } from './services/oblio.js';
import { createDraftShipment, getShipmentStatus } from './services/ecolet.js';
import { createPaymentSession, validatePaymentNotification } from './services/netopia.js';

dotenv.config();

const app = express();

// --- VERIFICARE MEDIU ---
const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_PASS', 'DB_NAME', 'STRIPE_SECRET_KEY'];
const missingEnvVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingEnvVars.length > 0) {
  console.error('❌ CRITICAL: Missing environment variables:', missingEnvVars.join(', '));
  process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
});

const SHIPPING_COSTS = { easybox: 15.00, courier: 25.00 };

// ==========================================
// 🤖 HELPERE AUTOMATIZARE (CORE ENGINE)
// ==========================================

async function checkAutomation(key) {
    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.query('SELECT setting_value FROM admin_settings WHERE setting_key = ?', [key]);
        connection.release();
        // Returnează true doar dacă string-ul este exact 'true'
        return rows.length > 0 && rows[0].setting_value === 'true';
    } catch (e) {
        console.error('⚠️ Automation check failed:', e);
        return false;
    }
}

async function runAutomations(orderId, type) {
    console.log(`🤖 [Auto] Verific automatizări pentru comanda #${orderId} (${type})...`);
    
    // 1. Verificăm "Master Switch"-ul
    const autoEnabled = await checkAutomation('automation_enabled');
    if (!autoEnabled) {
        console.log('🤖 [Auto] Automatizarea este OPRITĂ global.');
        return;
    }

    const autoOblio = await checkAutomation('auto_oblio');
    const autoEcolet = await checkAutomation('auto_ecolet');

    const connection = await pool.getConnection();
    const [orders] = await connection.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    const order = orders[0];
    connection.release();

    if (!order) return;

    const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
    const address = typeof order.shipping_address === 'string' ? JSON.parse(order.shipping_address) : 
                   { line1: order.address_line, city: order.city, county: order.county };

    // --- EXECUTARE AUTOMATIZĂRI ---

    // A. OBLIO (Doar dacă nu are deja factură)
    if (autoOblio && !order.oblio_invoice_id) {
        console.log(`🤖 [Auto] Generare factură Oblio...`);
        const oblioRes = await sendOblioInvoice({
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
            totalAmount: order.total_amount,
            paymentMethod: order.payment_method
        });
        
        if (oblioRes.success) {
            await pool.query('UPDATE orders SET oblio_invoice_id = ?, oblio_invoice_number = ? WHERE id = ?', 
                [oblioRes.invoiceId, oblioRes.invoiceNumber, order.id]);
            console.log('✅ [Auto] Oblio SUCCESS');
        } else {
            console.error('❌ [Auto] Oblio Failed:', oblioRes.error);
        }
    }

    // B. ECOLET (Doar dacă nu are deja AWB)
    if (autoEcolet && !order.ecolet_shipment_id) {
        console.log(`🤖 [Auto] Generare AWB Ecolet...`);
        const ecoletRes = await createDraftShipment(order);
        if (ecoletRes.success) {
            await pool.query('UPDATE orders SET ecolet_shipment_id = ?, ecolet_status = ? WHERE id = ?', 
                [ecoletRes.ecolet_shipment_id, ecoletRes.status, order.id]);
            console.log('✅ [Auto] Ecolet SUCCESS');
        } else {
             console.error('❌ [Auto] Ecolet Failed:', ecoletRes.error);
        }
    }
}

// ==========================================
// MIDDLEWARE & WEBHOOKS
// ==========================================

// WEBHOOK STRIPE (Raw Body obligatoriu - TREBUIE ÎNAINTE DE JSON PARSER)
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) return res.status(400).send('Missing signature/secret');

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
        
        const orderData = {
          stripe_session_id: session.id,
          customer_name: session.customer_details?.name || 'Client',
          customer_email: session.customer_details?.email || '',
          customer_phone: session.customer_details?.phone || '',
          shipping_address: JSON.stringify(session.customer_details?.address || {}),
          items: JSON.stringify(lineItems.data.map(i => ({ name: i.description, quantity: i.quantity, price: (i.amount_total || 0) / 100 }))),
          subtotal: parseFloat(metadata.subtotal || 0),
          shipping_method: metadata.shippingMethod || 'courier',
          shipping_cost: parseFloat(metadata.shippingCost || 0),
          discount_code: metadata.discountCode || null,
          discount_amount: parseFloat(metadata.discountAmount || 0),
          total_amount: (session.amount_total || 0) / 100,
        };

        const [result] = await connection.query(
          `INSERT INTO orders 
           (stripe_session_id, customer_name, customer_email, customer_phone, shipping_address, items, subtotal, shipping_method, shipping_cost, discount_code, discount_amount, total_amount, payment_method, status, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'card', 'paid', NOW())`,
          [orderData.stripe_session_id, orderData.customer_name, orderData.customer_email, orderData.customer_phone, orderData.shipping_address, orderData.items, orderData.subtotal, orderData.shipping_method, orderData.shipping_cost, orderData.discount_code, orderData.discount_amount, orderData.total_amount]
        );

        if (orderData.discount_code) await connection.query('UPDATE discount_codes SET used_count = used_count + 1 WHERE code = ?', [orderData.discount_code]);

        // Email
        if (orderData.customer_email) {
             const emailDetails = { 
                orderId: result.insertId.toString(), customerName: orderData.customer_name, customerEmail: orderData.customer_email, totalAmount: orderData.total_amount, items: JSON.parse(orderData.items), paymentMethod: 'card', paymentStatus: 'paid', customerPhone: orderData.customer_phone, address: session.customer_details?.address, subtotal: orderData.subtotal, shippingCost: orderData.shipping_cost, shippingMethod: orderData.shipping_method, discountCode: orderData.discount_code, discountAmount: orderData.discount_amount
             };
             sendOrderEmails(emailDetails).catch(err => console.error('Email err', err));
        }

        // 🤖 AUTOMATIZARE STRIPE
        runAutomations(result.insertId, 'stripe_webhook');

      } catch (error) {
        console.error('Error processing webhook:', error);
      } finally {
        if (connection) connection.release();
      }
    }
    res.json({ received: true });
});

// JSON PARSER (După Webhook - IMPORTANT)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// RUTE STANDARD (Health, Produse)
app.get('/api/health', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        await connection.query('SELECT 1');
        connection.release();
        res.json({ status: 'healthy' });
    } catch (e) { res.status(503).json({ error: e.message }); }
});

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
    } catch (e) { res.status(500).json({ error: 'Err' }); } finally { if(connection) connection.release(); }
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
    } catch (e) { res.status(500).json({ error: 'Err' }); } finally { if(connection) connection.release(); }
});

app.post('/api/validate-discount', async (req, res) => {
    const { code, subtotal } = req.body;
    if (!code) return res.status(400).json({ error: 'Cod lipsă' });
    let connection;
    try {
        connection = await pool.getConnection();
        const [rows] = await connection.query('SELECT * FROM discount_codes WHERE code = ? AND is_active = TRUE', [code.toUpperCase()]);
        if (rows.length === 0) return res.json({ valid: false, message: 'Cod invalid' });
        const discount = rows[0];
        let discountAmount = discount.discount_type === 'percentage' ? (subtotal * discount.discount_value) / 100 : discount.discount_value;
        discountAmount = Math.min(discountAmount, subtotal);
        res.json({ valid: true, code: discount.code, discountAmount: parseFloat(discountAmount.toFixed(2)) });
    } catch (e) { res.status(500).json({ error: 'Err' }); } finally { if (connection) connection.release(); }
});

app.post('/api/calculate-shipping', async (req, res) => {
    const { method } = req.body;
    const cost = SHIPPING_COSTS[method] || SHIPPING_COSTS.courier;
    res.json({ method, cost: parseFloat(cost.toFixed(2)) });
});
// ==========================================
// RUTE PLĂȚI & COMENZI (Actualizate cu Automatizare)
// ==========================================

// 1. RAMBURS (Create Order)
app.post('/api/create-order-ramburs', async (req, res) => {
    let connection;
    try {
        const body = req.body;
        // Calcul cost transport safe
        let shippingCostVal = 0;
        if (body.shippingCost !== undefined) shippingCostVal = parseFloat(body.shippingCost);
        else if (body.shipping_cost !== undefined) shippingCostVal = parseFloat(body.shipping_cost);

        const { 
            customerName, customerEmail, customerPhone, address, items, 
            subtotal, shippingMethod, discountCode, discountAmount, 
            totalAmount, postalCode, lockerId 
        } = body;

        // Validare minimală
        if (!customerName || !customerPhone || !address || !items || !totalAmount) {
            return res.status(400).json({ error: 'Lipsesc date obligatorii' });
        }

        connection = await pool.getConnection();
        const itemsJson = JSON.stringify(items);

        // INSERARE ÎN DB (Cu locker_id și postal_code)
        const [result] = await connection.query(
            `INSERT INTO orders 
            (customer_name, customer_email, customer_phone, county, city, address_line, postal_code, locker_id, items, subtotal, shipping_method, shipping_cost, discount_code, discount_amount, total_amount, payment_method, status, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ramburs', 'pending', NOW())`,
            [
                customerName, customerEmail, customerPhone, 
                address.county, address.city, address.line, 
                postalCode || null, 
                (shippingMethod === 'easybox' ? lockerId : null), 
                itemsJson, subtotal, shippingMethod, shippingCostVal, 
                discountCode, discountAmount, totalAmount
            ]
        );

        const newOrderId = result.insertId;

        // Actualizare stoc cod reducere
        if (discountCode) {
            await connection.query('UPDATE discount_codes SET used_count = used_count + 1 WHERE code = ?', [discountCode]);
        }

        // Trimitere Email Confirmare
        if (customerEmail) {
            const emailDetails = { 
                orderId: newOrderId.toString(), customerName, customerEmail, customerPhone, 
                address: { line1: address.line, city: address.city, county: address.county }, 
                subtotal, shippingCost: shippingCostVal, shippingMethod, discountCode, discountAmount, 
                totalAmount, items, paymentMethod: 'ramburs', paymentStatus: 'pending' 
            };
            sendOrderEmails(emailDetails).catch(err => console.error('❌ Email error:', err));
        }

        // 🤖 AUTOMATIZARE RAMBURS (Declanșare imediată)
        // Verificăm setările adminului și chemăm curierul/factura automat
        runAutomations(newOrderId, 'ramburs_create');

        console.log(`✅ Comandă Ramburs #${newOrderId} creată.`);
        res.json({ success: true, orderId: newOrderId });

    } catch (e) {
        console.error('❌ Error creating ramburs order:', e);
        res.status(500).json({ error: e.message || 'Failed to create order' });
    } finally {
        if (connection) connection.release();
    }
});

// 2. NETOPIA INIT (Pasul 1: Salvare DB -> Generare Link)
app.post('/api/create-netopia-session', async (req, res) => {
    let connection;
    try {
        const paymentData = req.body;
        if (!paymentData.amount) return res.status(400).json({ success: false, error: "Lipsă sumă de plată" });

        connection = await pool.getConnection();
        const itemsJson = JSON.stringify(paymentData.items);
        const shippingCostVal = parseFloat(paymentData.shippingCost || 0);

        // Inserăm întâi comanda ca 'pending'
        const [result] = await connection.query(
            `INSERT INTO orders 
            (customer_name, customer_email, customer_phone, county, city, address_line, postal_code, locker_id, items, subtotal, shipping_method, shipping_cost, discount_code, discount_amount, total_amount, payment_method, status, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'card', 'pending', NOW())`,
            [
                paymentData.customerName, paymentData.customerEmail, paymentData.customerPhone, 
                paymentData.address.county, paymentData.address.city, paymentData.address.line, 
                paymentData.postalCode || null, 
                (paymentData.shippingMethod === 'easybox' ? paymentData.lockerId : null), 
                itemsJson, paymentData.subtotal, paymentData.shippingMethod, shippingCostVal, 
                paymentData.discountCode, paymentData.discountAmount, paymentData.totalAmount
            ]
        );

        const newOrderId = result.insertId;
        
        // Cerem link de plată folosind ID-ul REAL din baza de date
        const netopiaPayload = { ...paymentData, orderId: newOrderId.toString() };
        const netopiaResult = await createPaymentSession(netopiaPayload);

        if (paymentData.discountCode) {
            await connection.query('UPDATE discount_codes SET used_count = used_count + 1 WHERE code = ?', [paymentData.discountCode]);
        }

        console.log(`✅ Comandă Card #${newOrderId} inițiată. Redirect către Netopia...`);
        res.json(netopiaResult);

    } catch (error) {
        console.error("Eroare Netopia Init:", error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

// 3. NETOPIA CONFIRM (Webhook-ul care vine de la Netopia)
app.post('/api/netopia/confirm', async (req, res) => {
    try {
        // Validăm notificarea JSON
        const paymentInfo = validatePaymentNotification(req.body);

        if (paymentInfo.success) {
            console.log(`✅ PLATĂ CONFIRMATĂ (IPN): Comanda #${paymentInfo.orderId}`);
            const connection = await pool.getConnection();
            
            // Actualizăm statusul și salvăm ID-ul tranzacției
            // ATENȚIE: Dacă ai scos coloana transaction_id din DB, șterge ", transaction_id = ?" și parametrul aferent
            await connection.query(
                'UPDATE orders SET status = "paid", transaction_id = ? WHERE id = ?', 
                [paymentInfo.transactionId, paymentInfo.orderId]
            );

            // Luăm datele comenzii pentru email
            const [orders] = await connection.query('SELECT * FROM orders WHERE id = ?', [paymentInfo.orderId]);
            
            if (orders.length > 0) {
                const order = orders[0];
                const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
                const address = typeof order.shipping_address === 'string' ? JSON.parse(order.shipping_address) : 
                               { line1: order.address_line, city: order.city, county: order.county };

                if (order.customer_email) {
                    const emailDetails = { 
                        orderId: order.id.toString(), customerName: order.customer_name, 
                        customerEmail: order.customer_email, customerPhone: order.customer_phone, 
                        address, subtotal: order.subtotal, shippingCost: order.shipping_cost, 
                        shippingMethod: order.shipping_method, discountCode: order.discount_code, 
                        discountAmount: order.discount_amount, totalAmount: order.total_amount, 
                        items, paymentMethod: 'card', paymentStatus: 'paid' 
                    };
                    sendOrderEmails(emailDetails).catch(err => console.error('❌ Email error:', err));
                }

                // 🤖 AUTOMATIZARE CARD (Declanșată de confirmarea plății)
                // Aici intră în scenă Oblio și Ecolet automat dacă slider-ul e ON
                runAutomations(order.id, 'card_confirm');
            }
            connection.release();
        } else {
            console.log(`⚠️ NETOPIA: Plată neconfirmată/respinsă pentru #${paymentInfo.orderId}: ${paymentInfo.message}`);
        }

        // Răspuns standard JSON pentru Netopia (Code 0 = Success)
        res.json({ error: { code: 0, message: "success" } });

    } catch (error) {
        console.error("Eroare procesare IPN:", error);
        res.status(500).json({ error: { code: 1, message: error.message } });
    }
});

// 4. STRIPE CREATE SESSION (Pentru clienții internaționali sau alternativă)
app.post('/api/create-checkout-session', async (req, res) => {
    try {
        const body = req.body;
        let shippingCostVal = 0;
        if (body.shippingCost !== undefined) shippingCostVal = parseFloat(body.shippingCost);
        else if (body.shipping_cost !== undefined) shippingCostVal = parseFloat(body.shipping_cost);

        const { items, discountCode, discountAmount, shippingMethod, subtotal } = body;
        
        // Asigurăm URL-uri curate (fără hash # dacă ești pe BrowserRouter)
        const origin = req.headers.origin || process.env.FRONTEND_URL || 'https://oclar.ro';
        
        const lineItems = items.map(item => ({
            price_data: { 
                currency: 'ron', 
                product_data: { name: item.name, images: item.imageUrl ? [item.imageUrl] : [] }, 
                unit_amount: Math.round(item.price * 100) 
            },
            quantity: item.quantity,
        }));

        if (shippingCostVal > 0) {
            lineItems.push({ 
                price_data: { currency: 'ron', product_data: { name: `Transport (${shippingMethod})` }, unit_amount: Math.round(shippingCostVal * 100) }, 
                quantity: 1 
            });
        }
        if (discountAmount > 0) {
            lineItems.push({ 
                price_data: { currency: 'ron', product_data: { name: `Reducere (${discountCode})` }, unit_amount: -Math.round(discountAmount * 100) }, 
                quantity: 1 
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
            success_url: `${origin}/success`, // URL Curat
            cancel_url: `${origin}/`,
            metadata: { 
                discountCode: discountCode || '', discountAmount: discountAmount || 0, 
                shippingMethod: shippingMethod || 'courier', shippingCost: shippingCostVal, subtotal: subtotal || 0 
            }
        });
        
        res.json({ url: session.url });
    } catch (e) {
        console.error('❌ Error creating stripe session:', e);
        res.status(500).json({ error: e.message });
    }
});
// ==========================================
// RUTE ADMIN - NOUL DASHBOARD "NASA" 🚀
// ==========================================

// 1. GET SETTINGS (Starea inițială a sliderelor)
app.get('/api/admin/settings', async (req, res) => {
    const adminSecret = req.headers['x-admin-secret'];
    if (adminSecret !== process.env.ADMIN_SECRET) return res.status(401).json({ error: 'Auth fail' });

    let connection;
    try {
        connection = await pool.getConnection();
        // Luăm setările din DB
        const [rows] = await connection.query('SELECT * FROM admin_settings');
        const settings = {};
        
        // Convertim valorile 'true'/'false' din text în boolean real pentru React
        rows.forEach(r => {
            settings[r.setting_key] = r.setting_value === 'true';
        });
        
        res.json(settings);
    } catch (e) {
        res.status(500).json({ error: e.message });
    } finally {
        if(connection) connection.release();
    }
});

// 2. UPDATE SETTINGS (Când muți un slider)
app.post('/api/admin/settings', async (req, res) => {
    const adminSecret = req.headers['x-admin-secret'];
    if (adminSecret !== process.env.ADMIN_SECRET) return res.status(401).json({ error: 'Auth fail' });
    
    const { key, value } = req.body; 
    let connection;
    try {
        connection = await pool.getConnection();
        // UPSERT: Dacă setarea există o actualizăm, dacă nu o creăm
        await connection.query(
            `INSERT INTO admin_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?`,
            [key, String(value), String(value)]
        );
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    } finally {
        if(connection) connection.release();
    }
});

// 3. TOGGLE VISIBILITY (HIDE/UNHIDE - Arhivare)
app.post('/api/admin/toggle-visibility', async (req, res) => {
    const adminSecret = req.headers['x-admin-secret'];
    if (adminSecret !== process.env.ADMIN_SECRET) return res.status(401).json({ error: 'Auth fail' });

    const { orderIds, hide } = req.body; // hide = true (ascunde) sau false (arată)
    if (!orderIds || orderIds.length === 0) return res.status(400).json({ error: 'No orders selected' });

    let connection;
    try {
        connection = await pool.getConnection();
        const placeholders = orderIds.map(() => '?').join(',');
        
        // Actualizăm coloana is_hidden
        await connection.query(
            `UPDATE orders SET is_hidden = ? WHERE id IN (${placeholders})`,
            [hide ? 1 : 0, ...orderIds]
        );
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    } finally {
        if(connection) connection.release();
    }
});

// 4. FETCH ADMIN DATA (Cu filtru pentru Hidden)
app.get('/api/admin', async (req, res) => {
    const adminSecret = req.headers['x-admin-secret'];
    if (adminSecret !== process.env.ADMIN_SECRET) return res.status(401).json({ error: 'Auth fail' });
    
    const showHidden = req.query.showHidden === 'true';
    const type = req.query.type;

    let connection;
    try {
        connection = await pool.getConnection();

        if (type === 'orders') {
            let query = 'SELECT * FROM orders WHERE 1=1';
            
            // LOGICA DE FILTRARE VIZIBILITATE
            // Dacă butonul "Arată Arhiva" nu e apăsat, excludem comenzile ascunse
            if (!showHidden) {
                query += ' AND (is_hidden = 0 OR is_hidden IS NULL)';
            }
            
            query += ' ORDER BY created_at DESC';
            const [orders] = await connection.query(query);
            res.json(orders);

        } else if (type === 'products') {
            const [products] = await connection.query('SELECT * FROM products ORDER BY id DESC');
            // Parsare JSON-uri pentru frontend
            const parsed = products.map(p => ({
                ...p,
                colors: typeof p.colors === 'string' ? JSON.parse(p.colors) : (p.colors || []),
                details: typeof p.details === 'string' ? JSON.parse(p.details) : (p.details || []),
                gallery: typeof p.gallery === 'string' ? JSON.parse(p.gallery) : (p.gallery || []),
                price: parseFloat(p.price),
                original_price: p.original_price ? parseFloat(p.original_price) : null
            }));
            res.json(parsed);

        } else if (type === 'discounts') {
             const [discounts] = await connection.query('SELECT * FROM discount_codes ORDER BY created_at DESC');
             res.json(discounts);
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    } finally {
        if(connection) connection.release();
    }
});

// 5. EXPORT CONTABIL (CSV & XML)
app.post('/api/admin/export-orders', async (req, res) => {
    const adminSecret = req.headers['x-admin-secret'];
    if (adminSecret !== process.env.ADMIN_SECRET) return res.status(401).json({ error: 'Auth fail' });

    const { orderIds, format } = req.body;
    let connection;
    try {
        connection = await pool.getConnection();
        const placeholders = orderIds.map(() => '?').join(',');
        const [orders] = await connection.query(`SELECT * FROM orders WHERE id IN (${placeholders})`, orderIds);

        if (format === 'csv') {
            // FORMAT CONTABIL (SPV/SAGA/SMARTBILL Friendly)
            let csv = 'Data,Nr_Comanda,Client,CUI,Adresa,Total,Baza_Impozabila,TVA,Metoda_Plata,Status\n';
            
            orders.forEach(order => {
                const date = new Date(order.created_at).toISOString().split('T')[0];
                const total = parseFloat(order.total_amount || 0);
                
                // Calcul TVA 19% (Backwards calculation)
                const baza = (total / 1.19).toFixed(2);
                const tva = (total - (total / 1.19)).toFixed(2);
                
                // Curățăm adresa de virgule ca să nu strice CSV-ul
                const adresa = `${order.address_line || ''} ${order.city || ''}`.replace(/,/g, ' ').replace(/\n/g, ' ');
                const cui = ''; // Placeholder pentru viitor

                csv += `${date},${order.id},"${order.customer_name}",${cui},"${adresa}",${total.toFixed(2)},${baza},${tva},${order.payment_method},${order.status}\n`;
            });

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="export_contabil_${Date.now()}.csv"`);
            return res.send(csv);
        }

        if (format === 'xml') {
            let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<orders>\n';
            orders.forEach(order => {
                xml += `  <order id="${order.id}">\n`;
                xml += `    <date>${new Date(order.created_at).toISOString()}</date>\n`;
                xml += `    <client>${order.customer_name}</client>\n`;
                xml += `    <total>${order.total_amount}</total>\n`;
                xml += `    <status>${order.status}</status>\n`;
                xml += `  </order>\n`;
            });
            xml += '</orders>';
            res.setHeader('Content-Type', 'application/xml');
            res.send(xml);
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    } finally {
        if (connection) connection.release();
    }
});

// 6. TRIMITERE MANUALĂ OBLIO (Buton "Trimite Oblio")
app.post('/api/admin/send-invoices', async (req, res) => {
    const adminSecret = req.headers['x-admin-secret'];
    if (adminSecret !== process.env.ADMIN_SECRET) return res.status(401).json({ error: 'Auth fail' });

    const { orderIds } = req.body;
    let connection;
    const results = [];
    try {
        connection = await pool.getConnection();
        for (const orderId of orderIds) {
            const [orders] = await connection.query('SELECT * FROM orders WHERE id = ?', [orderId]);
            if (!orders.length) continue;
            const order = orders[0];
            const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
            const address = typeof order.shipping_address === 'string' ? JSON.parse(order.shipping_address) : { line1: order.address_line, city: order.city, county: order.county };
            
            const oblioRes = await sendOblioInvoice({
                orderId: order.id, customerName: order.customer_name, customerEmail: order.customer_email, customerPhone: order.customer_phone,
                address, items, subtotal: order.subtotal, shippingCost: order.shipping_cost, discountAmount: order.discount_amount, discountCode: order.discount_code, totalAmount: order.total_amount, paymentMethod: order.payment_method
            });
            
            if (oblioRes.success) {
                await connection.query('UPDATE orders SET oblio_invoice_id = ?, oblio_invoice_number = ? WHERE id = ?', [oblioRes.invoiceId, oblioRes.invoiceNumber, order.id]);
            }
            results.push({ orderId, ...oblioRes });
        }
        res.json({ success: true, results });
    } catch (e) { res.status(500).json({ error: e.message }); } finally { if(connection) connection.release(); }
});

// 7. TRIMITERE MANUALĂ ECOLET (Buton "Trimite Ecolet")
app.post('/api/admin/ecolet/export', async (req, res) => {
    const adminSecret = req.headers['x-admin-secret'];
    if (adminSecret !== process.env.ADMIN_SECRET) return res.status(401).json({ error: 'Auth fail' });

    const { orderIds } = req.body;
    let connection;
    const results = [];
    try {
        connection = await pool.getConnection();
        for (const orderId of orderIds) {
             const [orders] = await connection.query('SELECT * FROM orders WHERE id = ?', [orderId]);
             if (!orders.length) continue;
             
             const ecoletRes = await createDraftShipment(orders[0]);
             if (ecoletRes.success) {
                 await connection.query('UPDATE orders SET ecolet_shipment_id = ?, ecolet_status = ? WHERE id = ?', [ecoletRes.ecolet_shipment_id, ecoletRes.status, orderId]);
             }
             results.push({ orderId, ...ecoletRes });
        }
        res.json({ success: true, results });
    } catch (e) { res.status(500).json({ error: e.message }); } finally { if(connection) connection.release(); }
});

// 8. SINCRONIZARE AWB (Dacă vrei să verifici statusul manual)
app.post('/api/admin/ecolet/sync', async (req, res) => {
    const adminSecret = req.headers['x-admin-secret'];
    if (adminSecret !== process.env.ADMIN_SECRET) return res.status(401).json({ error: 'Auth fail' });
    const { orderIds } = req.body;
    let connection;
    const results = [];
    try {
        connection = await pool.getConnection();
        for (const orderId of orderIds) {
            const [orders] = await connection.query('SELECT * FROM orders WHERE id = ? AND ecolet_shipment_id IS NOT NULL', [orderId]);
            if (orders.length === 0) continue;
            
            const statusResult = await getShipmentStatus(orders[0].ecolet_shipment_id);
            if (statusResult.success && statusResult.awb_number) {
                 await connection.query('UPDATE orders SET awb_number = ?, label_url = ?, ecolet_status = ? WHERE id = ?', [statusResult.awb_number, statusResult.label_url, 'completed', orderId]);
            }
            results.push({ orderId, ...statusResult });
        }
        res.json({ success: true, results });
    } catch (e) { res.status(500).json({ error: e.message }); } finally { if(connection) connection.release(); }
});

// 9. GENERARE AWB MANUAL (Legacy/Specific)
app.post('/api/admin/generate-awb', async (req, res) => {
    const adminSecret = req.headers['x-admin-secret'];
    if (adminSecret !== process.env.ADMIN_SECRET) return res.status(401).json({ error: 'Auth fail' });
    const { orderIds, courierService } = req.body;
    let connection;
    const results = [];
    try {
        connection = await pool.getConnection();
        for (const orderId of orderIds) {
            const [orders] = await connection.query('SELECT * FROM orders WHERE id = ?', [orderId]);
            if (!orders.length) continue;
            const order = orders[0];
            const address = typeof order.shipping_address === 'string' ? JSON.parse(order.shipping_address) : { line1: order.address_line, city: order.city, county: order.county };
            
            const awbResult = await generateAWB({
                orderId: order.id, customerName: order.customer_name, customerPhone: order.customer_phone,
                address, totalAmount: order.total_amount, shippingMethod: order.shipping_method, paymentMethod: order.payment_method
            }, courierService);

            if (awbResult.success) {
                await connection.query('UPDATE orders SET awb_number = ?, awb_courier = ? WHERE id = ?', [awbResult.awbNumber, courierService, orderId]);
            }
            results.push({ orderId, ...awbResult });
        }
        res.json({ success: true, results });
    } catch (e) { res.status(500).json({ error: e.message }); } finally { if(connection) connection.release(); }
});

// ==========================================
// MANAGEMENT PRODUSE & REDUCERI
// ==========================================

// PRODUSE (Update/Create/Delete)
app.post('/api/admin/products', async (req, res) => {
    // ... Logica Create/Update Produs ...
    const { id, name, description, price, original_price, stock_quantity, category, imageUrl, gallery, colors, details } = req.body;
    const status = (stock_quantity && stock_quantity > 0) ? 'active' : 'out_of_stock';
    const colorsJson = JSON.stringify(colors || []);
    const detailsJson = JSON.stringify(details || []);
    const galleryJson = JSON.stringify(gallery || []);
    let connection;
    try {
        connection = await pool.getConnection();
        if (id) {
             await connection.query(`UPDATE products SET name=?, description=?, price=?, original_price=?, stock_quantity=?, category=?, imageUrl=?, gallery=?, colors=?, details=?, status=?, updated_at=NOW() WHERE id=?`, [name, description, price, original_price || null, stock_quantity || 0, category, imageUrl, galleryJson, colorsJson, detailsJson, status, id]);
        } else {
             await connection.query(`INSERT INTO products (name, description, price, original_price, stock_quantity, category, imageUrl, gallery, colors, details, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`, [name, description, price, original_price || null, stock_quantity || 0, category, imageUrl, galleryJson, colorsJson, detailsJson, status]);
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); } finally { if(connection) connection.release(); }
});

app.delete('/api/admin/products', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.query('DELETE FROM products WHERE id = ?', [req.query.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); } finally { if(connection) connection.release(); }
});

// REDUCERI (Create/Update/Delete)
app.post('/api/admin/discount-codes', async (req, res) => {
    const { code, discount_type, discount_value, min_order_amount, max_uses, valid_from, valid_until, is_active } = req.body;
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.query(`INSERT INTO discount_codes (code, discount_type, discount_value, min_order_amount, max_uses, valid_from, valid_until, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`, [code, discount_type, discount_value, min_order_amount || 0, max_uses || null, valid_from, valid_until || null, is_active ? 1 : 0]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); } finally { if(connection) connection.release(); }
});
app.put('/api/admin/discount-codes', async (req, res) => {
    const { id, code, discount_type, discount_value, min_order_amount, max_uses, valid_from, valid_until, is_active } = req.body;
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.query(`UPDATE discount_codes SET code=?, discount_type=?, discount_value=?, min_order_amount=?, max_uses=?, valid_from=?, valid_until=?, is_active=? WHERE id=?`, [code, discount_type, discount_value, min_order_amount || 0, max_uses || null, valid_from, valid_until || null, is_active ? 1 : 0, id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); } finally { if(connection) connection.release(); }
});
app.delete('/api/admin/discount-codes', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.query('DELETE FROM discount_codes WHERE id = ?', [req.query.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); } finally { if(connection) connection.release(); }
});

// ==========================================
// SERVER START
// ==========================================

// Error handling global
app.use((err, req, res, next) => {
    console.error('❌ Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error', message: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Oclar API running on port ${PORT}`));