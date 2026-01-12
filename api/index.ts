import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Stripe from 'stripe';
import serverless from 'serverless-http';

// Import our own modules with explicit .js extensions.  When compiling this
// TypeScript file to JavaScript, these imports will continue to point to
// the generated .js files. This is required because Vercel treats all
// files in the api/ directory as ESM modules and will fail to resolve
// extensionless imports at runtime.
import { pool } from './db.js';
import { sendOrderEmails } from './services/email.js';

// Load environment variables from .env.  In a Vercel deployment, these
// variables should be configured in the project settings.
dotenv.config();

// Initialise Express and middleware once outside of the handler.  This
// allows Vercel to reuse the same instance across invocations, which
// reduces cold‑start overhead.
const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia' as any,
});

app.use(cors());

// -----------------------------------------------------------------------------
// 1. STRIPE WEBHOOK
//
// Vercel strips the body by default for `express.json()`, so the first
// middleware on this route must read the raw body.  Only this specific
// endpoint uses express.raw(); all other routes use express.json() below.
// -----------------------------------------------------------------------------
app.post(
  '/api/webhook',
  express.raw({ type: 'application/json' }) as any,
  async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
      return res.status(400).send('Webhook Error: Missing signature or secret');
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig.toString(), webhookSecret);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      try {
        // Retrieve line items to store in our database
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
        const orderData = {
          stripe_session_id: session.id,
          customer_name: session.customer_details?.name || 'Client',
          customer_email: session.customer_details?.email || '',
          customer_phone: session.customer_details?.phone || '',
          shipping_address: JSON.stringify(session.customer_details?.address || {}),
          items: JSON.stringify(
            lineItems.data.map((item) => ({
              name: item.description,
              quantity: item.quantity,
              price: (item.amount_total || 0) / 100,
            }))
          ),
          total_amount: (session.amount_total || 0) / 100,
        };

        // Insert order into database.  We set payment_method to 'card' and
        // status to 'paid'.  If your schema differs, adjust the query below.
        const [result]: any = await pool.query(
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

        // Send confirmation emails if we have a customer email
        if (orderData.customer_email) {
          const emailDetails = {
            orderId: dbOrderId.toString(),
            customerName: orderData.customer_name,
            customerEmail: orderData.customer_email,
            customerPhone: orderData.customer_phone,
            address: session.customer_details?.address,
            totalAmount: orderData.total_amount,
            items: lineItems.data.map((item) => ({
              name: item.description || 'Produs',
              quantity: item.quantity || 1,
              price: (item.amount_total || 0) / 100,
            })),
          };
          await sendOrderEmails(emailDetails);
        }
      } catch (error) {
        console.error('Error saving order or sending email:', error);
      }
    }
    res.json({ received: true });
  }
);

// -----------------------------------------------------------------------------
// 2. COMMON JSON BODY PARSER
//
// All routes after the webhook should parse JSON normally.  This must come
// after the webhook route to avoid interfering with Stripe's raw body parser.
// -----------------------------------------------------------------------------
app.use(express.json() as any);

// -----------------------------------------------------------------------------
// 3. RAMBURS (CASH ON DELIVERY) ORDER
//
// Clients send customerName, customerEmail, customerPhone, address (with
// county, city, line), items array, and totalAmount.  We store the order
// in MySQL and send emails to the customer and admin.  Payment method is
// recorded as 'ramburs' and status as 'pending'.
// -----------------------------------------------------------------------------
app.post('/api/create-order-ramburs', async (req: Request, res: Response) => {
  try {
    const { customerName, customerEmail, customerPhone, address, items, totalAmount } = req.body;

    // Validate required fields
    if (!customerName || !customerPhone || !address || !items || !totalAmount) {
      return res.status(400).json({ error: 'Missing required order fields' });
    }

    // JSON encode items for storage in one column
    const itemsJson = JSON.stringify(items);

    const [result]: any = await pool.query(
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

    // Prepare email details
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

    // Send emails (can be awaited or not depending on preference).  We await
    // here to ensure any errors are logged.
    if (customerEmail) {
      await sendOrderEmails(emailDetails);
    }

    return res.json({ success: true, orderId });
  } catch (error: any) {
    console.error('Error creating ramburs order:', error);
    return res.status(500).json({ error: 'Nu am putut salva comanda.' });
  }
});

// -----------------------------------------------------------------------------
// 4. PRODUCTS ROUTES
//
// These endpoints expose your product catalogue.  Ensure that the schema
// matches your database.  The `details` and `colors` columns are expected
// to be JSON strings in the database and will be parsed here before
// returning to the client.
// -----------------------------------------------------------------------------
app.get('/api/products', async (_req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query('SELECT * FROM products');
    const products = rows.map((product: any) => ({
      ...product,
      details: typeof product.details === 'string' ? JSON.parse(product.details) : product.details,
      colors: typeof product.colors === 'string' ? JSON.parse(product.colors) : product.colors,
      price: parseFloat(product.price),
    }));
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/products/:id', async (req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    const product = rows[0];
    if (typeof product.details === 'string') product.details = JSON.parse(product.details);
    if (typeof product.colors === 'string') product.colors = JSON.parse(product.colors);
    res.json(product);
  } catch (error) {
    console.error('Error fetching product by id:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// -----------------------------------------------------------------------------
// 5. CHECKOUT SESSION CREATION
//
// Creates a Stripe Checkout Session for card payments.  The caller must
// provide an array of items with name, imageUrl, price (RON) and quantity.
// The success and cancel URLs are derived from the request origin to allow
// cross-environment deployment (e.g. local dev, preview, production).
// -----------------------------------------------------------------------------
app.post('/api/create-checkout-session', async (req: Request, res: Response) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Missing or invalid items array' });
    }

    const lineItems = items.map((item: any) => ({
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
      success_url: `${req.headers.origin}/#/success`,
      cancel_url: `${req.headers.origin}/#/`,
    });
    res.json({ url: session.url });
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message || 'Stripe error' });
  }
});

// -----------------------------------------------------------------------------
// 6. STATUS ROUTE
//
// Diagnostic route to verify environment configuration, database connection
// and table existence.  Useful for debugging deployments.  In production
// you might want to restrict access to this endpoint.
// -----------------------------------------------------------------------------
app.get('/api/status', async (_req: Request, res: Response) => {
  const status: any = {
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
  try {
    // simple test query
    await pool.query('SELECT 1 + 1');
    status.database_connection = 'SUCCESS: Connected to database';

    // check for orders table
    const [tables]: any = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = ? AND table_name = 'orders'`,
      [process.env.DB_NAME]
    );
    if (tables.length > 0) {
      status.table_orders_exists = 'YES';
    } else {
      status.table_orders_exists = 'NO - Tabelul lipsește!';
    }

    // show last 3 orders for debugging
    const [recentOrders]: any = await pool.query('SELECT id, created_at FROM orders ORDER BY id DESC LIMIT 3');
    status.recent_orders_check = recentOrders;

    res.json(status);
  } catch (error: any) {
    status.database_connection = 'FAILED';
    status.error_message = error.message;
    status.error_code = error.code;
    res.status(500).json(status);
  }
});

// Export a serverless handler.  Vercel will automatically detect this
// default export and wrap it as an edge function.  Do not call app.listen().
export default serverless(app);