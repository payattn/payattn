#!/bin/bash

echo "Testing impression settlement endpoint..."
echo ""

curl -X POST "http://localhost:3000/api/publisher/impressions" \
  -H "Content-Type: application/json" \
  -d '{
    "offerId": "offer_test_v2_nopub",
    "publisherId": "pub_001",
    "duration": 2000
  }' | jq '.'

echo ""
echo "Test complete."
