import { uint8ArrayToHex } from './argon2';

/**
 * Derives an Authentication Key (AK) from the Master Key (MK) using HKDF-SHA256.
 * AK is transmitted over TLS to authenticate with the server without revealing MK or Master Password.
 */
export async function deriveAuthKey(masterKeyBytes: Uint8Array): Promise<string> {
  const masterKeyObj = await crypto.subtle.importKey(
    'raw',
    masterKeyBytes.buffer as ArrayBuffer,
    'HKDF',
    false,
    ['deriveBits']
  );

  const salt = new TextEncoder().encode('VaultX-AuthKey-Salt-2026');
  const info = new TextEncoder().encode('auth-key-derivation');

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt,
      info,
    },
    masterKeyObj,
    256 // 32 bytes output
  );

  return uint8ArrayToHex(new Uint8Array(derivedBits));
}
