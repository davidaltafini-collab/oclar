import { pool } from './db.js';

export default async function handler(req, res) {
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

  const { id } = req.query;
  
  if (!id) {
    return res.status(400).json({ error: 'Product ID required' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.query('SELECT * FROM products WHERE id = ?', [id]);
    connection.release();
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    const product = rows[0];
    if (typeof product.details === 'string') product.details = JSON.parse(product.details);
    if (typeof product.colors === 'string') product.colors = JSON.parse(product.colors);
    product.price = parseFloat(product.price);
    
    res.status(200).json(product);
  } catch (error) {
    if (connection) connection.release();
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Database error' });
  }
}