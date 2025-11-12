#!/bin/bash

# Test POST /api/publisher/impressions endpoint
# This simulates a publisher SDK reporting that a user viewed an ad

set -e

echo "=== Testing Impression Settlement Endpoint ==="
echo ""

# Load environment
source <(grep -v "^#" ../../backend/.env.local | sed 's/^/export /')

# Configuration
OFFER_ID="offer_41f8f17d3b6bebd6"  # Funded offer from test data
PUBLISHER_ID="pub_001"              # Test publisher
DURATION=2000                        # 2 seconds (must be >= 1000ms)
BACKEND_URL="http://localhost:3001"

echo "Configuration:"
echo "  Offer ID: $OFFER_ID"
echo "  Publisher ID: $PUBLISHER_ID"
echo "  Duration: ${DURATION}ms"
echo "  Backend: $BACKEND_URL"
echo ""

# Check if backend is running
echo "1. Checking if backend is running..."
if ! curl -s "$BACKEND_URL/api/debug-env" > /dev/null 2>&1; then
    echo "[ERROR] Backend not running on port 3001"
    echo "        Start it with: cd ../../backend && npm run dev"
    exit 1
fi
echo "[OK] Backend is running"
echo ""

# Report impression
echo "2. Reporting impression..."
echo ""

RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/publisher/impressions" \
  -H "Content-Type: application/json" \
  -d "{
    \"offerId\": \"$OFFER_ID\",
    \"publisherId\": \"$PUBLISHER_ID\",
    \"duration\": $DURATION
  }")

echo "Response:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

# Parse result
SETTLED=$(echo "$RESPONSE" | jq -r '.settled // false' 2>/dev/null)

if [ "$SETTLED" = "true" ]; then
    echo "[OK] Settlement succeeded!"
    echo ""
    echo "View transactions:"
    echo "$RESPONSE" | jq -r '.transactions[]? | "  \(.type): \(.explorerUrl // "pending")"' 2>/dev/null
else
    echo "[WARN] Settlement partially failed or pending"
    echo ""
    echo "Check failed settlements:"
    echo "  curl $BACKEND_URL/api/admin/settlements/failed | jq"
fi

echo ""
echo "=== Test Complete ==="
