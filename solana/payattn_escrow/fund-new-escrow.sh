#!/bin/bash

# Fund a new escrow with the updated contract structure
# This creates an escrow that works with the new 3-settlement design

export PATH="/tmp/solana-release/bin:$PATH"

# New offer ID
OFFER_ID="offer_test_v4_$(date +%s)"

# Wallets
ADVERTISER_KEYPAIR="$HOME/.config/solana/advertiser.json"
USER_PUBKEY="9kXHUnoYjB7eVUafsKFibrdHJWiYiX26vP7p7QX77nux"
PLATFORM_PUBKEY="G6Lbdq9JyQ3QR5YvKqpVC9KjPqAd9hSwWtHv3bPDrWTY"
AMOUNT=10000000  # 0.01 SOL

echo "========================================="
echo "Creating New Escrow with Updated Contract"
echo "========================================="
echo "Offer ID: $OFFER_ID"
echo "User: $USER_PUBKEY"
echo "Platform: $PLATFORM_PUBKEY"
echo "Amount: $AMOUNT lamports"
echo ""

# Build the command
cd /Users/jmd/nosync/org.payattn.main/solana/payattn_escrow

echo "Funding escrow on-chain..."
anchor run create-escrow -- \
  --offer-id "$OFFER_ID" \
  --advertiser "$ADVERTISER_KEYPAIR" \
  --user "$USER_PUBKEY" \
  --platform "$PLATFORM_PUBKEY" \
  --amount "$AMOUNT"

echo ""
echo "✅ Escrow created!"
echo ""
echo "To add to database, run:"
echo "INSERT INTO offers (offer_id, ad_id, user_pubkey, advertiser_pubkey, amount_lamports, status)"
echo "VALUES ('$OFFER_ID', 'ad_001', '$USER_PUBKEY', '$(solana-keygen pubkey $ADVERTISER_KEYPAIR)', $AMOUNT, 'funded');"
echo ""
echo "To test settlement:"
echo "curl -X POST \"http://localhost:3000/api/publisher/impressions\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"offerId\": \"$OFFER_ID\", \"publisherId\": \"pub_001\", \"duration\": 2000}'"
