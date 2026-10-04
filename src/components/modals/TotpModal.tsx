import React, { useState, useEffect } from 'react';
import { KeyRound, X, AlertCircle } from 'lucide-react';
import { isValidBase32 } from '../../utils/base32';
import { TotpAccount } from '../../types/totp';

interface TotpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveAccount: (account: TotpAccount) => void;
  initialAccount?: TotpAccount | null;
}

export const TotpModal: React.FC<TotpModalProps> = ({
  isOpen,
  onClose,
  onSaveAccount,
  initialAccount,
}) => {
  const [accountName, setAccountName] = useState('');
  const [secret, setSecret] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialAccount) {
      setAccountName(initialAccount.accountName);
      setSecret(initialAccount.secret);
    } else {
      setAccountName('');
      setSecret('');
    }
    setError(null);
  }, [initialAccount, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = accountName.trim();
    const trimmedSecret = secret.trim().toUpperCase().replace(/[\s\-_]/g, '');

    if (!trimmedName) {
      setError('Username / Account name cannot be empty');
      return;
    }

    if (!trimmedSecret) {
      setError('Authenticator Secret cannot be empty');
      return;
    }

    if (!isValidBase32(trimmedSecret)) {
      setError('Invalid Base32 secret key. Allowed characters: A-Z and 2-7.');
      return;
    }

    const account: TotpAccount = {
      id: initialAccount ? initialAccount.id : `totp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      accountName: trimmedName,
      secret: trimmedSecret,
      period: 30,
      digits: 6,
      algorithm: 'SHA1',
      createdAt: initialAccount ? initialAccount.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSaveAccount(account);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none">
      <div className="w-full max-w-md bg-surface border border-surface-border rounded-3xl p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {initialAccount ? 'Edit Authenticator' : 'Add Authenticator'}
              </h2>
              <p className="text-xs text-slate-400">RFC 6238 Standard (6-digit, 30s)</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-surface-elevated transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Username
            </label>
            <input
              type="text"
              value={accountName}
              onChange={e => setAccountName(e.target.value)}
              placeholder="e.g. MyRobloxUser"
              className="w-full bg-surface-elevated border border-surface-border rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Authenticator Secret
            </label>
            <input
              type="text"
              value={secret}
              onChange={e => setSecret(e.target.value)}
              placeholder="e.g. JBSWY3DPEHPK3PXP"
              className="w-full font-mono uppercase bg-surface-elevated border border-surface-border rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Base32 secret provided by Roblox 2FA setup.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-surface-elevated hover:bg-slate-800 text-slate-300 text-xs font-bold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-lg shadow-purple-600/25 transition"
            >
              {initialAccount ? 'Save Changes' : 'Add Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
