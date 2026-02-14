import crypto from "crypto";
import fs from "fs";
import path from "path";

// Calea către folderul de certificate
const CERTS_DIR = path.join(process.cwd(), "api", "certs");

const NETOPIA_CONFIG = {
  // URL Sandbox
  gatewayUrl: "https://sandboxsecure.mobilpay.ro",

  // Semnătura din Netopia Dashboard
  signature: String(process.env.NETOPIA_SIGNATURE || "").trim(),

  // --- MODIFICARE AICI ---
  // Folosim numele exact pe care l-am văzut în comanda ls: public.cer
  netopiaPublicCertPath: path.join(CERTS_DIR, "public.cer"),

  // Cheia ta privată
  merchantPrivateKeyPath: path.join(CERTS_DIR, "private.key"),

  // URL-urile
  returnUrl: "https://oclar.ro/#/success",
  confirmUrl: "https://api.oclar.ro/api/netopia/confirm",
};

/**
 * Algoritmul RC4
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
}

function cleanXml(str) {
  if (!str) return "";
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
  const firstName = cleanXml(data.firstName || "Client");
  const lastName = cleanXml(data.lastName || "Oclar");
  const email = cleanXml(data.email || "no-reply@oclar.ro");
  const phone = cleanXml(data.phone || "");
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

  // 1. Citim Cheia Publică Netopia
  const netopiaPublicPemRaw = readTextFile(NETOPIA_CONFIG.netopiaPublicCertPath);

  // VERIFICARE CRITICĂ: Fișierul trebuie să fie TEXT (PEM), nu binar
  if (!netopiaPublicPemRaw.includes("-----BEGIN")) {
      throw new Error(
        `[Netopia] Eroare Format Certificat: Fișierul ${NETOPIA_CONFIG.netopiaPublicCertPath} pare a fi binar (DER).\n` +
        `Trebuie convertit în PEM. Rulează pe server:\n` +
        `openssl x509 -inform DER -in api/certs/public.cer -out api/certs/public.pem\n` +
        `...și apoi actualizează codul să folosească public.pem`
      );
  }

  const xml = buildXml(paymentData);
  const rc4Key = crypto.randomBytes(16);
  const encryptedDataHex = rc4(rc4Key, Buffer.from(xml, "utf8"))
    .toString("hex")
    .toUpperCase();

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
  const merchantPrivateKeyPem = readTextFile(NETOPIA_CONFIG.merchantPrivateKeyPath);

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
    throw new Error("Decriptare cheie RSA eșuată. Verifică private.key.");
  }

  const xml = rc4(rc4Key, Buffer.from(encryptedDataHex, "hex")).toString("utf8");

  const orderIdMatch = xml.match(/<order[^>]*id="([^"]+)"/i) || xml.match(/id="([^"]+)"/i);
  const errorCodeMatch = xml.match(/<error[^>]*code="([^"]+)"/i);
  const actionMatch = xml.match(/<action>([^<]+)<\/action>/i);
  const errorMessageMatch = xml.match(/>([^<]+)<\/error>/i);

  return {
    orderId: orderIdMatch ? orderIdMatch[1] : null,
    action: actionMatch ? actionMatch[1] : null,
    errorCode: errorCodeMatch ? errorCodeMatch[1] : null,
    errorMessage: errorMessageMatch ? errorMessageMatch[1] : null,
    xml,
  };
}
