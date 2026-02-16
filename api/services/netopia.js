// api/services/netopia.js - VARIANTA FINALA REST API
import fetch from 'node-fetch'; // Dacă ai Node mai vechi de 18, altfel e nativ

export async function createPaymentSession(paymentData) {
  const apiKey = process.env.NETOPIA_API_KEY;
  const apiUrl = process.env.NETOPIA_API_URL;
  const posSignature = process.env.NETOPIA_SIGNATURE; 

  // Verificăm să avem tot ce trebuie în .env
  if (!apiKey || !posSignature) {
      throw new Error("Lipsesc NETOPIA_API_KEY sau NETOPIA_SIGNATURE din .env");
  }

  const now = new Date();
  const dateTime = now.toISOString(); 

  // Construim Payload-ul JSON
  const payload = {
    config: {
      notifyUrl: "https://api.oclar.ro/api/netopia/confirm",
      redirectUrl: "https://oclar.ro/#/success",
      language: "ro"
    },
    payment: {
      options: {
        installments: 0,
        bonus: 0
      },
      instrument: {
        type: "card",
        account: "", 
        expMonth: 1, 
        expYear: 2030,
        secretCode: ""
      }
    },
    order: {
      posSignature: posSignature, 
      dateTime: dateTime,
      description: `Comanda ${paymentData.orderId}`,
      orderID: paymentData.orderId,
      amount: Number(paymentData.amount),
      currency: "RON",
      billing: {
        email: paymentData.email || "client@fara-email.com",
        phone: paymentData.phone || "0700000000",
        firstName: paymentData.firstName || "Client",
        lastName: paymentData.lastName || "Test",
        city: paymentData.address.city || "Bucuresti",
        country: 642,
        countryName: "Romania",
        state: paymentData.address.county || "Bucuresti",
        postalCode: "000000",
        details: paymentData.address.line || "Adresa completa"
      },
      shipping: {
        email: paymentData.email || "client@fara-email.com",
        phone: paymentData.phone || "0700000000",
        firstName: paymentData.firstName || "Client",
        lastName: paymentData.lastName || "Test",
        city: paymentData.address.city || "Bucuresti",
        country: 642,
        state: paymentData.address.county || "Bucuresti",
        postalCode: "000000",
        details: paymentData.address.line || "Adresa completa"
      }
    }
  };

  console.log("[Netopia REST] Request Payload:", JSON.stringify(payload, null, 2));

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": apiKey 
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    console.log("[Netopia REST] Response:", result);

    if (result.payment && result.payment.paymentURL) {
      return { success: true, paymentUrl: result.payment.paymentURL };
    } 
    
    if (result.error) {
      throw new Error(`Netopia Error: ${result.error.message} (Code: ${result.error.code})`);
    }

    throw new Error("Răspuns invalid de la Netopia (lipsește paymentURL)");

  } catch (error) {
    console.error("[Netopia REST] Fail:", error);
    throw error;
  }
}

// Funcție pentru validarea notificării (IPN)
export function validatePaymentNotification(reqBody) {
  if (!reqBody || !reqBody.payment || !reqBody.order) {
    // Uneori Netopia trimite JSON simplu pe eroare, dar structura standard e cu payment/order
    // Dacă e gol, aruncăm eroare
    throw new Error("Invalid IPN format");
  }

  const status = reqBody.payment.status; 
  const orderId = reqBody.order.orderID; 
  const ntpId = reqBody.payment.ntpID;   
  
  console.log(`[Netopia IPN] Comanda: ${orderId}, Status: ${status}, NTP ID: ${ntpId}`);

  let isSuccess = false;
  let message = "Pending";

  // Statusuri conform documentației tale: 3=Paid, 5=Confirmed
  if (status === 3) {
    isSuccess = true;
    message = "PAID (În așteptare confirmare)";
  } else if (status === 5) {
    isSuccess = true;
    message = "CONFIRMED (Banii sunt la tine)";
  } else if (status === 12) {
    isSuccess = false;
    message = "REJECTED (Plată respinsă)";
  }

  return {
    success: isSuccess,
    orderId: orderId,
    transactionId: ntpId,
    status: status,
    message: message
  };
}