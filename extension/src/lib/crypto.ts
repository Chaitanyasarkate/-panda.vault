/**
 * Lightweight Zero-Knowledge Crypto Module for Browser Extension.
 * Perfectly aligned with the web application cryptographic derivation.
 */
import { argon2id } from 'hash-wasm';

export interface DerivedKeys {
  masterKeyBytes: Uint8Array;
  authKeyHex: string;
}

export async function deriveKeys(masterPassword: string, saltHex: string): Promise<DerivedKeys> {
  const saltBytes = hexToUint8Array(saltHex);
  
  // 1. Compute Argon2id Master Key (MK)
  const hashHex = await argon2id({
    password: masterPassword,
    salt: saltBytes,
    parallelism: 4,
    memorySize: 64 * 1024, // 64 MB (65536 KiB)
    iterations: 3,
    hashLength: 32, // 256 bits
    outputType: 'hex',
  });

  const rawMasterKey = hexToUint8Array(hashHex);

  // 2. Derive Auth Key (AK) via HKDF-SHA256
  const encoder = new TextEncoder();
  const hkdfKey = await crypto.subtle.importKey(
    'raw',
    rawMasterKey.buffer as ArrayBuffer,
    { name: 'HKDF' },
    false,
    ['deriveBits']
  );

  const authKeyBytesBuffer = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: encoder.encode('VaultX-AuthKey-Salt-2026'),
      info: encoder.encode('auth-key-derivation'),
    },
    hkdfKey,
    256 // 32 bytes output
  );

  return {
    masterKeyBytes: rawMasterKey,
    authKeyHex: uint8ArrayToHex(new Uint8Array(authKeyBytesBuffer)),
  };
}

export async function decryptVmk(
  encryptedVmkBase64: string,
  vmkIvBase64: string,
  masterKeyBytes: Uint8Array
): Promise<CryptoKey> {
  const mkCryptoKey = await crypto.subtle.importKey(
    'raw',
    masterKeyBytes.buffer as ArrayBuffer,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  const encryptedBuf = base64ToArrayBuffer(encryptedVmkBase64);
  const iv = base64ToArrayBuffer(vmkIvBase64);

  const decryptedRaw = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    mkCryptoKey,
    encryptedBuf
  );

  return await crypto.subtle.importKey(
    'raw',
    decryptedRaw,
    { name: 'AES-GCM' },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function decryptVaultItem(
  encryptedPayloadBase64: string,
  ivBase64: string,
  vmk: CryptoKey,
  itemId?: string
): Promise<any> {
  const encryptedBuf = base64ToArrayBuffer(encryptedPayloadBase64);
  const iv = base64ToArrayBuffer(ivBase64);
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  if (itemId) {
    try {
      const params: AesGcmParams = {
        name: 'AES-GCM',
        iv,
        additionalData: encoder.encode(itemId),
      };
      const decryptedBuf = await crypto.subtle.decrypt(params, vmk, encryptedBuf);
      return JSON.parse(decoder.decode(decryptedBuf));
    } catch {
      // Fallback without AAD
    }
  }

  const params: AesGcmParams = { name: 'AES-GCM', iv };
  const decryptedBuf = await crypto.subtle.decrypt(params, vmk, encryptedBuf);
  return JSON.parse(decoder.decode(decryptedBuf));
}

// Helpers
export function hexToUint8Array(hexString: string): Uint8Array {
  const matched = hexString.match(/.{1,2}/g);
  if (!matched) return new Uint8Array();
  return new Uint8Array(matched.map((byte) => parseInt(byte, 16)));
}

export function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
