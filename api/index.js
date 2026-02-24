import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Stripe from 'stripe';
import { pool } from './db.js';
import { sendOrderEmails } from './services/email.js';
import { sendOblioInvoice, generateAWB } from './services/oblio.js';
import { createDraftShipment, getShipmentStatus, getAvailableServices } from './services/ecolet.js';
import { createPaymentSession, validatePaymentNotification } from './services/netopia.js';

dotenv.config();

const app = express();

// Verificare variabile de mediu critice
const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_PASS', 'DB_NAME', 'STRIPE_SECRET_KEY'];
const missingEnvVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingEnvVars.length > 0) {
  console.error('❌ CRITICAL: Missing environment variables:', missingEnvVars.join(', '));
  process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
});

const SHIPPING_COSTS = {
  easybox: 15.00,
  courier: 25.00
};

// ==========================================
// 🤖 SISTEM AUTOMATIZARE (ENGINE CORE)
// ==========================================

/**
 * Verifică dacă o setare de automatizare este activată
 */
async function checkAutomation(key) {
    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.query(
            'SELECT setting_value FROM admin_settings WHERE setting_key = ?', 
            [key]
        );
        connection.release();
        // Acceptă atât boolean true cât și string 'true'
        const val = rows.length > 0 ? rows[0].setting_value : 'false';
        return val === 'true' || val === true;
    } catch (e) {
        console.error('⚠️ Automation check failed:', e);
        return false;
    }
}

// Citește TOATE setările dintr-o singură query (mai eficient + mai reliable)
async function getAllAutomationSettings() {
    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.query('SELECT setting_key, setting_value FROM admin_settings');
        connection.release();
        const settings = {};
        rows.forEach(r => { settings[r.setting_key] = r.setting_value === 'true' || r.setting_value === true; });
        return settings;
    } catch (e) {
        console.error('⚠️ getAllAutomationSettings failed:', e);
        return {};
    }
}

/**
 * FUNCȚIE PRINCIPALĂ: Rulează automatizările pentru o comandă
 * Apelată după: Stripe Webhook, Netopia IPN, Ramburs Create
 */
async function runAutomations(orderId, source) {
    console.log(`🤖 [Auto] Verificare automatizări #${orderId} (${source})...`);
    
    // ⭐ Citim TOATE setările dintr-o singură query (fix reliability)
    const settings = await getAllAutomationSettings();
    
    const autoEnabled = settings['automation_enabled'] || false;
    if (!autoEnabled) {
        console.log('🤖 [Auto] Master switch: OPRIT.');
        return;
    }

    const autoOblio = settings['auto_oblio'] !== false;  // Default true dacă nu există
    const autoEcolet = settings['auto_ecolet'] !== false; // Default true dacă nu există

    console.log(`🤖 [Auto] Master=ON | Oblio=${autoOblio} | Ecolet=${autoEcolet}`);

    // 3. Luăm datele comenzii din baza de date
    const connection = await pool.getConnection();
    const [orders] = await connection.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    
    if (orders.length === 0) {
        console.log(`⚠️ [Auto] Comanda #${orderId} nu există în DB.`);
        connection.release();
        return;
    }

    const order = orders[0];
    connection.release();

    // Parsăm JSON-urile din DB
    const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
    const address = typeof order.shipping_address === 'string' ? 
                   JSON.parse(order.shipping_address) : 
                   { 
                       line1: order.address_line, 
                       city: order.city, 
                       county: order.county,
                       postal_code: order.postal_code
                   };

    // --- A. AUTOMATIZARE OBLIO (Facturare) ---
    if (autoOblio && !order.oblio_invoice_id) {
        console.log(`🤖 [Auto] Generare factură Oblio pentru #${orderId}...`);
        
        try {
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
                totalAmount: order.total_amount,
                paymentMethod: order.payment_method
            });
            
            if (oblioResult.success) {
                await pool.query(
                    'UPDATE orders SET oblio_invoice_id = ?, oblio_invoice_number = ? WHERE id = ?', 
                    [oblioResult.invoiceId, oblioResult.invoiceNumber, order.id]
                );
                console.log(`✅ [Auto] Oblio SUCCESS - Factura ${oblioResult.invoiceNumber} generată.`);
            } else {
                console.error(`❌ [Auto] Oblio FAILED:`, oblioResult.error);
            }
        } catch (e) {
            console.error(`❌ [Auto] Oblio ERROR:`, e);
        }
    } else if (autoOblio && order.oblio_invoice_id) {
        console.log(`ℹ️ [Auto] Oblio: Factura deja există pentru #${orderId}.`);
    }

    // --- B. AUTOMATIZARE ECOLET (Curier) ---
    if (autoEcolet && !order.ecolet_shipment_id) {
        console.log(`🤖 [Auto] Creare shipment Ecolet pentru #${orderId}...`);
        
        try {
            const ecoletResult = await createDraftShipment(order);
            
            if (ecoletResult.success) {
                await pool.query(
                    'UPDATE orders SET ecolet_shipment_id = ?, ecolet_status = ? WHERE id = ?', 
                    [ecoletResult.ecolet_shipment_id, ecoletResult.status, order.id]
                );
                console.log(`✅ [Auto] Ecolet SUCCESS - Shipment ${ecoletResult.ecolet_shipment_id} creat.`);
            } else {
                console.error(`❌ [Auto] Ecolet FAILED:`, ecoletResult.message || ecoletResult.error);
            }
        } catch (e) {
            console.error(`❌ [Auto] Ecolet ERROR:`, e);
        }
    } else if (autoEcolet && order.ecolet_shipment_id) {
        console.log(`ℹ️ [Auto] Ecolet: Shipment deja există pentru #${orderId}.`);
    }

    console.log(`🤖 [Auto] Automatizare completă pentru #${orderId}.`);
}

// ==========================================
// MIDDLEWARE & WEBHOOKS
// ==========================================

// WEBHOOK STRIPE (Raw Body - ÎNAINTE DE JSON PARSER!)
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
      console.error('❌ Missing signature or webhook secret');
      return res.status(400).send('Webhook Error: Missing signature/secret');
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      console.log('✅ Webhook signature verified:', event.type);
    } catch (err) {
      console.error('❌ Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      let connection;
      
      try {
        connection = await pool.getConnection();
        
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
        
        const metadata = session.metadata || {};
        const discountCode = metadata.discountCode || null;
        const discountAmount = parseFloat(metadata.discountAmount || 0);
        const shippingMethod = metadata.shippingMethod || 'courier';
        const subtotal = parseFloat(metadata.subtotal || 0);
        
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
              name: item.description,
              quantity: item.quantity,
              price: (item.amount_total || 0) / 100,
          }))),
          subtotal: subtotal,
          shipping_method: shippingMethod,
          shipping_cost: shippingCost,
          discount_code: discountCode,
          discount_amount: discountAmount,
          total_amount: (session.amount_total || 0) / 100,
        };

        // Inserăm comanda cu status 'paid' (Stripe plătit instant)
        const [result] = await connection.query(
          `INSERT INTO orders 
           (stripe_session_id, customer_name, customer_email, customer_phone, shipping_address, items, subtotal, shipping_method, shipping_cost, discount_code, discount_amount, total_amount, payment_method, status, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'card', 'paid', NOW())`,
          [
            orderData.stripe_session_id, orderData.customer_name, orderData.customer_email, 
            orderData.customer_phone, orderData.shipping_address, orderData.items, 
            orderData.subtotal, orderData.shipping_method, orderData.shipping_cost, 
            orderData.discount_code, orderData.discount_amount, orderData.total_amount
          ]
        );

        const newOrderId = result.insertId;

        // Actualizăm stocul codului de reducere
        if (orderData.discount_code) {
             await connection.query(
                 'UPDATE discount_codes SET used_count = used_count + 1 WHERE code = ?',
                 [orderData.discount_code]
             );
        }

        // Trimitem Email Confirmare
        if (orderData.customer_email) {
            const emailDetails = {
                orderId: newOrderId.toString(),
                customerName: orderData.customer_name,
                customerEmail: orderData.customer_email,
                customerPhone: orderData.customer_phone,
                address: session.customer_details?.address,
                subtotal: orderData.subtotal,
                shippingCost: orderData.shipping_cost,
                shippingMethod: orderData.shipping_method,
                discountCode: orderData.discount_code,
                discountAmount: orderData.discount_amount,
                totalAmount: orderData.total_amount,
                items: lineItems.data.map(item => ({
                    name: item.description || 'Produs',
                    quantity: item.quantity || 1,
                    price: (item.amount_total || 0) / 100,
                })),
                paymentMethod: 'card',
                paymentStatus: 'paid'
            };
            sendOrderEmails(emailDetails).catch(err => console.error('❌ Email error:', err));
        }
        
        console.log('✅ Stripe Order created successfully:', newOrderId);

        // 🤖 DECLANȘARE AUTOMATIZARE
        runAutomations(newOrderId, 'stripe_webhook');

      } catch (error) {
        console.error('❌ Error processing webhook:', error);
        return res.status(500).json({ error: 'Internal server error' });
      } finally {
        if (connection) connection.release();
      }
    }
    
    res.json({ received: true });
});

// JSON PARSER (După Webhook - IMPORTANT!)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ==========================================
// RUTE STANDARD
// ==========================================

app.get('/api/health', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        await connection.query('SELECT 1');
        connection.release();
        res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    } catch (error) {
        console.error('❌ Health check failed:', error);
        res.status(503).json({ status: 'unhealthy', error: error.message });
    }
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
    } catch (e) { 
        console.error('❌ Error fetching products:', e);
        res.status(500).json({ error: 'Failed to fetch products' }); 
    } finally { 
        if(connection) connection.release(); 
    }
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
    } catch (e) { 
        console.error('❌ Error fetching product:', e);
        res.status(500).json({ error: 'Failed to fetch product' }); 
    } finally { 
        if(connection) connection.release(); 
    }
});

app.post('/api/validate-discount', async (req, res) => {
    const { code, subtotal } = req.body;
    
    if (!code) {
        return res.status(400).json({ error: 'Cod lipsă' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        const [rows] = await connection.query(
            'SELECT * FROM discount_codes WHERE code = ? AND is_active = TRUE',
            [code.toUpperCase()]
        );

        if (rows.length === 0) {
            return res.json({ valid: false, message: 'Cod invalid sau expirat' });
        }

        const discount = rows[0];

        if (discount.valid_until && new Date(discount.valid_until) < new Date()) {
            return res.json({ valid: false, message: 'Codul a expirat' });
        }

        if (discount.max_uses && discount.used_count >= discount.max_uses) {
            return res.json({ valid: false, message: 'Codul a fost folosit deja' });
        }

        if (subtotal < discount.min_order_amount) {
            return res.json({ 
                valid: false, 
                message: `Comanda minimă pentru acest cod este ${discount.min_order_amount} RON` 
            });
        }

        let discountAmount = 0;
        if (discount.discount_type === 'percentage') {
            discountAmount = (subtotal * discount.discount_value) / 100;
        } else {
            discountAmount = discount.discount_value;
        }

        discountAmount = Math.min(discountAmount, subtotal);

        res.json({
            valid: true,
            code: discount.code,
            discountAmount: parseFloat(discountAmount.toFixed(2)),
            discountType: discount.discount_type,
            discountValue: discount.discount_value
        });

    } catch (e) {
        console.error('❌ Error validating discount:', e);
        res.status(500).json({ error: 'Eroare server' });
    } finally {
        if (connection) connection.release();
    }
});

app.post('/api/calculate-shipping', async (req, res) => {
    try {
        const { method } = req.body;
        const cost = SHIPPING_COSTS[method] || SHIPPING_COSTS.courier;
        res.json({
            method,
            cost: parseFloat(cost.toFixed(2))
        });
    } catch (e) {
        console.error('❌ Error calculating shipping:', e);
        res.status(500).json({ error: 'Failed to calculate shipping' });
    }
});

// ==========================================
// RUTE PLĂȚI & COMENZI
// ==========================================

// 1. RAMBURS (Create Order)
app.post('/api/create-order-ramburs', async (req, res) => {
    let connection;
    try {
        const body = req.body;
        console.log("🔍 DEBUG LOCKER:", {
        lockerId: body.lockerId,
        shippingMethod: body.shippingMethod,
        // Vezi dacă mai vine ceva util
        fullBody: JSON.stringify(body).substring(0, 200) 
         });

        let shippingCostVal = 0;
        if (body.shippingCost !== undefined) shippingCostVal = parseFloat(body.shippingCost);
        else if (body.shipping_cost !== undefined) shippingCostVal = parseFloat(body.shipping_cost);

        const {
            customerName,
            customerEmail,
            customerPhone,
            address,
            items,
            subtotal,
            shippingMethod,
            discountCode,
            discountAmount,
            totalAmount,
            postalCode,
            lockerId,
            lockerName
        } = body;
         const finalAddress = (shippingMethod === 'easybox' && lockerName) ? lockerName : address.line;
        if (!customerName || !customerPhone || !customerEmail ||!address || !items || !totalAmount) {
            return res.status(400).json({ error: 'Lipsesc date obligatorii' });
        }

        connection = await pool.getConnection();
        const itemsJson = JSON.stringify(items);

        const [result] = await connection.query(
            `INSERT INTO orders 
            (customer_name, customer_email, customer_phone, county, city, address_line, postal_code, locker_id, items, subtotal, shipping_method, shipping_cost, discount_code, discount_amount, total_amount, payment_method, status, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ramburs', 'pending', NOW())`,
            [
                customerName,
                customerEmail,
                customerPhone,
                address.county,
                address.city,
                finalAddress,
                postalCode || null,
                (shippingMethod === 'easybox' ? lockerId : null),
                itemsJson,
                subtotal,
                shippingMethod,
                shippingCostVal,
                discountCode,
                discountAmount,
                totalAmount
            ]
        );

        const newOrderId = result.insertId;

        if (discountCode) {
            await connection.query(
                'UPDATE discount_codes SET used_count = used_count + 1 WHERE code = ?',
                [discountCode]
            );
        }

        if (customerEmail) {
            const emailDetails = {
                orderId: newOrderId.toString(),
                customerName,
                customerEmail,
                customerPhone,
                address: { line1: address.line, city: address.city, county: address.county },
                subtotal,
                shippingCost: shippingCostVal,
                shippingMethod,
                discountCode,
                discountAmount,
                totalAmount,
                items,
                paymentMethod: 'ramburs',
                paymentStatus: 'pending'
            };
            sendOrderEmails(emailDetails).catch(err => console.error('❌ Email error:', err));
        }

        console.log('✅ Ramburs order created:', newOrderId);

        // 🤖 DECLANȘARE AUTOMATIZARE
        runAutomations(newOrderId, 'ramburs_create');

        res.json({ success: true, orderId: newOrderId });
    } catch (e) {
        console.error('❌ Error creating ramburs order:', e);
        res.status(500).json({ error: e.message || 'Failed to create order' });
    } finally {
        if (connection) connection.release();
    }
});


// 2. NETOPIA INIT (Creare comandă + Redirect plată)
app.post('/api/create-netopia-session', async (req, res) => {
    // 1. Preluăm datele, inclusiv lockerId și lockerName
    const {
        totalAmount, customerName, customerEmail, customerPhone, address,
        items, subtotal, shippingMethod, discountCode, discountAmount,
        postalCode, lockerId, lockerName
    } = req.body;

    // 2. Construim adresa finală pentru baza de date
    // Dacă e locker, punem numele lockerului. Dacă e curier, punem strada.
    const dbAddressLine = (shippingMethod === 'easybox' && lockerName) ? lockerName : (address ? address.line : '');

    let connection;
    try {
        connection = await pool.getConnection();
        const itemsJson = JSON.stringify(items);

        // 3. Inserăm în DB
        // NU punem ID manual. Lăsăm baza de date să pună ID-ul automat (ex: 155, 156...)
        const [result] = await connection.query(
            `INSERT INTO orders 
            (customer_name, customer_email, customer_phone, county, city, address_line, postal_code, locker_id, items, subtotal, shipping_method, shipping_cost, discount_code, discount_amount, total_amount, payment_method, status, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'card', 'pending', NOW())`,
            [
                customerName,
                customerEmail,
                customerPhone,
                address ? address.county : '',
                address ? address.city : '',
                dbAddressLine, // <--- Aici se salvează Numele Lockerului (ex: Pachetomat Cargus...)
                postalCode || null,
                (shippingMethod === 'easybox' ? lockerId : null), // <--- Aici se salvează ID-ul Lockerului
                itemsJson,
                subtotal,
                shippingMethod,
                (shippingMethod === 'easybox' ? 15 : 25), // Cost transport
                discountCode,
                discountAmount,
                totalAmount
            ]
        );

        // 4. Luăm ID-ul generat de baza de date
        const dbOrderId = result.insertId;

        // Actualizăm stocul codului de reducere (dacă există)
        if (discountCode) {
            await connection.query('UPDATE discount_codes SET used_count = used_count + 1 WHERE code = ?', [discountCode]);
        }

        // 5. Trimitem către Netopia doar ce are nevoie (ID-ul scurt și suma)
        const netopiaPayload = {
            orderId: dbOrderId, // Trimitem 155, nu 1740... (evităm eroarea la Netopia)
            amount: totalAmount,
            email: customerEmail,
            phone: customerPhone
        };

        const sessionResult = await createPaymentSession(netopiaPayload);
        res.json(sessionResult);

    } catch (error) {
        console.error('❌ Eroare Netopia Init:', error.message);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

// 3. NETOPIA CONFIRM (IPN - Webhook confirmare plată)
app.post('/api/netopia/confirm', async (req, res) => {
    try {
        console.log("--------------- NETOPIA IPN (REST) ---------------");

        const paymentInfo = validatePaymentNotification(req.body);

        if (paymentInfo.success) {
            console.log(`✅ PLATĂ CONFIRMATĂ: Comanda #${paymentInfo.orderId}`);

            const connection = await pool.getConnection();

            // Actualizăm statusul comenzii
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

                // Trimitem email confirmare
                if (order.customer_email) {
                    const emailDetails = {
                        orderId: order.id.toString(),
                        customerName: order.customer_name,
                        customerEmail: order.customer_email,
                        customerPhone: order.customer_phone,
                        address: address,
                        subtotal: order.subtotal,
                        shippingCost: order.shipping_cost,
                        shippingMethod: order.shipping_method,
                        discountCode: order.discount_code,
                        discountAmount: order.discount_amount,
                        totalAmount: order.total_amount,
                        items: items,
                        paymentMethod: 'card',
                        paymentStatus: 'paid'
                    };
                    sendOrderEmails(emailDetails).catch(err => console.error('❌ Email error:', err));
                }

                // 🤖 DECLANȘARE AUTOMATIZARE
                runAutomations(order.id, 'netopia_confirm');
            }

            connection.release();
        } else {
            console.log(`⚠️ PLATĂ NE-CONFIRMATĂ: ${paymentInfo.message}`);
        }

        // Răspuns JSON pentru Netopia
        res.json({ error: { code: 0, message: "success" } });

    } catch (error) {
        console.error("Eroare procesare IPN:", error);
        res.status(500).json({ error: { code: 1, message: error.message } });
    }
});

// 4. STRIPE CHECKOUT SESSION
app.post('/api/create-checkout-session', async (req, res) => {
    try {
        const body = req.body;
        
        let shippingCostVal = 0;
        if (body.shippingCost !== undefined) shippingCostVal = parseFloat(body.shippingCost);
        else if (body.shipping_cost !== undefined) shippingCostVal = parseFloat(body.shipping_cost);

        const { items, discountCode, discountAmount, shippingMethod, subtotal } = body;
        
        const origin = req.headers.origin || process.env.FRONTEND_URL || 'https://oclar.ro';
        
        const lineItems = items.map(item => ({
            price_data: {
                currency: 'ron',
                product_data: { 
                    name: item.name, 
                    images: item.imageUrl ? [item.imageUrl] : [] 
                },
                unit_amount: Math.round(item.price * 100),
            },
            quantity: item.quantity,
        }));

        if (shippingCostVal > 0) {
            lineItems.push({
                price_data: {
                    currency: 'ron',
                    product_data: {
                        name: `Transport (${shippingMethod === 'easybox' ? 'Easy Box' : 'Curier la adresă'})`,
                    },
                    unit_amount: Math.round(shippingCostVal * 100),
                },
                quantity: 1,
            });
        }

        if (discountAmount > 0) {
            lineItems.push({
                price_data: {
                    currency: 'ron',
                    product_data: {
                        name: `Reducere${discountCode ? ` (${discountCode})` : ''}`,
                    },
                    unit_amount: -Math.round(discountAmount * 100),
                },
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
                shippingCost: shippingCostVal,
                subtotal: subtotal || 0
            }
        });
        
        console.log('✅ Stripe checkout session created:', session.id);
        res.json({ url: session.url });
    } catch (e) { 
        console.error('❌ Error creating checkout session:', e);
        res.status(500).json({ error: e.message }); 
    }
});

// ==========================================
// RUTE ADMIN - Dashboard NASA 🚀
// ==========================================

// Middleware autentificare admin
function authAdmin(req, res, next) {
    const adminSecret = req.headers['x-admin-secret'];
    if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
        return res.status(401).json({ error: 'Acces Neautorizat' });
    }
    next();
}

// 1. GET SETTINGS (Starea sliderelor)
app.get('/api/admin/settings', authAdmin, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const [rows] = await connection.query('SELECT * FROM admin_settings');
        
        const settings = {};
        rows.forEach(r => {
            // Convertim 'true'/'false' (string) în boolean
            settings[r.setting_key] = r.setting_value === 'true';
        });
        
        res.json(settings);
    } catch (e) {
        console.error('❌ Error fetching settings:', e);
        res.status(500).json({ error: e.message });
    } finally {
        if(connection) connection.release();
    }
});

// 2. UPDATE SETTINGS (Salvare setare)
app.post('/api/admin/settings', authAdmin, async (req, res) => {
    const { key, value } = req.body;
    
    let connection;
    try {
        connection = await pool.getConnection();
        
        // UPSERT: INSERT ... ON DUPLICATE KEY UPDATE
        await connection.query(
            `INSERT INTO admin_settings (setting_key, setting_value) 
             VALUES (?, ?) 
             ON DUPLICATE KEY UPDATE setting_value = ?`,
            [key, String(value), String(value)]
        );
        
        console.log(`✅ Setting updated: ${key} = ${value}`);
        res.json({ success: true });
    } catch (e) {
        console.error('❌ Error updating setting:', e);
        res.status(500).json({ error: e.message });
    } finally {
        if(connection) connection.release();
    }
});

// 3. TOGGLE VISIBILITY (Hide/Unhide - Arhivare)
app.post('/api/admin/toggle-visibility', authAdmin, async (req, res) => {
    const { orderIds, hide } = req.body;
    
    if (!orderIds || orderIds.length === 0) {
        return res.status(400).json({ error: 'No orders selected' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        const placeholders = orderIds.map(() => '?').join(',');
        
        await connection.query(
            `UPDATE orders SET is_hidden = ? WHERE id IN (${placeholders})`,
            [hide ? 1 : 0, ...orderIds]
        );
        
        console.log(`✅ ${orderIds.length} orders ${hide ? 'hidden' : 'unhidden'}`);
        res.json({ success: true });
    } catch (e) {
        console.error('❌ Error toggling visibility:', e);
        res.status(500).json({ error: e.message });
    } finally {
        if(connection) connection.release();
    }
});

// 4. FETCH ADMIN DATA (Cu filtru Hidden)
app.all('/api/admin', authAdmin, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        
        if (req.method === 'GET') {
            const { type, showHidden, startDate, endDate, status } = req.query;
            
            if (type === 'orders') {
                let query = 'SELECT * FROM orders WHERE 1=1';
                const params = [];

                // Filtru vizibilitate
                if (showHidden !== 'true') {
                    query += ' AND (is_hidden = 0 OR is_hidden IS NULL)';
                }

                // Filtre suplimentare
                if (startDate) {
                    query += ' AND created_at >= ?';
                    params.push(startDate);
                }
                if (endDate) {
                    query += ' AND created_at <= ?';
                    params.push(endDate + ' 23:59:59');
                }
                if (status) {
                    query += ' AND status = ?';
                    params.push(status);
                }

                // ⭐ FILTRU NOU: Metodă plată (card / ramburs)
                if (req.query.paymentMethod) {
                    query += ' AND payment_method = ?';
                    params.push(req.query.paymentMethod);
                }

                // ⭐ FILTRU NOU: Metodă livrare (courier / easybox)
                if (req.query.shippingMethod) {
                    query += ' AND shipping_method = ?';
                    params.push(req.query.shippingMethod);
                }

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
        }
        
        if (req.method === 'POST') {
             const { id, name, description, price, original_price, stock_quantity, category, imageUrl, gallery, colors, details } = req.body;
             
             const status = (stock_quantity && stock_quantity > 0) ? 'active' : 'out_of_stock';
             const colorsJson = JSON.stringify(colors || []);
             const detailsJson = JSON.stringify(details || []);
             const galleryJson = JSON.stringify(gallery || []);

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
        
        if (req.method === 'DELETE') {
             await connection.query('DELETE FROM products WHERE id = ?', [req.query.id]);
             return res.json({ success: true });
        }

        if (req.method === 'PUT') {
            const { orderId, ...updateData } = req.body;
            
            const allowedFields = ['customer_name', 'customer_email', 'customer_phone', 'status', 'county', 'city', 'address_line', 'postal_code', 'locker_id'];
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
                await connection.query(
                    `UPDATE orders SET ${updates.join(', ')} WHERE id = ?`,
                    values
                );
            }

            return res.json({ success: true, message: 'Comandă actualizată' });
        }

        return res.status(405).json({ error: 'Metodă nepermisă' });

    } catch (e) {
        console.error('❌ Admin Error:', e);
        res.status(500).json({ error: e.message });
    } finally {
        if(connection) connection.release();
    }
});

// 5. EXPORT CONTABIL (CSV & XML - SPV Style)
app.post('/api/admin/export-orders', authAdmin, async (req, res) => {
    const { orderIds, format } = req.body;
    
    if (!orderIds || orderIds.length === 0) {
        return res.status(400).json({ error: 'Nu există comenzi selectate' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        
        const placeholders = orderIds.map(() => '?').join(',');
        const [orders] = await connection.query(
            `SELECT * FROM orders WHERE id IN (${placeholders})`,
            orderIds
        );

        if (format === 'csv') {
            // FORMAT CONTABIL SPV/SAGA/SMARTBILL
            let csv = 'Data,Nr_Comanda,Client,CUI,Adresa,Total,Baza_Impozabila,TVA,Metoda_Plata,Status\n';
            
            orders.forEach(order => {
                const date = new Date(order.created_at).toISOString().split('T')[0];
                const total = parseFloat(order.total_amount || 0);
                
                // Calcul TVA 19% (Backwards)
                const baza = (total / 1.19).toFixed(2);
                const tva = (total - (total / 1.19)).toFixed(2);
                
                const adresa = `${order.address_line || ''} ${order.city || ''}`.replace(/,/g, ' ').replace(/\n/g, ' ');
                const cui = ''; // Placeholder

                csv += `${date},${order.id},"${order.customer_name}",${cui},"${adresa}",${total.toFixed(2)},${baza},${tva},${order.payment_method},${order.status}\n`;
            });

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="export_contabil_${Date.now()}.csv"`);
            return res.send(csv);
        }

        if (format === 'xml') {
            let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<orders>\n';
            
            orders.forEach(order => {
                xml += `  <order>\n`;
                xml += `    <id>${order.id}</id>\n`;
                xml += `    <customer_name><![CDATA[${order.customer_name}]]></customer_name>\n`;
                xml += `    <customer_email>${order.customer_email}</customer_email>\n`;
                xml += `    <customer_phone>${order.customer_phone}</customer_phone>\n`;
                xml += `    <total_amount>${order.total_amount}</total_amount>\n`;
                xml += `    <status>${order.status}</status>\n`;
                xml += `    <payment_method>${order.payment_method}</payment_method>\n`;
                xml += `    <created_at>${order.created_at}</created_at>\n`;
                xml += `  </order>\n`;
            });
            
            xml += '</orders>';

            res.setHeader('Content-Type', 'application/xml; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="orders_${Date.now()}.xml"`);
            return res.send(xml);
        }

        res.status(400).json({ error: 'Format invalid' });

    } catch (e) {
        console.error('❌ Export error:', e);
        res.status(500).json({ error: e.message });
    } finally {
        if (connection) connection.release();
    }
});

// 6. TRIMITERE MANUALĂ OBLIO
app.post('/api/admin/send-invoices', authAdmin, async (req, res) => {
    const { orderIds } = req.body;
    
    if (!orderIds || orderIds.length === 0) {
        return res.status(400).json({ error: 'Nu există comenzi selectate' });
    }

    let connection;
    const results = [];

    try {
        connection = await pool.getConnection();

        for (const orderId of orderIds) {
            const [orders] = await connection.query('SELECT * FROM orders WHERE id = ?', [orderId]);
            
            if (orders.length === 0) continue;

            const order = orders[0];
            const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
            const address = typeof order.shipping_address === 'string' ? JSON.parse(order.shipping_address) : 
                           { line1: order.address_line, city: order.city, county: order.county };

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

            results.push({
                orderId,
                ...oblioResult
            });
        }

        res.json({ success: true, results });

    } catch (e) {
        console.error('❌ Error sending invoices:', e);
        res.status(500).json({ error: e.message });
    } finally {
        if (connection) connection.release();
    }
});

// 7. TRIMITERE MANUALĂ ECOLET
app.post('/api/admin/ecolet/export', authAdmin, async (req, res) => {
    const { orderIds } = req.body;

    if (!orderIds || orderIds.length === 0) {
        return res.status(400).json({ error: 'Nu există comenzi selectate' });
    }

    let connection;
    const results = [];

    try {
        connection = await pool.getConnection();

        for (const orderId of orderIds) {
            const [orders] = await connection.query('SELECT * FROM orders WHERE id = ?', [orderId]);

            if (orders.length === 0) {
                results.push({
                    orderId,
                    success: false,
                    message: 'Comanda nu există'
                });
                continue;
            }

            const order = orders[0];

            const ecoletResult = await createDraftShipment(order);

            if (ecoletResult.success) {
                await connection.query(
                    'UPDATE orders SET ecolet_shipment_id = ?, ecolet_status = ? WHERE id = ?',
                    [ecoletResult.ecolet_shipment_id, ecoletResult.status, orderId]
                );
            }

            results.push({
                orderId,
                ...ecoletResult
            });
        }

        res.json({ success: true, results });

    } catch (e) {
        console.error('❌ Error exporting to Ecolet:', e);
        res.status(500).json({ error: e.message });
    } finally {
        if (connection) connection.release();
    }
});

// 8. SINCRONIZARE AWB ECOLET
app.post('/api/admin/ecolet/sync', authAdmin, async (req, res) => {
    const { orderIds } = req.body;

    if (!orderIds || orderIds.length === 0) {
        return res.status(400).json({ error: 'Nu există comenzi selectate' });
    }

    let connection;
    const results = [];

    try {
        connection = await pool.getConnection();

        for (const orderId of orderIds) {
            const [orders] = await connection.query(
                'SELECT * FROM orders WHERE id = ? AND ecolet_shipment_id IS NOT NULL',
                [orderId]
            );

            if (orders.length === 0) {
                results.push({
                    orderId,
                    success: false,
                    message: 'Comanda nu are shipment Ecolet'
                });
                continue;
            }

            const order = orders[0];
            const shipmentId = order.ecolet_shipment_id;

            const statusResult = await getShipmentStatus(shipmentId);

            if (statusResult.success && statusResult.awb_number) {
                await connection.query(
                    'UPDATE orders SET awb_number = ?, label_url = ?, ecolet_status = ? WHERE id = ?',
                    [statusResult.awb_number, statusResult.label_url, 'completed', orderId]
                );

                results.push({
                    orderId,
                    success: true,
                    awb_number: statusResult.awb_number,
                    label_url: statusResult.label_url,
                    message: 'AWB sincronizat cu succes'
                });
            } else {
                results.push({
                    orderId,
                    success: false,
                    message: statusResult.message
                });
            }
        }

        res.json({ success: true, results });

    } catch (e) {
        console.error('❌ Error syncing Ecolet AWB:', e);
        res.status(500).json({ error: e.message });
    } finally {
        if (connection) connection.release();
    }
});

// ⭐ DEBUG: Listează serviciile Ecolet disponibile în contul tău
// Apelează GET /api/admin/ecolet/services ca să afli slug-urile corecte
app.get('/api/admin/ecolet/services', authAdmin, async (req, res) => {
    try {
        const result = await getAvailableServices();
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 9. GENERARE AWB MANUAL (Legacy)
app.post('/api/admin/generate-awb', authAdmin, async (req, res) => {
    const { orderIds, courierService } = req.body;
    
    if (!orderIds || orderIds.length === 0) {
        return res.status(400).json({ error: 'Nu există comenzi selectate' });
    }

    let connection;
    const results = [];

    try {
        connection = await pool.getConnection();

        for (const orderId of orderIds) {
            const [orders] = await connection.query('SELECT * FROM orders WHERE id = ?', [orderId]);
            
            if (orders.length === 0) continue;

            const order = orders[0];
            const address = typeof order.shipping_address === 'string' ? JSON.parse(order.shipping_address) : 
                           { line1: order.address_line, city: order.city, county: order.county };

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

            results.push({
                orderId,
                ...awbResult
            });
        }

        res.json({ success: true, results });

    } catch (e) {
        console.error('❌ Error generating AWB:', e);
        res.status(500).json({ error: e.message });
    } finally {
        if (connection) connection.release();
    }
});

// ==========================================
// MANAGEMENT REDUCERI
// ==========================================

app.post('/api/admin/discount-codes', authAdmin, async (req, res) => {
    const { code, discount_type, discount_value, min_order_amount, max_uses, valid_from, valid_until, is_active } = req.body;
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.query(
            `INSERT INTO discount_codes (code, discount_type, discount_value, min_order_amount, max_uses, valid_from, valid_until, is_active, created_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [code, discount_type, discount_value, min_order_amount || 0, max_uses || null, valid_from, valid_until || null, is_active ? 1 : 0]
        );
        res.json({ success: true, message: 'Cod creat cu succes' });
    } catch (error) {
        console.error('❌ Error creating discount code:', error);
        res.status(500).json({ error: 'Eroare la creare cod' });
    } finally {
        if (connection) connection.release();
    }
});

app.put('/api/admin/discount-codes', authAdmin, async (req, res) => {
    const { id, code, discount_type, discount_value, min_order_amount, max_uses, valid_from, valid_until, is_active } = req.body;
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.query(
            `UPDATE discount_codes 
             SET code=?, discount_type=?, discount_value=?, min_order_amount=?, max_uses=?, valid_from=?, valid_until=?, is_active=?
             WHERE id=?`,
            [code, discount_type, discount_value, min_order_amount || 0, max_uses || null, valid_from, valid_until || null, is_active ? 1 : 0, id]
        );
        res.json({ success: true, message: 'Cod actualizat cu succes' });
    } catch (error) {
        console.error('❌ Error updating discount code:', error);
        res.status(500).json({ error: 'Eroare la actualizare cod' });
    } finally {
        if (connection) connection.release();
    }
});

app.delete('/api/admin/discount-codes', authAdmin, async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.query('DELETE FROM discount_codes WHERE id = ?', [req.query.id]);
        res.json({ success: true, message: 'Cod șters cu succes' });
    } catch (error) {
        console.error('❌ Error deleting discount code:', error);
        res.status(500).json({ error: 'Eroare la ștergere cod' });
    } finally {
        if (connection) connection.release();
    }
});

// ==========================================
// RUTA STATUS
// ==========================================

app.get('/api/status', async (req, res) => {
    const status = {
        system: 'Online',
        timestamp: new Date().toISOString(),
        env: {
            db_host: !!process.env.DB_HOST,
            stripe: !!process.env.STRIPE_SECRET_KEY,
            smtp: !!process.env.SMTP_USER,
            oblio: !!process.env.OBLIO_EMAIL
        },
        database: 'Checking...'
    };
    
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.query('SELECT 1');
        status.database = 'Connected ✅';
        res.json(status);
    } catch (e) {
        status.database = `Error: ${e.message} ❌`;
        res.status(500).json(status);
    } finally {
        if(connection) connection.release();
    }
});

// ==========================================
// ERROR HANDLER & SERVER START
// ==========================================

app.use((err, req, res, next) => {
    console.error('❌ Unhandled error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Verificare conexiune DB înainte de pornire
pool.getConnection()
  .then(connection => {
    console.log('✅ Database connection verified');
    connection.release();
    
    app.listen(PORT, HOST, () => {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`🚀 SERVER OCLAR PORNIT`);
        console.log(`📡 Host: ${HOST}:${PORT}`);
        console.log(`📦 Shipping: EasyBox ${SHIPPING_COSTS.easybox} RON | Curier ${SHIPPING_COSTS.courier} RON`);
        console.log(`🤖 Automatizare: ACTIVĂ (verifică setările în Admin)`);
        console.log(`⏰ Started at: ${new Date().toISOString()}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    });
  })
  .catch(err => {
    console.error('❌ CRITICAL: Cannot connect to database on startup');
    console.error(err);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, closing server gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, closing server gracefully...');
    process.exit(0);
});