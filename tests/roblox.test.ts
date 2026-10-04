import { describe, it, expect, beforeEach } from 'vitest';
import { calculateAccountAge, formatDate } from '../src/utils/date';
import { StorageService } from '../src/services/storageService';
import { RobloxAuthorizationService } from '../src/services/robloxAuthorizationService';
import { TotpAccount } from '../src/types/totp';

// Node test environment mock for localStorage
const storageMock: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (key: string) => storageMock[key] || null,
  setItem: (key: string, value: string) => {
    storageMock[key] = value;
  },
  removeItem: (key: string) => {
    delete storageMock[key];
  },
  clear: () => {
    for (const key of Object.keys(storageMock)) {
      delete storageMock[key];
    }
  },
};

describe('Roblox Utilities and Storage Suite', () => {
  beforeEach(() => {
    (globalThis as any).localStorage.clear();
  });

  it('calculates account age accurately across multiple durations', () => {
    const yearsAgo = new Date();
    yearsAgo.setFullYear(yearsAgo.getFullYear() - 5);
    yearsAgo.setMonth(yearsAgo.getMonth() - 3);

    const age = calculateAccountAge(yearsAgo.toISOString());
    expect(age).toContain('5 yr');

    expect(calculateAccountAge(undefined)).toBe('Not available');
    expect(calculateAccountAge('invalid-date')).toBe('Not available');
  });

  it('formats dates consistently', () => {
    const dateStr = '2006-02-27T21:06:40.300Z';
    const formatted = formatDate(dateStr);
    expect(formatted).toMatch(/Feb (27|28), 2006/);
    expect(formatDate(null)).toBe('Not available');
  });

  it('initializes TOTP accounts as empty list by default (no demo data)', () => {
    const accounts = StorageService.getTotpAccounts();
    expect(accounts).toEqual([]);
    expect(accounts.length).toBe(0);
  });

  it('supports adding, updating, and deleting TOTP accounts', () => {
    const account: TotpAccount = {
      id: 'acc_1',
      accountName: 'TestUser',
      secret: 'JBSWY3DPEHPK3PXP',
      period: 30,
      digits: 6,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    StorageService.addTotpAccount(account);
    expect(StorageService.getTotpAccounts().length).toBe(1);
    expect(StorageService.getTotpAccounts()[0].accountName).toBe('TestUser');

    const updated: TotpAccount = {
      ...account,
      accountName: 'UpdatedName',
    };
    StorageService.updateTotpAccount(updated);
    expect(StorageService.getTotpAccounts()[0].accountName).toBe('UpdatedName');

    StorageService.deleteTotpAccount('acc_1');
    expect(StorageService.getTotpAccounts().length).toBe(0);
  });

  it('never creates a connected Roblox identity without verified OAuth user info', async () => {
    expect(RobloxAuthorizationService.getAuthStatus().status).toBe('NOT CONNECTED');
    expect('connectAccount' in RobloxAuthorizationService).toBe(false);

    await RobloxAuthorizationService.disconnect();
    expect(RobloxAuthorizationService.getAuthStatus().status).toBe('NOT CONNECTED');
  });

  it('reports an unconfigured OAuth client without exposing credentials', async () => {
    const diagnostics = await RobloxAuthorizationService.getDiagnostics();
    expect(diagnostics.clientId).toBe('NOT CONFIGURED');
    expect(diagnostics.authorization).toBe('NOT CONFIGURED');
    expect(diagnostics.maskedClientId).toBe('Not configured');
    expect(JSON.stringify(diagnostics)).not.toContain('access_token');
    expect(JSON.stringify(diagnostics)).not.toContain('client_secret');
  });

  it('rejects OAuth before navigation when no real client ID is configured', async () => {
    await expect(RobloxAuthorizationService.initiateOAuthFlow()).rejects.toThrow('not configured');
  });
});
