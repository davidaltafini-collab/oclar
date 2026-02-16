export async function createPaymentSession(paymentData) {
  const apiKey = process.env.NETOPIA_API_KEY;
  const apiUrl = process.env.NETOPIA_API_URL;
  const posSignature = process.env.NETOPIA_SIGNATURE; // Semnătura contului (obligatorie în 'order')

  if (!apiKey || !posSignature) throw new Error("Lipsesc NETOPIA_API_KEY sau NETOPIA_SIGNATURE din .env");

  // Formatare dată ISO 8601 (ex: 2023-08-24T14:15:22+02:00)
  const now = new Date();
  const dateTime = now.toISOString(); 

  // Construim Payload-ul conform schemei 'StartRequest' din api.json
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
      // Instrument este cerut de schemă, trimitem tip card simplu
      instrument: {
        type: "card",
        account: "", 
        expMonth: 1, 
        expYear: 2030,
        secretCode: ""
      }
    },
    order: {
      posSignature: posSignature, // CRITIC: Aici vine semnătura 39IB...
      dateTime: dateTime,
      description: `Comanda ${paymentData.orderId}`,
      orderID: paymentData.orderId,
      amount: Number(paymentData.amount),
      currency: "RON",
      billing: {
        email: paymentData.email || "client@test.com",
        phone: paymentData.phone || "0700000000",
        firstName: paymentData.firstName || "Client",
        lastName: paymentData.lastName || "Test",
        city: paymentData.address.city || "Bucuresti",
        country: 642, // Cod numeric Romania conform ISO 3166-1
        countryName: "Romania",
        state: paymentData.address.county || "Bucuresti",
        postalCode: "000000",
        details: paymentData.address.line || "Adresa completa"
      },
      shipping: {
        email: paymentData.email || "client@test.com",
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
        "Authorization": apiKey // Cheia API direct în header
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    console.log("[Netopia REST] Response:", result);

    // Conform schemei 'StartResponse', URL-ul este în payment.paymentURL
    if (result.payment && result.payment.paymentURL) {
      return { success: true, paymentUrl: result.payment.paymentURL };
    } 
    
    // Tratare erori (schema ErrorWithDetails)
    if (result.error) {
      throw new Error(`Netopia Error: ${result.error.message} (Code: ${result.error.code})`);
    }

    throw new Error("Răspuns invalid de la Netopia (lipsește paymentURL)");

  } catch (error) {
    console.error("[Netopia REST] Fail:", error);
    throw error;
  }
}

export function decryptIPN(reqBody) {
   // Placeholder pentru noul format de IPN (JSON)
   // Momentan doar logăm să vedem ce primim
   console.log("IPN Primit:", reqBody);
   return { status: "OK" };
}
export function validatePaymentNotification(reqBody) {
  // Verificăm dacă structura e cea din documentație (NotifyRequest)
  if (!reqBody || !reqBody.payment || !reqBody.order) {
    throw new Error("Invalid IPN format");
  }

  const status = reqBody.payment.status; // 3 = Paid, 5 = Confirmed
  const orderId = reqBody.order.orderID; // ID-ul comenzii tale
  const ntpId = reqBody.payment.ntpID;   // ID-ul tranzacției Netopia
  
  console.log(`[Netopia IPN] Comanda: ${orderId}, Status: ${status}, NTP ID: ${ntpId}`);

  // Interpretăm statusul conform documentației API
  let isSuccess = false;
  let message = "Pending";

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