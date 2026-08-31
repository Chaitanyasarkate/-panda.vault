import { EncryptedPayload, EncryptedVmk, UnencryptedVaultItem } from './types';

let workerInstance: Worker | null = null;
let messageIdCounter = 0;
const pendingPromises = new Map<number, { resolve: (val: any) => void; reject: (err: any) => void }>();

function getWorker(): Worker {
  if (typeof window === 'undefined') {
    throw new Error('Web Worker can only be executed in browser environment');
  }

  if (!workerInstance) {
    workerInstance = new Worker(new URL('../../workers/crypto.worker.ts', import.meta.url), {
      type: 'module',
    });

    workerInstance.onmessage = (event: MessageEvent) => {
      const { id, type, payload, error } = event.data;
      const deferred = pendingPromises.get(id);

      if (deferred) {
        pendingPromises.delete(id);
        if (type === 'ERROR' || error) {
          deferred.reject(new Error(error || 'Worker error'));
        } else {
          deferred.resolve(payload);
        }
      }
    };

    workerInstance.onerror = (err) => {
      console.error('Crypto Worker Error:', err);
    };
  }

  return workerInstance;
}

function sendWorkerMessage<T>(type: string, payload: any): Promise<T> {
  const worker = getWorker();
  const id = ++messageIdCounter;

  return new Promise<T>((resolve, reject) => {
    pendingPromises.set(id, { resolve, reject });
    worker.postMessage({ id, type, payload });
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
