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

    // Validare input
    if (!customerName || !customerPhone || !address || !items || !totalAmount) {
      console.error('Missing fields:', { customerName, customerPhone, address, items, totalAmount });
      return res.status(400).json({ 
        error: 'Missing required order fields',
        details: {
          hasName: !!customerName,
          hasPhone: !!customerPhone,
          hasAddress: !!address,
          hasItems: !!items,
          hasTotal: !!totalAmount
        }
      });
    }

    console.log('Attempting database connection...');
    connection = await pool.getConnection();
    console.log('Database connected successfully');
    
    const itemsJson = JSON.stringify(items);

    console.log('Inserting order into database...');
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
    console.log('Order inserted successfully with ID:', orderId);

    // FIX AICI: Adăugat await pentru a aștepta trimiterea email-ului
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
      
      try {
        console.log('⏳ Sending emails...');
        await sendOrderEmails(emailDetails); // Așteptăm să plece mailul
        console.log('✅ Emails processing finished');
      } catch (emailError) {
        console.error('⚠️ Warning: Order created but email failed:', emailError);
      }
    }

    connection.release();
    return res.status(200).json({ success: true, orderId });
  } catch (error) {
    if (connection) connection.release();
    console.error('DETAILED ERROR in create-order-ramburs:', {
      message: error.message,
      code: error.code,
      sqlMessage: error.sqlMessage,
      stack: error.stack
    });
    
    return res.status(500).json({ 
      error: 'Nu am putut salva comanda',
      details: error.message,
      code: error.code
    });
  }
}
