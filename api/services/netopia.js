import forge from 'node-forge';
import fs from 'fs';
import path from 'path';

const NETOPIA_CONFIG = {
  url: 'http://sandboxsecure.mobilpay.ro', // Sandbox
  signature: process.env.NETOPIA_SIGNATURE, 
  publicKeyPath: path.join(process.cwd(), 'api', 'certs', 'public.cer'),
  privateKeyPath: path.join(process.cwd(), 'api', 'certs', 'private.key')
};

// --- ALGORITM RC4 PUR (JavaScript) ---
// Îl scriem manual ca să nu depindem de mofturile Node.js
function rc4(key, str) {
	var s = [], j = 0, x, res = '';
	for (var i = 0; i < 256; i++) { s[i] = i; }
	for (i = 0; i < 256; i++) {
		j = (j + s[i] + key.charCodeAt(i % key.length)) % 256;
		x = s[i]; s[i] = s[j]; s[j] = x;
	}
	i = 0; j = 0;
	for (var y = 0; y < str.length; y++) {
		i = (i + 1) % 256;
		j = (j + s[i]) % 256;
		x = s[i]; s[i] = s[j]; s[j] = x;
		res += String.fromCharCode(str.charCodeAt(y) ^ s[(s[i] + s[j]) % 256]);
	}
	return res;
}

function stringToHex(str) {
    let hex = '';
    for(let i=0;i<str.length;i++) {
        hex += ''+str.charCodeAt(i).toString(16).padStart(2, '0');
    }
    return hex.toUpperCase();
}

function hexToString(hex) {
    let str = '';
    for (let i = 0; i < hex.length; i += 2) {
        str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    }
    return str;
}

// --- 1. INITIERE PLATA ---
export const encryptRequest = async (paymentData) => {
  try {
    // Citim certificatul
    const publicKeyPem = fs.readFileSync(NETOPIA_CONFIG.publicKeyPath, 'utf8');
    let publicKey;
    try {
        const cert = forge.pki.certificateFromPem(publicKeyPem);
        publicKey = cert.publicKey;
    } catch (e) {
        publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
    }

    const xmlData = buildXml(paymentData);

    // Generam cheia RC4 aleatorie
    const rc4Key = forge.random.getBytesSync(16);
    
    // CRIPTARE CU FUNCTIA NOASTRA MANUALĂ (Nu dă erori de sistem)
    const encryptedRaw = rc4(rc4Key, xmlData);
    const encryptedData = stringToHex(encryptedRaw);

    // Criptam cheia RC4 cu RSA (Asta merge bine cu Forge)
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

// --- 2. DECRIPTARE RĂSPUNS ---
export const decryptIPN = async (envKey, encryptedData) => {
    try {
        const privateKeyPem = fs.readFileSync(NETOPIA_CONFIG.privateKeyPath, 'utf8');
        const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);

        // Decriptăm cheia RC4
        const rc4Key = privateKey.decrypt(forge.util.decode64(envKey), 'RSA-OAEP');

        // Decriptăm datele cu funcția manuală
        const encryptedStr = hexToString(encryptedData);
        const xmlContent = rc4(rc4Key, encryptedStr);

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
    const clean = (str) => String(str || '').replace(/[<>&'"]/g, '');
    
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