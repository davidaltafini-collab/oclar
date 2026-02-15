import fs from "fs";
import path from "path";
import { Mobilpay } from "mobilpay-card";

// ==========================================
// CONFIGURARE
// ==========================================
const CERTS_DIR = path.join(process.cwd(), "api", "certs");

// ⚠️ MODIFICĂ AICI dacă fișierele tale au numele lungi pe server!
const PUBLIC_FILE = "public.cer"; 
const PRIVATE_FILE = "private.key";

const NETOPIA_CONFIG = {
  // Semnătura din .env este "API-ul" principal
  signature: String(process.env.NETOPIA_SIGNATURE || "").trim(),
  sandbox: true, // TRUE pentru teste
  gatewayUrl: "http://sandboxsecure.mobilpay.ro",
  returnUrl: "https://oclar.ro/#/success",
  confirmUrl: "https://api.oclar.ro/api/netopia/confirm",
};

// Funcție care inițializează librăria
function getMobilpayInstance() {
  const publicPath = path.join(CERTS_DIR, PUBLIC_FILE);
  const privatePath = path.join(CERTS_DIR, PRIVATE_FILE);

  if (!fs.existsSync(publicPath) || !fs.existsSync(privatePath)) {
    throw new Error(`[Netopia] Lipsesc certificatele! Verifică folderul api/certs`);
  }

  // Aici se face legătura cu API-ul Netopia folosind fișierele
  return new Mobilpay({
    signature: NETOPIA_CONFIG.signature,
    sandbox: NETOPIA_CONFIG.sandbox,
    publicKey: fs.readFileSync(publicPath),
    privateKey: fs.readFileSync(privatePath),
  });
}

// ==========================================
// 1. START PLATĂ (ENCRYPT)
// ==========================================
export function encryptRequest(paymentData) {
  const mp = getMobilpayInstance();

  // Construim datele comenzii
  const orderParams = {
    orderId: paymentData.orderId,
    amount: Number(paymentData.amount).toFixed(2),
    currency: "RON",
    details: `Comanda ${paymentData.orderId}`,
    confirmUrl: NETOPIA_CONFIG.confirmUrl,
    returnUrl: NETOPIA_CONFIG.returnUrl,
    billing: {
      firstName: paymentData.firstName || "Client",
      lastName: paymentData.lastName || "Oclar",
      email: paymentData.email || "test@test.com",
      phone: paymentData.phone || "0700000000",
      address: paymentData.address || "Romania",
      city: "Bucuresti",
      country: "Romania"
    },
    shipping: {
      firstName: paymentData.firstName || "Client",
      lastName: paymentData.lastName || "Oclar",
      email: paymentData.email || "test@test.com",
      phone: paymentData.phone || "0700000000",
      address: paymentData.address || "Romania",
      city: "Bucuresti",
      country: "Romania"
    }
  };

  // Librăria face criptarea automat
  const requestElement = mp.createRequest(orderParams);
  const { envKey, envData } = mp.encrypt(requestElement);

  return {
    gatewayUrl: NETOPIA_CONFIG.gatewayUrl,
    env_key: envKey,
    data: envData,
  };
}

// ==========================================
// 2. CONFIRMARE PLATĂ (DECRYPT)
// ==========================================
export function decryptIPN(envKey, envData) {
  const mp = getMobilpayInstance();

  // Librăria face decriptarea
  const data = mp.decrypt({ envKey, envData });

  return {
    orderId: data.orderId,
    action: data.action, // ex: 'confirmed', 'paid'
    errorCode: data.errorCode,
    errorMessage: data.errorMessage,
    xml: JSON.stringify(data) // Trimitem datele decriptate ca JSON
  };
}