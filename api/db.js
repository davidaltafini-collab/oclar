import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Create MySQL connection pool optimized for serverless
export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  waitForConnections: true,
  connectionLimit: 5, // Reduced for serverless
  maxIdle: 2, // Maximum idle connections
  idleTimeout: 10000, // 10 seconds
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  connectTimeout: 10000, // 10 seconds
});

// Graceful connection handling
pool.on('connection', (connection) => {
  console.log('New database connection established');
});

pool.on('error', (err) => {
  console.error('Database pool error:', err);
});

export async function checkDbConnection() {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query('SELECT 1');
    console.log('Database connection OK');
    connection.release();
    return true;
  } catch (error) {
    if (connection) connection.release();
    console.error('Database connection failed:', error);
    return false;
  }
}