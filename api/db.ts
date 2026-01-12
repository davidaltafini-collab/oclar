import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Verificăm dacă variabilele critice există (doar warning, nu crash)
if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASS || !process.env.DB_NAME) {
  console.error('⚠️ ATENȚIE: Lipsesc variabile de mediu, conexiunea poate eșua.');
}

export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 4000,
  waitForConnections: true,
  connectionLimit: 1, // Pe Vercel e critic să fie 1 (serverless nu ține multe conexiuni)
  queueLimit: 0,
  // --- AICI AM FĂCUT MODIFICAREA CRITICĂ ---
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: false // <--- TREBUIE SĂ FIE FALSE CA SĂ NU CRAPE PE VERCEL
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
  }
};
