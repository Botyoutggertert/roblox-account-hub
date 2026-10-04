import React, { useEffect, useState } from 'react';
import { Link2, ShieldCheck, RefreshCw, LogOut, AlertTriangle, CheckCircle2, XCircle, ExternalLink, Shield, Key } from 'lucide-react';
import { RobloxAuthStatus, ConnectionStatus, OAuthDiagnostics } from '../types/roblox';
import { RobloxAuthorizationService } from '../services/robloxAuthorizationService';
import { formatDate } from '../utils/date';

interface RobloxConnectionPageProps {
  authStatus: RobloxAuthStatus;
  oauthError?: string;
  onStatusChange: (status: RobloxAuthStatus) => void;
  onOAuthErrorClear?: () => void;
}

const emptyDiagnostics: OAuthDiagnostics = {
  clientId: 'NOT CONFIGURED', authorization: 'NOT CONFIGURED', redirectUri: 'NOT CONFIGURED',
  callback: 'NOT CONFIGURED', tokenExchange: 'NOT CONFIGURED', userInfo: 'NOT CONFIGURED',
  tokenValidation: 'NOT CONFIGURED', maskedClientId: 'Not configured', redirectUriValue: 'Not configured',
};

export const RobloxConnectionPage: React.FC<RobloxConnectionPageProps> = ({
  authStatus,
  oauthError = '',
  onStatusChange,
  onOAuthErrorClear,
}) => {
  const [isChecking, setIsChecking] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [error, setError] = useState('');
  const [diagnostics, setDiagnostics] = useState<OAuthDiagnostics>(emptyDiagnostics);

  const refreshDiagnostics = () => RobloxAuthorizationService.getDiagnostics().then(setDiagnostics).catch(() => undefined);

  useEffect(() => {
    refreshDiagnostics();
    return RobloxAuthorizationService.onOAuthResult(result => {
      setIsAuthorizing(false);
      if (result.error) setError(result.error);
      if (result.status) onStatusChange(result.status);
      refreshDiagnostics();
    });
  }, [onStatusChange]);

  const handleConnectWithRoblox = async () => {
    setError('');
    onOAuthErrorClear?.();
    setIsAuthorizing(true);
    try {
      await RobloxAuthorizationService.initiateOAuthFlow();
      await refreshDiagnostics();
    } catch (err: any) {
      setIsAuthorizing(false);
      setError(err?.message || 'Unable to start Roblox OAuth.');
      await refreshDiagnostics();
    }
  };

  const handleCheckStatus = async () => {
    setIsChecking(true);
    setError('');
    try {
      const status = await RobloxAuthorizationService.checkStatus();
      onStatusChange(status);
    } catch (err: any) {
      setError(err?.message || 'Unable to verify the Roblox connection.');
    } finally {
      setIsChecking(false);
      await refreshDiagnostics();
    }
  };

  const handleDisconnect = async () => {
    setError('');
    try {
      await RobloxAuthorizationService.disconnect();
      onStatusChange(RobloxAuthorizationService.disconnectedStatus());
    } catch (err: any) {
      setError(err?.message || 'Unable to disconnect the Roblox account.');
      try {
        onStatusChange(await RobloxAuthorizationService.checkStatus());
      } catch {
        // Preserve the current verified state when the backend cannot be reached.
      }
    } finally {
      await refreshDiagnostics();
    }
  };

  const getStatusConfig = (status: ConnectionStatus) => {
    switch (status) {
      case 'CONNECTED': return { color: 'text-success', bg: 'bg-success/10 border-success/30', icon: CheckCircle2, label: 'Connected' };
      case 'NOT CONNECTED': return { color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/30', icon: XCircle, label: 'Not Connected' };
      case 'AUTHORIZATION EXPIRED': return { color: 'text-warning', bg: 'bg-warning/10 border-warning/30', icon: AlertTriangle, label: 'Authorization Expired' };
      case 'ACCESS REVOKED': return { color: 'text-danger', bg: 'bg-danger/10 border-danger/30', icon: XCircle, label: 'Access Revoked' };
      default: return { color: 'text-danger', bg: 'bg-danger/10 border-danger/30', icon: AlertTriangle, label: 'Connection Error' };
    }
  };

  const statusConfig = getStatusConfig(authStatus.status);
  const StatusIcon = statusConfig.icon;

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-background p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3"><Link2 className="w-7 h-7 text-primary" />Roblox Connection</h1>
          <p className="text-slate-400 mt-1">Official OAuth 2.0 connection with PKCE and verified Roblox identity.</p>
        </div>

        {(oauthError || error) && <div className="p-4 rounded-lg border border-danger/30 bg-danger/10 text-danger flex gap-3"><AlertTriangle className="w-5 h-5 shrink-0" /><span>{oauthError || error}</span></div>}

        <div className={`rounded-xl border p-6 ${statusConfig.bg}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${authStatus.status === 'CONNECTED' ? 'bg-success/20' : 'bg-slate-800'}`}><StatusIcon className={`w-7 h-7 ${statusConfig.color}`} /></div>
              <div><p className="text-sm text-slate-400">OAuth Status</p><h2 className={`text-xl font-bold ${statusConfig.color}`}>{statusConfig.label}</h2>{authStatus.status === 'CONNECTION ERROR' && oauthError && <p className="text-sm text-danger mt-1 max-w-xl">{oauthError}</p>}</div>
            </div>
            <div className="flex gap-2">
              {authStatus.status === 'CONNECTED' && <button onClick={handleCheckStatus} disabled={isChecking} className="btn-secondary"><RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />Verify</button>}
              <button onClick={handleConnectWithRoblox} disabled={isAuthorizing} className="btn-primary"><RefreshCw className={`w-4 h-4 ${isAuthorizing ? 'animate-spin' : ''}`} />{authStatus.status === 'CONNECTED' ? 'Reconnect' : isAuthorizing ? 'Waiting for Roblox…' : 'Connect with Roblox'}</button>
              {authStatus.status !== 'NOT CONNECTED' && <button onClick={handleDisconnect} className="btn-secondary text-danger"><LogOut className="w-4 h-4" />Disconnect</button>}
            </div>
          </div>
        </div>

        {authStatus.status === 'CONNECTED' && authStatus.userId && (
          <div className="panel p-6 grid md:grid-cols-[auto_1fr] gap-5">
            {authStatus.avatarUrl ? <img src={authStatus.avatarUrl} alt="Roblox avatar" className="w-24 h-24 rounded-xl bg-slate-800" /> : <div className="w-24 h-24 rounded-xl bg-slate-800 flex items-center justify-center"><ShieldCheck className="w-10 h-10 text-primary" /></div>}
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div><p className="text-slate-500">Username</p><p className="text-white font-medium">@{authStatus.username}</p></div>
              <div><p className="text-slate-500">Display Name</p><p className="text-white font-medium">{authStatus.displayName}</p></div>
              <div><p className="text-slate-500">Roblox User ID</p><p className="text-white font-mono">{authStatus.userId}</p></div>
              <div><p className="text-slate-500">Connected</p><p className="text-white">{formatDate(authStatus.connectedAt)}</p></div>
              <div><p className="text-slate-500">Last Verified</p><p className="text-white">{formatDate(authStatus.lastVerified || authStatus.lastChecked)}</p></div>
              <div><p className="text-slate-500">Scopes</p><p className="text-white">{authStatus.scope?.join(', ') || 'Not reported'}</p></div>
              <a href={authStatus.profileUrl} target="_blank" rel="noreferrer" className="text-primary flex items-center gap-1">Open Roblox profile <ExternalLink className="w-3 h-3" /></a>
            </div>
          </div>
        )}

        <div className="panel p-6">
          <h3 className="font-semibold text-white flex items-center gap-2"><Key className="w-5 h-5 text-primary" />Check User Diagnostics</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
            {(['clientId', 'authorization', 'redirectUri', 'callback', 'tokenExchange', 'userInfo', 'tokenValidation'] as const).map(key => (
              <div key={key} className="bg-slate-900/50 rounded-lg p-3 border border-slate-800">
                <p className="text-xs uppercase tracking-wide text-slate-500">{key.replace(/([A-Z])/g, ' $1')}</p>
                <p className={`mt-1 font-semibold ${diagnostics[key] === 'PASS' ? 'text-success' : diagnostics[key] === 'FAIL' ? 'text-danger' : 'text-slate-400'}`}>{diagnostics[key]}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 text-sm space-y-2 border-t border-slate-800 pt-4">
            <p className="flex justify-between gap-4"><span className="text-slate-500">Masked Client ID</span><span className="font-mono text-slate-300">{diagnostics.maskedClientId}</span></p>
            <p className="flex justify-between gap-4"><span className="text-slate-500">Redirect URI</span><span className="font-mono text-slate-300 break-all text-right">{diagnostics.redirectUriValue}</span></p>
          </div>
        </div>

        <div className="panel p-5 flex gap-3"><Shield className="w-5 h-5 text-success shrink-0" /><div><h3 className="text-white font-medium">Security</h3><p className="text-sm text-slate-400 mt-1">The app never displays client secrets or OAuth tokens. Connected is shown only after Roblox returns user information and the user ID is verified.</p></div></div>
      </div>
    </div>
  );
};
