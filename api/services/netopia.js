import forge from 'node-forge';
import fs from 'fs';
import path from 'path';

const NETOPIA_CONFIG = {
  url: 'https://sandboxsecure.mobilpay.ro',
  // Ne asigurăm că nu există spații goale în semnătură
  signature: (process.env.NETOPIA_SIGNATURE || '39IB-FQJV-WABH-2FHI-O4ZQ').trim(),
  publicKeyPath: path.join(process.cwd(), 'api', 'certs', 'public.cer'),
  privateKeyPath: path.join(process.cwd(), 'api', 'certs', 'private.key')
};

// --- Algoritm RC4 Manual (Compatibil 1:1 cu PHP SDK) ---
// Folosim asta ca sa evitam erorile Node 20 si sa avem control total pe bytes
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

// --- 1. CRIPTARE CERERE (SEND) ---
export const encryptRequest = async (paymentData) => {
  try {
    if (!NETOPIA_CONFIG.signature || NETOPIA_CONFIG.signature.length < 10) {
        throw new Error("Semnatura Netopia lipseste sau este invalida in .env");
    }

    // Citim cheia publică
    const publicKeyPem = fs.readFileSync(NETOPIA_CONFIG.publicKeyPath, 'utf8');
    let publicKey;
    try {
        const cert = forge.pki.certificateFromPem(publicKeyPem);
        publicKey = cert.publicKey;
    } catch (e) {
        publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
    }

    // Generăm XML-ul și îl transformăm în Buffer
    const xmlData = buildXml(paymentData);
    const xmlBuffer = Buffer.from(xmlData, 'utf8');

    // Generăm cheia RC4 (16 bytes)
    const rc4KeyString = forge.random.getBytesSync(16);
    const rc4KeyBuffer = Buffer.from(rc4KeyString, 'binary');

    // Criptăm datele (RC4 Manual) -> Rezultat HEX Uppercase
    const encryptedBuffer = rc4Encrypt(rc4KeyBuffer, xmlBuffer);
    const encryptedData = encryptedBuffer.toString('hex').toUpperCase();

    // Criptăm cheia RC4 (RSA cu padding vechi pentru Sandbox)
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

// --- 2. DECRIPTARE RASPUNS (CONFIRM) ---
export const decryptIPN = async (envKey, encryptedData) => {
    try {
        const privateKeyPem = fs.readFileSync(NETOPIA_CONFIG.privateKeyPath, 'utf8');
        const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);

        // Decriptăm cheia RSA (RC4 Key)
        // Atentie: Netopia trimite cheia tot base64, trebuie decodata inainte de decrypt
        const rc4KeyString = privateKey.decrypt(forge.util.decode64(envKey), 'RSAES-PKCS1-V1_5');
        const rc4KeyBuffer = Buffer.from(rc4KeyString, 'binary');

        // Decriptăm datele (RC4 Manual)
        // Convertim string-ul HEX primit inapoi in Buffer
        const encryptedBuffer = Buffer.from(encryptedData, 'hex');
        
        // RC4 este simetric: aceeasi functie cripteaza si decripteaza
        const decryptedBuffer = rc4Encrypt(rc4KeyBuffer, encryptedBuffer);
        
        const xmlContent = decryptedBuffer.toString('utf8');

        // Parsare simpla Regex
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
    // Format dată Netopia: YYYY-MM-DD HH:MM:SS
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    return `<?xml version="1.0" encoding="utf-8"?>
<order type="card" timestamp="${dateStr}">
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