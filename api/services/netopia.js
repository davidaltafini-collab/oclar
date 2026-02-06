import forge from 'node-forge';
import fs from 'fs';
import path from 'path';

// Configurare
const NETOPIA_CONFIG = {
  url: 'https://sandboxsecure.mobilpay.ro',
  signature: process.env.NETOPIA_SIGNATURE || '39IB-FQJV-WABH-2FHI-O4ZQ', 
  publicKeyPath: path.join(process.cwd(), 'api', 'certs', 'public.cer'),
  privateKeyPath: path.join(process.cwd(), 'api', 'certs', 'private.key')
};

// --- ALGORITM RC4 MANUAL (Pe baza de Buffer - Sigur 100%) ---
function rc4Encrypt(keyBuffer, dataBuffer) {
    let S = [];
    for (let i = 0; i < 256; i++) S[i] = i;
    
    let j = 0;
    for (let i = 0; i < 256; i++) {
        j = (j + S[i] + keyBuffer[i % keyBuffer.length]) % 256;
        [S[i], S[j]] = [S[j], S[i]]; // Swap
    }

    let i = 0; 
    j = 0;
    let output = Buffer.alloc(dataBuffer.length);

    for (let k = 0; k < dataBuffer.length; k++) {
        i = (i + 1) % 256;
        j = (j + S[i]) % 256;
        [S[i], S[j]] = [S[j], S[i]]; // Swap
        output[k] = dataBuffer[k] ^ S[(S[i] + S[j]) % 256];
    }
    return output;
}
// -----------------------------------------------------------

export const encryptRequest = async (paymentData) => {
  try {
    console.log(`[Netopia] Start criptare comanda #${paymentData.orderId}`);

    // 1. Citim Certificatul Public
    const publicKeyPem = fs.readFileSync(NETOPIA_CONFIG.publicKeyPath, 'utf8');
    let publicKey;
    try {
        const cert = forge.pki.certificateFromPem(publicKeyPem);
        publicKey = cert.publicKey;
    } catch (e) {
        publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
    }

    // 2. Pregătim datele
    const xmlData = buildXml(paymentData);
    const xmlBuffer = Buffer.from(xmlData, 'utf8'); // Convertim XML in Buffer

    // 3. Generăm Cheia RC4 (16 bytes)
    const rc4KeyString = forge.random.getBytesSync(16);
    const rc4KeyBuffer = Buffer.from(rc4KeyString, 'binary');

    // 4. Criptăm XML cu algoritmul nostru manual
    // Rezultatul este un Buffer, pe care îl facem HEX UPPERCASE imediat
    const encryptedBuffer = rc4Encrypt(rc4KeyBuffer, xmlBuffer);
    const encryptedData = encryptedBuffer.toString('hex').toUpperCase();

    // 5. Criptăm cheia RC4 cu RSA (folosind Forge și padding vechi)
    // Forge vrea string "binary", nu Buffer, deci folosim rc4KeyString
    const encryptedKey = publicKey.encrypt(rc4KeyString, 'RSAES-PKCS1-V1_5');
    const envKey = forge.util.encode64(encryptedKey);

    console.log(`[Netopia] Criptare Gata. Lungime date: ${encryptedData.length}`);

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

export const decryptIPN = async (envKey, encryptedData) => {
    try {
        const privateKeyPem = fs.readFileSync(NETOPIA_CONFIG.privateKeyPath, 'utf8');
        const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);

        // Decriptăm cheia RC4 (RSA)
        const rc4KeyString = privateKey.decrypt(forge.util.decode64(envKey), 'RSAES-PKCS1-V1_5');
        const rc4KeyBuffer = Buffer.from(rc4KeyString, 'binary');

        // Decriptăm datele (RC4)
        // Convertim inputul din Hex în Buffer
        const encryptedBuffer = Buffer.from(encryptedData, 'hex');
        const decryptedBuffer = rc4Encrypt(rc4KeyBuffer, encryptedBuffer); // RC4 e simetric, aceeasi functie
        
        const xmlContent = decryptedBuffer.toString('utf8');

        // Parsare simpla
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
    // Format simplu de dată YYYY-MM-DD HH:MM:SS
    const now = new Date();
    const dateStr = now.toISOString().replace(/T/, ' ').replace(/\..+/, '');

    return `<?xml version="1.0" encoding="utf-8"?>
<order type="card" timestamp="${dateStr}">
  <signature>${NETOPIA_CONFIG.signature}</signature>
  <url>
    <return>https://oclar.ro/#/success</return>
    <confirm>https://api.oclar.ro/api/netopia/confirm</confirm>
  </url>
  <invoice currency="RON" amount="${data.amount}">
    <details>Comanda Oclar #${data.orderId}</details>
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