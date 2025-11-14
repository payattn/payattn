#!/bin/bash
set -e

echo "🧪 Testing coverage badge generation locally..."
echo ""

# Run backend tests with coverage
echo "📦 Running backend tests..."
cd backend
npm run test:coverage 2>&1 | tail -5
if [ ! -f coverage/coverage-summary.json ]; then
  echo "❌ Backend coverage-summary.json not generated"
  exit 1
fi
echo "✅ Backend coverage generated"
cd ..

# Run agent tests with coverage
echo "📦 Running agent tests..."
cd advertiser-agent
NEXT_PUBLIC_SUPABASE_URL=https://test.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key \
VENICE_API_KEY=test-venice-key \
SOLANA_RPC_URL=https://api.devnet.solana.com \
npm run test:coverage 2>&1 | tail -5
if [ ! -f coverage/coverage-summary.json ]; then
  echo "❌ Agent coverage-summary.json not generated"
  ls -la coverage/ || echo "Coverage directory doesn't exist"
  exit 1
fi
echo "✅ Agent coverage generated"
cd ..

# Simulate the badge generation step
echo ""
echo "🎨 Generating coverage badge JSON..."

# Extract coverage percentages
BACKEND_FUNCTIONS=$(node -pe "JSON.parse(require('fs').readFileSync('backend/coverage/coverage-summary.json')).total.functions.pct")
BACKEND_LINES=$(node -pe "JSON.parse(require('fs').readFileSync('backend/coverage/coverage-summary.json')).total.lines.pct")
BACKEND_STATEMENTS=$(node -pe "JSON.parse(require('fs').readFileSync('backend/coverage/coverage-summary.json')).total.statements.pct")
BACKEND_BRANCHES=$(node -pe "JSON.parse(require('fs').readFileSync('backend/coverage/coverage-summary.json')).total.branches.pct")

AGENT_FUNCTIONS=$(node -pe "JSON.parse(require('fs').readFileSync('advertiser-agent/coverage/coverage-summary.json')).total.functions.pct")
AGENT_LINES=$(node -pe "JSON.parse(require('fs').readFileSync('advertiser-agent/coverage/coverage-summary.json')).total.lines.pct")
AGENT_STATEMENTS=$(node -pe "JSON.parse(require('fs').readFileSync('advertiser-agent/coverage/coverage-summary.json')).total.statements.pct")
AGENT_BRANCHES=$(node -pe "JSON.parse(require('fs').readFileSync('advertiser-agent/coverage/coverage-summary.json')).total.branches.pct")

# Calculate weighted average (70% backend, 30% agent)
OVERALL_FUNCTIONS=$(node -pe "Math.round(($BACKEND_FUNCTIONS * 0.7 + $AGENT_FUNCTIONS * 0.3) * 100) / 100")
OVERALL_LINES=$(node -pe "Math.round(($BACKEND_LINES * 0.7 + $AGENT_LINES * 0.3) * 100) / 100")
OVERALL_STATEMENTS=$(node -pe "Math.round(($BACKEND_STATEMENTS * 0.7 + $AGENT_STATEMENTS * 0.3) * 100) / 100")
OVERALL_BRANCHES=$(node -pe "Math.round(($BACKEND_BRANCHES * 0.7 + $AGENT_BRANCHES * 0.3) * 100) / 100")

# Determine color
if (( $(echo "$OVERALL_FUNCTIONS >= 80" | bc -l) )); then
  COLOR="brightgreen"
elif (( $(echo "$OVERALL_FUNCTIONS >= 60" | bc -l) )); then
  COLOR="green"
elif (( $(echo "$OVERALL_FUNCTIONS >= 40" | bc -l) )); then
  COLOR="yellow"
elif (( $(echo "$OVERALL_FUNCTIONS >= 20" | bc -l) )); then
  COLOR="orange"
else
  COLOR="red"
fi

# Create coverage.json
cat > coverage.json << EOF
{
  "schemaVersion": 1,
  "label": "coverage",
  "message": "${OVERALL_FUNCTIONS}%",
  "color": "${COLOR}"
}
EOF

echo "✅ Generated coverage.json"
echo ""
echo "📊 Coverage Summary:"
echo "  Backend:  Functions: ${BACKEND_FUNCTIONS}% | Lines: ${BACKEND_LINES}% | Statements: ${BACKEND_STATEMENTS}% | Branches: ${BACKEND_BRANCHES}%"
echo "  Agent:    Functions: ${AGENT_FUNCTIONS}% | Lines: ${AGENT_LINES}% | Statements: ${AGENT_STATEMENTS}% | Branches: ${AGENT_BRANCHES}%"
echo "  Overall:  Functions: ${OVERALL_FUNCTIONS}% | Lines: ${OVERALL_LINES}% | Statements: ${OVERALL_STATEMENTS}% | Branches: ${OVERALL_BRANCHES}%"
echo ""
echo "🎨 Badge Color: ${COLOR}"
echo ""
echo "📄 coverage.json contents:"
cat coverage.json
echo ""
echo ""
echo "✅ Badge generation test complete!"
echo "   The workflow will work correctly on push to main."
