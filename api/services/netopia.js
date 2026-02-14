import crypto from "crypto";
import fs from "fs";
import path from "path";

const CERTS_DIR = path.join(process.cwd(), "api", "certs");

const NETOPIA_CONFIG = {
  // SANDBOX gateway
  gatewayUrl: "https://sandboxsecure.mobilpay.ro",

  // POS signature from Netopia dashboard (SANDBOX POS)
  signature: String(process.env.NETOPIA_SIGNATURE || "").trim(),

  // IMPORTANT: Netopia (mobilPay) PUBLIC certificate (SANDBOX) used to encrypt env_key
  netopiaPublicCertPath: path.join(CERTS_DIR, "netopia-sandbox-public.pem"),

  // IMPORTANT: Merchant PRIVATE key used to decrypt IPN env_key
  merchantPrivateKeyPath: path.join(CERTS_DIR, "merchant-private.key"),

  // URLs
  returnUrl: "https://oclar.ro/#/success",
  confirmUrl: "https://api.oclar.ro/api/netopia/confirm",
};

// ---------------- RC4 (legacy mobilPay) ----------------
function rc4(keyBuffer, dataBuffer) {
  const S = new Array(256);
  for (let i = 0; i < 256; i++) S[i] = i;

  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + S[i] + keyBuffer[i % keyBuffer.length]) % 256;
    [S[i], S[j]] = [S[j], S[i]];
  }

  let i = 0;
  j = 0;
  const output = Buffer.alloc(dataBuffer.length);

  for (let k = 0; k < dataBuffer.length; k++) {
    i = (i + 1) % 256;
    j = (j + S[i]) % 256;
    [S[i], S[j]] = [S[j], S[i]];
    const idx = (S[i] + S[j]) % 256;
    output[k] = dataBuffer[k] ^ S[idx];
  }
  return output;
}

// -------------- Helpers: robust PEM read --------------
function readTextFile(p) {
  return fs.readFileSync(p, "utf8");
}

function ensurePemCertificate(pemOrDerText, filePathForHint = "") {
  // We require PEM text for crypto.publicEncrypt compatibility and stability.
  // If you accidentally stored DER (.cer) and read it as utf8, it'll be garbage.
  const hasPemHeader =
    pemOrDerText.includes("-----BEGIN CERTIFICATE-----") ||
    pemOrDerText.includes("-----BEGIN PUBLIC KEY-----");

  if (!hasPemHeader) {
    throw new Error(
      `Certificate is not PEM. Convert to PEM and save as .pem.\n` +
        `Offending file: ${filePathForHint}\n` +
        `Expected header like '-----BEGIN CERTIFICATE-----'.`
    );
  }
  return pemOrDerText;
}

function ensureNonEmptySignature(sig) {
  if (!sig) throw new Error("NETOPIA_SIGNATURE is empty. Set it in env.");
  // quick sanity: 5 groups
  const ok = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(sig);
  if (!ok) {
    // not fatal, but strongly suspicious (O vs 0 etc.)
    // Throw to avoid debugging hell.
    throw new Error(
      `NETOPIA_SIGNATURE format looks wrong: '${sig}'. Copy-paste it from Netopia dashboard (SANDBOX POS).`
    );
  }
}

function cleanXml(str) {
  return String(str || "")
    .replace(/[<>&'"]/g, "")
    .trim();
}

function formatTimestamp(d = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}:${pad(d.getSeconds())}`;
}

function buildXml(data) {
  // Minimal valid order; you can extend with more optional tags later.
  const ts = formatTimestamp();

  const orderId = cleanXml(data.orderId);
  const amount = Number(data.amount).toFixed(2);

  const firstName = cleanXml(data.firstName);
  const lastName = cleanXml(data.lastName);
  const email = cleanXml(data.email);
  const address = cleanXml(data.address);
  const phone = cleanXml(data.phone);

  return `<?xml version="1.0" encoding="utf-8"?>
<order type="card" id="${orderId}" timestamp="${ts}">
  <signature>${NETOPIA_CONFIG.signature}</signature>
  <url>
    <return>${NETOPIA_CONFIG.returnUrl}</return>
    <confirm>${NETOPIA_CONFIG.confirmUrl}</confirm>
  </url>
  <invoice currency="RON" amount="${amount}">
    <details>Comanda #${orderId}</details>
    <contact_info>
      <billing type="person">
        <first_name>${firstName}</first_name>
        <last_name>${lastName}</last_name>
        <email>${email}</email>
        <address>${address}</address>
        <mobile_phone>${phone}</mobile_phone>
      </billing>
      <shipping type="person">
        <first_name>${firstName}</first_name>
        <last_name>${lastName}</last_name>
        <email>${email}</email>
        <address>${address}</address>
        <mobile_phone>${phone}</mobile_phone>
      </shipping>
    </contact_info>
  </invoice>
</order>`;
}

// ------------------ ENCRYPT REQUEST (init payment) ------------------
export function encryptRequest(paymentData) {
  ensureNonEmptySignature(NETOPIA_CONFIG.signature);

  const netopiaPublicPemRaw = readTextFile(NETOPIA_CONFIG.netopiaPublicCertPath);
  const netopiaPublicPem = ensurePemCertificate(netopiaPublicPemRaw, NETOPIA_CONFIG.netopiaPublicCertPath);

  const xml = buildXml(paymentData);

  // RC4 key is 16 bytes for legacy
  const rc4Key = crypto.randomBytes(16);

  // Encrypt XML using RC4, then HEX uppercase
  const encryptedDataHex = rc4(rc4Key, Buffer.from(xml, "utf8"))
    .toString("hex")
    .toUpperCase();

  // Encrypt RC4 key using NETOPIA public certificate (RSA PKCS1 v1.5)
  const envKeyBase64 = crypto
    .publicEncrypt({ key: netopiaPublicPem, padding: crypto.constants.RSA_PKCS1_PADDING }, rc4Key)
    .toString("base64");

  return {
    gatewayUrl: NETOPIA_CONFIG.gatewayUrl,
    env_key: envKeyBase64,
    data: encryptedDataHex,
    xml_debug: xml, // keep for local debugging; DO NOT return to client in production
  };
}

// ------------------ BUILD AUTO-SUBMIT HTML FORM ------------------
export function buildPaymentFormHtml({ gatewayUrl, env_key, data }) {
  // IMPORTANT: do not JSON-escape these values; place raw in hidden inputs
  return `<!doctype html>
<html lang="ro">
  <head>
    <meta charset="utf-8" />
    <meta name="referrer" content="no-referrer" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Redirect catre Netopia</title>
  </head>
  <body onload="document.forms[0].submit()">
    <form method="post" action="${gatewayUrl}">
      <input type="hidden" name="env_key" value="${env_key}" />
      <input type="hidden" name="data" value="${data}" />
      <noscript>
        <p>Apasa pentru a continua plata.</p>
        <button type="submit">Continua</button>
      </noscript>
    </form>
  </body>
</html>`;
}

// ------------------ DECRYPT IPN (confirm callback) ------------------
export function decryptIPN(envKeyBase64, encryptedDataHex) {
  const merchantPrivateKeyPem = readTextFile(NETOPIA_CONFIG.merchantPrivateKeyPath);

  const rc4Key = crypto.privateDecrypt(
    { key: merchantPrivateKeyPem, padding: crypto.constants.RSA_PKCS1_PADDING },
    Buffer.from(envKeyBase64, "base64")
  );

  const xml = rc4(rc4Key, Buffer.from(encryptedDataHex, "hex")).toString("utf8");

  const orderIdMatch = xml.match(/<order[^>]*id="([^"]+)"/i) || xml.match(/id="([^"]+)"/i);
  const actionMatch = xml.match(/<action>([^<]+)<\/action>/i);
  const errorCodeMatch = xml.match(/<error[^>]*code="([^"]+)"/i);

  return {
    orderId: orderIdMatch ? orderIdMatch[1] : null,
    action: actionMatch ? actionMatch[1] : null, // ex: confirmed / paid / canceled (depinde de payload)
    errorCode: errorCodeMatch ? errorCodeMatch[1] : null,
    xml,
  };
}

// ------------------ BUILD IPN RESPONSE (XML) ------------------
// Netopia expects an XML response. In many legacy implementations the response is:
// <crc>message</crc> or <crc error_type="0">OK</crc>
// Exact format may vary; below is the typical one used in mobilPay integrations.
export function buildIPNResponse({ ok, message }) {
  const safeMsg = cleanXml(message || (ok ? "OK" : "ERROR"));
  const errorType = ok ? "0" : "1";
  return `<?xml version="1.0" encoding="utf-8"?><crc error_type="${errorType}">${safeMsg}</crc>`;
}