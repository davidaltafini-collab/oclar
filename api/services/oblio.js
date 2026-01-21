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
      products: oblioProducts,
      language: 'RO',
      precision: 2,
      collect: {
        type: 'OP', // Ordin de plată
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

/**
 * Generează AWB - PLACEHOLDER pentru integrare curier
 * Acesta este un template care trebuie completat cu API-ul curierului (Fan Courier, Cargus, etc.)
 */
export async function generateAWB(orderDetails, courierService = 'fancourier') {
  const {
    orderId,
    customerName,
    customerPhone,
    address,
    totalAmount,
    shippingMethod,
    paymentMethod
  } = orderDetails;

  // ACEST ENDPOINT TREBUIE ÎNLOCUIT CU API-UL REAL AL CURIERULUI
  // Exemplu pentru Fan Courier: https://www.fancourier.ro/awb/
  
  try {
    // Template pentru integrare Fan Courier
    if (courierService === 'fancourier') {
      const awbData = {
        clientId: process.env.FANCOURIER_CLIENT_ID,
        username: process.env.FANCOURIER_USERNAME,
        password: process.env.FANCOURIER_PASSWORD,
        service: shippingMethod === 'easybox' ? 'FAN BOX' : 'Standard',
        recipient: {
          name: customerName,
          phone: customerPhone,
          county: address.county,
          city: address.city,
          address: address.line1 || address.line,
        },
        packages: 1,
        weight: 0.5, // kg
        declaredValue: parseFloat(totalAmount),
        cashOnDelivery: paymentMethod === 'ramburs' ? parseFloat(totalAmount) : 0,
        contents: `Comanda #${orderId}`,
        observations: ''
      };

      // AICI TREBUIE FĂCUT REQUEST LA API-UL CURIERULUI
      // const awbResponse = await fetch('API_URL_CURIER', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(awbData)
      // });

      console.log(`⚠️ AWB template pregătit pentru comanda #${orderId} - Necesită API curier real`);

      return {
        success: true,
        awbNumber: `AWB-TEMPLATE-${orderId}`, // PLACEHOLDER
        trackingUrl: `https://track.fancourier.ro/`,
        message: 'AWB template generat - Necesită implementare API curier'
      };
    }

    // Template pentru alte servicii de curierat
    return {
      success: false,
      error: 'Serviciu curier neimplementat încă'
    };

  } catch (error) {
    console.error('❌ Eroare generare AWB:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
