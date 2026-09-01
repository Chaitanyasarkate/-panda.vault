import { create } from 'zustand';
import { UnencryptedVaultItem } from '../lib/crypto/types';
import {
  deriveKeysWorker,
  generateAndEncryptVmkWorker,
  decryptVmkWorker,
  encryptVaultItemWorker,
  decryptVaultItemWorker,
} from '../lib/crypto/worker-client';
import { generateUserSalt } from '../lib/crypto/argon2';
import { apiRequest } from '../lib/api';

export interface VaultState {
  isAuthenticated: boolean;
  isUnlocked: boolean;
  userEmail: string | null;
  userSalt: string | null;
  rawVmkBytes: number[] | null;
  items: UnencryptedVaultItem[];
  isLoading: boolean;
  isSessionChecking: boolean;
  error: string | null;
  autoLockMinutes: number;
  lastActivityTimestamp: number;

  // Actions
  checkSession: () => Promise<void>;
  register: (email: string, masterPassword: string) => Promise<void>;
  login: (email: string, masterPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  lockVault: () => void;
  unlockVault: (masterPassword: string) => Promise<void>;
  fetchAndDecryptVault: () => Promise<void>;
  addItem: (item: UnencryptedVaultItem) => Promise<void>;
  updateItem: (id: string, item: UnencryptedVaultItem, version: number) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  updateActivity: () => void;
  checkAutoLock: () => void;
  clearError: () => void;
}

export const useVaultStore = create<VaultState>((set, get) => ({
  isAuthenticated: false,
  isUnlocked: false,
  userEmail: null,
  userSalt: null,
  rawVmkBytes: null,
  items: [],
  isLoading: false,
  isSessionChecking: true,
  error: null,
  autoLockMinutes: 15,
  lastActivityTimestamp: Date.now(),

  clearError: () => set({ error: null }),

  updateActivity: () => set({ lastActivityTimestamp: Date.now() }),

  checkAutoLock: () => {
    const { isUnlocked, lastActivityTimestamp, autoLockMinutes, lockVault } = get();
    if (!isUnlocked) return;

    const now = Date.now();
    const elapsedMinutes = (now - lastActivityTimestamp) / (1000 * 60);
    if (elapsedMinutes >= autoLockMinutes) {
      lockVault();
    }
  },

  checkSession: async () => {
    try {
      if (typeof window === 'undefined') return;

      const savedEmail = sessionStorage.getItem('vaultx_user_email') || localStorage.getItem('vaultx_remembered_email');
      const savedSalt = sessionStorage.getItem('vaultx_user_salt');
      const tabVmk = sessionStorage.getItem('vaultx_session_vmk');

      // Check if active backend session exists via HTTP-only cookie or Bearer token
      let profile: any = null;
      try {
        profile = await apiRequest('/api/v1/auth/me', { method: 'GET' });
      } catch {
        profile = null;
      }

      if (profile) {
        const activeEmail = profile.email || savedEmail;
        const activeSalt = profile.user_salt || savedSalt;

        // If this active browser tab has a cached in-tab session key, seamlessly restore the unlocked vault
        if (tabVmk) {
          try {
            const rawVmkBytes: number[] = JSON.parse(tabVmk);
            set({
              isAuthenticated: true,
              isUnlocked: true,
              userEmail: activeEmail,
              userSalt: activeSalt,
              rawVmkBytes,
              isSessionChecking: false,
            });
            await get().fetchAndDecryptVault();
            return;
          } catch {
            sessionStorage.removeItem('vaultx_session_vmk');
          }
        }

        // Backend session is valid; prompt user to unlock vault with master password
        set({
          isAuthenticated: true,
          isUnlocked: false,
          userEmail: activeEmail,
          userSalt: activeSalt,
          rawVmkBytes: null,
          isSessionChecking: false,
        });
        return;
      }

      // No active backend session
      set({
        isAuthenticated: false,
        isUnlocked: false,
        userEmail: savedEmail || null,
        userSalt: savedSalt || null,
        rawVmkBytes: null,
        isSessionChecking: false,
      });
    } catch {
      set({ isSessionChecking: false });
    }
  },

  lockVault: () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('vaultx_session_vmk');
    }
    set({
      isUnlocked: false,
      rawVmkBytes: null,
      items: [],
      error: null,
    });
  },

  register: async (email: string, masterPassword: string) => {
    set({ isLoading: true, error: null });
    try {
      // 1. Generate user salt
      const userSalt = generateUserSalt();

      // 2. Derive MK and AK via worker
      const { masterKeyBytes, authKeyHex } = await deriveKeysWorker(masterPassword, userSalt);

      // 3. Generate and encrypt VMK
      const { encryptedVmk } = await generateAndEncryptVmkWorker(masterKeyBytes);

      // 4. Send to backend
      const response = await apiRequest('/api/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email,
          user_salt: userSalt,
          auth_key: authKeyHex,
          encrypted_vmk: encryptedVmk.encryptedVmkBase64,
          vmk_iv: encryptedVmk.vmkIvBase64,
        }),
      });

      const encVmk = response.encrypted_vmk || response.user?.encrypted_vmk || encryptedVmk.encryptedVmkBase64;
      const vmkIv = response.vmk_iv || response.user?.vmk_iv || encryptedVmk.vmkIvBase64;
      const userEmail = response.email || response.user?.email || email;

      // 5. Decrypt VMK in memory
      const { rawVmkBytes } = await decryptVmkWorker(
        encVmk,
        vmkIv,
        masterKeyBytes
      );

      if (typeof window !== 'undefined') {
        if (response.access_token) {
          sessionStorage.setItem('vaultx_access_token', response.access_token);
        }
        sessionStorage.setItem('vaultx_session_vmk', JSON.stringify(rawVmkBytes));
        sessionStorage.setItem('vaultx_user_email', userEmail);
        sessionStorage.setItem('vaultx_user_salt', userSalt);
        localStorage.setItem('vaultx_remembered_email', userEmail);
      }

      set({
        isAuthenticated: true,
        isUnlocked: true,
        userEmail: userEmail,
        userSalt,
        rawVmkBytes,
        items: [],
        isLoading: false,
      });
    } catch (err: any) {
      set({ isLoading: false, error: err.message || 'Registration failed' });
    }
  },

  login: async (email: string, masterPassword: string) => {
    set({ isLoading: true, error: null });
    try {
      // 1. Request salt challenge from server
      const challenge = await apiRequest('/api/v1/auth/login/challenge', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      const userSalt = challenge.user_salt;

      if (!userSalt) {
        throw new Error('User salt not found on server.');
      }

      // 2. Derive MK and AK via worker
      const { masterKeyBytes, authKeyHex } = await deriveKeysWorker(masterPassword, userSalt);

      // 3. Authenticate with server
      const response = await apiRequest('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, auth_key: authKeyHex }),
      });

      const encVmk = response.encrypted_vmk || response.user?.encrypted_vmk;
      const vmkIv = response.vmk_iv || response.user?.vmk_iv;
      const userEmail = response.email || response.user?.email || email;

      if (!encVmk || !vmkIv) {
        throw new Error('Encrypted Vault Key not returned by server.');
      }

      // 4. Decrypt VMK in memory
      const { rawVmkBytes } = await decryptVmkWorker(
        encVmk,
        vmkIv,
        masterKeyBytes
      );

      if (typeof window !== 'undefined') {
        if (response.access_token) {
          sessionStorage.setItem('vaultx_access_token', response.access_token);
        }
        sessionStorage.setItem('vaultx_session_vmk', JSON.stringify(rawVmkBytes));
        sessionStorage.setItem('vaultx_user_email', userEmail);
        sessionStorage.setItem('vaultx_user_salt', userSalt);
        localStorage.setItem('vaultx_remembered_email', userEmail);
      }

      set({
        isAuthenticated: true,
        isUnlocked: true,
        userEmail: userEmail,
        userSalt,
        rawVmkBytes,
        isLoading: false,
      });

      // 5. Fetch and decrypt vault items
      await get().fetchAndDecryptVault();
    } catch (err: any) {
      const rawMsg = err.message || 'Login failed';
      const userFriendlyMsg = rawMsg.includes('Invalid email or password')
        ? "Invalid email or password. If you haven't created your vault on this database yet, please click 'Sign up' below to create it."
        : rawMsg;
      set({ isLoading: false, error: userFriendlyMsg });
    }
  },

  unlockVault: async (masterPassword: string) => {
    const { userSalt, userEmail } = get();
    if (!userEmail) {
      set({ error: 'No email found to unlock vault' });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      // 1. Fetch user salt and encrypted VMK profile from server
      let activeSalt = userSalt;
      if (!activeSalt) {
        const challenge = await apiRequest('/api/v1/auth/login/challenge', {
          method: 'POST',
          body: JSON.stringify({ email: userEmail }),
        });
        activeSalt = challenge.user_salt;
      }

      const userProfile = await apiRequest('/api/v1/auth/me', { method: 'GET' });
      const encVmk = userProfile.encrypted_vmk;
      const vmkIv = userProfile.vmk_iv;

      if (!encVmk || !vmkIv) {
        throw new Error('Vault encryption keys not found on server.');
      }

      // 2. Derive MK
      const { masterKeyBytes } = await deriveKeysWorker(masterPassword, activeSalt!);

      // 3. Decrypt VMK into memory
      const { rawVmkBytes } = await decryptVmkWorker(
        encVmk,
        vmkIv,
        masterKeyBytes
      );

      if (typeof window !== 'undefined') {
        sessionStorage.setItem('vaultx_session_vmk', JSON.stringify(rawVmkBytes));
        sessionStorage.setItem('vaultx_user_email', userEmail);
        sessionStorage.setItem('vaultx_user_salt', activeSalt!);
      }

      set({
        isAuthenticated: true,
        isUnlocked: true,
        userEmail,
        userSalt: activeSalt,
        rawVmkBytes,
        isLoading: false,
      });

      await get().fetchAndDecryptVault();
    } catch (err: any) {
      set({ isLoading: false, error: err.message || 'Unlock failed. Incorrect Master Password.' });
    }
  },

  logout: async () => {
    try {
      await apiRequest('/api/v1/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('vaultx_access_token');
        sessionStorage.removeItem('vaultx_session_vmk');
        sessionStorage.removeItem('vaultx_user_email');
        sessionStorage.removeItem('vaultx_user_salt');
      }

      set({
        isAuthenticated: false,
        isUnlocked: false,
        userEmail: null,
        userSalt: null,
        rawVmkBytes: null,
        items: [],
        error: null,
      });
    }
  },

  fetchAndDecryptVault: async () => {
    const { rawVmkBytes, isUnlocked } = get();
    if (!isUnlocked || !rawVmkBytes) return;

    set({ isLoading: true });
    try {
      const encryptedItems: Array<{
        id: string;
        item_type?: string;
        category?: string;
        is_favorite?: boolean;
        encrypted_payload: string;
        iv: string;
        version: number;
        created_at: string;
        updated_at: string;
      }> = await apiRequest('/api/v1/vault/items', { method: 'GET' });

      const decryptedItems: UnencryptedVaultItem[] = [];

      for (const item of encryptedItems) {
        try {
          const { decryptedItem } = await decryptVaultItemWorker(
            item.encrypted_payload,
            item.iv,
            rawVmkBytes,
            item.id
          );
          decryptedItems.push({
            ...decryptedItem,
            id: item.id,
            type: (item.item_type as any) || decryptedItem.type || 'login',
            category: item.category || decryptedItem.category,
            favorite: item.is_favorite !== undefined ? item.is_favorite : decryptedItem.favorite,
            createdAt: item.created_at,
            updatedAt: item.updated_at,
          });
        } catch (decryptErr) {
          console.error(`Failed to decrypt item ${item.id}:`, decryptErr);
        }
      }

      set({ items: decryptedItems, isLoading: false });
    } catch (err: any) {
      set({ isLoading: false, error: err.message || 'Failed to fetch vault items' });
    }
  },

  addItem: async (item: UnencryptedVaultItem) => {
    const { rawVmkBytes } = get();
    if (!rawVmkBytes) throw new Error('Vault is locked');

    set({ isLoading: true, error: null });
    try {
      // 1. Encrypt payload client-side
      const { encryptedPayload } = await encryptVaultItemWorker(item, rawVmkBytes);

      // 2. Post to backend
      const createdItem = await apiRequest('/api/v1/vault/items', {
        method: 'POST',
        body: JSON.stringify({
          item_type: item.type || 'login',
          category: item.category || undefined,
          is_favorite: item.favorite || false,
          encrypted_payload: encryptedPayload.encryptedPayloadBase64,
          iv: encryptedPayload.ivBase64,
        }),
      });

      // 3. Add to local state
      const newItem: UnencryptedVaultItem = {
        ...item,
        id: createdItem.id,
        createdAt: createdItem.created_at,
        updatedAt: createdItem.updated_at,
      };

      set((state) => ({
        items: [newItem, ...state.items],
        isLoading: false,
      }));
    } catch (err: any) {
      set({ isLoading: false, error: err.message || 'Failed to add item' });
      throw err;
    }
  },

  updateItem: async (id: string, item: UnencryptedVaultItem, version: number) => {
    const { rawVmkBytes } = get();
    if (!rawVmkBytes) throw new Error('Vault is locked');

    set({ isLoading: true, error: null });
    try {
      const { encryptedPayload } = await encryptVaultItemWorker(item, rawVmkBytes, id);

      const updated = await apiRequest(`/api/v1/vault/items/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          item_type: item.type || 'login',
          category: item.category || undefined,
          is_favorite: item.favorite || false,
          encrypted_payload: encryptedPayload.encryptedPayloadBase64,
          iv: encryptedPayload.ivBase64,
          version,
        }),
      });

      set((state) => ({
        items: state.items.map((i) => (i.id === id ? { ...item, id, updatedAt: updated.updated_at } : i)),
        isLoading: false,
      }));
    } catch (err: any) {
      set({ isLoading: false, error: err.message || 'Failed to update item' });
      throw err;
    }
  },

  deleteItem: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await apiRequest(`/api/v1/vault/items/${id}`, { method: 'DELETE' });

      set((state) => ({
        items: state.items.filter((i) => i.id !== id),
        isLoading: false,
      }));
    } catch (err: any) {
      set({ isLoading: false, error: err.message || 'Failed to delete item' });
      throw err;
    }
  },
}));
