import { describe, it, expect } from 'vitest';
import { deriveKeys, hexToUint8Array, uint8ArrayToHex } from '../lib/crypto';

describe('panda.vault Extension Cryptography Suite', () => {
  it('should derive consistent Master Key and Auth Key from password and salt', async () => {
    const password = 'TestMasterPassword123!';
    const saltHex = '0123456789abcdef0123456789abcdef';

    const keys1 = await deriveKeys(password, saltHex);
    const keys2 = await deriveKeys(password, saltHex);

    expect(keys1.authKeyHex).toHaveLength(64);
    expect(keys1.authKeyHex).toBe(keys2.authKeyHex);
    expect(keys1.masterKeyBytes).toEqual(keys2.masterKeyBytes);
  });

  it('should generate different auth keys for different salts', async () => {
    const password = 'TestMasterPassword123!';
    const salt1 = '0123456789abcdef0123456789abcdef';
    const salt2 = 'fedcba9876543210fedcba9876543210';

    const keys1 = await deriveKeys(password, salt1);
    const keys2 = await deriveKeys(password, salt2);

    expect(keys1.authKeyHex).not.toBe(keys2.authKeyHex);
  });

  it('should convert hex strings to Uint8Array and back cleanly', () => {
    const hex = 'deadbeefcafe1234';
    const bytes = hexToUint8Array(hex);
    const reconverted = uint8ArrayToHex(bytes);

    expect(bytes).toHaveLength(8);
    expect(reconverted).toBe(hex);
  });
});
