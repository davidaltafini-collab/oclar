import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const NETOPIA_CONFIG = {
  url: 'https://sandboxsecure.mobilpay.ro', // URL-ul de LIVE
  signature: (process.env.NETOPIA_SIGNATURE || '').trim(),
  // Atenție: Asigură-te că numele fișierului de pe disk corespunde cu ce e aici (.cer vs .key)
  publicKeyPath: path.join(process.cwd(), 'api', 'certs', 'public.cer'),
  privateKeyPath: path.join(process.cwd(), 'api', 'certs', 'private.key')
};

/**
 * Algoritm RC4 Manual (Buffer Safe)
 * Îl păstrăm pe acesta manual pentru că OpenSSL 3+ din Node a scos suportul nativ RC4,
 * dar Netopia încă îl cere.
 */
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
    if (!NETOPIA_CONFIG.signature) {
        throw new Error("Semnatura Netopia lipseste din .env");
    }

    // 1. Citim cheia publică
    // IMPORTANT: Node crypto vrea PEM-ul exact așa cum e
    const publicKeyPem = fs.readFileSync(NETOPIA_CONFIG.publicKeyPath, 'utf8');

    // 2. Generăm XML-ul
    const xmlData = buildXml(paymentData);
    const xmlBuffer = Buffer.from(xmlData, 'utf8');

    // 3. Generăm cheia RC4 (16 bytes random)
    const rc4KeyBuffer = crypto.randomBytes(16);

    // 4. Criptăm Datele (XML) cu RC4 -> Rezultat HEX Uppercase
    const encryptedDataBuffer = rc4Encrypt(rc4KeyBuffer, xmlBuffer);
    const encryptedData = encryptedDataBuffer.toString('hex').toUpperCase();

    // 5. Criptăm Cheia RC4 folosind RSA și cheia PUBLICĂ (pt ca Netopia să o deschidă cu privata lor)
    // Folosim padding-ul standard PKCS1 pe care îl așteaptă Netopia
    const encryptedKeyBuffer = crypto.publicEncrypt(
        {
            key: publicKeyPem,
            padding: crypto.constants.RSA_PKCS1_PADDING,
        },
        rc4KeyBuffer
    );

    // Rezultatul cheii criptate trebuie să fie Base64
    const envKey = encryptedKeyBuffer.toString('base64');

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

// --- 2. DECRIPTARE RĂSPUNS (CONFIRM) ---
export const decryptIPN = async (envKey, encryptedData) => {
    try {
        const privateKeyPem = fs.readFileSync(NETOPIA_CONFIG.privateKeyPath, 'utf8');

        // 1. Decriptăm env_key (care conține cheia RC4) folosind cheia PRIVATĂ
        const rc4KeyBuffer = crypto.privateDecrypt(
            {
                key: privateKeyPem,
                padding: crypto.constants.RSA_PKCS1_PADDING,
            },
            Buffer.from(envKey, 'base64')
        );

        // 2. Decriptăm datele (care sunt HEX) folosind cheia RC4 recuperată
        const encryptedBuffer = Buffer.from(encryptedData, 'hex');
        const decryptedBuffer = rc4Encrypt(rc4KeyBuffer, encryptedBuffer);
        
        const xmlContent = decryptedBuffer.toString('utf8');

        // Parsare simplă Regex
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
        throw error; // Aruncăm eroarea ca să trimitem XML de eroare în index.js
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