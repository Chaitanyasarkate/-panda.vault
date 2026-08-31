import { describe, it, expect, vi } from 'vitest';
import {
  generatePassword,
  calculatePasswordStrength,
  getSecureRandomInt,
  secureShuffle,
  UPPERCASE_CHARS,
  LOWERCASE_CHARS,
  NUMBER_CHARS,
  SYMBOL_CHARS,
  SIMILAR_CHARS,
} from '../generator';

describe('VaultX Password Generator Tests', () => {
  it('should strictly use crypto.getRandomValues() and NEVER use Math.random()', () => {
    const mathRandomSpy = vi.spyOn(Math, 'random');

    const password = generatePassword({ length: 32 });
    expect(password).toHaveLength(32);

    // Math.random must never be invoked
    expect(mathRandomSpy).not.toHaveBeenCalled();
    mathRandomSpy.mockRestore();
  });

  it('should generate passwords matching the exact configured lengths', () => {
    const lengths = [8, 12, 16, 24, 32, 64, 128];
    for (const len of lengths) {
      const pwd = generatePassword({ length: len });
      expect(pwd).toHaveLength(len);
    }
  });

  it('should guarantee inclusion of enabled character classes', () => {
    // Test 50 iterations to ensure reliable guaranteed presence
    for (let i = 0; i < 50; i++) {
      const pwd = generatePassword({
        length: 16,
        uppercase: true,
        lowercase: true,
        numbers: true,
        symbols: true,
      });

      expect(/[A-Z]/.test(pwd)).toBe(true); // Uppercase present
      expect(/[a-z]/.test(pwd)).toBe(true); // Lowercase present
      expect(/[0-9]/.test(pwd)).toBe(true); // Numbers present
      expect(/[^A-Za-z0-9]/.test(pwd)).toBe(true); // Symbols present
    }
  });

  it('should generate numbers-only PINs when only numbers are selected', () => {
    const pin = generatePassword({
      length: 8,
      uppercase: false,
      lowercase: false,
      numbers: true,
      symbols: false,
    });
    expect(pin).toHaveLength(8);
    expect(/^\d{8}$/.test(pin)).toBe(true);
  });

  it('should exclude ambiguous/similar characters when excludeSimilar is true', () => {
    for (let i = 0; i < 50; i++) {
      const pwd = generatePassword({
        length: 32,
        uppercase: true,
        lowercase: true,
        numbers: true,
        symbols: false,
        excludeSimilar: true,
      });

      expect(SIMILAR_CHARS.test(pwd)).toBe(false);
    }
  });

  it('should calculate password strength and entropy accurately', () => {
    // 1. Weak password (< 8 chars)
    const weak = calculatePasswordStrength('pass');
    expect(weak.score).toBeLessThanOrEqual(25);
    expect(weak.label).toBe('Very Weak');
    expect(weak.crackTimeDisplay).toBe('Instant');

    // 2. Medium/Fair password (10 alphanumeric chars)
    const medium = calculatePasswordStrength('Abc123Xyz9');
    expect(medium.score).toBeGreaterThanOrEqual(40);
    expect(medium.entropy).toBeGreaterThan(45);

    // 3. Very strong password (24 complex chars)
    const strong = calculatePasswordStrength('K9#mQ$8xL!2vP@5zW&7tR*4b');
    expect(strong.score).toBeGreaterThanOrEqual(80);
    expect(strong.label).toBe('Very Strong');
    expect(strong.crackTimeDisplay).toBe('Centuries+');
  });

  it('should handle empty password gracefully in strength calculation', () => {
    const emptyResult = calculatePasswordStrength('');
    expect(emptyResult.score).toBe(0);
    expect(emptyResult.entropy).toBe(0);
    expect(emptyResult.label).toBe('Very Weak');
  });

  it('should provide uniform random integers via getSecureRandomInt without modulo bias', () => {
    const max = 10;
    const counts = new Array(max).fill(0);
    const iterations = 10000;

    for (let i = 0; i < iterations; i++) {
      const val = getSecureRandomInt(max);
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(max);
      counts[val]++;
    }

    // Expected frequency ~1000 per bucket
    for (let i = 0; i < max; i++) {
      expect(counts[i]).toBeGreaterThan(700);
      expect(counts[i]).toBeLessThan(1300);
    }
  });

  it('should securely shuffle an array using Fisher-Yates CSPRNG', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const shuffled = secureShuffle(input);

    expect(shuffled).toHaveLength(input.length);
    expect(shuffled.sort((a, b) => a - b)).toEqual(input);
  });
});
