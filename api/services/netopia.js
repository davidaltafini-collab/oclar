import fs from "fs";
import path from "path";
import { Mobilpay } from "./Mobilpay.js"; // Importăm fișierul local creat la Pasul 2

// ==========================================
// CONFIGURARE
// ==========================================
const CERTS_DIR = path.join(process.cwd(), "api", "certs");

// ATENȚIE: Verifică numele fișierelor de pe server!
// Dacă le-ai lăsat cu numele lungi, pune-le aici.
const PUBLIC_FILE = "public.cer"; 
const PRIVATE_FILE = "private.key";

const NETOPIA_CONFIG = {
  signature: String(process.env.NETOPIA_SIGNATURE || "").trim(),
  sandbox: true,
  gatewayUrl: "http://sandboxsecure.mobilpay.ro", // HTTP pt sandbox
  returnUrl: "https://oclar.ro/#/success",
  confirmUrl: "https://api.oclar.ro/api/netopia/confirm",
};

// ==========================================
// HELPERE
// ==========================================
function clean(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .trim();
}

function getTimestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

// Inițializare instanță
function getClient() {
  const pubPath = path.join(CERTS_DIR, PUBLIC_FILE);
  const privPath = path.join(CERTS_DIR, PRIVATE_FILE);

  if (!fs.existsSync(pubPath)) throw new Error(`Lipsă fișier: ${PUBLIC_FILE}`);
  if (!fs.existsSync(privPath)) throw new Error(`Lipsă fișier: ${PRIVATE_FILE}`);

  return new Mobilpay({
    signature: NETOPIA_CONFIG.signature,
    publicKey: fs.readFileSync(pubPath, 'utf8'),
    privateKey: fs.readFileSync(privPath, 'utf8'),
    sandbox: NETOPIA_CONFIG.sandbox
  });
}

// ==========================================
// 1. CRIPTARE (START PLATĂ)
// ==========================================
export function encryptRequest(paymentData) {
  const mp = getClient();
  const ts = getTimestamp();
  const orderId = clean(paymentData.orderId);
  const amount = Number(paymentData.amount).toFixed(2);
  
  // Construim XML-ul EXACT cum îl vrea Netopia (fără spații inutile între tag-uri)
  // Ordinea tag-urilor contează uneori!
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<order type="card" id="${orderId}" timestamp="${ts}">
<signature>${NETOPIA_CONFIG.signature}</signature>
<url>
<return>${NETOPIA_CONFIG.returnUrl}</return>
<confirm>${NETOPIA_CONFIG.confirmUrl}</confirm>
</url>
<invoice currency="RON" amount="${amount}">
<details>Comanda ${orderId}</details>
<contact_info>
<billing type="person">
<first_name>${clean(paymentData.firstName)}</first_name>
<last_name>${clean(paymentData.lastName)}</last_name>
<email>${clean(paymentData.email)}</email>
<address>${clean(paymentData.address)}</address>
<mobile_phone>${clean(paymentData.phone)}</mobile_phone>
</billing>
<shipping type="person">
<first_name>${clean(paymentData.firstName)}</first_name>
<last_name>${clean(paymentData.lastName)}</last_name>
<email>${clean(paymentData.email)}</email>
<address>${clean(paymentData.address)}</address>
<mobile_phone>${clean(paymentData.phone)}</mobile_phone>
</shipping>
</contact_info>
</invoice>
</order>`;

  // Folosim clasa noastră pentru criptare
  const { envKey, envData } = mp.encrypt(xml);

  return {
    gatewayUrl: NETOPIA_CONFIG.gatewayUrl,
    env_key: envKey,
    data: envData,
  };
}

// ==========================================
// 2. DECRIPTARE (CONFIRMARE)
// ==========================================
export function decryptIPN(envKey, envData) {
  const mp = getClient();
  
  // Decriptăm
  const result = mp.decrypt(envKey, envData);
  
  return result;
}