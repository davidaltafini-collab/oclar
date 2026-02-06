import forge from 'node-forge';
import fs from 'fs';
import path from 'path';

const NETOPIA_CONFIG = {
  // ⭐ SCHIMBARE CRITICĂ: Folosim HTTP pentru Sandbox ca să evităm redirect-urile care șterg datele POST
  url: 'http://sandboxsecure.mobilpay.ro',
  signature: (process.env.NETOPIA_SIGNATURE || '39IB-FQJV-WABH-2FHI-O4ZQ').trim(),
  publicKeyPath: path.join(process.cwd(), 'api', 'certs', 'public.cer'),
  privateKeyPath: path.join(process.cwd(), 'api', 'certs', 'private.key')
};

// --- Algoritm RC4 Manual (Buffer Safe) ---
function rc4Encrypt(keyBuffer, dataBuffer) {
    let S = [];
    for (let i = 0; i < 256; i++) S[i] = i;
    
    let j = 0;
    for (let i = 0; i < 256; i++) {
        j = (j + S[i] + keyBuffer[i % keyBuffer.length]) % 256;
        [S[i], S[j]] = [S[j], S[i]];
    }

    let i = 0; 
    j = 0;
    let output = Buffer.alloc(dataBuffer.length);

    for (let k = 0; k < dataBuffer.length; k++) {
        i = (i + 1) % 256;
        j = (j + S[i]) % 256;
        [S[i], S[j]] = [S[j], S[i]];
        output[k] = dataBuffer[k] ^ S[(S[i] + S[j]) % 256];
    }
    return output;
}

// --- 1. CRIPTARE CERERE ---
export const encryptRequest = async (paymentData) => {
  try {
    const publicKeyPem = fs.readFileSync(NETOPIA_CONFIG.publicKeyPath, 'utf8');
    let publicKey;
    try {
        const cert = forge.pki.certificateFromPem(publicKeyPem);
        publicKey = cert.publicKey;
    } catch (e) {
        publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
    }

    // Construim XML și Buffer
    const xmlData = buildXml(paymentData);
    const xmlBuffer = Buffer.from(xmlData, 'utf8');

    // Generăm cheia RC4
    const rc4KeyString = forge.random.getBytesSync(16);
    const rc4KeyBuffer = Buffer.from(rc4KeyString, 'binary');

    // Criptăm datele (RC4 Manual)
    const encryptedBuffer = rc4Encrypt(rc4KeyBuffer, xmlBuffer);
    const encryptedData = encryptedBuffer.toString('hex').toUpperCase();

    // Criptăm cheia RC4 (RSA PKCS1 v1.5 pentru Sandbox)
    const encryptedKey = publicKey.encrypt(rc4KeyString, 'RSAES-PKCS1-V1_5');
    const envKey = forge.util.encode64(encryptedKey);

    return {
      url: NETOPIA_CONFIG.url,
      env_key: envKey,
      data: encryptedData,
    };
  } catch (error) {
    console.error("Netopia Encrypt Error:", error);
    throw error;
  }
};

// --- 2. DECRIPTARE RĂSPUNS ---
export const decryptIPN = async (envKey, encryptedData) => {
    try {
        const privateKeyPem = fs.readFileSync(NETOPIA_CONFIG.privateKeyPath, 'utf8');
        const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);

        const rc4KeyString = privateKey.decrypt(forge.util.decode64(envKey), 'RSAES-PKCS1-V1_5');
        const rc4KeyBuffer = Buffer.from(rc4KeyString, 'binary');

        const encryptedBuffer = Buffer.from(encryptedData, 'hex');
        const decryptedBuffer = rc4Encrypt(rc4KeyBuffer, encryptedBuffer);
        const xmlContent = decryptedBuffer.toString('utf8');

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
    
    // Format dată Netopia
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    // ⭐ SCHIMBARE: Am adăugat id="${data.orderId}" în tag-ul <order>
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