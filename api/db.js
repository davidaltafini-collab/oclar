import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Configurația care a mers la DEBUG
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: 3306,
  connectTimeout: 10000,
  ssl: { rejectUnauthorized: false }
};

// Variabilă globală pentru a păstra conexiunea "caldă" între request-uri (cât permite Vercel)
let cachedPool = null;

export const pool = {
  getConnection: async () => {
    // Dacă avem deja un pool creat, îl folosim pe ăla
    if (!cachedPool) {
      console.log("Creating new MySQL Pool...");
      cachedPool = mysql.createPool({
        ...dbConfig,
        waitForConnections: true,
        connectionLimit: 1, // Ținem doar 1 conexiune deschisă ca să nu supărăm FreakHosting
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
      });
    }
    return cachedPool.getConnection();
  },
  
  // Metoda standard de query
  query: async (sql, params) => {
    if (!cachedPool) {
      cachedPool = mysql.createPool({
        ...dbConfig,
        waitForConnections: true,
        connectionLimit: 1,
        queueLimit: 0
      });
    }
    return cachedPool.query(sql, params);
  }
};

export async function checkDbConnection() {
  try {
    const connection = await pool.getConnection();
    await connection.query('SELECT 1');
    connection.release();
    return true;
  } catch (error) {
    console.error('Check failed:', error);
    return false;
  }
}
