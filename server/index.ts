//
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Stripe from 'stripe';
import { pool, checkDbConnection } from './db'; // Asigură-te că importul e corect
import { sendOrderEmails } from './services/email';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia' as any,
});

app.use(cors());

// --- MODIFICARE 1: Am mutat webhook-ul la /api/webhook ---
// Webhook requires raw body
app.post('/api/webhook', express.raw({ type: 'application/json' }) as any, async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    res.status(400).send('Webhook Error: Missing signature or secret');
    return;
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error(`Webhook signature verification failed.`, err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.customer_details?.email) {
      await sendOrderEmails(
        session.customer_details.email, 
        session.id, 
        (session.amount_total || 0) / 100
      );
    }
  }

  res.json({ received: true });
});

app.use(express.json() as any);

// Rutele tale existente
app.get('/api/products', async (req, res) => {
  // ... codul tău existent pentru produse ...
  // (Păstrează logica de mapare a produselor din discuția anterioară dacă folosești MySQL real)
  try {
    const [rows]: any = await pool.query('SELECT * FROM products');
     const products = rows.map((product: any) => ({
      ...product,
      details: typeof product.details === 'string' ? JSON.parse(product.details) : product.details,
      colors: typeof product.colors === 'string' ? JSON.parse(product.colors) : product.colors,
      price: parseFloat(product.price) 
    }));
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/products/:id', async (req, res) => {
   // ... codul tău existent ...
   try {
    const [rows]: any = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    const product = rows[0];
    if (typeof product.details === 'string') product.details = JSON.parse(product.details);
    if (typeof product.colors === 'string') product.colors = JSON.parse(product.colors);
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/create-checkout-session', async (req, res) => {
  // ... codul tău existent ...
   try {
    const { items } = req.body; 
    const lineItems = items.map((item: any) => ({
      price_data: {
        currency: 'ron', // ATENȚIE: Stripe vrea codul valutei (ron/usd), asigură-te că e corect
        product_data: {
          name: item.name,
          images: [item.imageUrl],
        },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: item.quantity,
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${req.headers.origin}/#/success`,
      cancel_url: `${req.headers.origin}/#/`,
    });

    res.json({ url: session.url });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- MODIFICARE 2: Export pentru Vercel ---
if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    checkDbConnection();
  });
}

export default app;