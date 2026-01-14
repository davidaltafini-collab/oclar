import { pool } from './db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment_variables: {
      DB_HOST: process.env.DB_HOST ? '✅ SET' : '❌ MISSING',
      DB_USER: process.env.DB_USER ? '✅ SET' : '❌ MISSING',
      DB_PASS: process.env.DB_PASS ? '✅ SET (hidden)' : '❌ MISSING',
      DB_NAME: process.env.DB_NAME ? '✅ SET' : '❌ MISSING',
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ? '✅ SET' : '❌ MISSING',
      SMTP_HOST: process.env.SMTP_HOST ? '✅ SET' : '❌ MISSING',
    },
    database_connection: 'TESTING...',
    tables_check: {},
  };

  // Test database connection
  let connection;
  try {
    connection = await pool.getConnection();
    diagnostics.database_connection = '✅ CONNECTED';

    // Check if orders table exists
    try {
      const [tables] = await connection.query(
        "SHOW TABLES LIKE 'orders'"
      );
      diagnostics.tables_check.orders = tables.length > 0 ? '✅ EXISTS' : '❌ NOT FOUND';
    } catch (err) {
      diagnostics.tables_check.orders = `❌ ERROR: ${err.message}`;
    }

    // Check if products table exists
    try {
      const [tables] = await connection.query(
        "SHOW TABLES LIKE 'products'"
      );
      diagnostics.tables_check.products = tables.length > 0 ? '✅ EXISTS' : '❌ NOT FOUND';
    } catch (err) {
      diagnostics.tables_check.products = `❌ ERROR: ${err.message}`;
    }

    // Test a simple query
    try {
      const [result] = await connection.query('SELECT 1 + 1 AS result');
      diagnostics.simple_query = result[0].result === 2 ? '✅ WORKING' : '❌ FAILED';
    } catch (err) {
      diagnostics.simple_query = `❌ ERROR: ${err.message}`;
    }

    connection.release();

  } catch (error) {
    if (connection) connection.release();
    diagnostics.database_connection = `❌ FAILED: ${error.message}`;
    diagnostics.error_code = error.code;
    diagnostics.error_details = error.sqlMessage || error.message;
  }

  const allGood = 
    diagnostics.database_connection.includes('✅') &&
    diagnostics.tables_check.orders?.includes('✅') &&
    diagnostics.tables_check.products?.includes('✅');

  res.status(allGood ? 200 : 500).json(diagnostics);
}