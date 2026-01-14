import Stripe from 'stripe';
import { pool } from './db.js';
import { sendOrderEmails } from './services/email.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
});

export const config = {
  api: {
    bodyParser: false,
  },
};

async function buffer(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    console.error('Missing signature or webhook secret');
    return res.status(400).send('Webhook Error: Missing signature or secret');
  }

  let event;
  try {
    const rawBody = await buffer(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
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

      // FIX AICI: Adăugat await și try/catch
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
        
        try {
            await sendOrderEmails(emailDetails);
            console.log('✅ Webhook emails sent successfully');
        } catch (err) {
            console.error('❌ Error sending webhook emails:', err);
        }
      }
      
      connection.release();
    } catch (error) {
      if (connection) connection.release();
      console.error('Error processing webhook:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  res.status(200).json({ received: true });
}
