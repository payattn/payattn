'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAuth } from '@/hooks/useAuth';
import {
  saveProfile,
  loadProfile,
  deleteProfile,
  getAllStoredWallets,
  type UserProfile,
  type SWExecutionLog,
  type SWRuntimeStatus,
} from '@/lib/storage-kds';
import { getLogsIDB, clearLogsIDB, getStatusIDB } from '@/lib/storage-idb';
import {
  registerServiceWorker,
  unregisterServiceWorker,
  getServiceWorkerStatus,
  triggerManualSync,
  type ServiceWorkerStatus,
} from '@/lib/service-worker-manager';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const WalletMultiButton = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
);

export default function StorageTestPage() {
  const { publicKey, connected } = useWallet();
  const { isAuthenticated, authenticate, clearAuth } = useAuth();
  
  const [age, setAge] = useState('25');
  const [gender, setGender] = useState('prefer not to say');
  const [interests, setInterests] = useState('web3, technology, finance');
  const [country, setCountry] = useState('US');
  const [state, setState] = useState('CA');
  const [incomeRange, setIncomeRange] = useState('$50k-$100k');
  const [maxAdsPerHour, setMaxAdsPerHour] = useState('10');
  const [painThreshold, setPainThreshold] = useState('5');
  
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null);
  const [storedWallets, setStoredWallets] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  const [lastWallet, setLastWallet] = useState<string | null>(null);
  
  const [swStatus, setSwStatus] = useState<ServiceWorkerStatus | null>(null);
  const [swLogs, setSwLogs] = useState<SWExecutionLog[]>([]);
  const [swRuntimeStatus, setSwRuntimeStatus] = useState<SWRuntimeStatus | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [autoRunEnabled, setAutoRunEnabled] = useState(false);
  const [autoRunInterval, setAutoRunInterval] = useState<NodeJS.Timeout | null>(null);
  
  const refreshWalletList = async () => {
    if (typeof window !== 'undefined') {
      const wallets = await getAllStoredWallets();
      setStoredWallets(wallets);
    }
  };
  
  const loadSwLogs = async () => {
    const logs = await getLogsIDB();
    setSwLogs(logs);
  };
  
  const loadSwRuntimeStatus = async () => {
    const status = await getStatusIDB();
    setSwRuntimeStatus(status);
  };
  
  const clearFormFields = () => {
    setAge('25');
    setGender('prefer not to say');
    setInterests('web3, technology, finance');
    setCountry('US');
    setState('CA');
    setIncomeRange('$50k-$100k');
    setMaxAdsPerHour('10');
    setPainThreshold('5');
  };
  
  const loadUserProfile = async () => {
    if (!publicKey) return;
    
    try {
      const profile = await loadProfile(publicKey.toBase58());
      setCurrentProfile(profile);
      
      if (profile) {
        if (profile.demographics) {
          setAge(profile.demographics.age.toString());
          setGender(profile.demographics.gender || 'prefer not to say');
        }
        if (profile.interests) {
          setInterests(profile.interests.join(', '));
        }
        if (profile.location) {
          setCountry(profile.location.country);
          setState(profile.location.state || '');
        }
        if (profile.financial) {
          setIncomeRange(profile.financial.incomeRange || '');
        }
        if (profile.preferences) {
          setMaxAdsPerHour(profile.preferences.maxAdsPerHour.toString());
          setPainThreshold(profile.preferences.painThreshold.toString());
        }
        setStatus(' Profile loaded');
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
      setStatus(' Failed to load profile');
    }
  };
  
  useEffect(() => {
    if (connected && publicKey) {
      const pubKeyStr = publicKey.toBase58();
      
      if (lastWallet && lastWallet !== pubKeyStr) {
        clearAuth();
        setCurrentProfile(null);
        clearFormFields();
        setLastWallet(pubKeyStr);
        setStatus(` New wallet: ${pubKeyStr.substring(0, 8)}...`);
        return;
      }
      
      setLastWallet(pubKeyStr);
      
      if (isAuthenticated) {
        loadUserProfile();
        setStatus(` Session active`);
      } else {
        setStatus(` Wallet connected`);
      }
    } else {
      setStatus(lastWallet ? ' Disconnected' : 'Connect wallet');
      setLastWallet(null);
    }
  }, [connected, publicKey, isAuthenticated, lastWallet]);
  
  useEffect(() => {
    refreshWalletList();
    getServiceWorkerStatus().then(setSwStatus);
    loadSwLogs();
    loadSwRuntimeStatus();
    
    // Check if auto-run was enabled
    const autoRunSaved = localStorage.getItem('payattn_autorun_enabled');
    if (autoRunSaved === 'true') {
      setAutoRunEnabled(true);
    }
    
    // Listen for messages from Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('[App] Message from SW:', event.data);
        
        if (event.data.type === 'SYNC_COMPLETE') {
          // Update logs and status from SW response
          if (event.data.logs) {
            localStorage.setItem('payattn_sw_logs', JSON.stringify(event.data.logs));
            setSwLogs(event.data.logs);
          }
          if (event.data.status) {
            localStorage.setItem('payattn_sw_status', JSON.stringify(event.data.status));
            setSwRuntimeStatus(event.data.status);
          }
        }
      });
    }
  }, []);
  
  const handleAuthenticate = async () => {
    if (!publicKey) return;
    try {
      setStatus('Requesting signature...');
      const success = await authenticate();
      if (success) {
        setStatus(' Authenticated (24h)');
        await loadUserProfile();
      } else {
        setStatus(' Failed');
      }
    } catch (error) {
      setStatus(' Cancelled');
    }
  };
  
  const handleSaveProfile = async () => {
    if (!publicKey || !isAuthenticated) {
      setStatus(' Authenticate first');
      return;
    }
    
    try {
      const profile: UserProfile = {
        demographics: { age: parseInt(age) || 25, gender },
        interests: interests.split(',').map(s => s.trim()).filter(Boolean),
        location: { country, state: state || undefined },
        financial: { incomeRange: incomeRange || undefined },
        preferences: {
          maxAdsPerHour: parseInt(maxAdsPerHour) || 10,
          painThreshold: parseInt(painThreshold) || 5,
        },
        encryptedAt: new Date().toISOString(),
      };
      
      await saveProfile(profile, publicKey.toBase58());
      setCurrentProfile(profile);
      refreshWalletList();
      setStatus(' Saved');
      
      if (!swStatus?.registered) {
        setStatus(' Saved - Registering SW...');
        const status = await registerServiceWorker();
        setSwStatus(status);
        setStatus(status.registered ? ' Saved & SW registered!' : ' Saved');
      }
    } catch (error) {
      setStatus(' Save failed');
    }
  };
  
  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      setStatus(' Running service worker...');
      
      // Load all profiles to send to SW (SW can't access localStorage)
      const wallets = await getAllStoredWallets();
      const profiles: Array<{ publicKey: string; profile: any }> = [];
      
      for (const walletAddress of wallets) {
        try {
          const profile = await loadProfile(walletAddress);
          if (profile) {
            profiles.push({
              publicKey: walletAddress,
              profile,
            });
          }
        } catch (error) {
          console.warn(`[App] Skipping corrupted profile for ${walletAddress}:`, error);
          // Skip corrupted profiles, continue with others
        }
      }
      
      console.log(`[App] Sending ${profiles.length} profiles to SW`);
      
      // Get current logs
      const currentLogs = await getLogsIDB();
      
      // Trigger manual sync with profile data
      await triggerManualSync(profiles, currentLogs);
      
      // Wait for SW to process
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Reload logs and status
      await loadSwLogs();
      await loadSwRuntimeStatus();
      
      const logs = await getLogsIDB();
      const lastLog = logs[logs.length - 1];
      
      if (lastLog && lastLog.success) {
        setStatus(` Sync completed! ${lastLog.error || ''}`);
      } else if (lastLog && !lastLog.success) {
        setStatus(` Sync completed with error: ${lastLog.error}`);
      } else {
        setStatus(' Sync triggered - check execution log');
      }
    } catch (error) {
      setStatus(' Sync failed');
      console.error('Manual sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  };
  
  const toggleAutoRun = () => {
    if (autoRunEnabled) {
      // Stop auto-run
      if (autoRunInterval) {
        clearInterval(autoRunInterval);
        setAutoRunInterval(null);
      }
      setAutoRunEnabled(false);
      localStorage.setItem('payattn_autorun_enabled', 'false');
      setStatus(' Auto-run disabled');
    } else {
      // Start auto-run (every 30 minutes)
      const interval = setInterval(() => {
        console.log('[App] Auto-run triggered');
        handleManualSync();
      }, 30 * 60 * 1000); // 30 minutes
      
      setAutoRunInterval(interval);
      setAutoRunEnabled(true);
      localStorage.setItem('payattn_autorun_enabled', 'true');
      setStatus(' Auto-run enabled (every 30 mins)');
    }
  };
  
  // Set up auto-run interval when enabled
  useEffect(() => {
    if (autoRunEnabled && !autoRunInterval) {
      const interval = setInterval(() => {
        console.log('[App] Auto-run triggered');
        handleManualSync();
      }, 30 * 60 * 1000); // 30 minutes
      setAutoRunInterval(interval);
    }
    
    return () => {
      if (autoRunInterval) {
        clearInterval(autoRunInterval);
      }
    };
  }, [autoRunEnabled]);
  
  return (
    <div className="container mx-auto p-8 max-w-6xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">PayAttn Agent Dashboard</h1>
          <p className="text-gray-600 mt-2">Encrypted storage + Autonomous Service Worker</p>
        </div>
        <WalletMultiButton />
      </div>
      
      {status && <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded">{status}</div>}
      
      {currentProfile && (
        <Card className="mb-6 border-green-500">
          <CardHeader>
            <CardTitle className="text-green-700"> Active Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><strong>Age:</strong> {currentProfile.demographics?.age}</div>
              <div><strong>Gender:</strong> {currentProfile.demographics?.gender}</div>
              <div><strong>Location:</strong> {currentProfile.location?.country} {currentProfile.location?.state}</div>
              <div><strong>Income:</strong> {currentProfile.financial?.incomeRange}</div>
              <div className="col-span-2"><strong>Interests:</strong> {currentProfile.interests?.join(', ')}</div>
              <div><strong>Max Ads/Hr:</strong> {currentProfile.preferences?.maxAdsPerHour}</div>
              <div><strong>Pain Threshold:</strong> {currentProfile.preferences?.painThreshold}</div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {connected && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>1. Authentication</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Wallet</Label>
                <p className="text-sm">{connected ? ` ${publicKey?.toBase58().substring(0, 8)}...` : ' Not connected'}</p>
              </div>
              <div>
                <Label>Session</Label>
                <p className="text-sm">{isAuthenticated ? ' Active (24h)' : ' Not authenticated'}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAuthenticate} disabled={!connected || isAuthenticated}>Verify Wallet</Button>
              <Button onClick={() => { clearAuth(); setCurrentProfile(null); clearFormFields(); setStatus(' Logged out - you can now switch wallets'); }} variant="outline" disabled={!isAuthenticated}>Logout</Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>2. Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Age</Label><Input type="number" value={age} onChange={(e) => setAge(e.target.value)} disabled={!isAuthenticated} /></div>
            <div><Label>Gender</Label><Input value={gender} onChange={(e) => setGender(e.target.value)} disabled={!isAuthenticated} /></div>
            <div className="col-span-2"><Label>Interests</Label><Input value={interests} onChange={(e) => setInterests(e.target.value)} disabled={!isAuthenticated} /></div>
            <div><Label>Country</Label><Input value={country} onChange={(e) => setCountry(e.target.value)} disabled={!isAuthenticated} /></div>
            <div><Label>State</Label><Input value={state} onChange={(e) => setState(e.target.value)} disabled={!isAuthenticated} /></div>
            <div className="col-span-2"><Label>Income</Label><Input value={incomeRange} onChange={(e) => setIncomeRange(e.target.value)} disabled={!isAuthenticated} /></div>
            <div><Label>Max Ads/Hr</Label><Input type="number" value={maxAdsPerHour} onChange={(e) => setMaxAdsPerHour(e.target.value)} disabled={!isAuthenticated} /></div>
            <div><Label>Pain (1-10)</Label><Input type="number" min="1" max="10" value={painThreshold} onChange={(e) => setPainThreshold(e.target.value)} disabled={!isAuthenticated} /></div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSaveProfile} disabled={!isAuthenticated}> Save</Button>
            <Button onClick={loadUserProfile} variant="outline" disabled={!isAuthenticated}> Reload</Button>
            <Button onClick={() => { deleteProfile(publicKey!.toBase58()); setCurrentProfile(null); clearFormFields(); refreshWalletList(); setStatus(' Deleted'); }} variant="destructive" disabled={!isAuthenticated}> Delete</Button>
          </div>
        </CardContent>
      </Card>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>3. Service Worker Agent</CardTitle>
          <CardDescription>Background process that checks for ads every 30 minutes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Process Status</Label>
              <p className="text-sm font-semibold">
                {swStatus?.registered ? ' Active' : ' Inactive'}
              </p>
            </div>
            <div>
              <Label>Auto-Run (30 min interval)</Label>
              <p className="text-sm font-semibold">
                {autoRunEnabled ? ' Enabled' : ' Disabled'}
              </p>
            </div>
          </div>
          
          {swRuntimeStatus?.lastRunAt && (
            <div className="bg-blue-50 border border-blue-200 rounded p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">Last Run:</span>
                <span>{new Date(swRuntimeStatus.lastRunAt).toLocaleString()}</span>
              </div>
              {swRuntimeStatus.nextRunAt && (
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Next Run:</span>
                  <span>{new Date(swRuntimeStatus.nextRunAt).toLocaleString()}</span>
                </div>
              )}
            </div>
          )}
          
          {!swRuntimeStatus?.lastRunAt && swStatus?.registered && (
            <div className="bg-gray-50 border border-gray-200 rounded p-3">
              <p className="text-sm text-gray-600">No executions yet. Press Sync to run manually.</p>
            </div>
          )}
          
          <div className="flex gap-2">
            <Button 
              onClick={async () => { const s = await registerServiceWorker(); setSwStatus(s); loadSwRuntimeStatus(); }} 
              disabled={swStatus?.registered}
            >
              Start Process
            </Button>
            <Button 
              onClick={async () => { 
                if (autoRunEnabled) toggleAutoRun(); // Stop auto-run first
                await unregisterServiceWorker(); 
                setSwStatus({ registered: false, periodicSyncEnabled: false }); 
                setSwRuntimeStatus(null); 
              }} 
              variant="outline" 
              disabled={!swStatus?.registered}
            >
              Stop Process
            </Button>
            <Button 
              onClick={toggleAutoRun}
              disabled={!swStatus?.registered}
              variant={autoRunEnabled ? "destructive" : "secondary"}
            >
              {autoRunEnabled ? ' Disable Auto-Run' : ' Enable Auto-Run'}
            </Button>
            <Button 
              onClick={handleManualSync}
              disabled={!swStatus?.registered || isSyncing}
              variant="secondary"
            >
              {isSyncing ? ' Running...' : ' Run Now'}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>4. Execution History</CardTitle>
          <CardDescription>Recent Service Worker runs</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between">
            <p className="text-sm">{swLogs.length} execution(s) logged</p>
            <div className="flex gap-2">
              <Button onClick={async () => { await loadSwLogs(); await loadSwRuntimeStatus(); }} variant="outline" size="sm"> Refresh</Button>
              <Button onClick={async () => { await clearLogsIDB(); setSwLogs([]); }} variant="ghost" size="sm">Clear</Button>
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {swLogs.length > 0 ? [...swLogs].reverse().map((log, idx) => (
              <div key={idx} className={`p-3 rounded border text-sm ${log.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex justify-between items-start">
                  <span className="text-xs text-gray-600">{new Date(log.timestamp).toLocaleString()}</span>
                  <span className="font-medium">{log.success ? '' : ''} {log.profilesProcessed} profile(s)</span>
                </div>
                {log.error && <p className={`text-xs mt-1 ${log.success ? 'text-gray-700' : 'text-red-600'}`}>{log.error}</p>}
              </div>
            )) : <p className="text-sm text-gray-500 text-center py-8">No executions yet. Press "Run Now" to test.</p>}
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Dev Info</CardTitle>
        </CardHeader>
        <CardContent>
          {storedWallets.length > 0 ? (
            <div className="space-y-2">
              {storedWallets.map((w, i) => (
                <div key={i} className="text-sm font-mono bg-gray-100 p-2 rounded flex justify-between">
                  <span>{w.substring(0, 20)}...{w.slice(-8)}</span>
                  {publicKey?.toBase58() === w && <span className="text-green-600"> Current</span>}
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-gray-500">No profiles</p>}
        </CardContent>
      </Card>
    </div>
  );
}
