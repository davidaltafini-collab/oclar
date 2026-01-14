export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  
  res.status(200).json({ 
    message: "Pong! API-ul funcționează perfect.",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production'
  });
}