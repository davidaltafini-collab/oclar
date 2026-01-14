import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Configurația care a funcționat la test (Debug Success)
export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: 3306, // Forțăm portul standard MySQL
  waitForConnections: true,
  connectionLimit: 1, // Păstrăm 1 conexiune pentru stabilitate pe shared hosting
  queueLimit: 0,
  connectTimeout: 10000, // Putem lăsa 10s acum că știm că rețeaua merge
  // CRITIC: Aceasta este setarea care a făcut conexiunea să reușească
  ssl: {
    rejectUnauthorized: false
  }
});

pool.on('connection', (connection) => {
  console.log('✅ Conexiune MySQL Activă (Pool)');
});

pool.on('error', (err) => {
  console.error('❌ Eroare MySQL Pool:', err);
});

// Funcție pentru verificarea sănătății conexiunii
export async function checkDbConnection() {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query('SELECT 1');
    connection.release();
    return true;
  } catch (error) {
    if (connection) connection.release();
    console.error('Verificare conexiune eșuată:', error);
    return false;
  }
}
