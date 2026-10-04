import { describe, it, expect } from 'vitest';
import { TotpService } from '../src/services/totpService';
import { isValidBase32, base32Decode } from '../src/utils/base32';

describe('RFC 6238 TOTP and Base32 Suite', () => {
  it('validates standard Base32 strings', () => {
    expect(isValidBase32('JBSWY3DPEHPK3PXP')).toBe(true);
    expect(isValidBase32('MZXW6YTB')).toBe(true);
    expect(isValidBase32('invalid_12389!')).toBe(false); // '1', '8', '9' are not base32
  });

  it('correctly decodes Base32 string to Uint8Array', () => {
    const decoded = base32Decode('JBSWY3DPEHPK3PXP');
    expect(decoded).toBeInstanceOf(Uint8Array);
    expect(decoded.length).toBe(10);
  });

  it('generates consistent 6-digit TOTP code format', async () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    const code = await TotpService.generateCode(secret, 1234567890, 30, 6);
    expect(code).toMatch(/^\d{6}$/);
    expect(code.length).toBe(6);
  });

  it('calculates remaining seconds and progress within period', () => {
    const remaining = TotpService.getRemainingSeconds(30);
    expect(remaining).toBeGreaterThanOrEqual(1);
    expect(remaining).toBeLessThanOrEqual(30);

    const progress = TotpService.getProgress(30);
    expect(progress).toBeGreaterThanOrEqual(0);
    expect(progress).toBeLessThanOrEqual(1);
  });

  it('formats 6-digit codes with clean whitespace separation', () => {
    expect(TotpService.formatCode('123456')).toBe('123 456');
    expect(TotpService.formatCode('---')).toBe('---');
  });
});
