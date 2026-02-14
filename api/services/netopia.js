import fs from "fs";
import path from "path";
import forge from "node-forge";

// Căile către fișiere
const CERTS_DIR = path.join(process.cwd(), "api", "certs");
const PUBLIC_CERT_PATH = path.join(CERTS_DIR, "public.cer");
const PRIVATE_KEY_PATH = path.join(CERTS_DIR, "private.key");

// Configurația Netopia
const NETOPIA_CONFIG = {
    // URL Sandbox (HTTP pentru a evita erori SSL locale)
    gatewayUrl: "http://sandboxsecure.mobilpay.ro",
    // Link-urile tale
    returnUrl: "https://oclar.ro/#/success",
    confirmUrl: "https://api.oclar.ro/api/netopia/confirm",
};

/**
 * Helper pentru a citi și procesa cheia publică
 * Indiferent dacă e PEM sau DER (Binar)
 */
function getNetopiaPublicKey() {
    if (!fs.existsSync(PUBLIC_CERT_PATH)) {
        throw new Error(`[Netopia] Nu găsesc public.cer la: ${PUBLIC_CERT_PATH}`);
    }

    const certContent = fs.readFileSync(PUBLIC_CERT_PATH); // Citim ca Buffer (binar)

    try {
        // Încercăm să citim ca PEM (text)
        const pem = certContent.toString('utf8');
        if (pem.includes('-----BEGIN CERTIFICATE-----')) {
            const cert = forge.pki.certificateFromPem(pem);
            return cert.publicKey;
        }
    } catch (e) {
        // Ignorăm eroarea și încercăm DER
    }

    try {
        // Încercăm să citim ca DER (binar)
        const der = forge.util.createBuffer(certContent);
        const cert = forge.pki.certificateFromAsn1(forge.asn1.fromDer(der));
        return cert.publicKey;
    } catch (e) {
        throw new Error(`[Netopia] Format certificat invalid în public.cer. Trebuie să fie PEM sau DER valid.`);
    }
}

/**
 * Helper pentru cheia privată (pentru decriptare IPN)
 */
function getMerchantPrivateKey() {
    if (!fs.existsSync(PRIVATE_KEY_PATH)) {
        throw new Error(`[Netopia] Nu găsesc private.key la: ${PRIVATE_KEY_PATH}`);
    }
    const keyContent = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');
    return forge.pki.privateKeyFromPem(keyContent);
}

/**
 * Algoritmul RC4 (custom implementation pentru compatibilitate)
 */
function rc4(keyStr, dataStr) {
    const s = [];
    for (let i = 0; i < 256; i++) s[i] = i;
    let j = 0;
    let x;
    for (let i = 0; i < 256; i++) {
        j = (j + s[i] + keyStr.charCodeAt(i % keyStr.length)) % 256;
        x = s[i];
        s[i] = s[j];
        s[j] = x;
    }
    let i = 0;
    j = 0;
    let res = '';
    for (let y = 0; y < dataStr.length; y++) {
        i = (i + 1) % 256;
        j = (j + s[i]) % 256;
        x = s[i];
        s[i] = s[j];
        s[j] = x;
        res += String.fromCharCode(dataStr.charCodeAt(y) ^ s[(s[i] + s[j]) % 256]);
    }
    return res;
}

/**
 * Convert String to Hex Uppercase
 */
function strToHex(str) {
    let hex = '';
    for (let i = 0; i < str.length; i++) {
        hex += '' + str.charCodeAt(i).toString(16).padStart(2, '0');
    }
    return hex.toUpperCase();
}

function hexToStr(hex) {
    let str = '';
    for (let i = 0; i < hex.length; i += 2) {
        str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    }
    return str;
}

// XML Helpers
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

// ------------------ ENCRYPT REQUEST (Start Plată) ------------------
export function encryptRequest(paymentData) {
    const signature = String(process.env.NETOPIA_SIGNATURE || "").trim();
    if (!signature) throw new Error("NETOPIA_SIGNATURE lipsește din .env");

    const ts = formatTimestamp();
    const orderId = cleanXml(paymentData.orderId);
    const amount = Number(paymentData.amount).toFixed(2);
    
    // Construim XML-ul
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<order type="card" id="${orderId}" timestamp="${ts}">
  <signature>${signature}</signature>
  <url>
    <return>${NETOPIA_CONFIG.returnUrl}</return>
    <confirm>${NETOPIA_CONFIG.confirmUrl}</confirm>
  </url>
  <invoice currency="RON" amount="${amount}">
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

    // 1. Generăm cheia RC4 aleatorie
    const rc4Key = forge.random.getBytesSync(16);

    // 2. Criptăm XML-ul cu RC4
    const encryptedData = rc4(rc4Key, xml);
    const encryptedDataHex = strToHex(encryptedData);

    // 3. Criptăm cheia RC4 cu cheia Publică Netopia (RSA)
    const publicKey = getNetopiaPublicKey();
    const encryptedKey = publicKey.encrypt(rc4Key, 'RSAES-PKCS1-V1_5');
    const envKeyBase64 = forge.util.encode64(encryptedKey);

    return {
        gatewayUrl: NETOPIA_CONFIG.gatewayUrl,
        env_key: envKeyBase64,
        data: encryptedDataHex
    };
}

// ------------------ DECRYPT IPN (Confirmare Plată) ------------------
export function decryptIPN(envKeyBase64, encryptedDataHex) {
    const privateKey = getMerchantPrivateKey();

    // 1. Decriptăm cheia RC4 folosind cheia privată
    let rc4Key;
    try {
        const encryptedKey = forge.util.decode64(envKeyBase64);
        rc4Key = privateKey.decrypt(encryptedKey, 'RSAES-PKCS1-V1_5');
    } catch (e) {
        throw new Error("Decriptare RSA eșuată. Verifică private.key.");
    }

    // 2. Decriptăm Datele XML folosind RC4
    const encryptedData = hexToStr(encryptedDataHex);
    const xml = rc4(rc4Key, encryptedData);

    // 3. Extragem datele
    const orderIdMatch = xml.match(/id="([^"]+)"/);
    const actionMatch = xml.match(/<action>([^<]+)<\/action>/);
    const errorMatch = xml.match(/<error code="([^"]+)">/);
    const errorMessageMatch = xml.match(/<error[^>]*>([^<]+)<\/error>/);

    return {
        orderId: orderIdMatch ? orderIdMatch[1] : null,
        action: actionMatch ? actionMatch[1] : null,
        errorCode: errorMatch ? errorMatch[1] : "0",
        errorMessage: errorMessageMatch ? errorMessageMatch[1] : null,
        xml
    };
}