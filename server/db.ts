import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Create a connection pool
export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || 'password',
  database: process.env.DB_NAME || 'lumina_db',
  waitForConnections: true,
  connectionLimit: 1, 
  queueLimit: 0
});

// Helper to check connection
export const checkDbConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('Successfully connected to MySQL');
    connection.release();
  } catch (error) {
    console.error('MySQL connection failed:', error);
  }
};