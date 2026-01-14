import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Configurația bazei de date (exact ca în debug.js care a mers)
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: 3306,
  connectTimeout: 10000, // Putem lăsa 10s
  ssl: {
    rejectUnauthorized: false
  }
};

// SIMULĂM un Pool, dar facem conexiuni directe (Direct Connection Pattern)
// Asta previne blocarea conexiunilor pe Shared Hosting
export const pool = {
  getConnection: async () => {
    try {
      // 1. Creăm o conexiune nouă fix acum
      const connection = await mysql.createConnection(dbConfig);
      
      // 2. O "trucăm" să aibă metoda .release() pe care o așteaptă api/index.js
      // Când index.js cheamă .release(), noi de fapt închidem conexiunea (.end)
      connection.release = () => {
        connection.end().catch(err => console.error('Eroare la închiderea conexiunii:', err));
      };
      
      return connection;
    } catch (error) {
      console.error("Eroare fatală la conectare (Direct):", error);
      throw error;
    }
  },
  
  // Metoda query direct pe pool (dacă e folosită undeva)
  query: async (sql, params) => {
    const connection = await mysql.createConnection(dbConfig);
    try {
      const [results] = await connection.query(sql, params);
      await connection.end();
      return [results];
    } catch (error) {
      await connection.end();
      throw error;
    }
  }
};

// Funcție de verificare (adaptată pentru noul sistem)
export async function checkDbConnection() {
  try {
    const connection = await pool.getConnection();
    await connection.query('SELECT 1');
    connection.release(); // Asta va face connection.end()
    return true;
  } catch (error) {
    console.error('Test conexiune eșuat:', error);
    return false;
  }
}
