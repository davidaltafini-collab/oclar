import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Stripe from 'stripe';
import { pool } from './db.js';
import { sendOrderEmails } from './services/email.js';

dotenv.config();

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
});

// --- 1. CONFIGURARE CORS ---
app.use(cors({
  origin: '*', 
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-secret', 'stripe-signature']
}));

// --- 2. WEBHOOK STRIPE ---
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
      console.error('Missing signature or webhook secret');
      return res.status(400).send('Webhook Error: Missing signature/secret');
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Procesare eveniment plată reușită
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      let connection;
      try {
        connection = await pool.getConnection();
        
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
        
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
          total_amount: (session.amount_total || 0) / 100,
        };

        const [result] = await connection.query(
          `INSERT INTO orders 
           (stripe_session_id, customer_name, customer_email, customer_phone, shipping_address, items, total_amount, payment_method, status, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, 'card', 'paid', NOW())`,
          [orderData.stripe_session_id, orderData.customer_name, orderData.customer_email, orderData.customer_phone, orderData.shipping_address, orderData.items, orderData.total_amount]
        );

        // Trimitem Email Confirmare - SPECIFICĂM CARD
        if (orderData.customer_email) {
            const emailDetails = {
                orderId: result.insertId.toString(),
                customerName: orderData.customer_name,
                customerEmail: orderData.customer_email,
                customerPhone: orderData.customer_phone,
                address: session.customer_details?.address,
                totalAmount: orderData.total_amount,
                items: lineItems.data.map(item => ({
                    name: item.description || 'Produs',
                    quantity: item.quantity || 1,
                    price: (item.amount_total || 0) / 100,
                })),
                paymentMethod: 'card',    // <--- MODIFICARE AICI
                paymentStatus: 'paid'     // <--- MODIFICARE AICI
            };
            await sendOrderEmails(emailDetails).catch(err => console.error('Email error:', err));
        }
      } catch (error) {
        console.error('Error processing webhook:', error);
      } finally {
        if (connection) connection.release();
      }
    }
    res.json({ received: true });
});

// --- 3. PARSER JSON ---
app.use(express.json());

// --- 4. RUTE PRODUSE ---
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
        console.error(e);
        res.status(500).json({ error: e.message }); 
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
        res.status(500).json({ error: e.message }); 
    } finally { 
        if(connection) connection.release(); 
    }
});

// --- 5. RUTA COMANDĂ RAMBURS ---
app.post('/api/create-order-ramburs', async (req, res) => {
    let connection;
    try {
        const { customerName, customerEmail, customerPhone, address, items, totalAmount } = req.body;

        if (!customerName || !customerPhone || !address || !items || !totalAmount) {
            return res.status(400).json({ error: 'Lipsesc date obligatorii' });
        }

        connection = await pool.getConnection();
        const itemsJson = JSON.stringify(items);

        const [result] = await connection.query(
            `INSERT INTO orders 
            (customer_name, customer_email, customer_phone, county, city, address_line, items, total_amount, payment_method, status, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ramburs', 'pending', NOW())`,
            [customerName, customerEmail, customerPhone, address.county, address.city, address.line, itemsJson, totalAmount]
        );

        // Trimitere Email - SPECIFICĂM RAMBURS
        if (customerEmail) {
            const emailDetails = {
                orderId: result.insertId.toString(),
                customerName, customerEmail, customerPhone,
                address: { line1: address.line, city: address.city, county: address.county },
                totalAmount, items,
                paymentMethod: 'ramburs', // <--- MODIFICARE AICI
                paymentStatus: 'pending'  // <--- MODIFICARE AICI
            };
            await sendOrderEmails(emailDetails).catch(err => console.error('Email error:', err));
        }
        res.json({ success: true, orderId: result.insertId });
    } catch (e) { 
        console.error(e);
        res.status(500).json({ error: 'Eroare la procesarea comenzii' }); 
    } finally { 
        if(connection) connection.release(); 
    }
});

// --- 6. RUTA STRIPE CHECKOUT ---
app.post('/api/create-checkout-session', async (req, res) => {
    try {
        const { items } = req.body;
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
        });
        
        res.json({ url: session.url });
    } catch (e) { 
        console.error(e);
        res.status(500).json({ error: e.message }); 
    }
});

// --- 7. RUTE ADMIN ---
app.all('/api/admin', async (req, res) => {
    const adminSecret = req.headers['x-admin-secret'];
    if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
        return res.status(401).json({ error: 'Acces Neautorizat' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        
        if (req.method === 'GET') {
            const { type } = req.query;
            
            if (type === 'orders') {
                const [orders] = await connection.query('SELECT * FROM orders ORDER BY created_at DESC');
                return res.json(orders);
            }
            
            if (type === 'products') {
                const [products] = await connection.query('SELECT * FROM products ORDER BY id DESC');
                const parsed = products.map(p => ({
                    ...p,
                    colors: typeof p.colors === 'string' ? JSON.parse(p.colors) : (p.colors || []),
                    details: typeof p.details === 'string' ? JSON.parse(p.details) : (p.details || []),
                    price: parseFloat(p.price),
                    original_price: p.original_price ? parseFloat(p.original_price) : null
                }));
                return res.json(parsed);
            }
        }
        
       if (req.method === 'POST') {
             // Preluăm și gallery și details
             const { id, name, description, price, original_price, stock_quantity, category, imageUrl, gallery, colors, details } = req.body;
             
             const status = (stock_quantity && stock_quantity > 0) ? 'active' : 'out_of_stock';
             const colorsJson = JSON.stringify(colors || []);
             const detailsJson = JSON.stringify(details || []);
             const galleryJson = JSON.stringify(gallery || []); // Serializăm galeria

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

        return res.status(405).json({ error: 'Metodă nepermisă' });

    } catch (e) {
        console.error('Admin Error:', e);
        res.status(500).json({ error: e.message });
    } finally {
        if(connection) connection.release();
    }
});

// --- 8. RUTA DIAGNOSTIC ---
app.get('/api/status', async (req, res) => {
    const status = {
        system: 'Online',
        timestamp: new Date().toISOString(),
        env: {
            db_host: !!process.env.DB_HOST,
            stripe: !!process.env.STRIPE_SECRET_KEY,
            smtp: !!process.env.SMTP_USER
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

// --- 9. PORNIRE SERVER ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 SERVER OCLAR PORNIRE COMPLETĂ (PORT ${PORT})`);
});
