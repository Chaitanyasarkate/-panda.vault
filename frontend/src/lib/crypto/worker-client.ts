import { EncryptedPayload, EncryptedVmk, UnencryptedVaultItem } from './types';
import { deriveMasterKey } from './argon2';
import { deriveAuthKey } from './hkdf';
import {
  generateVmk,
  encryptVmk,
  decryptVmk,
  encryptVaultItem,
  decryptVaultItem
} from './aes';

let workerInstance: Worker | null = null;
let messageIdCounter = 0;
const pendingPromises = new Map<number, { resolve: (val: any) => void; reject: (err: any) => void }>();

function getWorker(): Worker | null {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') {
    return null;
  }

  if (!workerInstance) {
    try {
      workerInstance = new Worker(new URL('../../workers/crypto.worker.ts', import.meta.url), {
        type: 'module',
      });

      workerInstance.onmessage = (event: MessageEvent) => {
        const { id, type, payload, error } = event.data;
        const deferred = pendingPromises.get(id);

        if (deferred) {
          pendingPromises.delete(id);
          if (type === 'ERROR' || error) {
            deferred.reject(new Error(error || 'Worker execution error'));
          } else {
            deferred.resolve(payload);
          }
        }
      };

      workerInstance.onerror = (err) => {
        console.error('Crypto Worker Error:', err);
        pendingPromises.forEach(({ reject }) => {
          reject(new Error('Worker encountered an error during execution'));
        });
        pendingPromises.clear();
      };
    } catch (err) {
      console.warn('Worker initialization failed, falling back to direct main-thread execution:', err);
      workerInstance = null;
    }
  }

  return workerInstance;
}

async function executeInThread<T>(type: string, payload: any): Promise<T> {
  switch (type) {
    case 'DERIVE_KEYS': {
      const { password, userSalt } = payload;
      const masterKeyBytes = await deriveMasterKey(password, userSalt);
      const authKeyHex = await deriveAuthKey(masterKeyBytes);
      return { masterKeyBytes: Array.from(masterKeyBytes), authKeyHex } as T;
    }
    case 'GENERATE_AND_ENCRYPT_VMK': {
      const { masterKeyBytes } = payload;
      const mkBytes = new Uint8Array(masterKeyBytes);
      const vmk = await generateVmk();
      const encryptedVmk = await encryptVmk(vmk, mkBytes);
      return { encryptedVmk } as T;
    }
    case 'DECRYPT_VMK': {
      const { encryptedVmkBase64, vmkIvBase64, masterKeyBytes } = payload;
      const mkBytes = new Uint8Array(masterKeyBytes);
      try {
        const vmk = await decryptVmk(encryptedVmkBase64, vmkIvBase64, mkBytes);
        const rawVmkBuf = await crypto.subtle.exportKey('raw', vmk);
        return { rawVmkBytes: Array.from(new Uint8Array(rawVmkBuf)) } as T;
      } catch {
        throw new Error('Incorrect Master Password or corrupted vault key.');
      }
    }
    case 'ENCRYPT_ITEM': {
      const { itemPayload, rawVmkBytes, itemId } = payload;
      const vmkKey = await crypto.subtle.importKey(
        'raw',
        new Uint8Array(rawVmkBytes),
        { name: 'AES-GCM' },
        false,
        ['encrypt']
      );
      const encryptedPayload = await encryptVaultItem(itemPayload, vmkKey, itemId);
      return { encryptedPayload } as T;
    }
    case 'DECRYPT_ITEM': {
      const { encryptedPayloadBase64, ivBase64, rawVmkBytes, itemId } = payload;
      const vmkKey = await crypto.subtle.importKey(
        'raw',
        new Uint8Array(rawVmkBytes),
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );
      const decryptedItem = await decryptVaultItem(
        encryptedPayloadBase64,
        ivBase64,
        vmkKey,
        itemId
      );
      return { decryptedItem } as T;
    }
    default:
      throw new Error(`Unknown task type: ${type}`);
  }
}

async function sendWorkerMessage<T>(type: string, payload: any): Promise<T> {
  const worker = getWorker();
  if (!worker) {
    return executeInThread<T>(type, payload);
  }

  const id = ++messageIdCounter;

  return new Promise<T>((resolve, reject) => {
    pendingPromises.set(id, { resolve, reject });
    try {
      worker.postMessage({ id, type, payload });
    } catch {
      pendingPromises.delete(id);
      executeInThread<T>(type, payload).then(resolve).catch(reject);
    }
  });
}

export async function deriveKeysWorker(password: string, userSalt: string): Promise<{
  masterKeyBytes: number[];
  authKeyHex: string;
}> {
  return sendWorkerMessage('DERIVE_KEYS', { password, userSalt });
}

export async function generateAndEncryptVmkWorker(masterKeyBytes: number[]): Promise<{
  encryptedVmk: EncryptedVmk;
}> {
  return sendWorkerMessage('GENERATE_AND_ENCRYPT_VMK', { masterKeyBytes });
}

export async function decryptVmkWorker(
  encryptedVmkBase64: string,
  vmkIvBase64: string,
  masterKeyBytes: number[]
): Promise<{ rawVmkBytes: number[] }> {
  return sendWorkerMessage('DECRYPT_VMK', { encryptedVmkBase64, vmkIvBase64, masterKeyBytes });
}

export async function encryptVaultItemWorker(
  itemPayload: UnencryptedVaultItem,
  rawVmkBytes: number[],
  itemId?: string
): Promise<{ encryptedPayload: EncryptedPayload }> {
  return sendWorkerMessage('ENCRYPT_ITEM', { itemPayload, rawVmkBytes, itemId });
}

export async function decryptVaultItemWorker(
  encryptedPayloadBase64: string,
  ivBase64: string,
  rawVmkBytes: number[],
  itemId?: string
): Promise<{ decryptedItem: UnencryptedVaultItem }> {
  return sendWorkerMessage('DECRYPT_ITEM', { encryptedPayloadBase64, ivBase64, rawVmkBytes, itemId });
}
