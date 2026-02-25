import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const OBLIO_API_URL = 'https://www.oblio.eu/api';
const OBLIO_EMAIL = process.env.OBLIO_EMAIL;
const OBLIO_SECRET = process.env.OBLIO_SECRET;

/**
 * Trimite factură în Oblio pentru o comandă
 */
export async function sendOblioInvoice(orderDetails) {
  const {
    orderId,
    customerName,
    customerEmail,
    customerPhone,
    address,
    items,
    subtotal,
    shippingCost,
    discountAmount,
    totalAmount,
    discountCode
  } = orderDetails;

  try {
    // 1. Autentificare Oblio
    const authResponse = await fetch(`${OBLIO_API_URL}/authorize/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: OBLIO_EMAIL,
        client_secret: OBLIO_SECRET,
        grant_type: 'client_credentials'
      })
    });

    if (!authResponse.ok) {
      throw new Error('Oblio authentication failed');
    }

    const { access_token } = await authResponse.json();

    // 2. Construim produsele pentru factură
    const oblioProducts = items.map(item => ({
      name: item.name,
      code: `PROD-${item.id || '000'}`,
      description: item.name,
      price: parseFloat(item.price),
      currency: 'RON',
      vat: 19, // TVA 19%
      quantity: item.quantity,
      unit: 'buc',
      product_type: 'Marfa'
    }));

    // Adăugăm livrarea ca produs separat
    if (shippingCost > 0) {
      oblioProducts.push({
        name: 'Transport',
        code: 'TRANSPORT',
        description: 'Cost transport',
        price: parseFloat(shippingCost),
        currency: 'RON',
        vat: 19,
        quantity: 1,
        unit: 'buc',
        product_type: 'Serviciu'
      });
    }

    // Discount ca produs cu valoare negativă (dacă există)
    if (discountAmount > 0) {
      oblioProducts.push({
        name: `Reducere${discountCode ? ` (${discountCode})` : ''}`,
        code: 'DISCOUNT',
        description: 'Cod promotional',
        price: -parseFloat(discountAmount),
        currency: 'RON',
        vat: 19,
        quantity: 1,
        unit: 'buc',
        product_type: 'Discount'
      });
    }

    // 3. Construim clientul
    const client = {
      name: customerName,
      email: customerEmail || '',
      phone: customerPhone || '',
      address: address.line1 || address.line || '',
      city: address.city || '',
      county: address.county || '',
      country: 'Romania',
      rc: '', // Cod fiscal (pentru persoane juridice)
      cif: '', // CUI (pentru persoane juridice)
      save: false
    };

    // 4. Trimitem factura
    const invoiceData = {
      cif: process.env.OBLIO_CIF, // CIF-ul companiei tale
      client,
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 14 zile
      currency: 'RON',
      seriesName: process.env.OBLIO_SERIES_NAME,
      products: oblioProducts,
      language: 'RO',
      precision: 2,
collect: {
  type:
    orderDetails.paymentMethod === 'ramburs'
      ? 'Ramburs'
      : orderDetails.paymentMethod === 'card'
        ? 'Card'
        : 'Ordin de plata',
  value: parseFloat(totalAmount)
},
      mentions: `Comanda #${orderId}`,
      useStock: false
    };

    const invoiceResponse = await fetch(`${OBLIO_API_URL}/docs/invoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${access_token}`
      },
      body: JSON.stringify(invoiceData)
    });

    if (!invoiceResponse.ok) {
      const errorText = await invoiceResponse.text();
      throw new Error(`Oblio invoice creation failed: ${errorText}`);
    }

    const invoiceResult = await invoiceResponse.json();

    console.log(`✅ Factură Oblio creată pentru comanda #${orderId}`);
    
    return {
      success: true,
      invoiceId: invoiceResult.data?.id,
      invoiceNumber: invoiceResult.data?.seriesName + invoiceResult.data?.number,
      invoiceUrl: invoiceResult.data?.link
    };

  } catch (error) {
    console.error('❌ Eroare creare factură Oblio:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
/* =========================
   ECOLET / ALSENDO AUTH
========================= */
async function getEcoletToken() {
  const res = await fetch(`${process.env.ECOLET_BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.ECOLET_CLIENT_ID,
      client_secret: process.env.ECOLET_CLIENT_SECRET
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Ecolet auth failed: ${err}`);
  }

  const data = await res.json();
  return data.access_token;
}
/**
 * Generează AWB prin ECOLET (Alsendo)
 */
export async function generateAWB(orderDetails, courierService) {
  const {
    orderId,
    customerName,
    customerPhone,
    address,
    totalAmount,
    shippingMethod,
    paymentMethod
  } = orderDetails;

  try {
    const token = await getEcoletToken();

    /* =========================
       PAYLOAD ECOLET
    ========================= */

    const payload = {
      service: courierService,
      delivery_type: shippingMethod === 'easybox' ? 'LOCKER' : 'COURIER',
      sender: {
        company: process.env.SENDER_COMPANY,
        phone: process.env.SENDER_PHONE,
        address: process.env.SENDER_ADDRESS,
        city: process.env.SENDER_CITY,
        postal_code: process.env.SENDER_POSTAL_CODE
      },
      recipient: {
        name: customerName,
        phone: customerPhone,
        address: address.line1 || address.line || '',
        city: address.city,
        county: address.county
      },
      parcels: [
        {
          weight: Math.max(0.5, Number(orderDetails.weight || 1)),
          cash_on_delivery:
            paymentMethod === 'ramburs'
              ? parseFloat(totalAmount)
              : 0
        }
      ],
      reference: `ORDER-${orderId}`
    };


    /* =========================
       API CALL ECOLET
    ========================= */

    const awbRes = await fetch(
      `${process.env.ECOLET_BASE_URL}/send-order`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      }
    );

    if (!awbRes.ok) {
      const err = await awbRes.text();
      throw new Error(`Ecolet AWB failed: ${err}`);
    }

    const result = await awbRes.json();

    /* =========================
       RETURN STRUCTURĂ AȘTEPTATĂ
    ========================= */

    return {
      success: true,
      awbNumber: result?.data?.waybill_number,
      labelUrl: result?.data?.label_url,
      raw: result
    };

  } catch (error) {
    console.error('❌ Ecolet AWB error:', error.message);

    return {
      success: false,
      error: error.message
    };
  }
}

