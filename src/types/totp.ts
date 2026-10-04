// TOTP Authenticator Types
// RFC 6238 TOTP types for multi-account authenticator

export interface TotpAccount {
  id: string;
  accountName: string;
  secret: string; // Base32 encoded secret (offline only)
  issuer?: string;
  algorithm?: 'SHA1' | 'SHA256' | 'SHA512' | 'SHA-1' | 'SHA-256' | 'SHA-512';
  digits?: 6 | 8;
  period?: number; // default 30s
  createdAt: string;
  updatedAt: string;
}
