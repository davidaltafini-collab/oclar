import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface OrderDetails {
  orderId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  address: {
    city: string;
    county: string; // Stripe pune adesea judetul in "state"
    line1: string;
    line2?: string;
    postal_code?: string;
  };
  totalAmount: number;
  items: OrderItem[];
}

export const sendOrderEmails = async (details: OrderDetails) => {
  const { orderId, customerName, customerEmail, customerPhone, address, totalAmount, items } = details;

  // 1. Generăm lista de produse HTML
  const itemsHtml = items.map(item => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.name}</td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.quantity} buc</td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${item.price} RON</td>
    </tr>
  `).join('');

  // 2. Formatăm adresa
  const addressString = `
    ${address.line1} ${address.line2 || ''}<br>
    ${address.city}, ${address.county || ''}<br>
    ${address.postal_code || ''}
  `;

  // 3. Template Comun (CSS inline pentru email)
  const emailTemplate = (title: string, isMerchant: boolean) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <h2 style="color: #000; border-bottom: 2px solid #000; padding-bottom: 10px;">${title}</h2>
      
      <p><strong>ID Comandă:</strong> #${orderId}</p>
      
      <h3>Detalii Livrare</h3>
      <p>
        <strong>Nume:</strong> ${customerName}<br>
        <strong>Email:</strong> ${customerEmail}<br>
        <strong>Telefon:</strong> ${customerPhone || 'Nespecificat'}<br>
        <strong>Adresă:</strong><br>${addressString}
      </p>

      <h3>Produse Comandate</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f4f4f4;">
            <th style="text-align: left; padding: 8px;">Produs</th>
            <th style="text-align: left; padding: 8px;">Cant.</th>
            <th style="text-align: right; padding: 8px;">Preț</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="2" style="text-align: right; padding: 10px; font-weight: bold;">TOTAL:</td>
            <td style="text-align: right; padding: 10px; font-weight: bold; font-size: 1.2em;">${totalAmount} RON</td>
          </tr>
        </tfoot>
      </table>
      
      ${!isMerchant ? '<p style="margin-top: 30px; color: #666;">Îți mulțumim că ai ales magazinul nostru! Te vom anunța când coletul este expediat.</p>' : ''}
    </div>
  `;

  try {
    // A. Trimite Email la CLIENT
    await transporter.sendMail({
      from: `"Magazin Ochelari" <${process.env.SMTP_USER}>`,
      to: customerEmail,
      subject: `Confirmare Comandă #${orderId}`,
      html: emailTemplate(`Salut ${customerName}, am primit comanda ta!`, false),
    });

    // B. Trimite Email la TINE (Comerciant)
    if (process.env.MERCHANT_EMAIL) {
      await transporter.sendMail({
        from: `"Notificări Comenzi" <${process.env.SMTP_USER}>`,
        to: process.env.MERCHANT_EMAIL,
        subject: `[NOU] Comandă #${orderId} - ${totalAmount} RON`,
        html: emailTemplate(`Ai o comandă nouă de la ${customerName}!`, true),
      });
    }

    console.log(`Emails sent for order ${orderId}`);
  } catch (error) {
    console.error('Error sending emails:', error);
  }
};
