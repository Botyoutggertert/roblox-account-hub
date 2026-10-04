import React, { useState, useEffect } from 'react';
import {
  Copy,
  Check,
  Trash2,
  Edit2,
  Clock,
  KeyRound,
  ShieldCheck,
} from 'lucide-react';
import { TotpAccount } from '../../types/totp';
import { TotpService } from '../../services/totpService';

interface TotpCardProps {
  account: TotpAccount;
  onDelete: (id: string) => void;
  onEdit: (account: TotpAccount) => void;
  onCopySuccess: () => void;
}

export const TotpCard: React.FC<TotpCardProps> = ({
  account,
  onDelete,
  onEdit,
  onCopySuccess,
}) => {
  const [code, setCode] = useState<string>('------');
  const [remainingSec, setRemainingSec] = useState<number>(30);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    const updateOtp = async () => {
      try {
        const period = account.period || 30;
        const digits = account.digits || 6;
        const generated = await TotpService.generateCode(
          account.accountName ? account.secret : '',
          Math.floor(Date.now() / 1000),
          period,
          digits
        );
        if (isMounted) {
          setCode(generated);
          setRemainingSec(TotpService.getRemainingSeconds(period));
        }
      } catch (err) {
        if (isMounted) setCode('ERROR');
      }
    };

    updateOtp();
    const interval = setInterval(updateOtp, 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [account.secret, account.period, account.digits, account.accountName]);

  const handleCopy = async () => {
    if (code === '------' || code === 'ERROR') return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      onCopySuccess();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const formattedCode = TotpService.formatCode(code);

  return (
    <div className="p-6 rounded-3xl bg-surface border border-surface-border shadow-xl hover:border-surface-border/80 transition-all flex flex-col justify-between space-y-6">
      {/* Account Info Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center font-bold text-sm">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-white tracking-tight">
              {account.accountName}
            </h3>
            <span className="text-[11px] font-mono text-slate-500 uppercase">
              TOTP (RFC 6238)
            </span>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(account)}
            title="Edit Account"
            className="p-2 rounded-xl bg-surface-elevated hover:bg-slate-800 text-slate-400 hover:text-white border border-surface-border transition"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(account.id)}
            title="Delete Account"
            className="p-2 rounded-xl bg-surface-elevated hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-surface-border transition"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Code Display */}
      <div className="text-center py-4 bg-surface-elevated/70 rounded-2xl border border-surface-border/80">
        <div className="font-mono text-3xl sm:text-4xl font-black tracking-widest text-white select-all">
          {formattedCode}
        </div>
        <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-slate-400 font-mono">
          <Clock className="w-3.5 h-3.5 text-purple-400" />
          <span>Expires in <strong className="text-white font-bold">{remainingSec}s</strong></span>
        </div>
      </div>

      {/* Buttons: COPY, EDIT, DELETE */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={handleCopy}
          className="col-span-1 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-primary/20"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-white" />
              <span>COPIED</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              <span>COPY</span>
            </>
          )}
        </button>

        <button
          onClick={() => onEdit(account)}
          className="col-span-1 py-2.5 rounded-xl bg-surface-elevated hover:bg-slate-800 text-slate-300 hover:text-white border border-surface-border text-xs font-bold transition flex items-center justify-center gap-1.5"
        >
          <Edit2 className="w-4 h-4 text-slate-400" />
          <span>EDIT</span>
        </button>

        <button
          onClick={() => onDelete(account.id)}
          className="col-span-1 py-2.5 rounded-xl bg-surface-elevated hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-surface-border text-xs font-bold transition flex items-center justify-center gap-1.5"
        >
          <Trash2 className="w-4 h-4" />
          <span>DELETE</span>
        </button>
      </div>
    </div>
  );
};
