import mysql from 'mysql2/promise';

// Configurație optimizată pentru Vercel serverless
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: 3306,
  connectTimeout: 10000,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  ssl: { rejectUnauthorized: false }
};

// Creăm un pool care va fi reutilizat între invocări
let poolInstance;

function getPool() {
  if (!poolInstance) {
    poolInstance = mysql.createPool(dbConfig);
  }
  return poolInstance;
}

export const pool = {
  getConnection: async () => {
    const poolObj = getPool();
    return await poolObj.getConnection();
  },
  query: async (sql, params) => {
    const poolObj = getPool();
    return await poolObj.query(sql, params);
  }
};

// Verificarea de sănătate
export async function checkDbConnection() {
  try {
    const connection = await mysql.createConnection(dbConfig);
    await connection.execute('SELECT 1');
    await connection.end();
    return true;
  } catch (error) {
    console.error('Check failed:', error);
    return false;
  }
}