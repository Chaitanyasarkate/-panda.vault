import { deriveMasterKey } from '../lib/crypto/argon2';
import { deriveAuthKey } from '../lib/crypto/hkdf';
import {
  generateVmk,
  encryptVmk,
  decryptVmk,
  encryptVaultItem,
  decryptVaultItem
} from '../lib/crypto/aes';

// Web Worker Message Event Listener
self.addEventListener('message', async (event: MessageEvent) => {
  const { id, type, payload } = event.data;

  try {
    switch (type) {
      case 'DERIVE_KEYS': {
        const { password, userSalt } = payload;
        const masterKeyBytes = await deriveMasterKey(password, userSalt);
        const authKeyHex = await deriveAuthKey(masterKeyBytes);
        
        self.postMessage({
          id,
          type: 'DERIVE_KEYS_SUCCESS',
          payload: {
            masterKeyBytes: Array.from(masterKeyBytes),
            authKeyHex,
          },
        });
        break;
      }

      case 'GENERATE_AND_ENCRYPT_VMK': {
        const { masterKeyBytes } = payload;
        const mkBytes = new Uint8Array(masterKeyBytes);
        const vmk = await generateVmk();
        const encryptedVmk = await encryptVmk(vmk, mkBytes);

        self.postMessage({
          id,
          type: 'GENERATE_AND_ENCRYPT_VMK_SUCCESS',
          payload: {
            encryptedVmk,
          },
        });
        break;
      }

      case 'DECRYPT_VMK': {
        const { encryptedVmkBase64, vmkIvBase64, masterKeyBytes } = payload;
        const mkBytes = new Uint8Array(masterKeyBytes);
        try {
          const vmk = await decryptVmk(encryptedVmkBase64, vmkIvBase64, mkBytes);
          const rawVmkBuf = await crypto.subtle.exportKey('raw', vmk);

          self.postMessage({
            id,
            type: 'DECRYPT_VMK_SUCCESS',
            payload: {
              rawVmkBytes: Array.from(new Uint8Array(rawVmkBuf)),
            },
          });
        } catch {
          throw new Error('Incorrect Master Password or corrupted vault key.');
        }
        break;
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

        self.postMessage({
          id,
          type: 'ENCRYPT_ITEM_SUCCESS',
          payload: { encryptedPayload },
        });
        break;
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

        self.postMessage({
          id,
          type: 'DECRYPT_ITEM_SUCCESS',
          payload: { decryptedItem },
        });
        break;
      }

      default:
        throw new Error(`Unknown worker task type: ${type}`);
    }
  } catch (error: any) {
    const errorMsg = error?.message || (typeof error === 'string' ? error : 'Operation failed during cryptographic processing');
    self.postMessage({
      id,
      type: 'ERROR',
      error: errorMsg,
    });
  }
});
