import crypto from "crypto";
import fs from "fs";
import path from "path";

// ==========================================
// CONFIGURARE CĂI & URL
// ==========================================
const CERTS_DIR = path.join(process.cwd(), "api", "certs");

// Folosim numele exacte pe care le ai pe server
const PUBLIC_CERT_PATH = path.join(CERTS_DIR, "sandbox.39IB-FQJV-WABH-2FHI-O4ZQ.public.cer");
const PRIVATE_KEY_PATH = path.join(CERTS_DIR, "sandbox.39IB-FQJV-WABH-2FHI-O4ZQprivate.key");

const NETOPIA_CONFIG = {
    // Sandbox URL
    gatewayUrl: "http://sandboxsecure.mobilpay.ro",
    returnUrl: "https://oclar.ro/#/success",
    confirmUrl: "https://api.oclar.ro/api/netopia/confirm",
};

// ==========================================
// HELPERE
// ==========================================

function getFileContent(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`[Netopia] Fișier lipsă: ${filePath}`);
    }
    return fs.readFileSync(filePath, "utf8");
}

/**
 * Algoritmul RC4 implementat pentru Buffer (binar)
 * Compatibil UTF-8 pentru a suporta diacriticele din adrese
 */
function rc4(key, data) {
    const S = [];
    for (let i = 0; i < 256; i++) S[i] = i;
    let j = 0;
    for (let i = 0; i < 256; i++) {
        j = (j + S[i] + key[i % key.length]) % 256;
        [S[i], S[j]] = [S[j], S[i]];
    }
    let i = 0;
    j = 0;
    const output = Buffer.alloc(data.length);
    for (let k = 0; k < data.length; k++) {
        i = (i + 1) % 256;
        j = (j + S[i]) % 256;
        [S[i], S[j]] = [S[j], S[i]];
        output[k] = data[k] ^ S[(S[i] + S[j]) % 256];
    }
    return output;
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
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

// ==========================================
// 1. ENCRYPT REQUEST (Start Plată)
// ==========================================
export function encryptRequest(paymentData) {
    const signature = String(process.env.NETOPIA_SIGNATURE || "").trim();
    if (!signature) throw new Error("NETOPIA_SIGNATURE lipsește din .env");

    // 1. Pregătire XML
    const ts = formatTimestamp();
    const orderId = cleanXml(paymentData.orderId);
    
    const xmlStr = `<?xml version="1.0" encoding="utf-8"?>
<order type="card" id="${orderId}" timestamp="${ts}">
  <signature>${signature}</signature>
  <url>
    <return>${NETOPIA_CONFIG.returnUrl}</return>
    <confirm>${NETOPIA_CONFIG.confirmUrl}</confirm>
  </url>
  <invoice currency="RON" amount="${Number(paymentData.amount).toFixed(2)}">
    <details>Comanda ${orderId}</details>
    <contact_info>
      <billing type="person">
        <first_name>${cleanXml(paymentData.firstName)}</first_name>
        <last_name>${cleanXml(paymentData.lastName)}</last_name>
        <email>${cleanXml(paymentData.email)}</email>
        <address>${cleanXml(paymentData.address)}</address>
        <mobile_phone>${cleanXml(paymentData.phone)}</mobile_phone>
      </billing>
      <shipping type="person">
        <first_name>${cleanXml(paymentData.firstName)}</first_name>
        <last_name>${cleanXml(paymentData.lastName)}</last_name>
        <email>${cleanXml(paymentData.email)}</email>
        <address>${cleanXml(paymentData.address)}</address>
        <mobile_phone>${cleanXml(paymentData.phone)}</mobile_phone>
      </shipping>
    </contact_info>
  </invoice>
</order>`;

    // 2. Criptare RC4
    // Generăm cheia RC4 (16 bytes aleatori)
    const rc4Key = crypto.randomBytes(16);
    // Convertim XML-ul în Buffer (UTF-8) pentru a nu pierde diacriticele
    const xmlBuffer = Buffer.from(xmlStr, 'utf8');
    // Criptăm conținutul
    const encryptedData = rc4(rc4Key, xmlBuffer);
    const encryptedDataHex = encryptedData.toString('hex').toUpperCase();

    // 3. Criptare RSA (env_key)
    // Criptăm cheia RC4 folosind Certificatul Public al Netopia
    const netopiaPublicCert = getFileContent(PUBLIC_CERT_PATH);
    
    const encryptedKey = crypto.publicEncrypt(
        {
            key: netopiaPublicCert,
            padding: crypto.constants.RSA_PKCS1_PADDING, // Standardul obligatoriu Netopia
        },
        rc4Key
    );
    const envKeyBase64 = encryptedKey.toString('base64');

    return {
        gatewayUrl: NETOPIA_CONFIG.gatewayUrl,
        env_key: envKeyBase64,
        data: encryptedDataHex,
    };
}

// ==========================================
// 2. DECRYPT IPN (Confirmare Plată)
// ==========================================
export function decryptIPN(envKeyBase64, encryptedDataHex) {
    const merchantPrivateKey = getFileContent(PRIVATE_KEY_PATH);

    // 1. Decriptare Cheie RC4 (RSA)
    let rc4Key;
    try {
        rc4Key = crypto.privateDecrypt(
            {
                key: merchantPrivateKey,
                padding: crypto.constants.RSA_PKCS1_PADDING,
            },
            Buffer.from(envKeyBase64, 'base64')
        );
    } catch (e) {
        throw new Error(`Decriptare RSA eșuată: ${e.message}`);
    }

    // 2. Decriptare Date XML (RC4)
    const encryptedDataBuffer = Buffer.from(encryptedDataHex, 'hex');
    const decryptedBuffer = rc4(rc4Key, encryptedDataBuffer);
    const xml = decryptedBuffer.toString('utf8');

    // 3. Extragere date
    const orderIdMatch = xml.match(/id="([^"]+)"/) || xml.match(/<order[^>]*id="([^"]+)"/);
    const actionMatch = xml.match(/<action>([^<]+)<\/action>/);
    const errorMatch = xml.match(/<error code="([^"]+)">/);
    const errorMessageMatch = xml.match(/<error[^>]*>([^<]+)<\/error>/);

    return {
        orderId: orderIdMatch ? orderIdMatch[1] : null,
        action: actionMatch ? actionMatch[1] : null,
        errorCode: errorMatch ? errorMatch[1] : "0",
        errorMessage: errorMessageMatch ? errorMessageMatch[1] : null,
        xml,
    };
}