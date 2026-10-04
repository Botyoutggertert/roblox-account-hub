// Pure Offline RFC 6238 TOTP Authenticator Service
// Computes TOTP = HOTP(Secret, floor(UnixTimestamp / Period))
// Works 100% offline using standard Web Crypto SubtleCrypto HMAC

import { decodeBase32, isValidBase32 } from '../utils/base32';
import { TotpAccount } from '../types/totp';

export class TotpService {
  /**
   * Generates a dynamic 6-digit TOTP code for the given secret at a specific epoch time (seconds)
   */
  static async generateCode(
    secret: string,
    timeSeconds: number = Math.floor(Date.now() / 1000),
    period: number = 30,
    digits: number = 6,
    algorithm: 'SHA-1' | 'SHA-256' | 'SHA-512' = 'SHA-1'
  ): Promise<string> {
    if (!secret || !isValidBase32(secret)) {
      throw new Error('Invalid Base32 secret provided');
    }

    const keyBytes = decodeBase32(secret);
    if (keyBytes.length === 0) {
      throw new Error('Secret decoded to empty byte array');
    }

    // Counter = floor(time / period) as 8-byte big-endian integer
    const counter = Math.floor(timeSeconds / period);
    const counterBuffer = new ArrayBuffer(8);
    const counterView = new DataView(counterBuffer);

    // Counter fits in safe JS integer, set high and low 32-bit words
    const high = Math.floor(counter / 0x100000000);
    const low = counter >>> 0;
    counterView.setUint32(0, high, false);
    counterView.setUint32(4, low, false);

    // Import secret as CryptoKey
    const cryptoInstance =
      typeof window !== 'undefined' && window.crypto
        ? window.crypto
        : (globalThis as any).crypto;
    if (!cryptoInstance || !cryptoInstance.subtle) {
      throw new Error('Web Cryptography API is unavailable in this environment');
    }

    const cryptoKey = await cryptoInstance.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'HMAC', hash: { name: algorithm } },
      false,
      ['sign']
    );

    // Calculate HMAC
    const signature = await cryptoInstance.subtle.sign('HMAC', cryptoKey, counterBuffer);
    const hmacResult = new Uint8Array(signature);

    // Dynamic truncation (RFC 4226)
    const offset = hmacResult[hmacResult.length - 1] & 0x0f;
    const binary =
      ((hmacResult[offset] & 0x7f) << 24) |
      ((hmacResult[offset + 1] & 0xff) << 16) |
      ((hmacResult[offset + 2] & 0xff) << 8) |
      (hmacResult[offset + 3] & 0xff);

    const otp = binary % Math.pow(10, digits);
    return otp.toString().padStart(digits, '0');
  }

  /**
   * Returns remaining seconds until next code refresh
   */
  static getRemainingSeconds(period: number = 30, timeSeconds: number = Math.floor(Date.now() / 1000)): number {
    const elapsed = timeSeconds % period;
    return period - elapsed;
  }

  /**
   * Returns progress fraction from 0.0 to 1.0 of the current period
   */
  static getProgress(period: number = 30, timeSeconds: number = Math.floor(Date.now() / 1000)): number {
    const elapsed = timeSeconds % period;
    return elapsed / period;
  }

  /**
   * Formats a 6-digit TOTP code into two 3-digit groups (e.g. "482 193")
   */
  static formatCode(code: string): string {
    if (code.length === 6) {
      return `${code.slice(0, 3)} ${code.slice(3)}`;
    }
    return code;
  }

  /**
   * Validates a candidate code against expected code within a tolerance window (+/- step)
   */
  static async verifyCode(
    secret: string,
    candidateCode: string,
    windowSteps: number = 1,
    period: number = 30
  ): Promise<boolean> {
    const normalizedCandidate = candidateCode.replace(/\s+/g, '');
    const currentEpoch = Math.floor(Date.now() / 1000);

    for (let step = -windowSteps; step <= windowSteps; step++) {
      try {
        const testTime = currentEpoch + step * period;
        const generated = await this.generateCode(secret, testTime, period);
        if (generated === normalizedCandidate) {
          return true;
        }
      } catch {
        continue;
      }
    }
    return false;
  }
}
