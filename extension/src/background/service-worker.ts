/**
 * Background Service Worker for panda.vault Chrome Extension.
 * Manages zero-knowledge in-memory session, origin matching, and tab communication.
 */
import { deriveKeys, decryptVmk, decryptVaultItem } from '../lib/crypto';
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

const API_BASE_URL = 'http://localhost:8000/api/v1';

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
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}/vault/items`, {
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

          sendResponse({
            success: true,
            data: {
              isUnlocked: state.isUnlocked,
              userEmail: state.userEmail,
              keepLoggedIn: state.keepLoggedIn,
              activeUrl,
              activeDomain: parsed?.hostname || '',
              totalItems: state.decryptedItems.length,
            },
          });
          break;
        }

        case 'UNLOCK_VAULT': {
          const { email, masterPassword, keepLoggedIn } = message.payload;

          // 1. Fetch challenge salt from server
          const challengeRes = await fetch(`${API_BASE_URL}/auth/login/challenge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          });

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
          const loginRes = await fetch(`${API_BASE_URL}/auth/login`, {
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
