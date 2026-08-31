export interface DerivedKeys {
  masterKeyHex: string;       // MK (256-bit derived key hex)
  authKeyHex: string;         // AK (256-bit auth key hex for server auth)
}

export interface EncryptedPayload {
  encryptedPayloadBase64: string; // AES-GCM Ciphertext + Tag (base64)
  ivBase64: string;               // 12-byte IV (base64)
}

export interface EncryptedVmk {
  encryptedVmkBase64: string;    // Encrypted VMK
  vmkIvBase64: string;           // IV for VMK encryption
}

export type VaultItemType = 'login' | 'secure_note' | 'card';

export interface UnencryptedVaultItem {
  id?: string;
  type: VaultItemType;
  title: string;
  username?: string;
  password?: string;
  url?: string;
  notes?: string;
  totpSecret?: string;
  category?: string;
  favorite?: boolean;
  createdAt?: string;
  updatedAt?: string;
  customFields?: Array<{ key: string; value: string; isSecret?: boolean }>;
}

export interface PasswordGeneratorOptions {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
  excludeSimilar: boolean;
}
