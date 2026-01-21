import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Configurare SMTP Transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
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
    subtotal,
    shippingCost,
    shippingMethod,
    discountCode,
    discountAmount,
    totalAmount,
    items,
    paymentMethod,
    paymentStatus
  } = orderDetails;

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('⚠️ SMTP credentials not configured. Skipping email sending.');
    return { success: false, message: 'SMTP not configured' };
  }

  // --- MESAJ PLATĂ ---
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

  // --- INFO SHIPPING ---
  const shippingLabel = shippingMethod === 'easybox' ? 'Easy Box / Locker' : 'Curier la adresă';
  
  // Formatare produse
  const itemsList = items
    .map((item) => `- ${item.name} x${item.quantity} = ${(item.price * item.quantity).toFixed(2)} RON`)
    .join('\n');

  // Formatare adresă
  const addressText = address
    ? typeof address === 'string'
      ? address
      : `${address.line1 || address.line || ''}, ${address.city || ''}, ${address.county || ''}`
    : 'Adresă nespecificată';

  // --- CALCUL AFIȘAJ PREȚURI ---
  const subtotalValue = parseFloat(subtotal || 0);
  const shippingValue = parseFloat(shippingCost || 0);
  const discountValue = parseFloat(discountAmount || 0);
  const totalBeforeDiscount = subtotalValue + shippingValue;

  try {
    // ==================== EMAIL CĂTRE CLIENT ====================
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

Subtotal Produse: ${subtotalValue.toFixed(2)} RON
Transport (${shippingLabel}): ${shippingValue.toFixed(2)} RON
${discountValue > 0 ? `Reducere${discountCode ? ` (${discountCode})` : ''}: -${discountValue.toFixed(2)} RON\n` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL DE PLATĂ: ${parseFloat(totalAmount).toFixed(2)} RON

LIVRARE:
Metodă: ${shippingLabel}
Adresă: ${addressText}

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
    .price-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
    .price-label { font-weight: normal; color: #666; }
    .price-value { font-weight: bold; }
    .discount-row { color: #16a34a; }
    .total-row { font-size: 1.3em; font-weight: bold; background: #fef3c7; padding: 15px; margin-top: 10px; border-radius: 8px; }
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
        <p><strong>Metodă Plată:</strong> ${paymentTextLabel}</p>
      </div>
      
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
      
      <div style="margin: 20px 0; padding: 15px; background: #fff; border: 1px solid #ddd; border-radius: 8px;">
        <div class="price-row">
          <span class="price-label">Subtotal Produse:</span>
          <span class="price-value">${subtotalValue.toFixed(2)} RON</span>
        </div>
        <div class="price-row">
          <span class="price-label">Transport (${shippingLabel}):</span>
          <span class="price-value">${shippingValue.toFixed(2)} RON</span>
        </div>
        ${discountValue > 0 ? `
        <div class="price-row discount-row">
          <span class="price-label">Reducere${discountCode ? ` (${discountCode})` : ''}:</span>
          <span class="price-value">-${discountValue.toFixed(2)} RON</span>
        </div>
        ` : ''}
        <div class="total-row">
          <div style="display: flex; justify-content: space-between;">
            <span>TOTAL DE PLATĂ:</span>
            <span>${parseFloat(totalAmount).toFixed(2)} RON</span>
          </div>
          ${discountValue > 0 ? `
          <div style="font-size: 0.7em; color: #16a34a; margin-top: 5px; font-weight: normal;">
            Ai economisit ${discountValue.toFixed(2)} RON!
          </div>
          ` : ''}
        </div>
      </div>
      
      <div class="order-info">
        <h3>Livrare:</h3>
        <p><strong>Metodă:</strong> ${shippingLabel}</p>
        <p><strong>Adresă:</strong> ${addressText}</p>
        
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

    // ==================== EMAIL CĂTRE ADMIN ====================
    const adminEmail = process.env.SMTP_ADMIN_EMAIL;
    if (adminEmail) {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: adminEmail,
        subject: `🔔 Comandă Nouă #${orderId} (${paymentTextLabel}) - OCLAR`,
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

LIVRARE:
Metodă: ${shippingLabel}
Adresă: ${addressText}

PRODUSE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${itemsList}

FINANCIAR:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Subtotal: ${subtotalValue.toFixed(2)} RON
Transport: ${shippingValue.toFixed(2)} RON
${discountValue > 0 ? `Reducere: -${discountValue.toFixed(2)} RON\n` : ''}
TOTAL: ${parseFloat(totalAmount).toFixed(2)} RON

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Procesează comanda pe https://oclar.ro/#/admin-dashboard
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
    .price-row { display: flex; justify-content: space-between; padding: 5px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="alert">
      <h2>🔔 Comandă Nouă #${orderId}</h2>
      <p>${new Date().toLocaleString('ro-RO')}</p>
      <p><strong>Metodă Plată: ${paymentTextLabel}</strong></p>
    </div>
    
    <div class="info-box">
      <h3>CLIENT</h3>
      <p><strong>Nume:</strong> ${customerName}<br>
      <strong>Telefon:</strong> ${customerPhone}<br>
      <strong>Email:</strong> ${customerEmail || 'N/A'}</p>
    </div>
    
    <div class="info-box">
      <h3>LIVRARE</h3>
      <p><strong>Metodă:</strong> ${shippingLabel}</p>
      <p><strong>Adresă:</strong> ${addressText}</p>
    </div>
    
    <div class="info-box">
      <h3>PRODUSE</h3>
      ${items.map((item) => `<p>${item.name} x${item.quantity} = ${(item.price * item.quantity).toFixed(2)} RON</p>`).join('')}
    </div>

    <div class="info-box">
      <h3>FINANCIAR</h3>
      <div class="price-row">
        <span>Subtotal Produse:</span>
        <strong>${subtotalValue.toFixed(2)} RON</strong>
      </div>
      <div class="price-row">
        <span>Transport (${shippingLabel}):</span>
        <strong>${shippingValue.toFixed(2)} RON</strong>
      </div>
      ${discountValue > 0 ? `
      <div class="price-row" style="color: #16a34a;">
        <span>Reducere${discountCode ? ` (${discountCode})` : ''}:</span>
        <strong>-${discountValue.toFixed(2)} RON</strong>
      </div>
      ` : ''}
      <div class="price-row" style="margin-top: 10px; padding-top: 10px; border-top: 2px solid #000; font-size: 1.2em;">
        <span>TOTAL:</span>
        <strong>${parseFloat(totalAmount).toFixed(2)} RON</strong>
      </div>
    </div>
    
    <p><a href="https://oclar.ro/#/admin-dashboard" style="background: #000; color: #fff; padding: 10px 20px; text-decoration: none; display: inline-block;">Vezi Comandă în Admin</a></p>
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
