import forge from 'node-forge';
import fs from 'fs';
import path from 'path';

// ⭐ HARDCODĂM SEMNĂTURA TEMPORAR PENTRU SIGURANȚĂ
// Verifică să fie exact cea din poză: 39IB-FQJV-WABH-2FHI-O4ZQ
const MY_SIGNATURE = process.env.NETOPIA_SIGNATURE || '39IB-FQJV-WABH-2FHI-O4ZQ';

const NETOPIA_CONFIG = {
  url: 'https://sandboxsecure.mobilpay.ro',
  signature: MY_SIGNATURE,
  publicKeyPath: path.join(process.cwd(), 'api', 'certs', 'public.cer'),
  privateKeyPath: path.join(process.cwd(), 'api', 'certs', 'private.key')
};

export const encryptRequest = async (paymentData) => {
  try {
    console.log(`[Netopia] Incepem criptarea pentru comanda #${paymentData.orderId}`);
    
    // 1. Citim Certificatul Public
    const publicKeyPem = fs.readFileSync(NETOPIA_CONFIG.publicKeyPath, 'utf8');
    let publicKey;
    try {
        const cert = forge.pki.certificateFromPem(publicKeyPem);
        publicKey = cert.publicKey;
    } catch (e) {
        publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
    }

    const xmlData = buildXml(paymentData);
    
    // 2. Generăm Cheia RC4 (16 bytes)
    const rc4Key = forge.random.getBytesSync(16);

    // 3. Criptăm XML-ul folosind RC4 (Pure JS - Fără eroare Node 20)
    // Folosim forge.rc4.create() care nu apelează OpenSSL
    const cipher = forge.rc4.create();
    cipher.start(rc4Key);
    cipher.update(forge.util.createBuffer(xmlData, 'utf8'));
    const encryptedData = cipher.output.toHex().toUpperCase();

    // 4. Criptăm cheia RC4 folosind RSA
    // CRITIC: Folosim padding-ul vechi pentru Sandbox
    const encryptedKey = publicKey.encrypt(rc4Key, 'RSAES-PKCS1-V1_5');
    const envKey = forge.util.encode64(encryptedKey);

    console.log(`[Netopia] Criptare reusita. Semnatura folosita: ${NETOPIA_CONFIG.signature}`);

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

        // Decriptăm cheia RSA
        const rc4Key = privateKey.decrypt(forge.util.decode64(envKey), 'RSAES-PKCS1-V1_5');

        // Decriptăm datele RC4
        const decipher = forge.rc4.create();
        decipher.start(rc4Key);
        decipher.update(forge.util.createBuffer(forge.util.hexToBytes(encryptedData)));
        const xmlContent = decipher.output.toString();

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
    // Curățare agresivă a datelor
    const clean = (str) => String(str || '').replace(/[<>&'"]/g, '').trim();
    
    // Formatarea datei
    const d = new Date();
    const dateStr = d.getFullYear() + '-' + 
                   String(d.getMonth() + 1).padStart(2, '0') + '-' + 
                   String(d.getDate()).padStart(2, '0') + ' ' + 
                   String(d.getHours()).padStart(2, '0') + ':' + 
                   String(d.getMinutes()).padStart(2, '0') + ':' + 
                   String(d.getSeconds()).padStart(2, '0');

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