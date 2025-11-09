#!/bin/bash

# Test Script for KDS Authentication
# Run this after authenticating on localhost:3000/wallet-auth

echo "🔐 Testing KDS Authentication Security"
echo "========================================"
echo ""

# Test 1: Unauthenticated request (should fail with 401)
echo "Test 1: Unauthenticated request (should return 401)"
echo "----------------------------------------------------"
RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:3000/api/k/5e28467a1c7d3c1973a8fadc2e7202eaf5a0747433a87c795d6a61b42675d4b9)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "401" ]; then
    echo "✅ PASS: Got 401 Unauthorized"
    echo "   Response: $BODY"
else
    echo "❌ FAIL: Expected 401, got $HTTP_CODE"
    echo "   Response: $BODY"
fi
echo ""

# Test 2: Invalid signature (should fail with 403)
echo "Test 2: Invalid signature (should return 403)"
echo "----------------------------------------------"
RESPONSE=$(curl -s -w "\n%{http_code}" \
    -H "X-Wallet: FakeWalletAddress123" \
    -H "X-Auth-Token: FakeSignature123==" \
    http://localhost:3000/api/k/5e28467a1c7d3c1973a8fadc2e7202eaf5a0747433a87c795d6a61b42675d4b9)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "403" ]; then
    echo "✅ PASS: Got 403 Forbidden"
    echo "   Response: $BODY"
else
    echo "❌ FAIL: Expected 403, got $HTTP_CODE"
    echo "   Response: $BODY"
fi
echo ""

# Test 3: Check extension storage
echo "Test 3: Extension storage check"
echo "--------------------------------"
echo "To manually verify:"
echo "1. Open extension popup"
echo "2. Open Chrome DevTools console"
echo "3. Run: chrome.storage.local.get(['payattn_walletAddress', 'payattn_keyHash', 'payattn_authToken'])"
echo "4. Should see all three values after authentication"
echo ""

# Test 4: Profile persistence check
echo "Test 4: Profile persistence"
echo "---------------------------"
echo "Manual test steps:"
echo "1. Authenticate on website → create profile in extension"
echo "2. Disconnect wallet on website"
echo "3. Reconnect wallet (generates NEW signature)"
echo "4. Open extension popup → profile should still decrypt"
echo "   (Because keyHash is deterministic based on wallet address)"
echo ""

echo "🎉 Test script complete!"
echo ""
echo "Next steps:"
echo "- Start dev server: npm run dev"
echo "- Visit http://localhost:3000/wallet-auth"
echo "- Authenticate with Phantom wallet"
echo "- Run this script again to verify KDS security"
