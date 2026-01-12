import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendOrderEmails = async (customerEmail: string, orderId: string, amount: number) => {
  try {
    // Email to Customer
    await transporter.sendMail({
      from: '"Lumina Supply" <no-reply@lumina.supply>',
      to: customerEmail,
      subject: `Order Confirmation #${orderId}`,
      text: `Thank you for your order. Total: $${amount.toFixed(2)}. We are processing it now.`,
      html: `
        <div style="font-family: sans-serif; color: #171717;">
          <h1>Order Confirmed</h1>
          <p>Thank you for shopping with Lumina.</p>
          <p><strong>Order ID:</strong> ${orderId}</p>
          <p><strong>Total:</strong> $${amount.toFixed(2)}</p>
        </div>
      `,
    });

    // Email to Merchant
    await transporter.sendMail({
      from: '"Lumina System" <system@lumina.supply>',
      to: process.env.MERCHANT_EMAIL || 'admin@lumina.supply',
      subject: `New Order Received #${orderId}`,
      text: `New order from ${customerEmail}. Amount: $${amount.toFixed(2)}.`,
    });

    console.log('Emails sent successfully');
  } catch (error) {
    console.error('Error sending emails:', error);
  }
};