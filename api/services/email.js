import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Configurare SMTP Transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Trimite email-uri către client și admin după plasarea comenzii
 */
export async function sendOrderEmails(orderDetails) {
  const {
    orderId,
    customerName,
    customerEmail,
    customerPhone,
    address,
    totalAmount,
    items,
    paymentMethod, // <--- ADAUGAT
    paymentStatus  // <--- ADAUGAT
  } = orderDetails;

  // Verificare env variables
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('⚠️ SMTP credentials not configured. Skipping email sending.');
    return { success: false, message: 'SMTP not configured' };
  }

  // --- LOGICĂ NOUĂ PENTRU MESAJ PLATĂ (Fără a simplifica restul) ---
  let paymentBadgeHtml = '';
  let paymentTextLabel = 'Ramburs';
  
  if (paymentMethod === 'card') {
      paymentTextLabel = 'Card Online (Achitat)';
      paymentBadgeHtml = `
      <div style="background-color: #d4edda; color: #155724; padding: 15px; margin: 15px 0; border: 1px solid #c3e6cb; border-radius: 4px;">
          ✅ <strong>Plată Confirmată!</strong> Comanda a fost achitată cu cardul. Nu mai trebuie să plătești nimic la curier.
      </div>`;
  } else {
      paymentTextLabel = 'Ramburs (Numerar la livrare)';
      paymentBadgeHtml = `
      <div style="background-color: #fff3cd; color: #856404; padding: 15px; margin: 15px 0; border: 1px solid #ffeeba; border-radius: 4px;">
          ⚠️ <strong>Plată Ramburs.</strong> Te rugăm să pregătești suma de <strong>${parseFloat(totalAmount).toFixed(2)} RON</strong> pentru curier.
      </div>`;
  }
  // ---------------------------------------------------------------

  // Formatare produse pentru email (Codul tău original)
  const itemsList = items
    .map(
      (item) =>
        `- ${item.name} x${item.quantity} = ${(item.price * item.quantity).toFixed(2)} RON`
    )
    .join('\n');

  // Formatare adresă (Codul tău original)
  const addressText = address
    ? typeof address === 'string'
      ? address
      : `${address.line1 || address.line || ''}, ${address.city || ''}, ${address.county || ''}`
    : 'Adresă nespecificată';

  try {
    // EMAIL CĂTRE CLIENT
    if (customerEmail) {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: customerEmail,
        subject: `Confirmare Comandă #${orderId} - OCLAR`,
        text: `
Bună ${customerName},

Comanda ta a fost înregistrată cu succes! 🎉

${paymentMethod === 'card' ? '✅ COMANDA ESTE ACHITATĂ CU CARDUL' : '⚠️ PLATA SE VA FACE RAMBURS LA CURIER'}

DETALII COMANDĂ:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ID Comandă: #${orderId}
Data: ${new Date().toLocaleString('ro-RO')}
Metodă Plată: ${paymentTextLabel}

PRODUSE:
${itemsList}

TOTAL: ${parseFloat(totalAmount).toFixed(2)} RON

LIVRARE:
${addressText}

CONTACT:
Telefon: ${customerPhone}
Email: ${customerEmail}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Vei fi contactat în cel mai scurt timp pentru confirmarea comenzii.

Mulțumim pentru încredere! 👓
Echipa OCLAR
        `,
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #000; color: #fff; padding: 20px; text-align: center; }
    .content { background: #f9f9f9; padding: 30px; border: 1px solid #ddd; }
    .order-info { background: #fff; padding: 15px; margin: 20px 0; border-left: 4px solid #000; }
    .products { margin: 20px 0; }
    .product-item { padding: 10px; border-bottom: 1px solid #eee; }
    .total { font-size: 1.5em; font-weight: bold; color: #000; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; color: #999; font-size: 0.9em; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>OCLAR</h1>
      <p>Confirmare Comandă #${orderId}</p>
    </div>
    
    <div class="content">
      <p>Bună <strong>${customerName}</strong>,</p>
      <p>Comanda ta a fost înregistrată cu succes! 🎉</p>
      
      ${paymentBadgeHtml}
      
      <div class="order-info">
        <p><strong>ID Comandă:</strong> #${orderId}</p>
        <p><strong>Data:</strong> ${new Date().toLocaleString('ro-RO')}</p>
        <p><strong>Metodă Plată:</strong> ${paymentTextLabel}</p> </div>
      
      <div class="products">
        <h3>Produse Comandate:</h3>
        ${items
          .map(
            (item) => `
          <div class="product-item">
            <strong>${item.name}</strong><br>
            Cantitate: ${item.quantity} x ${parseFloat(item.price).toFixed(2)} RON = ${(item.price * item.quantity).toFixed(2)} RON
          </div>
        `
          )
          .join('')}
      </div>
      
      <div class="total">
        TOTAL: ${parseFloat(totalAmount).toFixed(2)} RON
      </div>
      
      <div class="order-info">
        <h3>Adresă Livrare:</h3>
        <p>${addressText}</p>
        
        <h3>Contact:</h3>
        <p>Telefon: ${customerPhone}</p>
        <p>Email: ${customerEmail}</p>
      </div>
      
      <p>Vei fi contactat în cel mai scurt timp pentru confirmarea comenzii.</p>
      <p><strong>Mulțumim pentru încredere! 👓</strong></p>
    </div>
    
    <div class="footer">
      <p>Echipa OCLAR<br>
      <a href="https://oclar.ro">oclar.ro</a></p>
    </div>
  </div>
</body>
</html>
        `,
      });
    }

    // EMAIL CĂTRE ADMIN
    const adminEmail = process.env.SMTP_ADMIN_EMAIL;
    if (adminEmail) {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: adminEmail,
        subject: `🔔 Comandă Nouă #${orderId} (${paymentTextLabel}) - OCLAR`, // ADAUGAT IN SUBIECT
        text: `
COMANDĂ NOUĂ!

ID: #${orderId}
Metodă: ${paymentTextLabel}
Data: ${new Date().toLocaleString('ro-RO')}

CLIENT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Nume: ${customerName}
Telefon: ${customerPhone}
Email: ${customerEmail || 'N/A'}

ADRESĂ:
${addressText}

PRODUSE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${itemsList}

TOTAL: ${parseFloat(totalAmount).toFixed(2)} RON

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Procesează comanda pe https://oclar.ro
        `,
        html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .alert { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
    .info-box { background: #f8f9fa; padding: 15px; margin: 10px 0; border: 1px solid #dee2e6; }
  </style>
</head>
<body>
  <div class="container">
    <div class="alert">
      <h2>🔔 Comandă Nouă #${orderId}</h2>
      <p>${new Date().toLocaleString('ro-RO')}</p>
      <p><strong>Metodă Plată: ${paymentTextLabel}</strong></p> </div>
    
    <div class="info-box">
      <h3>CLIENT</h3>
      <p><strong>Nume:</strong> ${customerName}<br>
      <strong>Telefon:</strong> ${customerPhone}<br>
      <strong>Email:</strong> ${customerEmail || 'N/A'}</p>
    </div>
    
    <div class="info-box">
      <h3>ADRESĂ LIVRARE</h3>
      <p>${addressText}</p>
    </div>
    
    <div class="info-box">
      <h3>PRODUSE</h3>
      ${items.map((item) => `<p>${item.name} x${item.quantity} = ${(item.price * item.quantity).toFixed(2)} RON</p>`).join('')}
      <p><strong>TOTAL: ${parseFloat(totalAmount).toFixed(2)} RON</strong></p>
    </div>
    
    <p><a href="https://oclar.ro" style="background: #000; color: #fff; padding: 10px 20px; text-decoration: none; display: inline-block;">Vezi Comandă</a></p>
  </div>
</body>
</html>
        `,
      });
    }

    console.log(`✅ Email-uri trimise cu succes pentru comanda #${orderId}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Eroare la trimiterea email-urilor:', error);
    return { success: false, error: error.message };
  }
}
