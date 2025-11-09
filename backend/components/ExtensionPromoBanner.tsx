'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { isExtensionInstalled } from '@/lib/extension-detection';

export function ExtensionPromoBanner() {
  const [hasExtension, setHasExtension] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if banner was dismissed
    const wasDismissed = localStorage.getItem('extension_banner_dismissed');
    if (wasDismissed) {
      setDismissed(true);
    }

    // Check for extension
    isExtensionInstalled().then(setHasExtension);
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('extension_banner_dismissed', 'true');
  };

  // Don't show if extension is installed or banner was dismissed
  if (hasExtension || dismissed || hasExtension === null) {
    return null;
  }

  return (
    <Card className="mb-6 bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-300">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🚀</span>
              <h3 className="text-lg font-bold text-gray-900">
                Get the Full Experience - Install the Extension
              </h3>
            </div>
            
            <p className="text-sm text-gray-700 mb-3">
              Keep your ad queue stocked and your profile working 24/7
            </p>
            
            <div className="space-y-2 mb-4">
              <div className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Runs automatically every 30 minutes</p>
                  <p className="text-xs text-gray-600">Never run out of ads - the agent works in the background</p>
                </div>
              </div>
              
              <div className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <div>
                  <p className="text-sm font-semibold text-gray-900">100% local processing</p>
                  <p className="text-xs text-gray-600">Your data NEVER leaves your machine - unlike server-based systems</p>
                </div>
              </div>
              
              <div className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Zero-knowledge privacy</p>
                  <p className="text-xs text-gray-600">Only ZK proofs are sent - advertisers never see your real data</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <a 
                href="https://github.com/payattn/payattn/blob/main/extension/README.md" 
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button className="bg-blue-600 hover:bg-blue-700">
                  📥 Install Extension (2 mins)
                </Button>
              </a>
              <Button variant="ghost" onClick={handleDismiss} className="text-gray-600">
                Maybe later
              </Button>
            </div>
            
            <p className="text-xs text-gray-500 mt-3">
              <strong>Why an extension?</strong> Normally this would require sending your data to our servers. 
              With the extension, everything stays private on your device. We can't see your data - 
              only you can.
            </p>
          </div>
          
          <button 
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-600 ml-4"
          >
            ✕
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
