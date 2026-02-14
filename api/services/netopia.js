import fs from "fs";
import path from "path";
import forge from "node-forge";

// Căile către fișiere
const CERTS_DIR = path.join(process.cwd(), "api", "certs");
const PUBLIC_CERT_PATH = path.join(CERTS_DIR, "public.cer");
const PRIVATE_KEY_PATH = path.join(CERTS_DIR, "private.key");

// Configurația Netopia
const NETOPIA_CONFIG = {
    // URL Sandbox (folosim HTTP pentru a evita erori SSL locale la redirect)
    gatewayUrl: "http://sandboxsecure.mobilpay.ro",
    // URL-urile tale
    returnUrl: "https://oclar.ro/#/success",
    confirmUrl: "https://api.oclar.ro/api/netopia/confirm",
};

/**
 * 1. Helper pentru a citi cheia publică (Netopia)
 * Folosește node-forge pentru a fi compatibil cu orice format (PEM sau DER/Binar)
 */
function getNetopiaPublicKey() {
    if (!fs.existsSync(PUBLIC_CERT_PATH)) {
        throw new Error(`[Netopia] Nu găsesc public.cer la: ${PUBLIC_CERT_PATH}`);
    }

    const certContent = fs.readFileSync(PUBLIC_CERT_PATH);

    try {
        // Încercăm PEM
        const pem = certContent.toString('utf8');
        if (pem.includes('-----BEGIN CERTIFICATE-----')) {
            const cert = forge.pki.certificateFromPem(pem);
            return cert.publicKey;
        }
    } catch (e) {}

    try {
        // Încercăm DER (Binar) - formatul standard Netopia
        const der = forge.util.createBuffer(certContent);
        const cert = forge.pki.certificateFromAsn1(forge.asn1.fromDer(der));
        return cert.publicKey;
    } catch (e) {
        throw new Error(`[Netopia] Certificatul public.cer nu este valid (nici PEM, nici DER).`);
    }
}

/**
 * 2. Helper pentru cheia privată (a ta)
 */
function getMerchantPrivateKey() {
    if (!fs.existsSync(PRIVATE_KEY_PATH)) {
        throw new Error(`[Netopia] Nu găsesc private.key la: ${PRIVATE_KEY_PATH}`);
    }
    const keyContent = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');
    return forge.pki.privateKeyFromPem(keyContent);
}

/**
 * 3. Algoritmul RC4 compatibil cu Buffer (UTF-8 Safe)
 * Asta rezolvă problema cu "Brașov" / diacritice.
 */
function rc4(key, data) {
    // key și data trebuie să fie Buffers
    const S = [];
    for(let i=0; i<256; i++) S[i] = i;
    
    let j = 0;
    for(let i=0; i<256; i++) {
        j = (j + S[i] + key[i % key.length]) % 256;
        [S[i], S[j]] = [S[j], S[i]];
    }
    
    let i = 0;
    j = 0;
    const output = Buffer.alloc(data.length);
    
    for(let k=0; k<data.length; k++) {
        i = (i + 1) % 256;
        j = (j + S[i]) % 256;
        [S[i], S[j]] = [S[j], S[i]];
        output[k] = data[k] ^ S[(S[i] + S[j]) % 256];
    }
    return output;
}

// Helpers XML
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
    const xmlStr = `<?xml version="1.0" encoding="utf-8"?>
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

    // IMPORTANT: Convertim string-ul XML în Buffer UTF-8 înainte de criptare
    // Asta asigură că diacriticele sunt codate corect în octeți
    const xmlBuffer = Buffer.from(xmlStr, 'utf8');

    // 1. Generăm cheia RC4 (16 bytes)
    const rc4KeyHex = forge.random.getBytesSync(16);
    const rc4KeyBuffer = Buffer.from(rc4KeyHex, 'binary');

    // 2. Criptăm datele cu RC4 (Buffer -> Buffer)
    const encryptedDataBuffer = rc4(rc4KeyBuffer, xmlBuffer);
    const encryptedDataHex = encryptedDataBuffer.toString('hex').toUpperCase();

    // 3. Criptăm cheia RC4 cu RSA (folosind node-forge pentru certificat)
    const publicKey = getNetopiaPublicKey();
    const encryptedKey = publicKey.encrypt(rc4KeyHex, 'RSAES-PKCS1-V1_5');
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

    // 1. Decriptăm cheia RC4 cu RSA
    let rc4KeyBinary;
    try {
        const encryptedKey = forge.util.decode64(envKeyBase64);
        rc4KeyBinary = privateKey.decrypt(encryptedKey, 'RSAES-PKCS1-V1_5');
    } catch (e) {
        throw new Error("Decriptare RSA eșuată. Verifică private.key.");
    }
    
    // Convertim cheia RC4 în Buffer
    const rc4KeyBuffer = Buffer.from(rc4KeyBinary, 'binary');

    // 2. Decriptăm datele (Hex -> Buffer -> Decrypt -> Utf8 String)
    const encryptedDataBuffer = Buffer.from(encryptedDataHex, 'hex');
    const decryptedBuffer = rc4(rc4KeyBuffer, encryptedDataBuffer);
    
    // Convertim înapoi în string UTF-8
    const xml = decryptedBuffer.toString('utf8');

    // 3. Parsare simplă XML
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