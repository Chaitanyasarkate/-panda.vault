import { EncryptedPayload, EncryptedVmk, UnencryptedVaultItem } from './types';

/**
 * Generates a random 256-bit Symmetric Vault Master Key (VMK) using Web Crypto API.
 */
export async function generateVmk(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts the Vault Master Key (VMK) using the derived Master Key (MK).
 */
export async function encryptVmk(vmk: CryptoKey, masterKeyBytes: Uint8Array): Promise<EncryptedVmk> {
  const mkCryptoKey = await crypto.subtle.importKey(
    'raw',
    masterKeyBytes.buffer as ArrayBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const exportedVmk = await crypto.subtle.exportKey('raw', vmk);
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encryptedBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    mkCryptoKey,
    exportedVmk
  );

  return {
    encryptedVmkBase64: arrayBufferToBase64(encryptedBuf),
    vmkIvBase64: arrayBufferToBase64(iv.buffer),
  };
}

/**
 * Decrypts the Vault Master Key (VMK) using the derived Master Key (MK).
 */
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

/**
 * Encrypts a Vault Item JSON Payload using the Vault Master Key (VMK) via AES-256-GCM.
 */
export async function encryptVaultItem(
  itemPayload: UnencryptedVaultItem,
  vmk: CryptoKey,
  itemId?: string
): Promise<EncryptedPayload> {
  const encoder = new TextEncoder();
  const plaintextBytes = encoder.encode(JSON.stringify(itemPayload));

  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const params: AesGcmParams = {
    name: 'AES-GCM',
    iv,
  };
  if (itemId) {
    params.additionalData = encoder.encode(itemId);
  }

  const encryptedBuf = await crypto.subtle.encrypt(params, vmk, plaintextBytes);

  return {
    encryptedPayloadBase64: arrayBufferToBase64(encryptedBuf),
    ivBase64: arrayBufferToBase64(iv.buffer),
  };
}

/**
 * Decrypts an encrypted Vault Item payload using the Vault Master Key (VMK) via AES-256-GCM.
 * Handles both AAD-bound payloads and legacy unauthenticated-AAD payloads seamlessly.
 */
export async function decryptVaultItem(
  encryptedPayloadBase64: string,
  ivBase64: string,
  vmk: CryptoKey,
  itemId?: string
): Promise<UnencryptedVaultItem> {
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
      const jsonStr = decoder.decode(decryptedBuf);
      return JSON.parse(jsonStr) as UnencryptedVaultItem;
    } catch (aadErr) {
      // If encrypted before item ID was assigned, try decrypting without AAD
      try {
        const fallbackParams: AesGcmParams = { name: 'AES-GCM', iv };
        const decryptedBuf = await crypto.subtle.decrypt(fallbackParams, vmk, encryptedBuf);
        const jsonStr = decoder.decode(decryptedBuf);
        return JSON.parse(jsonStr) as UnencryptedVaultItem;
      } catch {
        throw aadErr;
      }
    }
  }

  const params: AesGcmParams = {
    name: 'AES-GCM',
    iv,
  };
  const decryptedBuf = await crypto.subtle.decrypt(params, vmk, encryptedBuf);
  const jsonStr = decoder.decode(decryptedBuf);
  return JSON.parse(jsonStr) as UnencryptedVaultItem;
}

// Base64 helper functions
export function arrayBufferToBase64(buffer: ArrayBufferLike): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
