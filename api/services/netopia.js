import forge from 'node-forge';
import fs from 'fs';
import path from 'path';

const NETOPIA_CONFIG = {
  url: 'http://sandboxsecure.mobilpay.ro', // Sandbox
  signature: process.env.NETOPIA_SIGNATURE || 'AAAA-BBBB-CCCC-DDDD-EEEE', 
  publicKeyPath: path.join(process.cwd(), 'api', 'certs', 'public.cer'),
  privateKeyPath: path.join(process.cwd(), 'api', 'certs', 'private.key')
};

// 1. INITIERE PLATA (CRIPTARE)
export const encryptRequest = async (paymentData) => {
  try {
    const publicKeyPem = fs.readFileSync(NETOPIA_CONFIG.publicKeyPath, 'utf8');
    const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);

    const xmlData = buildXml(paymentData);
    const rc4Key = forge.random.getBytesSync(16);
    
    const cipher = forge.cipher.createCipher('RC4', rc4Key);
    cipher.start();
    cipher.update(forge.util.createBuffer(xmlData, 'utf8'));
    cipher.finish();
    const encryptedData = cipher.output.toHex().toUpperCase();

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

// 2. CONFIRMARE PLATA (DECRIPTARE IPN)
export const decryptIPN = async (env_key, data) => {
  try {
    // Citim cheia privata
    const privateKeyPem = fs.readFileSync(NETOPIA_CONFIG.privateKeyPath, 'utf8');
    const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);

    // 1. Decriptam cheia RC4 folosind cheia privata RSA
    const decodedEnvKey = forge.util.decode64(env_key);
    const rc4Key = privateKey.decrypt(decodedEnvKey, 'RSA-OAEP');

    // 2. Decriptam datele folosind cheia RC4
    const decipher = forge.cipher.createDecipher('RC4', rc4Key);
    decipher.start();
    decipher.update(forge.util.createBuffer(forge.util.hexToBytes(data)));
    decipher.finish();
    
    const xmlContent = decipher.output.toString();

    // 3. Extragem datele simple din XML (RegEx rapid)
    // In productie se recomanda un XML Parser (ex: xml2js), dar RegEx merge pt structura fixa
    const actionMatch = xmlContent.match(/action="([^"]+)"/);
    const errorMatch = xmlContent.match(/<error code="([^"]+)">/);
    const orderIdMatch = xmlContent.match(/id="([^"]+)"/);

    return {
      action: actionMatch ? actionMatch[1] : 'unknown', // 'confirmed' e ce cautam
      errorCode: errorMatch ? errorMatch[1] : '1',
      orderId: orderIdMatch ? orderIdMatch[1] : null,
      originalXml: xmlContent
    };

  } catch (error) {
    console.error("Netopia Decrypt Error:", error);
    throw error;
  }
};

function buildXml(data) {
  const timestamp = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
  // URL-urile trebuie sa fie publice si accesibile de pe internet!
  // Pentru localhost nu va merge confirmarea decat cu ngrok.
  const siteUrl = process.env.FRONTEND_URL || 'https://oclar.ro'; 
  
  return `
<?xml version="1.0" encoding="utf-8"?>
<order type="card" timestamp="${timestamp}">
  <signature>${NETOPIA_CONFIG.signature}</signature>
  <invoice currency="RON" amount="${data.amount}">
    <details><![CDATA[Comanda Oclar #${data.orderId}]]></details>
    <contact_info>
      <billing type="person">
        <first_name><![CDATA[${data.firstName}]]></first_name>
        <last_name><![CDATA[${data.lastName}]]></last_name>
        <email><![CDATA[${data.email}]]></email>
        <address><![CDATA[${data.address}]]></address>
        <mobile_phone><![CDATA[${data.phone}]]></mobile_phone>
      </billing>
    </contact_info>
  </invoice>
  <url>
    <confirm>${siteUrl}/api/netopia/confirm</confirm>
    <return>${siteUrl}/#/success</return>
  </url>
</order>`.trim();
}