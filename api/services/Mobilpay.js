import crypto from "crypto";
import fs from "fs";

export class Mobilpay {
  constructor(config) {
    this.signature = config.signature;
    this.publicKey = config.publicKey; // String PEM sau Buffer
    this.privateKey = config.privateKey; // String PEM sau Buffer
    this.sandbox = config.sandbox;
  }

  // Algoritmul RC4 (Binary Safe)
  rc4(key, str) {
    const s = [], res = [];
    let i = 0, j = 0, x;
    for (let i = 0; i < 256; i++) {
      s[i] = i;
    }
    for (i = 0; i < 256; i++) {
      j = (j + s[i] + key.charCodeAt(i % key.length)) % 256;
      x = s[i];
      s[i] = s[j];
      s[j] = x;
    }
    i = 0;
    j = 0;
    for (let y = 0; y < str.length; y++) {
      i = (i + 1) % 256;
      j = (j + s[i]) % 256;
      x = s[i];
      s[i] = s[j];
      s[j] = x;
      res.push(str.charCodeAt(y) ^ s[(s[i] + s[j]) % 256]);
    }
    return Buffer.from(res);
  }

  encrypt(xmlData) {
    // 1. Generăm cheia RC4 aleatorie (16 caractere)
    const rc4Key = crypto.randomBytes(16).toString('hex').substr(0, 16);
    
    // 2. Criptăm XML-ul cu RC4
    // Convertim XML-ul în string binar corect pentru a nu pierde diacritice
    const encData = this.rc4(rc4Key, Buffer.from(xmlData).toString('binary'));
    const dataHex = encData.toString('hex').toUpperCase();

    // 3. Criptăm cheia RC4 cu RSA (folosind Certificatul Public)
    const encryptedKey = crypto.publicEncrypt(
      {
        key: this.publicKey,
        padding: crypto.constants.RSA_PKCS1_PADDING,
      },
      Buffer.from(rc4Key)
    );

    return {
      envKey: encryptedKey.toString('base64'),
      envData: dataHex
    };
  }

  decrypt(envKey, envData) {
    // 1. Decriptăm cheia RC4 (RSA)
    const privateKeyObj = {
      key: this.privateKey,
      padding: crypto.constants.RSA_PKCS1_PADDING
    };
    
    let rc4Key;
    try {
      rc4Key = crypto.privateDecrypt(privateKeyObj, Buffer.from(envKey, 'base64'));
    } catch (e) {
      throw new Error('Decriptare RSA eșuată. Verifică cheia privată.');
    }

    // 2. Decriptăm datele (RC4)
    const encData = Buffer.from(envData, 'hex').toString('binary');
    const decData = this.rc4(rc4Key.toString(), encData);

    // 3. Parsăm rezultatul
    const xml = decData.toString('utf8');
    
    // Extragem valorile cu regex pentru viteză
    const orderId = (xml.match(/id="([^"]+)"/) || [])[1];
    const action = (xml.match(/<action>([^<]+)<\/action>/) || [])[1];
    const errorCode = (xml.match(/<error code="([^"]+)">/) || [])[1];
    const errorMessage = (xml.match(/<error[^>]*>([^<]+)<\/error>/) || [])[1];

    return { orderId, action, errorCode, errorMessage, xml };
  }
}