import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Create MySQL connection pool optimized for Vercel -> Shared Hosting
export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  waitForConnections: true,
  connectionLimit: 1, 
  maxIdle: 1, 
  idleTimeout: 3000, 
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  
  // MODIFICARE CRITICĂ 1: Timeout mic (3s) ca să prindem eroarea înainte de Vercel Limit
  connectTimeout: 3000, 
  
  // MODIFICARE CRITICĂ 2: Permite conexiunea chiar dacă certificatul serverului e vechi
  ssl: {
    rejectUnauthorized: false
  }
});

pool.on('connection', (connection) => {
  console.log('✅ Conectat la MySQL');
});

pool.on('error', (err) => {
  console.error('❌ Eroare MySQL:', err);
});

export async function checkDbConnection() {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query('SELECT 1');
    connection.release();
    return true;
  } catch (error) {
    if (connection) connection.release();
    console.error('Test conexiune eșuat:', error);
    return false;
  }
}
