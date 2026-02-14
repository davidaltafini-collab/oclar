import crypto from "crypto";
import fs from "fs";
import path from "path";

// Definim calea către folderul de certificate
const CERTS_DIR = path.join(process.cwd(), "api", "certs");

const NETOPIA_CONFIG = {
  // URL Sandbox (folosește 'https://secure.mobilpay.ro' pentru producție)
  gatewayUrl: "https://sandboxsecure.mobilpay.ro",

  // Semnătura din Netopia Dashboard (Admin -> Conturi de comerciant -> Modificare -> Tab-ul Implementare tehnică)
  signature: String(process.env.NETOPIA_SIGNATURE || "").trim(),

  // Certificatul PUBLIC al Netopia (Sandbox). Trebuie să fie convertit în .pem
  // Descarcă sandbox.X509.public.cer din Netopia și convertește-l.
  netopiaPublicCertPath: path.join(CERTS_DIR, "sandbox-public.pem"),

  // Cheia ta PRIVATĂ generată de tine (cea menționată de tine: private.key)
  merchantPrivateKeyPath: path.join(CERTS_DIR, "private.key"),

  // URL-urile unde se întoarce utilizatorul și unde trimite Netopia confirmarea (IPN)
  returnUrl: "https://oclar.ro/#/success", // Link-ul din browserul clientului
  confirmUrl: "https://api.oclar.ro/api/netopia/confirm", // Link-ul pentru server-to-server (IPN)
};

/**
 * Algoritmul RC4 (folosit de Netopia pentru criptarea datelor XML)
 * Implementare compatibilă cu Buffer (binar)
 */
function rc4(keyBuffer, dataBuffer) {
  const S = new Array(256);
  for (let i = 0; i < 256; i++) S[i] = i;

  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + S[i] + keyBuffer[i % keyBuffer.length]) % 256;
    [S[i], S[j]] = [S[j], S[i]];
  }

  let i = 0;
  j = 0;
  const output = Buffer.alloc(dataBuffer.length);

  for (let k = 0; k < dataBuffer.length; k++) {
    i = (i + 1) % 256;
    j = (j + S[i]) % 256;
    [S[i], S[j]] = [S[j], S[i]];
    output[k] = dataBuffer[k] ^ S[(S[i] + S[j]) % 256];
  }
  return output;
}

// -------------- Helpers --------------

function readTextFile(p) {
  if (!fs.existsSync(p)) {
    throw new Error(`[Netopia] Nu am găsit fișierul: ${p}`);
  }
  return fs.readFileSync(p, "utf8");
}

function ensureNonEmptySignature(sig) {
  if (!sig) throw new Error("NETOPIA_SIGNATURE lipsește din .env");
  // Verificare sumară format (XXXX-XXXX-XXXX-XXXX-XXXX)
  if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(sig)) {
    console.warn(`[Netopia] Atenție: Semnătura '${sig}' nu pare să aibă formatul corect.`);
  }
}

function cleanXml(str) {
  if (!str) return "";
  // Înlocuim caracterele speciale XML
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .trim();
}

function formatTimestamp(d = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(
    d.getMinutes()
  )}${pad(d.getSeconds())}`;
}

function buildXml(data) {
  const ts = formatTimestamp();
  const orderId = cleanXml(data.orderId);
  const amount = Number(data.amount).toFixed(2);

  // Date client
  const firstName = cleanXml(data.firstName || "Client");
  const lastName = cleanXml(data.lastName || "Oclar");
  const email = cleanXml(data.email || "no-reply@oclar.ro");
  const phone = cleanXml(data.phone || "");
  // Adresa trebuie să nu fie goală
  const address = cleanXml(data.address && data.address.length > 3 ? data.address : "Romania");

  return `<?xml version="1.0" encoding="utf-8"?>
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
        <first_name>${firstName}</first_name>
        <last_name>${lastName}</last_name>
        <email>${email}</email>
        <address>${address}</address>
        <mobile_phone>${phone}</mobile_phone>
      </billing>
      <shipping type="person">
        <first_name>${firstName}</first_name>
        <last_name>${lastName}</last_name>
        <email>${email}</email>
        <address>${address}</address>
        <mobile_phone>${phone}</mobile_phone>
      </shipping>
    </contact_info>
  </invoice>
</order>`;
}

// ------------------ ENCRYPT REQUEST (Start Plată) ------------------
export function encryptRequest(paymentData) {
  ensureNonEmptySignature(NETOPIA_CONFIG.signature);

  // 1. Citim Cheia Publică Netopia (Sandbox)
  const netopiaPublicPemRaw = readTextFile(NETOPIA_CONFIG.netopiaPublicCertPath);

  // 2. Construim XML-ul
  const xml = buildXml(paymentData);

  // 3. Generăm o cheie aleatorie RC4 (16 bytes)
  const rc4Key = crypto.randomBytes(16);

  // 4. Criptăm XML-ul folosind RC4
  const encryptedDataHex = rc4(rc4Key, Buffer.from(xml, "utf8"))
    .toString("hex")
    .toUpperCase();

  // 5. Criptăm cheia RC4 folosind Cheia Publică Netopia (RSA)
  const envKeyBase64 = crypto
    .publicEncrypt(
      { 
        key: netopiaPublicPemRaw, 
        padding: crypto.constants.RSA_PKCS1_PADDING 
      },
      rc4Key
    )
    .toString("base64");

  return {
    gatewayUrl: NETOPIA_CONFIG.gatewayUrl,
    env_key: envKeyBase64,
    data: encryptedDataHex,
  };
}

// ------------------ DECRYPT IPN (Confirmare Plată) ------------------
export function decryptIPN(envKeyBase64, encryptedDataHex) {
  // 1. Citim Cheia Privată a Comerciantului (a ta)
  const merchantPrivateKeyPem = readTextFile(NETOPIA_CONFIG.merchantPrivateKeyPath);

  // 2. Decriptăm cheia RC4 folosind Cheia Privată
  let rc4Key;
  try {
    rc4Key = crypto.privateDecrypt(
      { 
        key: merchantPrivateKeyPem, 
        padding: crypto.constants.RSA_PKCS1_PADDING 
      },
      Buffer.from(envKeyBase64, "base64")
    );
  } catch (e) {
    throw new Error("Decriptare cheie RSA eșuată. Verifică dacă private.key corespunde cu cheia publică încărcată în Netopia Dashboard.");
  }

  // 3. Decriptăm XML-ul folosind cheia RC4 obținută
  const xml = rc4(rc4Key, Buffer.from(encryptedDataHex, "hex")).toString("utf8");

  // 4. Extragem datele din XML (RegEx simplu pentru viteză)
  const orderIdMatch = xml.match(/<order[^>]*id="([^"]+)"/i) || xml.match(/id="([^"]+)"/i);
  // error code="0" înseamnă succes
  const errorCodeMatch = xml.match(/<error[^>]*code="([^"]+)"/i);
  
  // Statusul tranzacției: confirmed / paid / rejected / credit
  const actionMatch = xml.match(/<action>([^<]+)<\/action>/i);
  const errorMessageMatch = xml.match(/>([^<]+)<\/error>/i);

  return {
    orderId: orderIdMatch ? orderIdMatch[1] : null,
    action: actionMatch ? actionMatch[1] : null,
    errorCode: errorCodeMatch ? errorCodeMatch[1] : null,
    errorMessage: errorMessageMatch ? errorMessageMatch[1] : null,
    xml, // returnăm XML-ul brut pentru debug
  };
}
