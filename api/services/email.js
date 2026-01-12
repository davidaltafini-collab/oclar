import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

// Ensure environment variables are loaded for transporter configuration.
dotenv.config();

// Create a reusable transporter object using SMTP transport.  The
// configuration is driven entirely by environment variables to avoid
// hardcoding any credentials.  You must set SMTP_HOST, SMTP_PORT,
// SMTP_USER, SMTP_PASS and optionally SMTP_SECURE and SMTP_FROM in your
// deployment configuration.
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Send order confirmation emails both to the customer and to the store admin.
 * The admin email address should be set via SMTP_ADMIN_EMAIL in the env.
 * @param {Object} details
 * @param {string} details.orderId
 * @param {string} details.customerName
 * @param {string} [details.customerEmail]
 * @param {string} [details.customerPhone]
 * @param {any} details.address
 * @param {number} details.totalAmount
 * @param {Array<{name: string, quantity: number, price: number}>} details.items
 */
export async function sendOrderEmails(details) {
  const {
    orderId,
    customerName,
    customerEmail,
    customerPhone,
    address,
    totalAmount,
    items,
  } = details;
  const adminEmail = process.env.SMTP_ADMIN_EMAIL;
  const fromAddress = process.env.SMTP_FROM || adminEmail || '';

  // Construct a simple HTML representation of the order.  In a real
  // application you might want to use a template engine or separate file.
  const itemsHtml = items
    .map((item) => `<li>${item.name} – ${item.quantity} x ${item.price.toFixed(2)} RON</li>`) // romanian currency
    .join('');

  const addressLines = [];
  if (address) {
    if (address.line1 || address.line) addressLines.push(address.line1 || address.line);
    if (address.city) addressLines.push(address.city);
    if (address.county) addressLines.push(address.county);
  }
  const addressStr = addressLines.join(', ');

  const html = `
    <h1>Comanda #${orderId}</h1>
    <p><strong>Nume client:</strong> ${customerName}</p>
    ${customerEmail ? `<p><strong>Email:</strong> ${customerEmail}</p>` : ''}
    ${customerPhone ? `<p><strong>Telefon:</strong> ${customerPhone}</p>` : ''}
    ${addressStr ? `<p><strong>Adresă:</strong> ${addressStr}</p>` : ''}
    <p><strong>Produse comandate:</strong></p>
    <ul>${itemsHtml}</ul>
    <p><strong>Total:</strong> ${totalAmount.toFixed(2)} RON</p>
  `;

  // Build list of recipients.  Only include defined addresses.
  const toAddresses = [customerEmail, adminEmail].filter(Boolean).join(',');
  if (!toAddresses) {
    console.warn('No recipients specified for order email');
    return;
  }

  await transporter.sendMail({
    from: fromAddress,
    to: toAddresses,
    subject: `Confirmare comanda #${orderId}`,
    html,
  });
}