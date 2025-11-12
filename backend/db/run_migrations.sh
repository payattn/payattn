#!/bin/bash

# Run Database Migrations
# This script applies migrations to Supabase database

echo "PayAttn Database Migration Script"
echo "=================================="
echo ""

# Load environment variables
if [ -f .env.local ]; then
  export $(cat .env.local | grep -v '^#' | xargs)
  echo "[OK] Loaded .env.local"
else
  echo "[ERROR] .env.local not found"
  exit 1
fi

# Extract connection details from Supabase URL
SUPABASE_PROJECT=$(echo $NEXT_PUBLIC_SUPABASE_URL | sed -E 's|https://([^.]+)\.supabase\.co|\1|')
echo "Supabase Project: $SUPABASE_PROJECT"
echo ""

echo "[WARN] MANUAL MIGRATION REQUIRED"
echo ""
echo "Since Supabase CLI is not installed, please run these migrations manually:"
echo ""
echo "Option 1: Supabase Dashboard (Recommended)"
echo "  1. Go to: https://supabase.com/dashboard/project/$SUPABASE_PROJECT/sql/new"
echo "  2. Copy contents of: db/migrations/001_create_ad_creative_tables.sql"
echo "  3. Paste and run in SQL Editor"
echo "  4. Copy contents of: db/seed_ad_creatives.sql"
echo "  5. Paste and run in SQL Editor"
echo ""
echo "Option 2: Local Postgres (if running locally)"
echo "  psql \$DATABASE_URL -f db/migrations/001_create_ad_creative_tables.sql"
echo "  psql \$DATABASE_URL -f db/seed_ad_creatives.sql"
echo ""
echo "Option 3: Install Supabase CLI"
echo "  brew install supabase/tap/supabase"
echo "  supabase db push"
echo ""

# Display file paths for easy access
echo "Migration files created:"
echo "  - $(pwd)/db/migrations/001_create_ad_creative_tables.sql"
echo "  - $(pwd)/db/seed_ad_creatives.sql"
echo ""

# Offer to open files
read -p "Open migration file in default editor? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
  open db/migrations/001_create_ad_creative_tables.sql
  sleep 1
  open db/seed_ad_creatives.sql
fi

echo ""
echo "Ready to migrate! Follow instructions above."
