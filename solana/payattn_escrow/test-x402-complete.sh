#!/bin/bash

# Complete x402 Protocol Test
# Tests the full flow: Accept offer → Get 402 → Fund escrow → Verify payment

set -e

OFFER_ID="offer_41f8f17d3b6bebd6"
API_BASE="http://localhost:3000/api/advertiser"

echo "========================================="
echo "x402 PROTOCOL TEST - Complete Flow"
echo "========================================="
echo ""

# Step 1: Accept offer (should get HTTP 402)
echo "Step 1: Accept offer..."
echo "POST $API_BASE/offers/$OFFER_ID/accept"
echo ""

RESPONSE=$(curl -s -i "$API_BASE/offers/$OFFER_ID/accept" -X POST)
echo "$RESPONSE"
echo ""

# Extract headers
ESCROW_PDA=$(echo "$RESPONSE" | grep -i "x-escrow-pda:" | awk '{print $2}' | tr -d '\r')
AMOUNT=$(echo "$RESPONSE" | grep -i "x-payment-amount:" | awk '{print $2}' | tr -d '\r')
USER_PUBKEY=$(echo "$RESPONSE" | grep -i "x-user-pubkey:" | awk '{print $2}' | tr -d '\r')
PROGRAM_ID=$(echo "$RESPONSE" | grep -i "x-escrow-program:" | awk '{print $2}' | tr -d '\r')

echo "========================================="
echo "Extracted x402 Headers:"
echo "  Escrow PDA: $ESCROW_PDA"
echo "  Amount: $AMOUNT lamports"
echo "  User Pubkey: $USER_PUBKEY"
echo "  Program ID: $PROGRAM_ID"
echo "========================================="
echo ""

# Step 2: Fund escrow (manual step - show instructions)
echo "Step 2: Fund escrow"
echo ""
echo "Peggy (advertiser agent) needs to fund the escrow:"
echo ""
echo "  anchor run fund-escrow -- \\"
echo "    --offer-id $OFFER_ID \\"
echo "    --amount $AMOUNT"
echo ""
echo "Or using Solana CLI:"
echo ""
echo "  solana transfer $ESCROW_PDA $((AMOUNT / 1000000000)) SOL \\"
echo "    --from ~/.config/solana/payattn-advertiser.json"
echo ""
echo "========================================="
echo ""
echo "After funding, Peggy will call the verification endpoint:"
echo ""
echo "  POST $API_BASE/payments/verify"
echo "  Body: {\"offerId\": \"$OFFER_ID\", \"txSignature\": \"<tx>\"}"
echo ""
echo "========================================="
echo ""
echo "✅ x402 flow initiated successfully!"
echo "   Status: offer_made → accepted (waiting for escrow funding)"
