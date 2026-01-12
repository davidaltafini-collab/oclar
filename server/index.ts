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

// --- 1. WEBHOOK STRIPE (Pentru plăți cu cardul) ---
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
          price: (item.amount_total || 0) / 100
        }))),
        total_amount: (session.amount_total || 0) / 100
      };

      // Salvăm comanda CARD
      const [result]: any = await pool.query(
        `INSERT INTO orders 
        (stripe_session_id, customer_name, customer_email, customer_phone, shipping_address, items, total_amount, payment_method, status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, 'card', 'paid')`,
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

      const dbOrderId = result.insertId;
      
      if (orderData.customer_email) {
        const emailDetails = {
          orderId: dbOrderId.toString(),
          customerName: orderData.customer_name,
          customerEmail: orderData.customer_email,
          customerPhone: orderData.customer_phone,
          address: session.customer_details?.address as any,
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
    }
  }

  res.json({ received: true });
});

// Middleware standard pentru JSON (trebuie să fie DUPĂ webhook)
app.use(express.json() as any);

// --- 2. RUTA NOUĂ: COMANDĂ RAMBURS ---
app.post('/api/create-order-ramburs', async (req, res) => {
  try {
    const { customerName, customerEmail, customerPhone, address, items, totalAmount } = req.body;

    // A. Pregătim datele pentru bază
    // Construim obiectul de adresă și items ca JSON string pentru a le salva într-o singură coloană
    // (Sau pe coloane separate dacă ai modificat baza cum am discutat - aici merg pe varianta compatibilă JSON)
    
    // NOTĂ: Am adaptat query-ul pentru structura tabelului cu JSON (items) și coloane separate (county, city, line)
    // Asigură-te că ai tabelul creat cu structura nouă!
    
    const itemsJson = JSON.stringify(items);

    const [result]: any = await pool.query(
      `INSERT INTO orders 
      (customer_name, customer_email, customer_phone, county, city, address_line, items, total_amount, payment_method, status) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ramburs', 'pending')`,
      [
        customerName,
        customerEmail,
        customerPhone,
        address.county,
        address.city,
        address.line, // address.line vine din formularul frontend
        itemsJson,
        totalAmount
      ]
    );

    const orderId = result.insertId;

    // B. Trimitem Email-urile
    const emailDetails = {
      orderId: orderId.toString(),
      customerName,
      customerEmail,
      customerPhone,
      address: {
        line1: address.line,
        city: address.city,
        county: address.county
      },
      totalAmount,
      items: items // Aici trimitem array-ul direct, nu JSON string
    };

    // Trimitem emailul în background (nu așteptăm neapărat să termine ca să răspundem clientului, dar e ok cu await pentru siguranță)
    await sendOrderEmails(emailDetails);

    res.json({ success: true, orderId });

  } catch (error: any) {
    console.error('Eroare comanda ramburs:', error);
    res.status(500).json({ error: 'Nu am putut salva comanda.' });
  }
});

// --- 3. RUTE PRODUSE ---
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

// --- 4. RUTA CHECKOUT CARD (Stripe) ---
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

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      
      // Pentru CARD cerem datele din nou pe Stripe pentru securitate maximă
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
