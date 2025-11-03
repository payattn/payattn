'use client';

/**
 * Demo page for testing Encrypted Storage and JWT Token Management
 * WP01.2.3 & WP01.2.4 Implementation Test
 * REQUIRES: Phantom wallet connection (uses public key for encryption)
 */

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useWallet } from '@solana/wallet-adapter-react';
import { AuthService } from '@/lib/auth';
import { EncryptedStorage, UserProfile } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Import WalletMultiButton dynamically to avoid SSR hydration issues
const WalletMultiButton = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
);

export default function StorageTestPage() {
  // Wallet connection
  const { publicKey, signMessage, connected } = useWallet();
  
  // State
  const [hasVerified, setHasVerified] = useState<boolean>(false);
  const [sessionInfo, setSessionInfo] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [lastWallet, setLastWallet] = useState<string | null>(null);
  
  // Encryption test state
  const [plainText, setPlainText] = useState('');
  const [encryptedText, setEncryptedText] = useState('');
  const [decryptedText, setDecryptedText] = useState('');
  
  // Profile state
  const [profileAge, setProfileAge] = useState('25');
  const [profileInterests, setProfileInterests] = useState('web3, technology, finance');
  const [profileCountry, setProfileCountry] = useState('US');
  const [savedProfile, setSavedProfile] = useState<string>('');
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null);
  const [storedWallets, setStoredWallets] = useState<string[]>([]);

  // Check if wallet is connected and auto-load profile
  useEffect(() => {
    if (connected && publicKey) {
      const pubKeyStr = publicKey.toBase58();
      
      // Check if wallet changed (user swapped wallets)
      if (lastWallet && lastWallet !== pubKeyStr) {
        // Wallet changed - logout from previous wallet
        setStatus(`⚠️ Wallet changed - logging out from previous wallet`);
        setHasVerified(false);
        setCurrentProfile(null);
        setSavedProfile('');
        setSessionInfo('');
        localStorage.removeItem('payattn_wallet_verification');
        AuthService.clearSessionToken();
        setLastWallet(pubKeyStr);
        setStatus(`✅ New wallet connected: ${pubKeyStr.substring(0, 8)}... - Click "Verify Wallet" to login`);
        return;
      }
      
      setLastWallet(pubKeyStr);
      setStatus(`✅ Wallet connected: ${pubKeyStr.substring(0, 8)}...`);
      
      // Check if already verified (persistent across page reloads)
      const verificationData = localStorage.getItem('payattn_wallet_verification');
      if (verificationData) {
        try {
          const { walletAddress, timestamp } = JSON.parse(verificationData);
          const now = Date.now();
          const expiryDuration = 24 * 60 * 60 * 1000; // 24 hours
          
          // Check if same wallet and not expired
          if (walletAddress === pubKeyStr && (now - timestamp) < expiryDuration) {
            setHasVerified(true);
            
            const hoursRemaining = Math.floor((expiryDuration - (now - timestamp)) / (1000 * 60 * 60));
            
            // Update session info
            setSessionInfo(JSON.stringify({
              walletAddress: pubKeyStr,
              sessionRestored: new Date().toLocaleTimeString(),
              encryptionMethod: 'Public key based',
              expiresIn: `${hoursRemaining} hours`
            }, null, 2));
            
            // AUTO-LOAD: Try to load profile automatically
            autoLoadProfile(pubKeyStr);
            
            setStatus('✅ Wallet verified (session restored) - Profile auto-loaded');
            return;
          } else {
            // Expired or different wallet
            localStorage.removeItem('payattn_wallet_verification');
          }
        } catch (error) {
          localStorage.removeItem('payattn_wallet_verification');
        }
      }
      
      setStatus('✅ Wallet connected - Click "Verify Wallet" to sign and access your data');
    } else {
      // Wallet disconnected
      if (lastWallet) {
        setStatus('⚠️ Wallet disconnected - please reconnect');
      } else {
        setStatus('Please connect your Phantom wallet to continue');
      }
      setHasVerified(false);
      setLastWallet(null);
    }
  }, [connected, publicKey]);
  
  // Auto-load profile helper
  const autoLoadProfile = async (pubKey: string) => {
    try {
      const profile = await EncryptedStorage.loadProfile(pubKey);
      if (profile) {
        setSavedProfile(JSON.stringify(profile, null, 2));
        setCurrentProfile(profile);
        // Populate form fields
        if (profile.demographics?.age) setProfileAge(profile.demographics.age.toString());
        if (profile.interests) setProfileInterests(profile.interests.join(', '));
        if (profile.location?.country) setProfileCountry(profile.location.country);
      }
    } catch (error) {
      // Silently fail - profile might not exist yet or be corrupted
      console.log('No profile to auto-load');
    }
  };

  // Get all wallet addresses that have data stored
  const getStoredWallets = () => {
    const wallets: string[] = [];
    const prefix = 'payattn_profile_v1_';
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        const walletAddress = key.substring(prefix.length);
        wallets.push(walletAddress);
      }
    }
    
    return wallets;
  };

  // Update stored wallets list when component mounts or data changes
  useEffect(() => {
    setStoredWallets(getStoredWallets());
  }, [savedProfile, hasVerified]); // Refresh when profile is saved or verification changes

  // Request wallet signature for verification
  const verifyWallet = async () => {
    if (!connected || !signMessage || !publicKey) {
      setStatus('❌ Wallet not connected');
      return;
    }

    setStatus('⏳ Requesting signature to verify wallet ownership...');
    
    // Request signature to prove ownership
    const message = 'Sign to verify you own this wallet for payattn.org';
    const encodedMessage = new TextEncoder().encode(message);
    
    let signatureResult;
    try {
      signatureResult = await signMessage(encodedMessage);
    } catch (signError: any) {
      // User cancelled/rejected the signature request - this is normal behavior
      console.log('Signature request cancelled by user');
      
      // Only logout if they weren't already verified
      if (!hasVerified) {
        setHasVerified(false);
        localStorage.removeItem('payattn_wallet_verification');
      }
      
      // Friendly message for user
      const wasAlreadyLoggedIn = hasVerified;
      setStatus(
        wasAlreadyLoggedIn 
          ? '⚠️ Signature cancelled - you remain logged in' 
          : 'ℹ️ Signature cancelled - click "Verify Wallet" when ready to login'
      );
      return; // Exit early
    }

    // Signature succeeded - continue with verification
    try {
      const pubKeyStr = publicKey.toBase58();
      setHasVerified(true);
      
      // Store verification in localStorage with timestamp (persists across page reloads)
      const verificationData = {
        walletAddress: pubKeyStr,
        timestamp: Date.now()
      };
      localStorage.setItem('payattn_wallet_verification', JSON.stringify(verificationData));
      
      // Create session token
      const jwt = AuthService.createSessionToken(pubKeyStr, pubKeyStr);
      setSessionInfo(JSON.stringify({
        walletAddress: pubKeyStr,
        verified: new Date().toLocaleTimeString(),
        encryptionMethod: 'Public key based',
        sessionCreated: true,
        expiresIn: '24 hours'
      }, null, 2));
      
      // Auto-load profile
      autoLoadProfile(pubKeyStr);
      
      setStatus('✅ Wallet verified! You can now encrypt/decrypt data');
    } catch (error: any) {
      // Handle any other errors during session creation
      console.error('Error during session creation:', error);
      setStatus('❌ Error creating session - please try again');
      setHasVerified(false);
      localStorage.removeItem('payattn_wallet_verification');
    }
  };

  // ENCRYPT: Take plain text and encrypt it
  const handleEncrypt = async () => {
    if (!hasVerified || !publicKey) {
      setStatus('❌ Please verify wallet first (click "Verify Wallet")');
      return;
    }

    if (!plainText.trim()) {
      setStatus('❌ Enter some text to encrypt');
      return;
    }

    try {
      const pubKeyStr = publicKey.toBase58();
      const encrypted = await EncryptedStorage.encrypt(plainText, pubKeyStr);
      setEncryptedText(encrypted);
      setDecryptedText('');
      setStatus(`✅ Text encrypted! (${encrypted.length} characters)`);
    } catch (error) {
      setStatus(`❌ Encryption failed: ${error}`);
    }
  };

  // DECRYPT: Take encrypted text and decrypt it
  const handleDecrypt = async () => {
    if (!hasVerified || !publicKey) {
      setStatus('❌ Please verify wallet first (click "Verify Wallet")');
      return;
    }

    if (!encryptedText.trim()) {
      setStatus('❌ No encrypted text to decrypt');
      return;
    }

    try {
      const pubKeyStr = publicKey.toBase58();
      const decrypted = await EncryptedStorage.decrypt(encryptedText, pubKeyStr);
      setDecryptedText(decrypted);
      setStatus(`✅ Text decrypted successfully!`);
    } catch (error) {
      setStatus(`❌ Decryption failed: ${error}`);
    }
  };

  // SAVE PROFILE: Encrypt and save to localStorage
  const handleSaveProfile = async () => {
    if (!hasVerified || !publicKey) {
      setStatus('❌ Please verify wallet first (click "Verify Wallet")');
      return;
    }

    const profile: UserProfile = {
      demographics: {
        age: parseInt(profileAge) || 25,
        gender: 'prefer not to say',
      },
      interests: profileInterests.split(',').map(i => i.trim()).filter(Boolean),
      location: {
        country: profileCountry,
      },
      preferences: {
        maxAdsPerHour: 10,
        painThreshold: 5,
      },
    };

    try {
      const pubKeyStr = publicKey.toBase58();
      await EncryptedStorage.saveProfile(profile, pubKeyStr);
      setSavedProfile(JSON.stringify(profile, null, 2));
      setCurrentProfile(profile); // Update the top profile card
      setStatus('✅ Profile encrypted and saved to localStorage!');
    } catch (error) {
      setStatus(`❌ Error saving profile: ${error}`);
    }
  };

  // LOAD PROFILE: Read and decrypt from localStorage
  const handleLoadProfile = async () => {
    if (!hasVerified || !publicKey) {
      setStatus('❌ Please verify wallet first (click "Verify Wallet")');
      return;
    }

    try {
      const pubKeyStr = publicKey.toBase58();
      const profile = await EncryptedStorage.loadProfile(pubKeyStr);
      if (profile) {
        setSavedProfile(JSON.stringify(profile, null, 2));
        setCurrentProfile(profile);
        // Populate form fields
        if (profile.demographics?.age) setProfileAge(profile.demographics.age.toString());
        if (profile.interests) setProfileInterests(profile.interests.join(', '));
        if (profile.location?.country) setProfileCountry(profile.location.country);
        setStatus('✅ Profile loaded and decrypted!');
      } else {
        setSavedProfile('');
        setCurrentProfile(null);
        setStatus('❌ No saved profile found');
      }
    } catch (error) {
      console.error('Decryption error:', error);
      setStatus(`❌ Decryption failed - wrong wallet or corrupted data. Try saving a new profile.`);
    }
  };

  const logout = () => {
    // Only clear verification token, keep encrypted data
    AuthService.clearSessionToken();
    localStorage.removeItem('payattn_wallet_verification');
    
    // Clear UI state
    setSessionInfo('');
    setCurrentProfile(null);
    setSavedProfile('');
    setHasVerified(false);
    setPlainText('');
    setEncryptedText('');
    setDecryptedText('');
    
    setStatus('✅ Logged out (your encrypted data is still saved)');
  };

  const deleteMyData = async () => {
    if (!publicKey) return;
    
    const pubKeyStr = publicKey.toBase58();
    
    // Clear verification token AND delete THIS wallet's data
    AuthService.clearSessionToken();
    localStorage.removeItem('payattn_wallet_verification');
    await EncryptedStorage.deleteProfile(pubKeyStr);
    
    // Clear UI state
    setSessionInfo('');
    setCurrentProfile(null);
    setSavedProfile('');
    setHasVerified(false);
    setPlainText('');
    setEncryptedText('');
    setDecryptedText('');
    
    // Update stored wallets list
    setStoredWallets(getStoredWallets());
    
    setStatus('✅ Deleted your data and logged out (other wallets\' data preserved)');
  };

  return (
    <div className="container mx-auto p-8 max-w-7xl">
      <h1 className="text-3xl font-bold mb-2">
        🔐 Encrypted Storage Test Dashboard
      </h1>
      <p className="text-gray-600 mb-6">
        Requires Phantom wallet connection - Uses public key for deterministic encryption
      </p>
      
      {/* Status Bar */}
      <Card className="mb-6">
        <CardContent className="py-4">
          <p className="font-mono text-sm">{status || 'Ready'}</p>
        </CardContent>
      </Card>

      {/* Current Profile Display - Only show when logged in and has profile */}
      {hasVerified && currentProfile && (
        <Card className="mb-6 border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-green-600">✓</span> Your Profile
            </CardTitle>
            <CardDescription>Currently loaded and decrypted</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1">
                <div className="text-xs text-gray-500 uppercase font-semibold">Wallet</div>
                <div className="font-mono text-sm">
                  {publicKey?.toBase58().substring(0, 8)}...
                  {publicKey?.toBase58().substring(publicKey.toBase58().length - 8)}
                </div>
              </div>
              
              {currentProfile.demographics?.age && (
                <div className="space-y-1">
                  <div className="text-xs text-gray-500 uppercase font-semibold">Age</div>
                  <div className="text-lg font-semibold">{currentProfile.demographics.age}</div>
                </div>
              )}
              
              {currentProfile.location?.country && (
                <div className="space-y-1">
                  <div className="text-xs text-gray-500 uppercase font-semibold">Country</div>
                  <div className="text-lg font-semibold">{currentProfile.location.country}</div>
                </div>
              )}
              
              {currentProfile.interests && currentProfile.interests.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs text-gray-500 uppercase font-semibold">Interests</div>
                  <div className="text-sm">
                    {currentProfile.interests.slice(0, 3).join(', ')}
                    {currentProfile.interests.length > 3 && ` +${currentProfile.interests.length - 3} more`}
                  </div>
                </div>
              )}
            </div>
            
            {currentProfile.preferences && (
              <div className="mt-4 pt-4 border-t border-green-200">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {currentProfile.preferences.maxAdsPerHour && (
                    <div>
                      <span className="text-gray-500">Max ads/hour:</span>{' '}
                      <span className="font-semibold">{currentProfile.preferences.maxAdsPerHour}</span>
                    </div>
                  )}
                  {currentProfile.preferences.painThreshold !== undefined && (
                    <div>
                      <span className="text-gray-500">Pain threshold:</span>{' '}
                      <span className="font-semibold">{currentProfile.preferences.painThreshold}/10</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Wallet Connection */}
        <Card>
          <CardHeader>
            <CardTitle>1. Connect Wallet</CardTitle>
            <CardDescription>Login with Phantom to encrypt/decrypt data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center space-y-4">
              <WalletMultiButton />
              
              {connected && publicKey && (
                <>
                  <div className="text-sm text-gray-600">
                    Connected: {publicKey.toBase58().substring(0, 8)}...
                    {publicKey.toBase58().substring(publicKey.toBase58().length - 8)}
                  </div>
                  
                  {!hasVerified ? (
                    <Button 
                      onClick={verifyWallet} 
                      className="w-full"
                      variant="default"
                    >
                      🔓 Verify Wallet (Sign Message)
                    </Button>
                  ) : (
                    <div className="w-full space-y-2">
                      <div className="text-xs text-green-600 font-semibold text-center p-3 bg-green-50 rounded border border-green-200">
                        ✓ Wallet Verified - You're logged in!
                      </div>
                      <Button 
                        onClick={logout} 
                        className="w-full" 
                        variant="outline"
                      >
                        🚪 Logout
                      </Button>
                    </div>
                  )}
                </>
              )}
              
              {!connected && (
                <div className="text-sm text-gray-500 text-center">
                  Click the button above to connect your Phantom wallet
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Session Info */}
        <Card>
          <CardHeader>
            <CardTitle>Session Info</CardTitle>
            <CardDescription>Your current authentication status</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-slate-100 p-4 rounded text-xs overflow-auto max-h-48">
              {sessionInfo || 'No active session - verify wallet first'}
            </pre>
          </CardContent>
        </Card>
      </div>

      {/* Only show encryption tools if wallet is verified */}
      {hasVerified ? (
        <>
          {/* Encryption Test - Split View */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>2. Test Encryption/Decryption</CardTitle>
              <CardDescription>Watch your data get encrypted and decrypted in real-time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Plain Text Input */}
                <div className="space-y-2">
                  <Label htmlFor="plainText">
                    Plain Text (Original)
                  </Label>
                  <textarea
                    id="plainText"
                    value={plainText}
                    onChange={(e) => setPlainText(e.target.value)}
                    placeholder="Enter text to encrypt..."
                    className="w-full h-32 p-3 border rounded-md font-mono text-sm"
                  />
                  <Button 
                    onClick={handleEncrypt} 
                    className="w-full"
                    variant="default"
                  >
                    Encrypt →
                  </Button>
                </div>

                {/* Encrypted Text Display */}
                <div className="space-y-2">
                  <Label>
                    Encrypted (Base64)
                  </Label>
                  <textarea
                    value={encryptedText}
                    readOnly
                    placeholder="Encrypted text appears here..."
                    className="w-full h-32 p-3 border rounded-md bg-yellow-50 font-mono text-xs break-all"
                  />
                  <Button 
                    onClick={handleDecrypt} 
                    className="w-full"
                    variant="default"
                  >
                    → Decrypt
                  </Button>
                </div>

                {/* Decrypted Text Display */}
                <div className="space-y-2">
                  <Label>
                    Decrypted (Restored)
                  </Label>
                  <textarea
                    value={decryptedText}
                    readOnly
                    placeholder="Decrypted text appears here..."
                    className="w-full h-32 p-3 border rounded-md bg-green-50 font-mono text-sm"
                  />
                  <div className="text-xs text-center text-gray-600">
                    {decryptedText && plainText === decryptedText ? (
                      <span className="text-green-600 font-semibold">✓ Match!</span>
                    ) : decryptedText ? (
                      <span className="text-red-600">✗ Mismatch</span>
                    ) : (
                      <span>Waiting for decryption...</span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Profile Storage */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Profile Input */}
            <Card>
              <CardHeader>
                <CardTitle>3. Save Your Profile</CardTitle>
                <CardDescription>Enter profile data to encrypt and store</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="age">Age</Label>
                  <Input
                    id="age"
                    type="number"
                    value={profileAge}
                    onChange={(e) => setProfileAge(e.target.value)}
                    placeholder="25"
                  />
                </div>
                
                <div>
                  <Label htmlFor="interests">Interests (comma-separated)</Label>
                  <Input
                    id="interests"
                    value={profileInterests}
                    onChange={(e) => setProfileInterests(e.target.value)}
                    placeholder="web3, technology, finance"
                  />
                </div>
                
                <div>
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={profileCountry}
                    onChange={(e) => setProfileCountry(e.target.value)}
                    placeholder="US"
                  />
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleSaveProfile} className="flex-1" variant="default">
                    💾 Save & Encrypt
                  </Button>
                  <Button onClick={handleLoadProfile} className="flex-1" variant="outline">
                    📂 Load & Decrypt
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Saved Profile Display */}
            <Card>
              <CardHeader>
                <CardTitle>Saved Profile (Decrypted)</CardTitle>
                <CardDescription>What's stored (encrypted) in localStorage</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-slate-100 p-4 rounded text-xs overflow-auto max-h-80">
                  {savedProfile || 'No profile saved yet - use the form to save one'}
                </pre>
              </CardContent>
            </Card>
          </div>

          {/* Actions */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>4. Manage Data</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={deleteMyData} className="w-full" variant="destructive">
                🗑️ Delete My Data
              </Button>
              <p className="text-xs text-gray-500 text-center">
                Permanently delete your encrypted profile from this device. Other wallets' data is preserved.
              </p>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500 text-lg mb-4">
              🔒 Storage is locked
            </p>
            <p className="text-gray-400 text-sm">
              Connect your wallet and verify to access encryption features
            </p>
          </CardContent>
        </Card>
      )}

      {/* Testing Checklist */}
      <Card>
        <CardHeader>
          <CardTitle>Testing Checklist - Wallet-Based Encryption</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li>✅ 1. Click "Select Wallet" and connect Phantom</li>
            <li>✅ 2. Click "Verify Wallet" and approve signature request</li>
            <li>✅ 3. Type text in left box, encrypt, decrypt - verify match</li>
            <li>✅ 4. Fill profile form, click "Save & Encrypt"</li>
            <li>✅ 5. Refresh page - profile auto-loads! (no signature needed)</li>
            <li>✅ 6. Session persists for 24 hours or until you click "Clear All Data"</li>
            <li>✅ 7. Try with different wallet - can't decrypt others' data</li>
          </ul>
          
          <div className="mt-4 p-3 bg-blue-50 rounded text-sm">
            <strong>How it works:</strong> Your wallet's public key is used to derive the encryption key. 
            Once you sign to verify ownership, the verification is stored for 24 hours. You only need to 
            sign once, then you can reload the page and your data will be automatically decrypted!
          </div>
        </CardContent>
      </Card>

      {/* Dev Info - Stored Wallets */}
      <Card className="mt-6 border-purple-200 bg-purple-50">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            🔧 Dev Info: Wallets with Stored Data
          </CardTitle>
          <CardDescription className="text-xs">
            All wallet addresses that have encrypted profile data in localStorage
          </CardDescription>
        </CardHeader>
        <CardContent>
          {storedWallets.length > 0 ? (
            <div className="space-y-2">
              {storedWallets.map((wallet, index) => (
                <div 
                  key={wallet} 
                  className={`p-2 rounded font-mono text-xs ${
                    publicKey?.toBase58() === wallet 
                      ? 'bg-green-100 border border-green-300' 
                      : 'bg-white border border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>
                      {index + 1}. {wallet.substring(0, 8)}...{wallet.substring(wallet.length - 8)}
                    </span>
                    {publicKey?.toBase58() === wallet && (
                      <span className="text-green-600 font-semibold text-xs">← Current</span>
                    )}
                  </div>
                </div>
              ))}
              <div className="text-xs text-gray-500 mt-3">
                Total: {storedWallets.length} wallet{storedWallets.length !== 1 ? 's' : ''} with data
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500 text-center py-4">
              No wallet data stored yet - save a profile to see wallets listed here
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
