/**
 * Strongly-typed messaging contract between Popup UI, Background Service Worker,
 * and Content Scripts.
 */

export interface ExtensionVaultItem {
  id: string;
  title: string;
  username?: string;
  password?: string;
  url?: string;
  category?: string;
  notes?: string;
  totpSecret?: string;
  favorite?: boolean;
}

export type ExtensionMessage =
  | { type: 'GET_STATUS' }
  | { type: 'GET_ACTIVE_TAB' }
  | { type: 'UNLOCK_VAULT'; payload: { email: string; masterPassword: string } }
  | { type: 'LOCK_VAULT' }
  | { type: 'GET_MATCHED_CREDENTIALS'; payload?: { tabUrl?: string } }
  | { type: 'GET_ALL_CREDENTIALS' }
  | { type: 'EXECUTE_AUTOFILL'; payload: { username?: string; password?: string; totpCode?: string } }
  | { type: 'CONTENT_FORM_DETECTED'; payload: { hasLoginForm: boolean; inputCount: number } };

export interface ExtensionResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}
