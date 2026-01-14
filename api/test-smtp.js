import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  // Verifică environment variables
  const envCheck = {
    SMTP_HOST: process.env.SMTP_HOST || '❌ MISSING',
    SMTP_PORT: process.env.SMTP_PORT || '❌ MISSING',
    SMTP_USER: process.env.SMTP_USER || '❌ MISSING',
    SMTP_PASS: process.env.SMTP_PASS ? '✅ SET (hidden)' : '❌ MISSING',
    SMTP_FROM: process.env.SMTP_FROM || '❌ MISSING',
    SMTP_ADMIN_EMAIL: process.env.SMTP_ADMIN_EMAIL || '❌ MISSING',
    SMTP_SECURE: process.env.SMTP_SECURE || 'false',
  };

  console.log('🔍 Environment Variables Check:', envCheck);

  // Verifică dacă toate variabilele sunt setate
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return res.status(500).json({
      success: false,
      error: 'SMTP credentials not configured',
      env_check: envCheck,
    });
  }

  try {
    // Creează transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    console.log('📧 Testing SMTP connection...');

    // Test conexiune
    await transporter.verify();
    console.log('✅ SMTP connection successful!');

    // Trimite email de test (doar dacă query param test=true)
    if (req.query.test === 'true') {
      console.log('📨 Sending test email...');
      
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: process.env.SMTP_ADMIN_EMAIL,
        subject: '🧪 Test Email - OCLAR SMTP',
        text: `
Acest email este un test pentru configurația SMTP.

Dacă primești acest email, înseamnă că totul funcționează perfect! ✅

Timestamp: ${new Date().toISOString()}

Configurație:
- Host: ${process.env.SMTP_HOST}
- Port: ${process.env.SMTP_PORT}
- User: ${process.env.SMTP_USER}
- From: ${process.env.SMTP_FROM}
        `,
        html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    .success { background: #d4edda; border: 1px solid #c3e6cb; padding: 20px; border-radius: 5px; }
    .info { background: #f8f9fa; padding: 15px; margin: 20px 0; border-left: 4px solid #007bff; }
  </style>
</head>
<body>
  <div class="success">
    <h2>🎉 Test Email - SMTP Funcționează!</h2>
    <p>Dacă primești acest email, înseamnă că configurația SMTP este corectă!</p>
  </div>
  
  <div class="info">
    <h3>Detalii Configurație:</h3>
    <ul>
      <li><strong>Host:</strong> ${process.env.SMTP_HOST}</li>
      <li><strong>Port:</strong> ${process.env.SMTP_PORT}</li>
      <li><strong>User:</strong> ${process.env.SMTP_USER}</li>
      <li><strong>From:</strong> ${process.env.SMTP_FROM}</li>
      <li><strong>Timestamp:</strong> ${new Date().toLocaleString('ro-RO')}</li>
    </ul>
  </div>
  
  <p><strong>Următorul pas:</strong> Plasează o comandă pe site pentru a testa email-urile de confirmare!</p>
</body>
</html>
        `,
      });

      console.log('✅ Test email sent successfully!');

      return res.status(200).json({
        success: true,
        message: 'SMTP connection successful + Test email sent!',
        test_email_sent_to: process.env.SMTP_ADMIN_EMAIL,
        env_check: envCheck,
      });
    }

    // Doar verificare conexiune (fără trimitere email)
    return res.status(200).json({
      success: true,
      message: 'SMTP connection successful!',
      note: 'Add ?test=true to URL to send a test email',
      env_check: envCheck,
    });

  } catch (error) {
    console.error('❌ SMTP Error:', error);

    return res.status(500).json({
      success: false,
      error: error.message,
      error_code: error.code,
      error_command: error.command,
      env_check: envCheck,
      troubleshooting: {
        'Invalid login (535)': 'App Password incorrect - regenerează în Gmail',
        'Connection timeout': 'Gmail blochează - activează 2-Step Verification',
        'EAUTH': 'Autentificare eșuată - verifică SMTP_USER și SMTP_PASS',
        'ECONNECTION': 'Nu se poate conecta - verifică SMTP_HOST și SMTP_PORT',
      },
    });
  }
}
