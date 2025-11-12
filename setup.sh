#!/bin/bash

# PayAttn Setup Script
# This script installs dependencies for all components

set -e  # Exit on error

echo "🚀 PayAttn Setup Script"
echo "======================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "⚠️  Warning: Node.js version 18+ is recommended. You have v$NODE_VERSION"
fi

echo "✅ Node.js detected: $(node -v)"
echo ""

# Install backend dependencies
echo "📦 Installing backend dependencies..."
if [ -d "backend" ]; then
    cd backend
    npm install
    cd ..
    echo "✅ Backend dependencies installed"
else
    echo "⚠️  backend/ directory not found, skipping"
fi
echo ""

# Install extension dependencies
echo "📦 Installing extension dependencies..."
if [ -d "extension" ]; then
    cd extension
    npm install
    cd ..
    echo "✅ Extension dependencies installed"
else
    echo "⚠️  extension/ directory not found, skipping"
fi
echo ""

# Install advertiser-agent dependencies
echo "📦 Installing advertiser-agent dependencies..."
if [ -d "advertiser-agent" ]; then
    cd advertiser-agent
    npm install
    cd ..
    echo "✅ Advertiser-agent dependencies installed"
else
    echo "⚠️  advertiser-agent/ directory not found, skipping"
fi
echo ""

# Install solana dependencies
echo "📦 Installing Solana smart contract dependencies..."
if [ -d "solana/payattn_escrow" ]; then
    cd solana/payattn_escrow
    npm install
    cd ../..
    echo "✅ Solana dependencies installed"
else
    echo "⚠️  solana/payattn_escrow/ directory not found, skipping"
fi
echo ""

echo "✨ Setup complete!"
echo ""
echo "📋 Next Steps:"
echo "   1. Configure environment variables:"
echo "      • Copy backend/.env.example to backend/.env.local"
echo "      • Copy advertiser-agent/.env.example to advertiser-agent/.env"
echo "      • Fill in your Supabase, Solana, and Venice AI credentials"
echo ""
echo "   2. Set up Rapidsnark (for backend ZK verification):"
echo "      • cd rapidsnark-server"
echo "      • Follow instructions in rapidsnark-server/README.md"
echo ""
echo "   3. Start development server:"
echo "      • cd backend"
echo "      • npm run dev"
echo ""
echo "   4. Load Chrome extension:"
echo "      • Open chrome://extensions/"
echo "      • Enable 'Developer mode'"
echo "      • Click 'Load unpacked'"
echo "      • Select the 'extension/' directory"
echo ""
echo "   5. (Optional) Run Peggy advertiser agent:"
echo "      • cd advertiser-agent"
echo "      • npm start"
echo ""
echo "📖 For detailed instructions, see README.md"
echo "🏆 For hackathon judging, see HACKATHON_DEMO.md"
echo ""
