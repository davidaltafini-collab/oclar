import mysql from 'mysql2/promise';

export default async function handler(req, res) {
  // Setăm headere pentru a vedea logurile în timp real
  res.setHeader('Content-Type', 'application/json');

  const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: 3306,
    connectTimeout: 2000, // 2 secunde timeout HARD
    ssl: { rejectUnauthorized: false }
  };

  try {
    console.log("1. Încercare conectare cu config:", { 
      host: dbConfig.host, 
      user: dbConfig.user, 
      db: dbConfig.database 
    });

    // Forțăm o conexiune simplă, fără pool
    const connection = await mysql.createConnection(dbConfig);
    
    console.log("2. Conexiune realizată!");
    await connection.end();
    
    return res.status(200).json({ status: "SUCCESS", message: "Conexiune REUȘITĂ cu FreakHosting!" });

  } catch (error) {
    console.error("EROARE:", error.code, error.message);
    
    // Interpretarea erorii pentru tine
    let explicatie = "Eroare necunoscută";
    
    if (error.code === 'ETIMEDOUT') {
      explicatie = "FIREWALL BLOCAT! Serverul FreakHosting nu lasă Vercel să intre. Trebuie tichet la suport.";
    } else if (error.code === 'ECONNREFUSED') {
      explicatie = "IP sau Port GREȘIT. Verifică dacă ai pus IP-ul numeric corect.";
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      explicatie = "USER sau PAROLĂ greșite.";
    }

    return res.status(500).json({ 
      status: "ERROR", 
      code: error.code, 
      message: error.message,
      explicatie_romana: explicatie 
    });
  }
}
