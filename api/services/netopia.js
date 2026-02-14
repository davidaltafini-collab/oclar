import fs from "fs";
import path from "path";
import forge from "node-forge";

// ==========================================
// CONFIGURARE CĂI & URL
// ==========================================
const CERTS_DIR = path.join(process.cwd(), "api", "certs");
const PUBLIC_CERT_PATH = path.join(CERTS_DIR, "public.cer");
const PRIVATE_KEY_PATH = path.join(CERTS_DIR, "private.key");

const NETOPIA_CONFIG = {
    gatewayUrl: "http://sandboxsecure.mobilpay.ro",
    returnUrl: "https://oclar.ro/#/success",
    confirmUrl: "https://api.oclar.ro/api/netopia/confirm",
};

// ==========================================
// LOGGER DIAGNOSTIC
// ==========================================
function logDiag(step, message, data = null) {
    console.log(`\n[NETOPIA-DIAG] [${step}] ------------------------------------------------`);
    console.log(`>> ${message}`);
    if (data) {
        if (typeof data === 'object' && !Buffer.isBuffer(data)) {
            console.log(JSON.stringify(data, null, 2));
        } else {
            console.log(data);
        }
    }
    console.log(`------------------------------------------------------------------------\n`);
}

// ==========================================
// 1. ÎNCĂRCARE CERTIFICATE CU LOGGING
// ==========================================
function getNetopiaPublicKey() {
    logDiag("CERT-PUB", `Citesc Public Key din: ${PUBLIC_CERT_PATH}`);
    
    if (!fs.existsSync(PUBLIC_CERT_PATH)) {
        logDiag("CERT-PUB-ERR", "Fișierul nu există!");
        throw new Error(`[Netopia] Nu găsesc public.cer`);
    }

    const certContent = fs.readFileSync(PUBLIC_CERT_PATH);
    logDiag("CERT-PUB", `Mărime fișier: ${certContent.length} bytes`);
    logDiag("CERT-PUB", `Hex (primii 20 bytes): ${certContent.subarray(0, 20).toString('hex')}`);

    try {
        // Încercăm PEM
        const pem = certContent.toString('utf8');
        if (pem.includes('-----BEGIN CERTIFICATE-----')) {
            logDiag("CERT-PUB", "Detectat format PEM (Text)");
            const cert = forge.pki.certificateFromPem(pem);
            return cert.publicKey;
        }
    } catch (e) { logDiag("CERT-PUB", "Nu e PEM valid, încerc DER..."); }

    try {
        // Încercăm DER
        const der = forge.util.createBuffer(certContent);
        const cert = forge.pki.certificateFromAsn1(forge.asn1.fromDer(der));
        logDiag("CERT-PUB", "Detectat format DER (Binar) - OK");
        return cert.publicKey;
    } catch (e) {
        logDiag("CERT-PUB-ERR", "Eșec parsare certificat! Nu e nici PEM, nici DER valid.");
        throw new Error(`[Netopia] Certificat public invalid.`);
    }
}

function getMerchantPrivateKey() {
    logDiag("KEY-PRIV", `Citesc Private Key din: ${PRIVATE_KEY_PATH}`);
    
    if (!fs.existsSync(PRIVATE_KEY_PATH)) {
        throw new Error(`[Netopia] Nu găsesc private.key`);
    }
    const keyContent = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');
    // Verificare sumară
    if(!keyContent.includes('PRIVATE KEY')) {
        logDiag("KEY-PRIV-ERR", "Fișierul private.key nu pare să conțină o cheie RSA validă (lipsește header-ul).");
    } else {
        logDiag("KEY-PRIV", "Header PEM detectat OK.");
    }
    return forge.pki.privateKeyFromPem(keyContent);
}

// ==========================================
// 2. ALGORITMI CRIPTARE
// ==========================================
function rc4(key, data) {
    // key și data trebuie să fie Buffers
    const S = [];
    for(let i=0; i<256; i++) S[i] = i;
    let j = 0;
    for(let i=0; i<256; i++) {
        j = (j + S[i] + key[i % key.length]) % 256;
        [S[i], S[j]] = [S[j], S[i]];
    }
    let i = 0; j = 0;
    const output = Buffer.alloc(data.length);
    for(let k=0; k<data.length; k++) {
        i = (i + 1) % 256;
        j = (j + S[i]) % 256;
        [S[i], S[j]] = [S[j], S[i]];
        output[k] = data[k] ^ S[(S[i] + S[j]) % 256];
    }
    return output;
}

function cleanXml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;")
        .trim();
}

function formatTimestamp(d = new Date()) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

// ==========================================
// 3. MAIN: ENCRYPT REQUEST (+ SELF TEST)
// ==========================================
export function encryptRequest(paymentData) {
    logDiag("INIT", "Începere proces criptare cerere Netopia...");

    const signature = String(process.env.NETOPIA_SIGNATURE || "").trim();
    logDiag("ENV", `Semnătura citită: ${signature}`);
    
    if (!signature) throw new Error("NETOPIA_SIGNATURE lipsește din .env");

    const ts = formatTimestamp();
    const orderId = cleanXml(paymentData.orderId);
    
    // --- 1. GENERARE XML ---
    const xmlStr = `<?xml version="1.0" encoding="utf-8"?>
<order type="card" id="${orderId}" timestamp="${ts}">
  <signature>${signature}</signature>
  <url>
    <return>${NETOPIA_CONFIG.returnUrl}</return>
    <confirm>${NETOPIA_CONFIG.confirmUrl}</confirm>
  </url>
  <invoice currency="RON" amount="${Number(paymentData.amount).toFixed(2)}">
    <details>Comanda ${orderId}</details>
    <contact_info>
      <billing type="person">
        <first_name>${cleanXml(paymentData.firstName)}</first_name>
        <last_name>${cleanXml(paymentData.lastName)}</last_name>
        <email>${cleanXml(paymentData.email)}</email>
        <address>${cleanXml(paymentData.address)}</address>
        <mobile_phone>${cleanXml(paymentData.phone)}</mobile_phone>
      </billing>
      <shipping type="person">
        <first_name>${cleanXml(paymentData.firstName)}</first_name>
        <last_name>${cleanXml(paymentData.lastName)}</last_name>
        <email>${cleanXml(paymentData.email)}</email>
        <address>${cleanXml(paymentData.address)}</address>
        <mobile_phone>${cleanXml(paymentData.phone)}</mobile_phone>
      </shipping>
    </contact_info>
  </invoice>
</order>`;

    logDiag("XML-GEN", "XML Generat (Verifică diacriticele):", xmlStr);

    const xmlBuffer = Buffer.from(xmlStr, 'utf8');
    logDiag("XML-BUFF", `Buffer size: ${xmlBuffer.length} bytes`);

    // --- 2. CRIPTARE RC4 ---
    const rc4KeyHex = forge.random.getBytesSync(16);
    const rc4KeyBuffer = Buffer.from(rc4KeyHex, 'binary');
    logDiag("RC4-KEY", `Key Hex: ${rc4KeyBuffer.toString('hex')}`);

    const encryptedDataBuffer = rc4(rc4KeyBuffer, xmlBuffer);
    const encryptedDataHex = encryptedDataBuffer.toString('hex').toUpperCase();
    logDiag("RC4-CRYPT", `Data Criptată (primii 50 chars): ${encryptedDataHex.substring(0, 50)}...`);

    // --- 3. CRIPTARE RSA (Cheia RC4 -> env_key) ---
    const publicKey = getNetopiaPublicKey();
    const encryptedKey = publicKey.encrypt(rc4KeyHex, 'RSAES-PKCS1-V1_5');
    const envKeyBase64 = forge.util.encode64(encryptedKey);
    logDiag("RSA-CRYPT", `env_key generat (Base64): ${envKeyBase64.substring(0, 50)}...`);

    // =================================================================
    // ⭐ AUTO-TEST DECIZIV: ÎNCERCĂM SĂ DECRIPTĂM CE AM CRIPTAT
    // =================================================================
    try {
        logDiag("SELF-TEST", "⚠️ ÎNCEPE AUTO-TESTUL DE DECRIPTARE ⚠️");
        logDiag("SELF-TEST", "Dacă acesta eșuează, Netopia nu are nicio șansă.");

        const myPrivateKey = getMerchantPrivateKey();
        
        // A. Decriptare env_key
        const decodedEnvKey = forge.util.decode64(envKeyBase64);
        const decryptedRc4KeyBinary = myPrivateKey.decrypt(decodedEnvKey, 'RSAES-PKCS1-V1_5');
        const decryptedRc4KeyBuffer = Buffer.from(decryptedRc4KeyBinary, 'binary');

        logDiag("SELF-TEST", `Cheie RC4 Recuperată: ${decryptedRc4KeyBuffer.toString('hex')}`);
        
        if (decryptedRc4KeyBuffer.toString('hex') !== rc4KeyBuffer.toString('hex')) {
             throw new Error("MISMATCH: Cheia RC4 decriptată nu este identică cu cea originală!");
        } else {
             logDiag("SELF-TEST", "✅ RSA OK: Cheia RC4 recuperată corect.");
        }

        // B. Decriptare Data
        const decryptedDataBuffer = rc4(decryptedRc4KeyBuffer, encryptedDataBuffer);
        const decryptedXml = decryptedDataBuffer.toString('utf8');

        logDiag("SELF-TEST", `XML Recuperat (primii 100 chars): ${decryptedXml.substring(0, 100)}...`);

        if (decryptedXml.includes(signature)) {
            logDiag("SELF-TEST", "✅ RC4 OK: Semnătura găsită în XML-ul decriptat.");
            logDiag("SELF-TEST", "CONCLUZIE: Criptarea serverului tău este PERFECTĂ din punct de vedere tehnic.");
            logDiag("SELF-TEST", "Dacă Netopia dă eroare acum, înseamnă 100% că 'public.cer' folosit nu este perechea cheii private din sistemul Netopia (Mismatch Sandbox vs Live).");
        } else {
            throw new Error("XML-ul recuperat este corupt (nu conține semnătura).");
        }

    } catch (err) {
        logDiag("SELF-TEST-FAIL", "❌ AUTO-TEST EȘUAT!", err.message);
        // Nu oprim execuția, trimitem oricum, dar știm că e greșit
    }
    // =================================================================

    return {
        gatewayUrl: NETOPIA_CONFIG.gatewayUrl,
        env_key: envKeyBase64,
        data: encryptedDataHex
    };
}

// ==========================================
// 4. DECRIPTARE IPN (RĂMÂNE STANDARD)
// ==========================================
export function decryptIPN(envKeyBase64, encryptedDataHex) {
    logDiag("IPN", "Primire IPN de la Netopia...");
    const privateKey = getMerchantPrivateKey();

    let rc4KeyBinary;
    try {
        const encryptedKey = forge.util.decode64(envKeyBase64);
        rc4KeyBinary = privateKey.decrypt(encryptedKey, 'RSAES-PKCS1-V1_5');
    } catch (e) {
        throw new Error("Decriptare RSA eșuată. Verifică private.key.");
    }
    
    const rc4KeyBuffer = Buffer.from(rc4KeyBinary, 'binary');
    const encryptedDataBuffer = Buffer.from(encryptedDataHex, 'hex');
    const decryptedBuffer = rc4(rc4KeyBuffer, encryptedDataBuffer);
    const xml = decryptedBuffer.toString('utf8');

    const orderIdMatch = xml.match(/id="([^"]+)"/);
    const actionMatch = xml.match(/<action>([^<]+)<\/action>/);
    const errorMatch = xml.match(/<error code="([^"]+)">/);
    const errorMessageMatch = xml.match(/<error[^>]*>([^<]+)<\/error>/);

    return {
        orderId: orderIdMatch ? orderIdMatch[1] : null,
        action: actionMatch ? actionMatch[1] : null,
        errorCode: errorMatch ? errorMatch[1] : "0",
        errorMessage: errorMessageMatch ? errorMessageMatch[1] : null,
        xml
    };
}