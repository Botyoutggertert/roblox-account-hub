import React, { useState, useEffect } from 'react';
import { TopBar, NavTab } from './components/navigation/TopBar';
import { HomePage } from './pages/HomePage';
import { CheckUserPage } from './pages/CheckUserPage';
import { AuthenticatorPage } from './pages/AuthenticatorPage';
import { RobloxConnectionPage } from './pages/RobloxConnectionPage';

import { StorageService } from './services/storageService';
import { RobloxAuthorizationService } from './services/robloxAuthorizationService';
import { TotpAccount } from './types/totp';
import { RobloxAuthStatus } from './types/roblox';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [totpAccounts, setTotpAccounts] = useState<TotpAccount[]>([]);
  const [authStatus, setAuthStatus] = useState<RobloxAuthStatus>({
    status: 'NOT CONNECTED',
    lastChecked: new Date().toISOString(),
  });
  const [oauthError, setOauthError] = useState('');

  // TOTP data is local, but authorization is always reconciled with its runtime owner.
  useEffect(() => {
    let active = true;
    setTotpAccounts(StorageService.getTotpAccounts());

    const reconcileAuthorization = async () => {
      try {
        const callbackStatus = await RobloxAuthorizationService.handleWebCallback();
        const status = callbackStatus || await RobloxAuthorizationService.checkStatus();
        if (active) setAuthStatus(status);
      } catch (error) {
        // A cached Connected status is never trusted when runtime verification fails.
        const failed: RobloxAuthStatus = {
          status: 'CONNECTION ERROR',
          lastChecked: new Date().toISOString(),
          oauthStatus: 'FAIL',
          tokenStatus: 'FAIL',
        };
        RobloxAuthorizationService.saveAuthStatus(failed);
        if (active) {
          setAuthStatus(failed);
          setOauthError(error instanceof Error ? error.message : 'The Roblox connection could not be completed.');
          setCurrentTab('roblox-connection');
        }
      }
    };

    void reconcileAuthorization();
    return () => { active = false; };
  }, []);

  // TOTP Handlers
  const handleAddTotp = (account: TotpAccount) => {
    StorageService.addTotpAccount(account);
    setTotpAccounts(StorageService.getTotpAccounts());
  };

  const handleUpdateTotp = (account: TotpAccount) => {
    StorageService.updateTotpAccount(account);
    setTotpAccounts(StorageService.getTotpAccounts());
  };

  const handleDeleteTotp = (id: string) => {
    StorageService.deleteTotpAccount(id);
    setTotpAccounts(StorageService.getTotpAccounts());
  };

  // Auth Status Handlers
  const handleAuthStatusChange = (status: RobloxAuthStatus) => {
    StorageService.saveAuthStatus(status);
    setAuthStatus(status);
  };

  return (
    <div className="min-h-screen bg-background text-slate-100 flex flex-col font-sans selection:bg-primary/30 selection:text-white">
      {/* Universal TopBar with real-time status and tabs */}
      <TopBar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        connectionStatus={authStatus.status}
      />

      {/* Main Content Pane */}
      <main className="flex-1 w-full overflow-y-auto custom-scrollbar">
        {currentTab === 'home' && <HomePage onNavigate={setCurrentTab} />}
        {currentTab === 'check-user' && <CheckUserPage />}
        {currentTab === 'authenticator' && (
          <AuthenticatorPage
            accounts={totpAccounts}
            onAddAccount={handleAddTotp}
            onUpdateAccount={handleUpdateTotp}
            onDeleteAccount={handleDeleteTotp}
          />
        )}
        {currentTab === 'roblox-connection' && (
          <RobloxConnectionPage
            authStatus={authStatus}
            oauthError={oauthError}
            onStatusChange={handleAuthStatusChange}
            onOAuthErrorClear={() => setOauthError('')}
          />
        )}
      </main>
    </div>
  );
};

export default App;
