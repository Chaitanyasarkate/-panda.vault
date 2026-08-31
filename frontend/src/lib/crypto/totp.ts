/**
 * Native Web Crypto API RFC 6238 TOTP Engine
 * Dependency-free, fully client-side, zero-knowledge authenticator implementation.
 */

export interface TotpOptions {
  digits?: number;      // 6 or 8 digits (default 6)
  period?: number;      // Time step in seconds (default 30)
  algorithm?: 'SHA-1' | 'SHA-256' | 'SHA-512'; // Default SHA-1
}

export interface TotpResult {
  code: string;
  timeRemaining: number;
  progressPercentage: number; // 0 to 100 for countdown circle/bar
}

export interface ParsedOtpAuth {
  type: 'totp' | 'hotp';
  label: string;
  issuer?: string;
  secret: string;
  algorithm: 'SHA-1' | 'SHA-256' | 'SHA-512';
  digits: number;
  period: number;
}

/**
 * Standard RFC 4648 Base32 decoding into Uint8Array.
 * Strips whitespace, hyphens, and padding '='.
 */
export function base32ToUint8Array(base32: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleaned = base32.replace(/[\s-]/g, '').toUpperCase().replace(/=+$/, '');
  
  if (cleaned.length === 0) {
    return new Uint8Array(0);
  }

  let buffer = 0;
  let bitsLeft = 0;
  const result: number[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const val = alphabet.indexOf(cleaned[i]);
    if (val === -1) {
      throw new Error(`Invalid Base32 character: ${cleaned[i]}`);
    }

    buffer = (buffer << 5) | val;
    bitsLeft += 5;

    if (bitsLeft >= 8) {
      bitsLeft -= 8;
      result.push((buffer >> bitsLeft) & 0xff);
    }
  }

  return new Uint8Array(result);
}

/**
 * Validates whether a given string is a valid Base32 secret key.
 */
export function isValidBase32Secret(secret: string): boolean {
  if (!secret || secret.trim().length < 4) return false;
  try {
    const bytes = base32ToUint8Array(secret);
    return bytes.length > 0;
  } catch {
    return false;
  }
}

/**
 * Parses an otpauth://totp/... URI string into its components.
 */
export function parseOtpAuthUri(uri: string): ParsedOtpAuth | null {
  try {
    if (!uri.startsWith('otpauth://')) return null;

    const url = new URL(uri);
    const type = url.host as 'totp' | 'hotp';
    if (type !== 'totp' && type !== 'hotp') return null;

    const label = decodeURIComponent(url.pathname.replace(/^\//, ''));
    const secret = url.searchParams.get('secret');
    if (!secret) return null;

    const issuer = url.searchParams.get('issuer') || undefined;
    const rawAlgo = (url.searchParams.get('algorithm') || 'SHA1').toUpperCase();
    let algorithm: 'SHA-1' | 'SHA-256' | 'SHA-512' = 'SHA-1';
    if (rawAlgo === 'SHA256' || rawAlgo === 'SHA-256') algorithm = 'SHA-256';
    if (rawAlgo === 'SHA512' || rawAlgo === 'SHA-512') algorithm = 'SHA-512';

    const digits = parseInt(url.searchParams.get('digits') || '6', 10);
    const period = parseInt(url.searchParams.get('period') || '30', 10);

    return {
      type,
      label,
      issuer,
      secret,
      algorithm,
      digits: digits === 8 ? 8 : 6,
      period: period > 0 ? period : 30,
    };
  } catch {
    return null;
  }
}

/**
 * Calculates a dynamic RFC 6238 TOTP code using Web Crypto HMAC.
 */
export async function calculateTotp(
  base32Secret: string,
  timeEpochMs: number = Date.now(),
  options: TotpOptions = {}
): Promise<TotpResult> {
  const digits = options.digits || 6;
  const period = options.period || 30;
  const algorithm = options.algorithm || 'SHA-1';

  try {
    const keyBytes = base32ToUint8Array(base32Secret);
    if (keyBytes.length === 0) {
      return { code: '------', timeRemaining: 0, progressPercentage: 0 };
    }

    const epochSeconds = Math.floor(timeEpochMs / 1000);
    const timeStep = Math.floor(epochSeconds / period);
    const timeRemaining = period - (epochSeconds % period);
    const progressPercentage = Math.round((timeRemaining / period) * 100);

    // Convert timeStep to 8-byte big-endian ArrayBuffer
    const timeBuffer = new ArrayBuffer(8);
    const timeView = new DataView(timeBuffer);
    
    // Support 64-bit integer counters
    const high = Math.floor(timeStep / 0x100000000);
    const low = timeStep & 0xffffffff;
    timeView.setUint32(0, high, false);
    timeView.setUint32(4, low, false);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBytes.buffer as ArrayBuffer,
      { name: 'HMAC', hash: { name: algorithm } },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, timeBuffer);
    const hmacBytes = new Uint8Array(signature);

    // Dynamic truncation algorithm (RFC 4226 Section 5.4)
    const offset = hmacBytes[hmacBytes.length - 1] & 0x0f;
    const codeInt =
      ((hmacBytes[offset] & 0x7f) << 24) |
      ((hmacBytes[offset + 1] & 0xff) << 16) |
      ((hmacBytes[offset + 2] & 0xff) << 8) |
      (hmacBytes[offset + 3] & 0xff);

    const modulus = Math.pow(10, digits);
    const code = (codeInt % modulus).toString().padStart(digits, '0');

    return { code, timeRemaining, progressPercentage };
  } catch (err) {
    return { code: '------', timeRemaining: 0, progressPercentage: 0 };
  }
}

/**
 * Synchronous placeholder helper for components during initial mount render.
 */
export function generateTotpCode(secret: string): { code: string; timeRemaining: number } {
  const epochSeconds = Math.floor(Date.now() / 1000);
  const timeRemaining = 30 - (epochSeconds % 30);
  return { code: '------', timeRemaining };
}
