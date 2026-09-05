/**
 * Background Service Worker for panda.vault Chrome Extension.
 * Manages zero-knowledge in-memory session, origin matching, and tab communication.
 */
import { deriveKeys, decryptVmk, decryptVaultItem, encryptVaultItem } from '../lib/crypto';
import { filterMatchingCredentials, parseOrigin } from '../lib/originMatcher';
import { ExtensionVaultItem } from '../lib/messaging';

interface ExtensionSessionState {
  isUnlocked: boolean;
  userEmail: string | null;
  userSalt: string | null;
  accessToken: string | null;
  keepLoggedIn: boolean;
  decryptedItems: ExtensionVaultItem[];
  rawVmk: CryptoKey | null;
  lastActivity: number;
}

const state: ExtensionSessionState = {
  isUnlocked: false,
  userEmail: null,
  userSalt: null,
  accessToken: null,
  keepLoggedIn: false,
  decryptedItems: [],
  rawVmk: null,
  lastActivity: Date.now(),
};

const DEFAULT_API_BASE_URL = 'https://panda-vault-backend.onrender.com/api/v1';

async function getApiBaseUrl(): Promise<string> {
  return new Promise((resolve) => {
    chrome.storage.local.get(['api_server_url'], (res) => {
      if (res?.api_server_url && typeof res.api_server_url === 'string') {
        let base = res.api_server_url.trim().replace(/\/+$/, '');
        if (!base.endsWith('/api/v1')) {
          base = `${base}/api/v1`;
        }
        resolve(base);
      } else {
        resolve(DEFAULT_API_BASE_URL);
      }
    });
  });
}

// Restore session from in-memory session storage if service worker restarted
if (chrome.storage?.session) {
  chrome.storage.session.get(['session_state'], (result) => {
    if (result.session_state) {
      Object.assign(state, result.session_state);
    }
  });
}

// Auto-lock check (every 15 mins if keepLoggedIn is false)
setInterval(() => {
  if (state.isUnlocked && !state.keepLoggedIn && Date.now() - state.lastActivity > 15 * 60 * 1000) {
    lockVault();
  }
}, 60 * 1000);

function lockVault() {
  state.isUnlocked = false;
  state.decryptedItems = [];
  state.rawVmk = null;
  state.accessToken = null;
  state.lastActivity = Date.now();
  if (chrome.storage?.session) {
    chrome.storage.session.remove(['session_state']);
  }
  chrome.action.setBadgeText({ text: '' });
}

function persistSessionState() {
  if (chrome.storage?.session && state.isUnlocked && state.keepLoggedIn) {
    chrome.storage.session.set({
      session_state: {
        isUnlocked: state.isUnlocked,
        userEmail: state.userEmail,
        userSalt: state.userSalt,
        accessToken: state.accessToken,
        keepLoggedIn: state.keepLoggedIn,
        decryptedItems: state.decryptedItems,
        lastActivity: Date.now(),
      },
    });
  }
}

// Fetch encrypted items from backend and decrypt locally in memory
async function fetchAndDecryptVault(vmk: CryptoKey, token?: string | null): Promise<ExtensionVaultItem[]> {
  const apiBase = await getApiBaseUrl();
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${apiBase}/vault/items`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    throw new Error('Failed to fetch items from backend');
  }

  const encryptedList: any[] = await res.json();
  const decrypted: ExtensionVaultItem[] = [];

  for (const item of encryptedList) {
    try {
      const payload = await decryptVaultItem(
        item.encrypted_payload,
        item.iv,
        vmk,
        item.id
      );

      decrypted.push({
        id: item.id,
        title: payload.title || 'Untitled',
        username: payload.username,
        password: payload.password,
        url: payload.url,
        category: payload.category || item.category,
        notes: payload.notes,
        totpSecret: payload.totpSecret,
        favorite: item.is_favorite ?? payload.favorite,
      });
    } catch {
      // Ignore individual decryption errors
    }
  }

  return decrypted;
}

// Handle incoming messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  state.lastActivity = Date.now();

  (async () => {
    try {
      switch (message.type) {
        case 'GET_STATUS': {
          // Get active tab URL
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          const activeUrl = tabs[0]?.url || '';
          const parsed = parseOrigin(activeUrl);
          const currentApi = await getApiBaseUrl();

          sendResponse({
            success: true,
            data: {
              isUnlocked: state.isUnlocked,
              userEmail: state.userEmail,
              keepLoggedIn: state.keepLoggedIn,
              activeUrl,
              activeDomain: parsed?.hostname || '',
              totalItems: state.decryptedItems.length,
              apiBaseUrl: currentApi,
            },
          });
          break;
        }

        case 'SET_API_URL': {
          const newUrl = message.payload?.url;
          if (newUrl) {
            chrome.storage.local.set({ api_server_url: newUrl }, () => {
              sendResponse({ success: true });
            });
          } else {
            sendResponse({ success: false, error: 'Invalid URL' });
          }
          break;
        }

        case 'UNLOCK_VAULT': {
          const { email, masterPassword, keepLoggedIn } = message.payload;
          let apiBase = await getApiBaseUrl();

          // 1. Fetch challenge salt from server
          let challengeRes: Response;
          try {
            challengeRes = await fetch(`${apiBase}/auth/login/challenge`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email }),
            });
          } catch (networkErr: any) {
            // Fallback attempt to local backend if remote is cold/unreachable
            if (!apiBase.includes('localhost')) {
              try {
                const localBase = 'http://localhost:8000/api/v1';
                challengeRes = await fetch(`${localBase}/auth/login/challenge`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email }),
                });
                apiBase = localBase;
              } catch {
                throw new Error(`Cannot connect to server at ${apiBase}. Please verify backend is running.`);
              }
            } else {
              throw new Error(`Cannot connect to server at ${apiBase}: ${networkErr.message}`);
            }
          }

          if (!challengeRes.ok) {
            throw new Error('Invalid account or user not found');
          }

          const challenge = await challengeRes.json();
          const userSalt = challenge.user_salt;

          if (!userSalt) {
            throw new Error('User salt not found for this account');
          }

          // 2. Derive MK and AK
          const { masterKeyBytes, authKeyHex } = await deriveKeys(masterPassword, userSalt);

          // 3. Login to get encrypted VMK
          const loginRes = await fetch(`${apiBase}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, auth_key: authKeyHex }),
          });

          if (!loginRes.ok) {
            throw new Error('Incorrect Master Password');
          }

          const loginData = await loginRes.json();
          const encVmk = loginData.encrypted_vmk || loginData.user?.encrypted_vmk;
          const vmkIv = loginData.vmk_iv || loginData.user?.vmk_iv;
          const accessToken = loginData.access_token;

          if (!encVmk || !vmkIv) {
            throw new Error('Vault encryption keys not returned from server');
          }

          // 4. Decrypt VMK
          const vmkKey = await decryptVmk(encVmk, vmkIv, masterKeyBytes);

          // 5. Decrypt all vault credentials into extension memory
          const items = await fetchAndDecryptVault(vmkKey, accessToken);

          state.isUnlocked = true;
          state.userEmail = email;
          state.userSalt = userSalt;
          state.accessToken = accessToken;
          state.keepLoggedIn = !!keepLoggedIn;
          state.rawVmk = vmkKey;
          state.decryptedItems = items;

          persistSessionState();

          sendResponse({ success: true, data: { count: items.length } });
          break;
        }

        case 'LOCK_VAULT': {
          lockVault();
          sendResponse({ success: true });
          break;
        }

        case 'GET_MATCHED_CREDENTIALS': {
          let tabUrl = message.payload?.tabUrl;
          if (!tabUrl) {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            tabUrl = tabs[0]?.url || '';
          }

          const matched = filterMatchingCredentials(state.decryptedItems, tabUrl);
          sendResponse({ success: true, data: { matched, tabUrl } });
          break;
        }

        case 'GET_ALL_CREDENTIALS': {
          sendResponse({ success: true, data: { items: state.decryptedItems } });
          break;
        }

        case 'ADD_ITEM': {
          if (!state.isUnlocked || !state.rawVmk) {
            throw new Error('Vault is locked. Unlock before adding items.');
          }

          const { title, username, password, url, category, notes } = message.payload;
          if (!title) {
            throw new Error('Title is required');
          }

          const itemPayload = {
            title,
            username: username || '',
            password: password || '',
            url: url || '',
            category: category || 'Logins',
            notes: notes || '',
            favorite: false,
          };

          // 1. Encrypt payload client-side with VMK
          const { encryptedPayloadBase64, ivBase64 } = await encryptVaultItem(itemPayload, state.rawVmk);

          // 2. Send to backend
          const apiBase = await getApiBaseUrl();
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };
          if (state.accessToken) {
            headers['Authorization'] = `Bearer ${state.accessToken}`;
          }

          const createRes = await fetch(`${apiBase}/vault/items`, {
            method: 'POST',
            headers,
            credentials: 'include',
            body: JSON.stringify({
              item_type: 'login',
              category: category || 'Logins',
              is_favorite: false,
              encrypted_payload: encryptedPayloadBase64,
              iv: ivBase64,
            }),
          });

          if (!createRes.ok) {
            const errData = await createRes.json().catch(() => ({}));
            throw new Error(errData.detail || 'Failed to save item to vault on server');
          }

          const createdData = await createRes.json();
          const newItem: ExtensionVaultItem = {
            id: createdData.id,
            title,
            username,
            password,
            url,
            category: category || 'Logins',
            notes,
            favorite: false,
          };

          // 3. Add to local decrypted items state
          state.decryptedItems = [newItem, ...state.decryptedItems];
          persistSessionState();

          sendResponse({ success: true, data: { item: newItem } });
          break;
        }

        case 'EXECUTE_AUTOFILL': {
          const { username, password, totpCode } = message.payload;
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          const activeTab = tabs[0];

          if (!activeTab?.id) {
            throw new Error('No active browser tab found');
          }

          // Send explicit autofill command to content script in the active tab
          const fillRes = await chrome.tabs.sendMessage(activeTab.id, {
            type: 'AUTOFILL_CREDENTIAL',
            payload: { username, password, totpCode },
          });

          sendResponse({ success: true, data: fillRes });
          break;
        }

        case 'CONTENT_FORM_DETECTED': {
          if (sender.tab?.id) {
            chrome.action.setBadgeText({ tabId: sender.tab.id, text: '🔑' });
            chrome.action.setBadgeBackgroundColor({ tabId: sender.tab.id, color: '#f5c518' });
          }
          sendResponse({ success: true });
          break;
        }

        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (err: any) {
      sendResponse({ success: false, error: err.message || 'Operation failed' });
    }
  })();

  return true; // Keep message channel open for async response
});
