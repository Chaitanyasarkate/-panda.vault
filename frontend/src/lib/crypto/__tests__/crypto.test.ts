import { describe, it, expect } from 'vitest';
import {
  deriveMasterKey,
  generateUserSalt,
  deriveAuthKey,
  generateVmk,
  encryptVmk,
  decryptVmk,
  encryptVaultItem,
  decryptVaultItem,
  generatePassword,
  calculatePasswordStrength,
  generateTotpCode,
  calculateTotp,
  UnencryptedVaultItem,
} from '../index';

describe('VaultX Zero-Knowledge Cryptographic Engine & Security Tests', () => {
  it('should generate a cryptographically random 16-byte user salt', () => {
    const salt1 = generateUserSalt();
    const salt2 = generateUserSalt();

    expect(salt1).toHaveLength(32); // 16 bytes hex = 32 chars
    expect(salt2).toHaveLength(32);
    expect(salt1).not.toEqual(salt2); // Nonce uniqueness
    expect(/^[0-9a-fA-F]+$/.test(salt1)).toBe(true);
  });

  it('should derive consistent Master Key (MK) and Auth Key (AK) via Argon2id & HKDF', async () => {
    const masterPassword = 'SuperSecretMasterPassword123!';
    const saltHex = '0123456789abcdef0123456789abcdef';

    const mkBytes1 = await deriveMasterKey(masterPassword, saltHex);
    const mkBytes2 = await deriveMasterKey(masterPassword, saltHex);

    expect(mkBytes1).toHaveLength(32);
    expect(Array.from(mkBytes1)).toEqual(Array.from(mkBytes2));

    const ak1 = await deriveAuthKey(mkBytes1);
    const ak2 = await deriveAuthKey(mkBytes2);

    expect(ak1).toHaveLength(64); // 32 bytes in hex
    expect(ak1).toEqual(ak2);
  });

  it('should encrypt and decrypt Vault Master Key (VMK) with Master Key (MK)', async () => {
    const masterPassword = 'MySecureMasterPassword!2026';
    const saltHex = generateUserSalt();

    const mkBytes = await deriveMasterKey(masterPassword, saltHex);
    const vmk = await generateVmk();

    const encryptedVmk = await encryptVmk(vmk, mkBytes);
    expect(encryptedVmk.encryptedVmkBase64).toBeTruthy();
    expect(encryptedVmk.vmkIvBase64).toBeTruthy();

    const decryptedVmk = await decryptVmk(
      encryptedVmk.encryptedVmkBase64,
      encryptedVmk.vmkIvBase64,
      mkBytes
    );

    expect(decryptedVmk).toBeTruthy();
    expect(decryptedVmk.algorithm.name).toBe('AES-GCM');
  });

  it('should fail to decrypt VMK when given the wrong master password', async () => {
    const correctPassword = 'CorrectMasterPassword123!';
    const wrongPassword = 'WrongMasterPassword123!';
    const saltHex = generateUserSalt();

    // 1. Derive correct MK and encrypt VMK
    const correctMk = await deriveMasterKey(correctPassword, saltHex);
    const vmk = await generateVmk();
    const encryptedVmk = await encryptVmk(vmk, correctMk);

    // 2. Derive MK from wrong password
    const wrongMk = await deriveMasterKey(wrongPassword, saltHex);

    // 3. Attempt decryption with wrong MK -> MUST FAIL (OperationError / tag mismatch)
    await expect(
      decryptVmk(
        encryptedVmk.encryptedVmkBase64,
        encryptedVmk.vmkIvBase64,
        wrongMk
      )
    ).rejects.toThrow();
  });

  it('should encrypt and decrypt Vault Item JSON payloads using AES-256-GCM', async () => {
    const vmk = await generateVmk();
    const testItem: UnencryptedVaultItem = {
      type: 'login',
      title: 'Banking Portal',
      username: 'user@bank.com',
      password: 'BankPassword987#',
      url: 'https://bank.com',
      notes: 'Super secret notes',
      totpSecret: 'JBSWY3DPEHPK3PXP',
      favorite: true,
    };

    const itemId = 'item-uuid-1234';
    const encrypted = await encryptVaultItem(testItem, vmk, itemId);

    // Confidentiality Check: Plaintext credentials must NEVER appear in ciphertext or IV
    expect(encrypted.encryptedPayloadBase64).not.toContain('Banking Portal');
    expect(encrypted.encryptedPayloadBase64).not.toContain('user@bank.com');
    expect(encrypted.encryptedPayloadBase64).not.toContain('BankPassword987#');
    expect(encrypted.encryptedPayloadBase64).not.toContain('Super secret notes');
    expect(encrypted.encryptedPayloadBase64).not.toContain('JBSWY3DPEHPK3PXP');

    const decrypted = await decryptVaultItem(
      encrypted.encryptedPayloadBase64,
      encrypted.ivBase64,
      vmk,
      itemId
    );

    expect(decrypted).toEqual(testItem);
  });

  it('should fail decryption when using a wrong encryption key', async () => {
    const keyA = await generateVmk();
    const keyB = await generateVmk(); // Different key

    const testItem: UnencryptedVaultItem = {
      type: 'secure_note',
      title: 'Confidential Strategy',
      notes: 'Company confidential notes',
    };

    // Encrypt with Key A
    const encrypted = await encryptVaultItem(testItem, keyA);

    // Attempt to decrypt with Key B -> MUST FAIL
    await expect(
      decryptVaultItem(encrypted.encryptedPayloadBase64, encrypted.ivBase64, keyB)
    ).rejects.toThrow();
  });

  it('should fail decryption if ciphertext payload is tampered (AES-GCM Auth Tag Failure)', async () => {
    const vmk = await generateVmk();
    const testItem: UnencryptedVaultItem = {
      type: 'secure_note',
      title: 'Secret Code',
      notes: 'Nuclear launch code: 0000',
    };

    const encrypted = await encryptVaultItem(testItem, vmk);
    
    // Corrupt the ciphertext payload
    const tamperedPayload = encrypted.encryptedPayloadBase64.slice(0, -4) + 'AAAA';

    await expect(
      decryptVaultItem(tamperedPayload, encrypted.ivBase64, vmk)
    ).rejects.toThrow();
  });

  it('should fail decryption if IV (nonce) is tampered', async () => {
    const vmk = await generateVmk();
    const testItem: UnencryptedVaultItem = {
      type: 'login',
      title: 'Email Account',
      username: 'me@email.com',
      password: 'EmailPassword123!',
    };

    const encrypted = await encryptVaultItem(testItem, vmk);
    
    // Corrupt the IV
    const tamperedIv = encrypted.ivBase64.slice(0, -2) + 'ZZ';

    await expect(
      decryptVaultItem(encrypted.encryptedPayloadBase64, tamperedIv, vmk)
    ).rejects.toThrow();
  });

  it('should fail decryption if Associated Authenticated Data (item ID) is altered', async () => {
    const vmk = await generateVmk();
    const testItem: UnencryptedVaultItem = {
      type: 'login',
      title: 'Work VPN',
      password: 'VPNPassword123!',
    };

    // Encrypted with itemId 'item-original-id'
    const encrypted = await encryptVaultItem(testItem, vmk, 'item-original-id');

    // Attempt decryption with different itemId 'item-attacker-swapped-id'
    await expect(
      decryptVaultItem(
        encrypted.encryptedPayloadBase64,
        encrypted.ivBase64,
        vmk,
        'item-attacker-swapped-id'
      )
    ).rejects.toThrow();
  });

  it('should guarantee unique random 12-byte IVs across multiple encryption calls', async () => {
    const vmk = await generateVmk();
    const item: UnencryptedVaultItem = { type: 'login', title: 'Test' };
    const ivSet = new Set<string>();

    for (let i = 0; i < 100; i++) {
      const enc = await encryptVaultItem(item, vmk);
      expect(ivSet.has(enc.ivBase64)).toBe(false); // No collisions
      ivSet.add(enc.ivBase64);
    }
    expect(ivSet.size).toBe(100);
  });

  it('should generate cryptographically secure random passwords with accurate entropy scores', () => {
    const pwd = generatePassword({ length: 24, uppercase: true, lowercase: true, numbers: true, symbols: true });
    expect(pwd).toHaveLength(24);

    const strength = calculatePasswordStrength(pwd);
    expect(strength.score).toBeGreaterThanOrEqual(70);
    expect(strength.label).toBe('Very Strong');
  });

  it('should generate valid RFC 6238 TOTP codes from Base32 secret', async () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    const { code, timeRemaining } = await calculateTotp(secret);

    expect(code).toHaveLength(6);
    expect(/^\d{6}$/.test(code)).toBe(true);
    expect(timeRemaining).toBeGreaterThanOrEqual(0);
    expect(timeRemaining).toBeLessThanOrEqual(30);
  });
});
