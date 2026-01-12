import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Stripe from 'stripe';
import serverless from 'serverless-http';
import { pool } from './db.js';
import { sendOrderEmails } from './services/email.js';

dotenv.config();

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
});

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));

// Webhook route - MUST use raw body
app.post(
  '/api/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
      console.error('Missing signature or webhook secret');
      return res.status(400).send('Webhook Error: Missing signature or secret');
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig.toString(), webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      
      let connection;
      try {
        connection = await pool.getConnection();
        
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
        const orderData = {
          stripe_session_id: session.id,
          customer_name: (session.customer_details && session.customer_details.name) || 'Client',
          customer_email: (session.customer_details && session.customer_details.email) || '',
          customer_phone: (session.customer_details && session.customer_details.phone) || '',
          shipping_address: JSON.stringify((session.customer_details && session.customer_details.address) || {}),
          items: JSON.stringify(
            lineItems.data.map((item) => ({
              name: item.description,
              quantity: item.quantity,
              price: (item.amount_total || 0) / 100,
            }))
          ),
          total_amount: (session.amount_total || 0) / 100,
        };

        const [result] = await connection.query(
          `INSERT INTO orders
           (stripe_session_id, customer_name, customer_email, customer_phone,
            shipping_address, items, total_amount, payment_method, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'card', 'paid')`,
          [
            orderData.stripe_session_id,
            orderData.customer_name,
            orderData.customer_email,
            orderData.customer_phone,
            orderData.shipping_address,
            orderData.items,
            orderData.total_amount,
          ]
        );

        const dbOrderId = result.insertId;

        if (orderData.customer_email) {
          const emailDetails = {
            orderId: dbOrderId.toString(),
            customerName: orderData.customer_name,
            customerEmail: orderData.customer_email,
            customerPhone: orderData.customer_phone,
            address: session.customer_details && session.customer_details.address,
            totalAmount: orderData.total_amount,
            items: lineItems.data.map((item) => ({
              name: item.description || 'Produs',
              quantity: item.quantity || 1,
              price: (item.amount_total || 0) / 100,
            })),
          };
          
          // Send emails asynchronously
          sendOrderEmails(emailDetails).catch(err => {
            console.error('Error sending emails:', err);
          });
        }
        
        connection.release();
      } catch (error) {
        if (connection) connection.release();
        console.error('Error processing webhook:', error);
        return res.status(500).json({ error: 'Internal server error' });
      }
    }
    
    res.json({ received: true });
  }
);

// JSON body parser for all other routes
app.use(express.json());

// Create ramburs (cash on delivery) order
app.post('/api/create-order-ramburs', async (req, res) => {
  let connection;
  try {
    const { customerName, customerEmail, customerPhone, address, items, totalAmount } = req.body;

    if (!customerName || !customerPhone || !address || !items || !totalAmount) {
      return res.status(400).json({ error: 'Missing required order fields' });
    }

    connection = await pool.getConnection();
    
    const itemsJson = JSON.stringify(items);

    const [result] = await connection.query(
      `INSERT INTO orders
       (customer_name, customer_email, customer_phone, county, city, address_line,
        items, total_amount, payment_method, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ramburs', 'pending')`,
      [
        customerName,
        customerEmail || '',
        customerPhone,
        address.county,
        address.city,
        address.line,
        itemsJson,
        totalAmount,
      ]
    );

    const orderId = result.insertId;

    if (customerEmail) {
      const emailDetails = {
        orderId: orderId.toString(),
        customerName,
        customerEmail,
        customerPhone,
        address: {
          line1: address.line,
          city: address.city,
          county: address.county,
        },
        totalAmount,
        items,
      };
      
      // Send emails asynchronously
      sendOrderEmails(emailDetails).catch(err => {
        console.error('Error sending emails:', err);
      });
    }

    connection.release();
    return res.json({ success: true, orderId });
  } catch (error) {
    if (connection) connection.release();
    console.error('Error creating ramburs order:', error);
    return res.status(500).json({ error: 'Nu am putut salva comanda.' });
  }
});

// Get all products
app.get('/api/products', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.query('SELECT * FROM products');
    connection.release();
    
    const products = rows.map((product) => ({
      ...product,
      details: typeof product.details === 'string' ? JSON.parse(product.details) : product.details,
      colors: typeof product.colors === 'string' ? JSON.parse(product.colors) : product.colors,
      price: parseFloat(product.price),
    }));
    
    res.json(products);
  } catch (error) {
    if (connection) connection.release();
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get single product
app.get('/api/products/:id', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    connection.release();
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    const product = rows[0];
    if (typeof product.details === 'string') product.details = JSON.parse(product.details);
    if (typeof product.colors === 'string') product.colors = JSON.parse(product.colors);
    
    res.json(product);
  } catch (error) {
    if (connection) connection.release();
    console.error('Error fetching product by id:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Create Stripe checkout session
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { items } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Missing or invalid items array' });
    }

    const lineItems = items.map((item) => ({
      price_data: {
        currency: 'ron',
        product_data: {
          name: item.name,
          images: item.imageUrl ? [item.imageUrl] : [],
        },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: item.quantity,
    }));

    const origin = req.headers.origin || req.headers.referer || process.env.FRONTEND_URL || 'http://localhost:3000';
    const baseUrl = origin.replace(/\/$/, '');

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      billing_address_collection: 'required',
      shipping_address_collection: {
        allowed_countries: ['RO'],
      },
      phone_number_collection: {
        enabled: true,
      },
      success_url: `${baseUrl}/#/success`,
      cancel_url: `${baseUrl}/#/`,
    });
    
    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message || 'Stripe error' });
  }
});

// Health check / status route
app.get('/api/status', async (req, res) => {
  const status = {
    system: 'Online',
    timestamp: new Date().toISOString(),
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      has_DB_HOST: !!process.env.DB_HOST,
      has_DB_USER: !!process.env.DB_USER,
      has_DB_PASS: !!process.env.DB_PASS,
      has_DB_NAME: !!process.env.DB_NAME,
      db_name_value: process.env.DB_NAME,
    },
    database_connection: 'Pending...',
    table_orders_exists: 'Pending...',
  };
  
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query('SELECT 1 + 1');
    status.database_connection = 'SUCCESS: Connected to database';

    const [tables] = await connection.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = ? AND table_name = 'orders'`,
      [process.env.DB_NAME]
    );
    
    status.table_orders_exists = tables.length > 0 ? 'YES' : 'NO - Tabelul lipsește!';

    const [recentOrders] = await connection.query('SELECT id, created_at FROM orders ORDER BY id DESC LIMIT 3');
    status.recent_orders_check = recentOrders;
    
    connection.release();
    res.json(status);
  } catch (error) {
    if (connection) connection.release();
    status.database_connection = 'FAILED';
    status.error_message = error.message;
    status.error_code = error.code;
    res.status(500).json(status);
  }
});

// Catch-all for undefined routes
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Export serverless handler
export default serverless(app);