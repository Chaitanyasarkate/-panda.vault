import { describe, it, expect } from 'vitest';
import {
  calculateTotp,
  base32ToUint8Array,
  isValidBase32Secret,
  parseOtpAuthUri,
} from '../totp';

describe('RFC 6238 TOTP Engine & Official Test Vectors', () => {
  // RFC 6238 Appendix B standard test secret for SHA-1: "12345678901234567890" in Base32
  const RFC_SHA1_BASE32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

  // RFC 6238 Appendix B standard test secret for SHA-256 (32 bytes): "12345678901234567890123456789012" in Base32
  const RFC_SHA256_BASE32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZA====';

  describe('Official RFC 6238 SHA-1 Test Vectors', () => {
    it('should match RFC test vector at T = 59s', async () => {
      // 8-digit test
      const res8 = await calculateTotp(RFC_SHA1_BASE32, 59 * 1000, { digits: 8, algorithm: 'SHA-1' });
      expect(res8.code).toBe('94287082');

      // 6-digit test
      const res6 = await calculateTotp(RFC_SHA1_BASE32, 59 * 1000, { digits: 6, algorithm: 'SHA-1' });
      expect(res6.code).toBe('287082');
    });

    it('should match RFC test vector at T = 1111111109s', async () => {
      const res8 = await calculateTotp(RFC_SHA1_BASE32, 1111111109 * 1000, { digits: 8, algorithm: 'SHA-1' });
      expect(res8.code).toBe('07081804');

      const res6 = await calculateTotp(RFC_SHA1_BASE32, 1111111109 * 1000, { digits: 6, algorithm: 'SHA-1' });
      expect(res6.code).toBe('081804');
    });

    it('should match RFC test vector at T = 1111111111s', async () => {
      const res8 = await calculateTotp(RFC_SHA1_BASE32, 1111111111 * 1000, { digits: 8, algorithm: 'SHA-1' });
      expect(res8.code).toBe('14050471');

      const res6 = await calculateTotp(RFC_SHA1_BASE32, 1111111111 * 1000, { digits: 6, algorithm: 'SHA-1' });
      expect(res6.code).toBe('050471');
    });

    it('should match RFC test vector at T = 1234567890s', async () => {
      const res8 = await calculateTotp(RFC_SHA1_BASE32, 1234567890 * 1000, { digits: 8, algorithm: 'SHA-1' });
      expect(res8.code).toBe('89005924');

      const res6 = await calculateTotp(RFC_SHA1_BASE32, 1234567890 * 1000, { digits: 6, algorithm: 'SHA-1' });
      expect(res6.code).toBe('005924');
    });

    it('should match RFC test vector at T = 2000000000s', async () => {
      const res8 = await calculateTotp(RFC_SHA1_BASE32, 2000000000 * 1000, { digits: 8, algorithm: 'SHA-1' });
      expect(res8.code).toBe('69279037');

      const res6 = await calculateTotp(RFC_SHA1_BASE32, 2000000000 * 1000, { digits: 6, algorithm: 'SHA-1' });
      expect(res6.code).toBe('279037');
    });
  });

  describe('Official RFC 6238 SHA-256 Test Vectors', () => {
    it('should match RFC test vector for SHA-256 at T = 59s', async () => {
      const res = await calculateTotp(RFC_SHA256_BASE32, 59 * 1000, { digits: 8, algorithm: 'SHA-256' });
      expect(res.code).toBe('46119246');
    });

    it('should match RFC test vector for SHA-256 at T = 1111111109s', async () => {
      const res = await calculateTotp(RFC_SHA256_BASE32, 1111111109 * 1000, { digits: 8, algorithm: 'SHA-256' });
      expect(res.code).toBe('68084774');
    });

    it('should match RFC test vector for SHA-256 at T = 1234567890s', async () => {
      const res = await calculateTotp(RFC_SHA256_BASE32, 1234567890 * 1000, { digits: 8, algorithm: 'SHA-256' });
      expect(res.code).toBe('91819424');
    });

    it('should match RFC test vector for SHA-256 at T = 2000000000s', async () => {
      const res = await calculateTotp(RFC_SHA256_BASE32, 2000000000 * 1000, { digits: 8, algorithm: 'SHA-256' });
      expect(res.code).toBe('90698825');
    });
  });

  describe('Base32 Decoder and Validation', () => {
    it('should decode Base32 strings with spaces and hyphens', () => {
      // Base32 for "Hello!" is "JBSWY3DPEE======"
      const formatted = 'JBSW-Y3DP-EE==';
      const bytes = base32ToUint8Array(formatted);
      const text = new TextDecoder().decode(bytes);
      expect(text).toBe('Hello!');
    });

    it('should validate Base32 secrets accurately', () => {
      expect(isValidBase32Secret('JBSWY3DPEHPK3PXP')).toBe(true);
      expect(isValidBase32Secret('jbsw y3dp ehpk 3pxp')).toBe(true);
      expect(isValidBase32Secret('123')).toBe(false); // Too short
      expect(isValidBase32Secret('INVALID!@#89')).toBe(false); // Contains 8, 9 (non-base32)
    });
  });

  describe('otpauth:// URI Parser', () => {
    it('should parse standard Google Authenticator otpauth URI', () => {
      const uri = 'otpauth://totp/GitHub:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=GitHub&algorithm=SHA1&digits=6&period=30';
      const parsed = parseOtpAuthUri(uri);

      expect(parsed).not.toBeNull();
      expect(parsed?.type).toBe('totp');
      expect(parsed?.label).toBe('GitHub:user@example.com');
      expect(parsed?.issuer).toBe('GitHub');
      expect(parsed?.secret).toBe('JBSWY3DPEHPK3PXP');
      expect(parsed?.digits).toBe(6);
      expect(parsed?.period).toBe(30);
      expect(parsed?.algorithm).toBe('SHA-1');
    });

    it('should return null for malformed URIs', () => {
      expect(parseOtpAuthUri('https://example.com')).toBeNull();
      expect(parseOtpAuthUri('otpauth://invalid')).toBeNull();
      expect(parseOtpAuthUri('otpauth://totp/test?no_secret=1')).toBeNull();
    });
  });

  describe('Countdown & Timer Metrics', () => {
    it('should calculate accurate timeRemaining and progressPercentage', async () => {
      // Time 14s into a 30s period -> 16s remaining
      const timeMs = 14 * 1000;
      const res = await calculateTotp(RFC_SHA1_BASE32, timeMs);

      expect(res.timeRemaining).toBe(16);
      expect(res.progressPercentage).toBe(Math.round((16 / 30) * 100));
    });
  });
});
