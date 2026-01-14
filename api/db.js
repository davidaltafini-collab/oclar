import mysql from 'mysql2/promise';

// Logging pentru debugging
console.log('DB Config loaded:', {
  host: process.env.DB_HOST ? '✅' : '❌ MISSING',
  user: process.env.DB_USER ? '✅' : '❌ MISSING',
  password: process.env.DB_PASS ? '✅' : '❌ MISSING',
  database: process.env.DB_NAME ? '✅' : '❌ MISSING',
});

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

// Validare configurație
if (!dbConfig.host || !dbConfig.user || !dbConfig.password || !dbConfig.database) {
  console.error('❌ CRITICAL: Missing database configuration!');
  console.error('Please set DB_HOST, DB_USER, DB_PASS, DB_NAME in Vercel Environment Variables');
}

// Creăm un pool care va fi reutilizat între invocări
let poolInstance;

function getPool() {
  if (!poolInstance) {
    console.log('Creating new MySQL pool...');
    poolInstance = mysql.createPool(dbConfig);
    console.log('✅ MySQL pool created');
  }
  return poolInstance;
}

export const pool = {
  getConnection: async () => {
    try {
      const poolObj = getPool();
      const connection = await poolObj.getConnection();
      console.log('✅ Database connection acquired');
      return connection;
    } catch (error) {
      console.error('❌ Failed to get database connection:', {
        code: error.code,
        message: error.message,
        errno: error.errno
      });
      throw error;
    }
  },
  query: async (sql, params) => {
    try {
      const poolObj = getPool();
      const result = await poolObj.query(sql, params);
      console.log('✅ Query executed successfully');
      return result;
    } catch (error) {
      console.error('❌ Query failed:', {
        code: error.code,
        message: error.message,
        sql: sql
      });
      throw error;
    }
  }
};

// Verificarea de sănătate
export async function checkDbConnection() {
  try {
    const connection = await mysql.createConnection(dbConfig);
    await connection.execute('SELECT 1');
    await connection.end();
    console.log('✅ Database health check passed');
    return true;
  } catch (error) {
    console.error('❌ Database health check failed:', error);
    return false;
  }
}