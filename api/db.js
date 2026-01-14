import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Configurația care ȘTIM că merge (din debug.js)
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: 3306,
  connectTimeout: 10000, // Putem lăsa 10s acum
  ssl: { rejectUnauthorized: false }
};

// TRUCUL: Creăm un obiect care SE COMPORTĂ ca un pool, 
// dar în spate face conexiuni noi (Fresh Connections) de fiecare dată.
// Asta elimină orice eroare de tip "Zombie Connection" sau Timeout.

export const pool = {
  // Metoda 1: Când codul face pool.query()
  query: async (sql, params) => {
    let connection;
    try {
      // 1. Deschide conexiune nouă
      connection = await mysql.createConnection(dbConfig);
      // 2. Execută
      const [results] = await connection.execute(sql, params);
      // 3. Închide IMEDIAT
      await connection.end();
      return [results];
    } catch (error) {
      if (connection) await connection.end();
      console.error("Eroare Query Direct:", error);
      throw error;
    }
  },

  // Metoda 2: Când codul face pool.getConnection()
  getConnection: async () => {
    try {
      const connection = await mysql.createConnection(dbConfig);
      
      // Suprascriem metoda release() ca să închidă conexiunea de tot
      connection.release = () => {
        connection.end().catch(e => console.error("Err closing:", e));
      };
      
      return connection;
    } catch (error) {
      console.error("Eroare GetConnection:", error);
      throw error;
    }
  }
};

// Verificarea de sănătate
export async function checkDbConnection() {
  try {
    const conn = await mysql.createConnection(dbConfig);
    await conn.execute('SELECT 1');
    await conn.end();
    return true;
  } catch (error) {
    console.error('Check failed:', error);
    return false;
  }
}
