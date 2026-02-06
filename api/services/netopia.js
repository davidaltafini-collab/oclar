import forge from 'node-forge';
import fs from 'fs';
import path from 'path';

const NETOPIA_CONFIG = {
  url: 'https://sandboxsecure.mobilpay.ro',
  // FOLOSIM .ENV (Sigur)
  signature: process.env.NETOPIA_SIGNATURE, 
  publicKeyPath: path.join(process.cwd(), 'api', 'certs', 'public.cer'),
  privateKeyPath: path.join(process.cwd(), 'api', 'certs', 'private.key')
};

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

    const xmlData = buildXml(paymentData);

    // 1. Criptare RC4 (Datele)
    const rc4Key = forge.random.getBytesSync(16);
    const cipher = forge.cipher.createCipher('RC4', rc4Key);
    cipher.start();
    cipher.update(forge.util.createBuffer(xmlData, 'utf8'));
    cipher.finish();
    const encryptedData = cipher.output.toHex().toUpperCase();

    // 2. Criptare Cheie RC4 (RSA)
    // ⭐ AICI E SCHIMBAREA CRITICĂ: Folosim 'RSAES-PKCS1-V1_5' (Standardul vechi pt Sandbox)
    // Înainte era 'RSA-OAEP' și de asta dădea fail, chiar dacă cheile erau bune.
    const encryptedKey = publicKey.encrypt(rc4Key, 'RSAES-PKCS1-V1_5');
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

export const decryptIPN = async (envKey, encryptedData) => {
    try {
        const privateKeyPem = fs.readFileSync(NETOPIA_CONFIG.privateKeyPath, 'utf8');
        const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);

        // La fel și la decriptare, folosim standardul vechi
        const rc4Key = privateKey.decrypt(forge.util.decode64(envKey), 'RSAES-PKCS1-V1_5');

        const decipher = forge.cipher.createDecipher('RC4', rc4Key);
        decipher.start();
        decipher.update(forge.util.createBuffer(forge.util.hexToBytes(encryptedData)));
        decipher.finish();
        
        const xmlContent = decipher.output.toString();

        // Extragem datele
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