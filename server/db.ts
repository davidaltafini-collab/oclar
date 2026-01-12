import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Verificăm dacă variabilele critice există
if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASS || !process.env.DB_NAME) {
  console.error('❌ EROARE CRITICĂ: Lipsesc variabilele de mediu pentru baza de date!');
}

export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 4000,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // --- PARTEA CRITICĂ PENTRU TiDB ---
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true
  }
});

// Funcție de testare a conexiunii (o apelăm la pornire)
export const checkDbConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ CONECTAT LA TiDB CU SUCCES!');
    console.log(`Baza de date: ${process.env.DB_NAME}`);
    connection.release();
  } catch (error: any) {
    console.error('❌ EROARE CONEXIUNE DB:', error.message);
    // Afișăm detalii ca să știm ce să reparăm (fără să arătăm parola)
    console.error(`Încercare conectare la Host: ${process.env.DB_HOST}, User: ${process.env.DB_USER}`);
  }
};
