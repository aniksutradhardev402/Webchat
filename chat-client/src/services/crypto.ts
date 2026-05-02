/**
 * Simple E2E Encryption Service using Web Crypto API.
 * For ECDH Key Derivation and AES-GCM Encryption.
 */

export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return window.crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"]
  );
}

export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey("raw", key);
  return Buffer.from(exported).toString("base64");
}

export async function importPublicKey(b64: string): Promise<CryptoKey> {
  const buffer = Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
  return window.crypto.subtle.importKey(
    "raw",
    buffer,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    []
  );
}

export async function deriveSharedKey(privateKey: CryptoKey, publicKey: CryptoKey): Promise<CryptoKey> {
  return window.crypto.subtle.deriveKey(
    { name: "ECDH", public: publicKey },
    privateKey,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function encryptText(key: CryptoKey, text: string): Promise<{ ciphertext: string, iv: string }> {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(text);
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );
  return {
    ciphertext: Buffer.from(encrypted).toString("base64"),
    iv: Buffer.from(iv).toString("base64")
  };
}

export async function decryptText(key: CryptoKey, b64Ciphertext: string, b64Iv: string): Promise<string> {
  const ciphertext = Uint8Array.from(atob(b64Ciphertext), c => c.charCodeAt(0)).buffer;
  const iv = Uint8Array.from(atob(b64Iv), c => c.charCodeAt(0));
  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(decrypted);
}
