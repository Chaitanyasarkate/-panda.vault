import { argon2id } from 'hash-wasm';

export interface Argon2idParams {
  password: string;
  saltHex: string;
  parallelism?: number;
  memorySizeKB?: number;
  iterations?: number;
  hashLength?: number;
}

/**
 * Derives a 256-bit Master Key (MK) from the user's Master Password using Argon2id.
 * Execution runs entirely client-side using WebAssembly (hash-wasm).
 */
export async function deriveMasterKey(
  password: string,
  saltHex: string
): Promise<Uint8Array> {
  const saltUint8 = hexToUint8Array(saltHex);
  
  const hashHex = await argon2id({
    password,
    salt: saltUint8,
    parallelism: 4,
    memorySize: 64 * 1024, // 64 MB (65536 KiB)
    iterations: 3,
    hashLength: 32, // 256 bits
    outputType: 'hex',
  });

  return hexToUint8Array(hashHex);
}

/**
 * Generates a cryptographically secure 16-byte random salt for user registration.
 */
export function generateUserSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return uint8ArrayToHex(bytes);
}

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
