import { pool } from './db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const status = {
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
  
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query('SELECT 1 + 1');
    status.database_connection = 'SUCCESS: Connected to database';

    const [tables] = await connection.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = ? AND table_name = 'orders'`,
      [process.env.DB_NAME]
    );
    
    status.table_orders_exists = tables.length > 0 ? 'YES' : 'NO - Tabelul lipsește!';

    const [recentOrders] = await connection.query('SELECT id, created_at FROM orders ORDER BY id DESC LIMIT 3');
    status.recent_orders_check = recentOrders;
    
    connection.release();
    res.status(200).json(status);
  } catch (error) {
    if (connection) connection.release();
    status.database_connection = 'FAILED';
    status.error_message = error.message;
    status.error_code = error.code;
    res.status(500).json(status);
  }
}