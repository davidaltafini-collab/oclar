import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const OBLIO_API_URL = 'https://www.oblio.eu/api';
const OBLIO_EMAIL = process.env.OBLIO_EMAIL;
const OBLIO_SECRET = process.env.OBLIO_SECRET;

/**
 * Trimite factură în Oblio folosind DOAR datele reale din comandă.
 */
export async function sendOblioInvoice(orderDetails) {
  const {
    orderId,
    customerName,
    customerEmail,
    customerPhone,
    address, // Obiectul trebuie să conțină { city, county, line1/address_line } reale!
    items,
    subtotal,
    shippingCost,
    discountAmount,
    totalAmount,
    discountCode
  } = orderDetails;

  try {
    // 1. Autentificare
    const authResponse = await fetch(`${OBLIO_API_URL}/authorize/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: OBLIO_EMAIL,
        client_secret: OBLIO_SECRET,
        grant_type: 'client_credentials'
      })
    });

    if (!authResponse.ok) throw new Error('Oblio authentication failed');
    const { access_token } = await authResponse.json();

    // 2. Produse
    const oblioProducts = items.map(item => ({
      name: item.name,
      code: `PROD-${item.id || '000'}`,
      description: item.name,
      price: parseFloat(item.price),
      currency: 'RON',
      vat: 19,
      quantity: item.quantity,
      unit: 'buc',
      product_type: 'Marfa'
    }));

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

    // 3. Client - DATE REALE
    // Folosim strict datele venite din comandă. Fără falsuri.
    const client = {
      name: customerName,
      email: customerEmail || '',
      phone: customerPhone || '',
      // Mapăm câmpurile posibile din diverse structuri de DB
      address: address?.line1 || address?.line || address?.address_line || '',
      city: address?.city || '',
      county: address?.county || '',
      country: 'Romania',
      rc: '',
      cif: '',
      save: false
    };

    // Validare de bun simț: Dacă nu avem oraș/județ, Oblio va respinge oricum.
    if (!client.city || !client.county || !client.address) {
        throw new Error(`Date facturare incomplete pentru Comanda #${orderId} (Lipsă Adresă/Oraș/Județ)`);
    }

    // 4. Metoda de plată
    const paymentMethod = orderDetails.paymentMethod;
    let collectType;
    if (['card', 'online', 'netopia', 'stripe'].includes(paymentMethod)) {
      collectType = 'Card';
    } else if (paymentMethod === 'ramburs') {
      collectType = 'Ramburs';
    } else {
      collectType = 'Alta incasare banca';
    }

    // 5. Construire Factură
    const seriesName = process.env.OBLIO_SERIES_NAME;
    if (!seriesName) {
        throw new Error("OBLIO_SERIES_NAME nu este setat în .env!");
    }

    const invoiceData = {
      cif: process.env.OBLIO_CIF,
      client,
      seriesName: seriesName,
      number: '', // CRITIC: String gol forțează Oblio să aloce următorul număr disponibil.
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      currency: 'RON',
      products: oblioProducts,
      language: 'RO',
      precision: 2,
      mentions: `Comanda #${orderId} - Plata: ${collectType}`,
      useStock: false,
      collect: {
        type: collectType,
        value: parseFloat(totalAmount)
      }
    };

    console.log(`📄 Oblio: Generare factura #${orderId} pe seria "${seriesName}"...`);

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
      throw new Error(`Oblio Error: ${errorText}`);
    }

    const invoiceResult = await invoiceResponse.json();
    console.log(`✅ Factură Oblio SUCCESS: ${invoiceResult.data?.seriesName}${invoiceResult.data?.number}`);

    return {
      success: true,
      invoiceId: invoiceResult.data?.id,
      invoiceNumber: invoiceResult.data?.seriesName + invoiceResult.data?.number,
      invoiceUrl: invoiceResult.data?.link
    };

  } catch (error) {
    console.error('❌ Eroare creare factură Oblio:', error.message);
    return { success: false, error: error.message };
  }
}
