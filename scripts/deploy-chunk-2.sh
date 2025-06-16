#!/bin/bash

# Chunk 2: Enhanced Context Building - Deployment Script
# This script deploys the enhanced context system to Supabase

set -e  # Exit on error

echo "🚀 Deploying Chunk 2: Enhanced Context Building"
echo "=============================================="

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI is not installed. Please install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

# Check if we're in the correct directory
if [ ! -f "supabase/config.toml" ]; then
    echo "❌ Please run this script from the project root directory"
    exit 1
fi

echo "📊 Checking Supabase status..."
supabase status

echo ""
echo "🗃️ Applying database migrations..."
supabase db push

echo ""
echo "⚡ Deploying Edge Functions..."
supabase functions deploy chat

echo ""
echo "🔧 Verifying deployment..."

# Check if the function is deployed
if supabase functions list | grep -q "chat"; then
    echo "✅ Chat function deployed successfully"
else
    echo "❌ Chat function deployment failed"
    exit 1
fi

echo ""
echo "📋 Deployment Summary:"
echo "====================="
echo "✅ Database migrations applied"
echo "✅ Enhanced context service deployed"
echo "✅ Edge function updated with context building"
echo "✅ Performance monitoring enabled"

echo ""
echo "🧪 Next Steps:"
echo "1. Test the enhanced context manually in your app"
echo "2. Run the automated test script:"
echo "   export SUPABASE_URL=\"your-url\""
echo "   export SUPABASE_ANON_KEY=\"your-key\""
echo "   deno run --allow-net --allow-env scripts/test-enhanced-context.ts"
echo "3. Monitor performance in function logs:"
echo "   supabase functions logs chat"

echo ""
echo "🎉 Chunk 2 deployment complete!"
echo "Mano now has enhanced context awareness across all conversations." 