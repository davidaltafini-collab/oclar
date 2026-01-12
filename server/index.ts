import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Stripe from 'stripe';
import { pool, checkDbConnection } from './db'; 
import { sendOrderEmails } from './services/email';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia' as any,
});

app.use(cors());

// --- WEBHOOK: Aici se întâmplă magia (Salvare DB + Email) ---
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

    try {
      // 1. Cerem lista detaliată de produse de la Stripe
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
      
      // 2. Pregătim datele pentru Baza de Date
      const orderData = {
        stripe_session_id: session.id,
        customer_name: session.customer_details?.name || 'Client',
        customer_email: session.customer_details?.email || '',
        customer_phone: session.customer_details?.phone || '',
        // Salvăm adresa ca JSON
        shipping_address: JSON.stringify(session.customer_details?.address || {}),
        // Salvăm produsele ca JSON (Nume, Cantitate, Preț)
        items: JSON.stringify(lineItems.data.map(item => ({
          name: item.description,
          quantity: item.quantity,
          price: (item.amount_total || 0) / 100
        }))),
        total_amount: (session.amount_total || 0) / 100
      };

      // 3. SALVĂM ÎN BAZA DE DATE (MySQL / TiDB)
      const [result]: any = await pool.query(
        `INSERT INTO orders 
        (stripe_session_id, customer_name, customer_email, customer_phone, shipping_address, items, total_amount) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          orderData.stripe_session_id,
          orderData.customer_name,
          orderData.customer_email,
          orderData.customer_phone,
          orderData.shipping_address,
          orderData.items,
          orderData.total_amount
        ]
      );

      // Obținem ID-ul comenzii generate de baza de date (ex: 1001)
      const dbOrderId = result.insertId;
      console.log(`Order saved to DB with ID: ${dbOrderId}`);

      // 4. Trimitem Email-urile (folosind ID-ul frumos din baza de date)
      if (orderData.customer_email) {
        // Reconstruim obiectul pentru funcția de email
        const emailDetails = {
          orderId: dbOrderId.toString(), // Trimitem ID-ul simplu (1, 2, 3)
          customerName: orderData.customer_name,
          customerEmail: orderData.customer_email,
          customerPhone: orderData.customer_phone,
          address: session.customer_details?.address as any, // Trimitem obiectul, nu string-ul JSON
          totalAmount: orderData.total_amount,
          items: lineItems.data.map(item => ({
             name: item.description || 'Produs',
             quantity: item.quantity || 1,
             price: (item.amount_total || 0) / 100
          }))
        };
        
        await sendOrderEmails(emailDetails);
      }

    } catch (error) {
      console.error('Error saving order or sending email:', error);
      // Nu dăm eroare la Stripe ca să nu reîncerce plata la infinit, dar vedem eroarea în logs
    }
  }

  res.json({ received: true });
});

app.use(express.json() as any);

// --- Rute Produse (Neschimbate) ---
app.get('/api/products', async (req, res) => {
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

// --- Rute Checkout ---
app.post('/api/create-checkout-session', async (req, res) => {
   try {
    const { items } = req.body; 
    const lineItems = items.map((item: any) => ({
      price_data: {
        currency: 'ron', 
        product_data: {
          name: item.name,
          images: [item.imageUrl],
        },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: item.quantity,
    }));

    // Aici configurăm formularul pe care îl vede clientul pe Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      
      // 1. Cerem ADRESA (Obligatoriu pentru curier)
      billing_address_collection: 'required',
      shipping_address_collection: {
        allowed_countries: ['RO'], // Livrăm doar în România
      },
      
      // 2. Cerem TELEFONUL (Obligatoriu pentru curier)
      phone_number_collection: {
        enabled: true,
      },

      success_url: `${req.headers.origin}/#/success`,
      cancel_url: `${req.headers.origin}/#/`,
    });

    res.json({ url: session.url });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Export pentru Vercel
if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    checkDbConnection();
  });
}

export default app;
