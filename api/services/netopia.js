import forge from 'node-forge';
import fs from 'fs';
import path from 'path';

const NETOPIA_CONFIG = {
  // ⭐ SCHIMBAT PENTRU LIVE (Productie)
  url: 'https://secure.mobilpay.ro', 
  // Semnatura se ia din .env, sau poti pune string-ul direct aici daca vrei
  signature: process.env.NETOPIA_SIGNATURE, 
  publicKeyPath: path.join(process.cwd(), 'api', 'certs', 'public.cer'),
  privateKeyPath: path.join(process.cwd(), 'api', 'certs', 'private.key')
};

// --- 1. INITIERE PLATA (CRIPTARE) ---
export const encryptRequest = async (paymentData) => {
  try {
    const publicKeyPem = fs.readFileSync(NETOPIA_CONFIG.publicKeyPath, 'utf8');
    
    // ⭐ AICI ESTE FIX-UL PENTRU EROAREA "PEM header type"
    let publicKey;
    try {
        // Încercăm să citim ca un certificat (formatul standard Netopia)
        const cert = forge.pki.certificateFromPem(publicKeyPem);
        publicKey = cert.publicKey;
    } catch (e) {
        // Fallback: Dacă e formatul vechi (doar cheie publică)
        publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
    }

    const xmlData = buildXml(paymentData);

    // Criptare RC4 (Datele)
    const rc4Key = forge.random.getBytesSync(16);
    const cipher = forge.cipher.createCipher('RC4', rc4Key);
    cipher.start();
    cipher.update(forge.util.createBuffer(xmlData, 'utf8'));
    cipher.finish();
    const encryptedData = cipher.output.toHex().toUpperCase();

    // Criptare RSA (Cheia RC4)
    const encryptedKey = publicKey.encrypt(rc4Key, 'RSA-OAEP');
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

// --- 2. DECRIPTARE RĂSPUNS (IPN) ---
export const decryptIPN = async (envKey, encryptedData) => {
    try {
        const privateKeyPem = fs.readFileSync(NETOPIA_CONFIG.privateKeyPath, 'utf8');
        const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);

        // Decriptăm cheia RC4 folosind RSA
        const rc4Key = privateKey.decrypt(forge.util.decode64(envKey), 'RSA-OAEP');

        // Decriptăm datele folosind RC4
        const decipher = forge.cipher.createDecipher('RC4', rc4Key);
        decipher.start();
        decipher.update(forge.util.createBuffer(forge.util.hexToBytes(encryptedData)));
        decipher.finish();
        
        const xmlContent = decipher.output.toString();

        // Extragem datele simplu (fără parser XML greoi)
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

// --- 3. CONSTRUIRE XML ---
function buildXml(data) {
    const today = new Date();
    const startDate = today.toISOString().split('T')[0] + ' ' + today.toTimeString().split(' ')[0];
    // Data de expirare (ex: +10 minute)
    const expireDateObj = new Date(today.getTime() + 10 * 60000); 
    const expireDate = expireDateObj.toISOString().split('T')[0] + ' ' + expireDateObj.toTimeString().split(' ')[0];

    return `<?xml version="1.0" encoding="utf-8"?>
<order type="card" timestamp="${Date.now()}">
  <signature>${NETOPIA_CONFIG.signature}</signature>
  <url>
    <return>https://oclar.ro/#/success</return>
    <confirm>https://api.oclar.ro/api/netopia/confirm</confirm>
  </url>
  <invoice currency="RON" amount="${data.amount}">
    <details>Comanda Oclar #${data.orderId}</details>
    <contact_info>
      <billing type="person">
        <first_name>${data.firstName}</first_name>
        <last_name>${data.lastName}</last_name>
        <email>${data.email}</email>
        <address>${data.address}</address>
        <mobile_phone>${data.phone}</mobile_phone>
      </billing>
      <shipping type="person">
        <first_name>${data.firstName}</first_name>
        <last_name>${data.lastName}</last_name>
        <email>${data.email}</email>
        <address>${data.address}</address>
        <mobile_phone>${data.phone}</mobile_phone>
      </shipping>
    </contact_info>
  </invoice>
</order>`;
}