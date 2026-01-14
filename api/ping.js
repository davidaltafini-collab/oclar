export default function handler(req, res) {
  res.status(200).json({ 
    message: "Pong! Frontend-ul și Backend-ul sunt conectate perfect.",
    time: new Date().toISOString()
  });
}
