import { pool } from './db.js';

export default async function handler(req, res) {
  // 1. Securitate: Verificăm cheia secretă din .env
  const adminSecret = req.headers['x-admin-secret'];
  if (!process.env.ADMIN_SECRET || adminSecret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: Invalid Secret' });
  }

  let connection;
  try {
    connection = await pool.getConnection();

    // --- GET: Citește date (Comenzi sau Produse) ---
    if (req.method === 'GET') {
      const { type } = req.query;

      if (type === 'orders') {
        // Luăm comenzile cele mai noi primele
        const [orders] = await connection.query('SELECT * FROM orders ORDER BY created_at DESC');
        return res.status(200).json(orders);
      } 
      
      if (type === 'products') {
        const [products] = await connection.query('SELECT * FROM products ORDER BY id DESC');
        // Convertim string-urile JSON în obiecte pentru frontend
        const parsedProducts = products.map(p => ({
            ...p,
            colors: typeof p.colors === 'string' ? JSON.parse(p.colors) : (p.colors || []),
            price: parseFloat(p.price),
            original_price: p.original_price ? parseFloat(p.original_price) : null
        }));
        return res.status(200).json(parsedProducts);
      }
    }

    // --- POST: Adaugă sau Editează Produs ---
    if (req.method === 'POST') {
      const { 
        id, name, description, price, original_price, 
        stock_quantity, category, imageUrl, colors 
      } = req.body;

      const colorsJson = JSON.stringify(colors || []);
      
      // Calculăm automat statusul în funcție de stoc
      const status = stock_quantity > 0 ? 'active' : 'out_of_stock';

      if (id) {
        // UPDATE (Folosim coloanele corecte: original_price, stock_quantity)
        await connection.query(
          `UPDATE products 
           SET name=?, description=?, price=?, original_price=?, stock_quantity=?, category=?, imageUrl=?, colors=?, status=?, updated_at=NOW() 
           WHERE id=?`,
          [name, description, price, original_price || null, stock_quantity, category, imageUrl, colorsJson, status, id]
        );
        return res.status(200).json({ success: true, message: 'Produs actualizat' });
      } else {
        // INSERT (Produs Nou)
        const [result] = await connection.query(
          `INSERT INTO products 
           (name, description, price, original_price, stock_quantity, category, imageUrl, colors, status, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [name, description, price, original_price || null, stock_quantity, category, imageUrl, colorsJson, status]
        );
        return res.status(200).json({ success: true, id: result.insertId });
      }
    }

    // --- DELETE: Șterge Produs ---
    if (req.method === 'DELETE') {
      const { id } = req.query;
      await connection.query('DELETE FROM products WHERE id = ?', [id]);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Admin API Error:', error);
    return res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
}