import fetch from 'node-fetch'; // Dacă ai Node 18+, poți șterge linia asta, dar nu strică să fie aici.

export async function createPaymentSession(paymentData) {
  // Luăm variabilele din .env
  const apiKey = process.env.NETOPIA_API_KEY;
  const apiUrl = process.env.NETOPIA_API_URL;
  const posSignature = process.env.NETOPIA_SIGNATURE; 

  // Validare că avem cheile necesare
  if (!apiKey || !posSignature) {
      throw new Error("Lipsesc NETOPIA_API_KEY sau NETOPIA_SIGNATURE din .env");
  }

  // Data curentă în format ISO 8601
  const now = new Date();
  const dateTime = now.toISOString(); 

  // Construim obiectul JSON cerut de documentația Netopia
  const payload = {
    config: {
      notifyUrl: "https://api.oclar.ro/api/netopia/confirm",
      redirectUrl: "https://oclar.ro/success",
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
      posSignature: posSignature, // Semnătura ta (39IB...)
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

  console.log("[Netopia REST] Inițiere plată...");

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": apiKey // Cheia API în Header
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    
    // Verificăm dacă am primit URL-ul de plată
    if (result.payment && result.payment.paymentURL) {
      console.log("[Netopia REST] Success! URL:", result.payment.paymentURL);
      return { success: true, paymentUrl: result.payment.paymentURL };
    } 
    
    // Tratăm erorile trimise de Netopia
    if (result.error) {
      throw new Error(`Netopia Error: ${result.error.message} (Code: ${result.error.code})`);
    }

    throw new Error("Răspuns invalid de la Netopia (lipsește paymentURL)");

  } catch (error) {
    console.error("[Netopia REST] Fail:", error);
    throw error;
  }
}

// Funcție pentru interpretarea notificării (IPN)
export function validatePaymentNotification(reqBody) {
  if (!reqBody || !reqBody.payment || !reqBody.order) {
    throw new Error("Invalid IPN format");
  }

  const status = reqBody.payment.status; 
  const orderId = reqBody.order.orderID; 
  const ntpId = reqBody.payment.ntpID;   
  
  let isSuccess = false;
  let message = "Pending";

  // 3 = Paid, 5 = Confirmed
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