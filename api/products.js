import { pool } from './db.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
    
    res.status(200).json(products);
  } catch (error) {
    if (connection) connection.release();
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Database error' });
  }
}