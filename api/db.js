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
  // IMPORTANT: Pe shared hosting, ține numărul mic (1 sau 2)
  connectionLimit: 1, 
  maxIdle: 1, 
  idleTimeout: 5000, 
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  connectTimeout: 10000,
  // CRITIC pentru cPanel/FreakHosting: Acceptă certificate SSL self-signed
  ssl: {
    rejectUnauthorized: false
  }
});

pool.on('connection', (connection) => {
  console.log('✅ Conectat la baza de date MySQL');
});

pool.on('error', (err) => {
  console.error('❌ Eroare MySQL:', err);
});

// Funcție ajutătoare pentru diagnosticare
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
