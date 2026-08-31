import { PasswordGeneratorOptions } from './types';

export const UPPERCASE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const LOWERCASE_CHARS = 'abcdefghijklmnopqrstuvwxyz';
export const NUMBER_CHARS = '0123456789';
export const SYMBOL_CHARS = '!@#$%^&*()_+-=[]{}|;:,.<>?';
export const SIMILAR_CHARS = /[il1Lo0OI]/g;

export const DEFAULT_GENERATOR_OPTIONS: PasswordGeneratorOptions = {
  length: 16,
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: true,
  excludeSimilar: false,
};

/**
 * Generates an unbiased cryptographically secure random integer in the range [0, max).
 * Uses rejection sampling on 32-bit random words to prevent modulo bias.
 */
export function getSecureRandomInt(max: number): number {
  if (max <= 0) return 0;
  if (max === 1) return 0;

  const maxUint32 = 0xffffffff;
  const limit = maxUint32 - (maxUint32 % max);
  const randomBuffer = new Uint32Array(1);

  while (true) {
    crypto.getRandomValues(randomBuffer);
    const val = randomBuffer[0];
    if (val < limit) {
      return val % max;
    }
  }
}

/**
 * Shuffles an array of characters in-place using the Fisher-Yates algorithm
 * with cryptographically secure random numbers.
 */
export function secureShuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = getSecureRandomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Generates a cryptographically secure random password using Web Crypto API.
 * Guarantees that at least one character of each enabled character class is included
 * and all positions are uniformly distributed without modulo bias.
 */
export function generatePassword(options: Partial<PasswordGeneratorOptions> = {}): string {
  const opts: PasswordGeneratorOptions = { ...DEFAULT_GENERATOR_OPTIONS, ...options };
  
  let upper = UPPERCASE_CHARS;
  let lower = LOWERCASE_CHARS;
  let numbers = NUMBER_CHARS;
  let symbols = SYMBOL_CHARS;

  if (opts.excludeSimilar) {
    upper = upper.replace(SIMILAR_CHARS, '');
    lower = lower.replace(SIMILAR_CHARS, '');
    numbers = numbers.replace(SIMILAR_CHARS, '');
  }

  const enabledSets: string[] = [];
  const requiredChars: string[] = [];

  if (opts.uppercase && upper.length > 0) {
    enabledSets.push(upper);
    requiredChars.push(upper[getSecureRandomInt(upper.length)]);
  }
  if (opts.lowercase && lower.length > 0) {
    enabledSets.push(lower);
    requiredChars.push(lower[getSecureRandomInt(lower.length)]);
  }
  if (opts.numbers && numbers.length > 0) {
    enabledSets.push(numbers);
    requiredChars.push(numbers[getSecureRandomInt(numbers.length)]);
  }
  if (opts.symbols && symbols.length > 0) {
    enabledSets.push(symbols);
    requiredChars.push(symbols[getSecureRandomInt(symbols.length)]);
  }

  // Default fallback if all sets disabled
  if (enabledSets.length === 0) {
    enabledSets.push(lower + numbers);
    requiredChars.push(lower[getSecureRandomInt(lower.length)]);
  }

  const combinedCharset = enabledSets.join('');
  const targetLength = Math.max(4, Math.min(128, opts.length || 16));

  const passwordChars: string[] = [...requiredChars];

  // Fill the remaining length uniformly from the combined charset
  while (passwordChars.length < targetLength) {
    const randomChar = combinedCharset[getSecureRandomInt(combinedCharset.length)];
    passwordChars.push(randomChar);
  }

  // Cryptographically shuffle to prevent predictable positions for required chars
  const shuffled = secureShuffle(passwordChars.slice(0, targetLength));
  return shuffled.join('');
}

export interface PasswordStrengthResult {
  score: number;        // 0 to 100
  entropy: number;      // Bits of entropy
  label: 'Very Weak' | 'Weak' | 'Fair' | 'Strong' | 'Very Strong';
  crackTimeDisplay: string;
  feedback: string[];
}

/**
 * Calculates entropy and strength metrics for a given password.
 * Evaluates Shannon entropy based on dynamic pool size and structural composition.
 */
export function calculatePasswordStrength(password: string): PasswordStrengthResult {
  if (!password) {
    return {
      score: 0,
      entropy: 0,
      label: 'Very Weak',
      crackTimeDisplay: 'Instant',
      feedback: ['Password is empty'],
    };
  }

  let poolSize = 0;
  const feedback: string[] = [];

  if (/[a-z]/.test(password)) poolSize += 26;
  if (/[A-Z]/.test(password)) poolSize += 26;
  if (/[0-9]/.test(password)) poolSize += 10;
  if (/[^a-zA-Z0-9]/.test(password)) poolSize += 32;

  const entropy = Math.round(password.length * Math.log2(poolSize || 1));

  // Determine score (0 to 100 scale, where 80+ bits is very strong)
  let score = Math.min(100, Math.round((entropy / 90) * 100));

  // Penalize very short passwords
  if (password.length < 6) {
    score = Math.min(score, 15);
    feedback.push('Critically short password');
  } else if (password.length < 8) {
    score = Math.min(score, 25);
    feedback.push('Use at least 8 characters');
  } else if (password.length < 12) {
    feedback.push('12+ characters recommended for strong security');
  }

  // Feedback on diversity
  if (!/[A-Z]/.test(password)) feedback.push('Add uppercase letters');
  if (!/[a-z]/.test(password)) feedback.push('Add lowercase letters');
  if (!/[0-9]/.test(password)) feedback.push('Add numbers');
  if (!/[^a-zA-Z0-9]/.test(password)) feedback.push('Add special symbols');

  let label: 'Very Weak' | 'Weak' | 'Fair' | 'Strong' | 'Very Strong' = 'Very Weak';
  let crackTimeDisplay = 'Instant';

  if (score >= 80) {
    label = 'Very Strong';
    crackTimeDisplay = 'Centuries+';
  } else if (score >= 60) {
    label = 'Strong';
    crackTimeDisplay = 'Years to Decades';
  } else if (score >= 40) {
    label = 'Fair';
    crackTimeDisplay = 'Days to Months';
  } else if (score >= 20 && password.length >= 6) {
    label = 'Weak';
    crackTimeDisplay = 'Minutes to Hours';
  } else {
    label = 'Very Weak';
    crackTimeDisplay = 'Instant';
  }

  return {
    score,
    entropy,
    label,
    crackTimeDisplay,
    feedback: feedback.length > 0 ? feedback : ['Excellent password security'],
  };
}
