// RFC 4648 Base32 implementation for TOTP Secrets (Offline)

const RFC4648_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function decodeBase32(input: string): Uint8Array {
  // Clean input: remove spaces, hyphens, and convert to uppercase
  const cleaned = input.toUpperCase().replace(/[\s\-_=]/g, '');

  if (cleaned.length === 0) {
    return new Uint8Array(0);
  }

  let bits = 0;
  let value = 0;
  let index = 0;
  const output = new Uint8Array(Math.ceil((cleaned.length * 5) / 8));

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    const val = RFC4648_ALPHABET.indexOf(char);
    if (val === -1) {
      throw new Error(`Invalid Base32 character encountered: '${char}'`);
    }

    value = (value << 5) | val;
    bits += 5;

    if (bits >= 8) {
      output[index++] = (value >>> (bits - 8)) & 0xff;
      bits -= 8;
    }
  }

  return output.slice(0, index);
}

export const base32Decode = decodeBase32;

export function encodeBase32(buffer: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += RFC4648_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += RFC4648_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

export function isValidBase32(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  const cleaned = input.toUpperCase().replace(/[\s\-_=]/g, '');
  if (cleaned.length === 0) return false;
  for (let i = 0; i < cleaned.length; i++) {
    if (!RFC4648_ALPHABET.includes(cleaned[i])) {
      return false;
    }
  }
  return true;
}
