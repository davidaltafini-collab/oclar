import { pool } from './db.js';
import { sendOrderEmails } from './services/email.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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

    // Send emails asynchronously (don't wait)
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
      
      sendOrderEmails(emailDetails).catch(err => {
        console.error('Error sending emails:', err);
      });
    }

    connection.release();
    return res.status(200).json({ success: true, orderId });
  } catch (error) {
    if (connection) connection.release();
    console.error('Error creating ramburs order:', error);
    return res.status(500).json({ error: 'Nu am putut salva comanda.' });
  }
}