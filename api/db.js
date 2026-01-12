import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// Load environment variables.  In a production deployment this is
// configured in Vercel Project Settings.  When running locally you can
// create a .env file at the project root with DB_HOST, DB_USER, DB_PASS,
// DB_NAME and optional DB_PORT.
dotenv.config();

// Create a MySQL connection pool.  Using a pool is important in serverless
// environments to allow connections to be reused across invocations.
export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  waitForConnections: true,
  connectionLimit: 10,
  idleTimeout: 60000,
});

/**
 * Optionally check the database connectivity.  You can call this in a dev
 * environment to see whether the pool can connect.  Do not call this
 * synchronously on cold start in a serverless environment, as it will
 * increase latency unnecessarily.
 */
export async function checkDbConnection() {
  try {
    await pool.query('SELECT 1');
    console.log('Database connection OK');
  } catch (error) {
    console.error('Database connection failed:', error);
  }
}