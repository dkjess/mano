# Local Testing Setup

This document describes how to set up the database for local development.

## Quick Database Reset

To reset the database with all migrations applied:

```bash
./scripts/reset-with-test-data.sh
```

This script:
- ✅ Applies all database migrations
- ✅ Seeds basic database structure
- ✅ Creates test user with credentials
- ✅ Populates test topics and people

## Current State

### Database Structure
- ✅ All tables and migrations applied
- ✅ Vector embeddings support ready
- ✅ File upload infrastructure complete
- ✅ Topic and people tables ready
- ✅ User creation trigger fixed and working

### Test User Setup
- ✅ Automatic test user creation works
- ✅ Pre-populated topics and people
- ✅ Ready for immediate testing

## Test Login Credentials

- **Email**: `testuser@example.com`
- **Password**: `testuser123`

### Testing Capabilities

#### Vector Embeddings
- ✅ Message embeddings generated automatically
- ✅ File content embeddings for uploaded documents
- ✅ Semantic search across conversations and files

#### File Uploads
- ✅ Upload any text file (.txt, .vtt, .json)
- ✅ Automatic content extraction and processing
- ✅ AI can read and analyze uploaded content

#### Complete System
- ✅ Topics and people management
- ✅ Cross-conversation insights
- ✅ File content integration with AI responses

## Usage

1. Run reset script: `./scripts/reset-with-test-data.sh`
2. Start dev server: `pnpm dev` 
3. Go to `http://localhost:3000`
4. Log in with: `testuser@example.com` / `testuser123`
5. Test with pre-populated topics and people
6. Upload files and test AI interactions

The system is fully functional for testing all features including vector embeddings and file content capabilities.