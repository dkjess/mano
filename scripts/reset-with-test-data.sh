#!/bin/bash

# Reset database and load test data for local development
# Usage: ./scripts/reset-with-test-data.sh

echo "🔄 Resetting database with test data..."
echo ""

# Reset the database (applies all migrations and seeds)
echo "📚 Applying migrations and seeding data..."
npx supabase db reset

echo ""
echo "👤 Creating test user..."
node scripts/create-test-user.js

echo ""
echo "✅ Setup complete!"
echo ""
echo "🔑 Test login credentials:"
echo "   Email: testuser@example.com"
echo "   Password: testuser123"
echo ""
echo "📊 Available test data:"
echo "   • 3 topics: General, Product Development, Team Growth"
echo "   • 5 people: Sarah Chen (VP Eng), Marcus Rodriguez (PM), Jennifer Kim (CFO), Alex Thompson (Sr Dev), David Park (CEO)"
echo "   • Sample conversations and file uploads"
echo ""
echo "🚀 Ready for testing at http://localhost:3000"