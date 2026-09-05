/**
 * Content Script for panda.vault Browser Extension.
 * Injected into active pages to detect login forms and perform explicit user-controlled autofill.
 */

// Safely fill an input element with full React / Vue / Angular compatibility
function fillInputElement(el: HTMLInputElement, value: string): boolean {
  if (!el || typeof value !== 'string') return false;

  try {
    el.focus();

    // Support React 16+, Angular, and Vue state synchronizers
    const prototype = Object.getPrototypeOf(el);
    const descriptor =
      Object.getOwnPropertyDescriptor(prototype, 'value') ||
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');

    if (descriptor && descriptor.set) {
      descriptor.set.call(el, value);
    } else {
      el.value = value;
    }

    // Dispatch full sequence of synthetic input & change events
    el.dispatchEvent(new Event('focus', { bubbles: true }));
    el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));

    // Flash subtle gold highlight for visual feedback
    const prevOutline = el.style.outline;
    el.style.outline = '2px solid #f5c518';
    setTimeout(() => {
      el.style.outline = prevOutline;
    }, 1200);

    return true;
  } catch {
    return false;
  }
}

// Locate matching input fields across the DOM
function findFormInputs(): {
  usernameInput: HTMLInputElement | null;
  passwordInput: HTMLInputElement | null;
} {
  // 1. Find password field
  const passwordSelectors = [
    'input[type="password"]:not([hidden]):not([style*="display: none"])',
    'input[autocomplete*="password" i]:not([hidden])',
    'input[name*="password" i]:not([hidden])',
    'input[id*="password" i]:not([hidden])',
    'input[placeholder*="password" i]:not([hidden])',
  ];

  let passwordInput: HTMLInputElement | null = null;
  for (const selector of passwordSelectors) {
    const el = document.querySelector<HTMLInputElement>(selector);
    if (el && el.offsetParent !== null) {
      passwordInput = el;
      break;
    }
  }

  // 2. Find username / email field
  let usernameInput: HTMLInputElement | null = null;

  if (passwordInput) {
    // Look inside the same form or container first
    const parentContainer = passwordInput.closest('form') || passwordInput.closest('div[class*="login" i], div[class*="auth" i], div[class*="signin" i]') || passwordInput.parentElement?.parentElement;
    if (parentContainer) {
      const scopedSelectors = [
        'input[autocomplete="username"]',
        'input[autocomplete="email"]',
        'input[type="email"]',
        'input[name*="user" i]',
        'input[name*="email" i]',
        'input[name*="login" i]',
        'input[id*="user" i]',
        'input[id*="email" i]',
        'input[id*="login" i]',
        'input[placeholder*="email" i]',
        'input[placeholder*="username" i]',
        'input[type="text"]:not([type="password"])',
      ];
      for (const sel of scopedSelectors) {
        const candidate = parentContainer.querySelector<HTMLInputElement>(sel);
        if (candidate && candidate !== passwordInput && candidate.offsetParent !== null) {
          usernameInput = candidate;
          break;
        }
      }
    }
  }

  // Fallback: Global search for username input
  if (!usernameInput) {
    const globalSelectors = [
      'input[autocomplete="username"]:not([hidden])',
      'input[autocomplete="email"]:not([hidden])',
      'input[type="email"]:not([hidden])',
      'input[name*="username" i]:not([hidden])',
      'input[name*="email" i]:not([hidden])',
      'input[name*="login" i]:not([hidden])',
      'input[id*="username" i]:not([hidden])',
      'input[id*="email" i]:not([hidden])',
      'input[id*="login" i]:not([hidden])',
      'input[placeholder*="email" i]:not([hidden])',
      'input[placeholder*="user" i]:not([hidden])',
      'input[type="text"]:not([type="password"]):not([hidden])',
    ];
    for (const sel of globalSelectors) {
      const candidate = document.querySelector<HTMLInputElement>(sel);
      if (candidate && candidate !== passwordInput && candidate.offsetParent !== null) {
        usernameInput = candidate;
        break;
      }
    }
  }

  return { usernameInput, passwordInput };
}

// Execute explicit autofill upon verified user command
function performAutofill(payload: { username?: string; password?: string }): {
  success: boolean;
  filledFields: string[];
} {
  const filledFields: string[] = [];
  const { usernameInput, passwordInput } = findFormInputs();

  // Fill username
  if (payload.username && usernameInput) {
    if (fillInputElement(usernameInput, payload.username)) {
      filledFields.push('username');
    }
  }

  // Fill password
  if (payload.password && passwordInput) {
    if (fillInputElement(passwordInput, payload.password)) {
      filledFields.push('password');
    }
  }

  return {
    success: filledFields.length > 0,
    filledFields,
  };
}

// Listen for explicit autofill messages from the popup or background worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'AUTOFILL_CREDENTIAL') {
    const result = performAutofill(message.payload);
    sendResponse({ success: result.success, data: result });
    return true;
  }
});
