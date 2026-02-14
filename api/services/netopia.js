import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// CONFIGURARE SANDBOX
const NETOPIA_CONFIG = {
  url: 'http://sandboxsecure.mobilpay.ro', // URL SANDBOX
  signature: (process.env.NETOPIA_SIGNATURE || '').trim(),
  publicKeyPath: path.join(process.cwd(), 'api', 'certs', 'public.cer'),
  privateKeyPath: path.join(process.cwd(), 'api', 'certs', 'private.key')
};

// --- ALGORITM RC4 MANUAL ---
function rc4Encrypt(keyBuffer, dataBuffer) {
    let S = [];
    for (let i = 0; i < 256; i++) S[i] = i;
    let j = 0;
    for (let i = 0; i < 256; i++) {
        j = (j + S[i] + keyBuffer[i % keyBuffer.length]) % 256;
        [S[i], S[j]] = [S[j], S[i]];
    }
    let i = 0; j = 0;
    let output = Buffer.alloc(dataBuffer.length);
    for (let k = 0; k < dataBuffer.length; k++) {
        i = (i + 1) % 256;
        j = (j + S[i]) % 256;
        [S[i], S[j]] = [S[j], S[i]];
        output[k] = dataBuffer[k] ^ S[(S[i] + S[j]) % 256];
    }
    return output;
}

// --- 1. EXPORT: CRIPTARE CERERE ---
export const encryptRequest = async (paymentData) => {
  try {
    const publicKeyPem = fs.readFileSync(NETOPIA_CONFIG.publicKeyPath, 'utf8');
    const xmlData = buildXml(paymentData);
    const rc4KeyBuffer = crypto.randomBytes(16);
    
    // Criptare date cu RC4
    const encryptedData = rc4Encrypt(rc4KeyBuffer, Buffer.from(xmlData, 'utf8'))
                          .toString('hex').toUpperCase();

    // Criptare cheie RC4 cu RSA
    const envKey = crypto.publicEncrypt(
        { key: publicKeyPem, padding: crypto.constants.RSA_PKCS1_PADDING },
        rc4KeyBuffer
    ).toString('base64');

    return { url: NETOPIA_CONFIG.url, env_key: envKey, data: encryptedData };
  } catch (error) {
    console.error("Netopia Encrypt Error:", error);
    throw error;
  }
};

// --- 2. EXPORT: DECRIPTARE RĂSPUNS (AICI ERA PROBLEMA TA) ---
export const decryptIPN = async (envKey, encryptedData) => {
    try {
        const privateKeyPem = fs.readFileSync(NETOPIA_CONFIG.privateKeyPath, 'utf8');

        // Decriptare cheie RC4
        const rc4KeyBuffer = crypto.privateDecrypt(
            { key: privateKeyPem, padding: crypto.constants.RSA_PKCS1_PADDING },
            Buffer.from(envKey, 'base64')
        );

        // Decriptare date
        const xmlContent = rc4Encrypt(rc4KeyBuffer, Buffer.from(encryptedData, 'hex'))
                           .toString('utf8');

        const orderIdMatch = xmlContent.match(/id="([^"]+)"/);
        const actionMatch = xmlContent.match(/<action>([^<]+)<\/action>/);
        const errorMatch = xmlContent.match(/<error code="([^"]+)">/);

        return {
            orderId: orderIdMatch ? orderIdMatch[1] : null,
            action: actionMatch ? actionMatch[1] : null,
            errorCode: errorMatch ? errorMatch[1] : null,
            xml: xmlContent
        };
    } catch (error) {
        console.error("Netopia Decrypt Error:", error);
        throw error;
    }
};

function buildXml(data) {
    const clean = (str) => String(str || '').replace(/[<>&'"]/g, '').trim();
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    return `<?xml version="1.0" encoding="utf-8"?>
<order type="card" id="${data.orderId}" timestamp="${dateStr}">
  <signature>${NETOPIA_CONFIG.signature}</signature>
  <url>
    <return>https://oclar.ro/#/success</return>
    <confirm>https://api.oclar.ro/api/netopia/confirm</confirm>
  </url>
  <invoice currency="RON" amount="${data.amount}">
    <details>Comanda #${data.orderId}</details>
    <contact_info>
      <billing type="person">
        <first_name>${clean(data.firstName)}</first_name>
        <last_name>${clean(data.lastName)}</last_name>
        <email>${clean(data.email)}</email>
        <address>${clean(data.address)}</address>
        <mobile_phone>${clean(data.phone)}</mobile_phone>
      </billing>
      <shipping type="person">
        <first_name>${clean(data.firstName)}</first_name>
        <last_name>${clean(data.lastName)}</last_name>
        <email>${clean(data.email)}</email>
        <address>${clean(data.address)}</address>
        <mobile_phone>${clean(data.phone)}</mobile_phone>
      </shipping>
    </contact_info>
  </invoice>
</order>`;
}