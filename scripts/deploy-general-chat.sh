#!/bin/bash
# Deploy General Chat Architecture Script

set -e

echo "🚀 Deploying General Chat Architecture..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found. Please install it first.${NC}"
    echo "Visit: https://supabase.com/docs/guides/cli"
    exit 1
fi

# Check if we're in a Supabase project
if [ ! -f "supabase/config.toml" ]; then
    echo -e "${RED}❌ Not in a Supabase project directory.${NC}"
    echo "Make sure you're in the root directory of your project."
    exit 1
fi

echo -e "${YELLOW}📋 Pre-deployment checks...${NC}"

# Check if the migration file exists
if [ ! -f "supabase/migrations/20250619000000_general_chat_architecture.sql" ]; then
    echo -e "${RED}❌ Migration file not found.${NC}"
    echo "Expected: supabase/migrations/20250619000000_general_chat_architecture.sql"
    exit 1
fi

# Check if verification script exists  
if [ ! -f "scripts/verify-general-chat-architecture.sql" ]; then
    echo -e "${YELLOW}⚠️  Verification script not found.${NC}"
    echo "Continuing without verification script..."
fi

echo -e "${GREEN}✅ Pre-deployment checks passed.${NC}"

# Apply migrations
echo -e "${YELLOW}📦 Applying database migrations...${NC}"
if ! supabase db push; then
    echo -e "${RED}❌ Failed to apply migrations.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Database migrations applied successfully.${NC}"

# Run verification if script exists
if [ -f "scripts/verify-general-chat-architecture.sql" ]; then
    echo -e "${YELLOW}🔍 Running verification checks...${NC}"
    echo "Please run the following command in your Supabase SQL Editor:"
    echo "supabase sql --file scripts/verify-general-chat-architecture.sql"
    echo ""
    echo "Or copy the contents of scripts/verify-general-chat-architecture.sql"
    echo "and paste into the Supabase dashboard SQL Editor."
fi

echo ""
echo -e "${GREEN}🎉 General Chat Architecture deployment complete!${NC}"
echo ""
echo "Next steps:"
echo "1. 🔍 Run verification script in Supabase SQL Editor"
echo "2. 🧪 Test onboarding flow: visit your app and create a new user"
echo "3. 💬 Test general chat: navigate to /people/general"
echo "4. 👥 Test person-specific chats: add a person and start conversation"
echo "5. 🔄 Test cross-conversation intelligence in general chat"
echo ""
echo "Architecture highlights:"
echo "• 🤲 General chat appears at top of navigation with special styling"
echo "• 🎯 New users automatically start in general chat for onboarding" 
echo "• 🧠 Cross-conversation intelligence includes general messages"
echo "• 🔒 Proper user isolation via RLS policies"
echo "• ⚡ Optimized database indexes for performance"
echo ""
echo "If you encounter issues, check:"
echo "• docs/GENERAL_CHAT_IMPLEMENTATION.md for detailed implementation guide"
echo "• Run verification script to debug database issues"
echo "• Check API routes handle 'general' person_id properly"
echo ""
echo -e "${GREEN}Happy management coaching! 🤲${NC}" 