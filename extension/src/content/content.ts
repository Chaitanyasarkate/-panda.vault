/**
 * Content Script for panda.vault Browser Extension.
 * Injected into active pages to detect login forms and perform explicit user-controlled autofill.
 */

// Detect forms on page load
function detectLoginForms(): { hasLoginForm: boolean; inputCount: number } {
  const passwordInputs = document.querySelectorAll('input[type="password"]');
  const textInputs = document.querySelectorAll('input[type="text"], input[type="email"], input:not([type])');
  
  const hasLoginForm = passwordInputs.length > 0;
  const inputCount = passwordInputs.length + textInputs.length;

  return { hasLoginForm, inputCount };
}

// Safely fill an input element and dispatch synthetic events
function fillInputElement(el: HTMLInputElement, value: string): boolean {
  if (!el || !value) return false;

  try {
    el.focus();
    
    // Support React 16+ value tracker prototype override
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(el, value);
    } else {
      el.value = value;
    }

    el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    el.blur();
    return true;
  } catch {
    return false;
  }
}

// Execute explicit autofill upon verified user command
function performAutofill(payload: { username?: string; password?: string }): {
  success: boolean;
  filledFields: string[];
} {
  const filledFields: string[] = [];

  // Find password field
  const passwordInput = document.querySelector<HTMLInputElement>(
    'input[type="password"]:not([hidden]):not([style*="display: none"])'
  );

  // Find username / email field
  let usernameInput: HTMLInputElement | null = null;

  if (passwordInput) {
    // Look inside the same form first
    const parentForm = passwordInput.closest('form');
    if (parentForm) {
      usernameInput = parentForm.querySelector<HTMLInputElement>(
        'input[type="text"]:not([hidden]), input[type="email"]:not([hidden]), input[name*="user" i], input[name*="email" i], input[name*="login" i]'
      );
    }
  }

  // Fallback global search for username/email input
  if (!usernameInput) {
    usernameInput = document.querySelector<HTMLInputElement>(
      'input[type="email"]:not([hidden]), input[name*="username" i]:not([hidden]), input[name*="email" i]:not([hidden]), input[id*="username" i], input[id*="email" i]'
    );
  }

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

// Listen for explicit autofill messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'AUTOFILL_CREDENTIAL') {
    const result = performAutofill(message.payload);
    sendResponse({ success: result.success, data: result });
    return true;
  }

  if (message.type === 'DETECT_FORMS') {
    const status = detectLoginForms();
    sendResponse({ success: true, data: status });
    return true;
  }
});

// Run initial detection
try {
  const status = detectLoginForms();
  if (status.hasLoginForm) {
    chrome.runtime.sendMessage({
      type: 'CONTENT_FORM_DETECTED',
      payload: status,
    }).catch(() => {
      // Background worker might be sleeping, safe to ignore
    });
  }
} catch {
  // Ignored in strict frames
}
