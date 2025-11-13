#!/bin/bash
# Pre-commit test script
# Run this before committing to catch issues early

set -e  # Exit on any error

echo "🧪 Running pre-commit tests..."
echo ""

# Backend tests
echo "🧪 Testing backend..."
cd backend
npm run test:ci
cd ..
echo "✅ Backend tests passed"
echo ""

# Agent tests  
echo "🤖 Testing advertiser-agent..."
cd advertiser-agent
NEXT_PUBLIC_SUPABASE_URL=https://test.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=test-key \
VENICE_API_KEY=test-key \
npm test --silent --passWithNoTests
cd ..
echo "✅ Agent tests passed"
echo ""

echo "🎉 All tests passed! Safe to commit."
