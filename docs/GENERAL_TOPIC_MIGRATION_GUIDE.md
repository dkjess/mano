# General Topic Migration Guide

**Date:** 2025-06-25  
**Summary:** Migration from virtual person approach to proper topic-based architecture for General chat

## Overview

This guide documents the complete migration from the special `person_id = 'general'` virtual person approach to a proper topic-based architecture where each user gets a dedicated "General" topic for management coaching.

## Changes Made

### 1. Database Migration

**File:** `supabase/migrations/20250625000000_migrate_general_to_topic.sql`

**Key Actions:**
- Creates "General" topic for each user with existing general messages
- Migrates all `person_id = 'general'` messages to the new General topics
- Removes special case handling for 'general' in constraints and RLS policies
- Updates conversation embeddings to reference topic IDs instead of 'general'
- Simplifies message policies to handle person and topic messages uniformly

### 2. User Creation Trigger Update

**File:** `supabase/migrations/20250625000001_update_user_creation_trigger.sql`

**Enhancement:**
- Updated `handle_new_user()` function to automatically create a General topic when new users sign up
- Ensures every new user gets their dedicated management coaching space immediately

### 3. General Topic Helper Library

**File:** `lib/general-topic.ts`

**New Utilities:**
- `getOrCreateGeneralTopic()` - Server-side function to get/create General topic
- `getOrCreateGeneralTopicClient()` - Client-side version for React components
- `getGeneralTopicId()` - Quick helper to get just the topic ID
- `isGeneralTopic()` - Check if a topic is a user's General topic

### 4. Authentication Flow Updates

#### **OAuth Callback** (`app/auth/callback/route.ts`)
- **Before:** Redirected to `/people/general`
- **After:** Creates/gets General topic and redirects to `/topics/[generalTopicId]`
- **Enhancement:** Handles topic creation failures gracefully

#### **Sign-up Form** (`components/sign-up-form.tsx`)
- **Email Signup:** Now creates General topic and redirects to topic route
- **Google OAuth:** Removed hardcoded redirect, lets callback handle topic creation
- **Fallback:** Graceful handling if topic creation fails

#### **Main Page** (`app/page.tsx`)
- **Before:** All users redirected to `/people/general`
- **After:** Gets/creates General topic and redirects to `/topics/[generalTopicId]`
- **Benefit:** Works for both new and existing users

### 5. Login Flow (No Changes Needed)
- Login form already redirects to "/" which goes through main page logic
- OAuth login goes through callback route which handles topic creation
- **Result:** Seamless transition for existing users

## Migration Benefits

### **Architectural Consistency**
- ✅ General chat is now a proper topic like any other
- ✅ No more special case handling throughout codebase
- ✅ Unified data model for all conversation types

### **Enhanced Functionality**
- ✅ General topics can use all topic features (participants, descriptions, etc.)
- ✅ Better vector search integration with consistent ID patterns
- ✅ Potential for multiple coaching topics in the future

### **Improved User Experience**
- ✅ Seamless transition for existing users
- ✅ Automatic topic creation for new users
- ✅ Consistent routing patterns across the application

### **Developer Experience**
- ✅ Simplified API endpoints (no more 'general' special cases)
- ✅ Cleaner database constraints and policies
- ✅ Better maintainability and extensibility

## Post-Migration Frontend Updates Needed

The following frontend components will need updates to work with the new topic-based approach:

### **High Priority:**
1. **Sidebar Component** (`components/Sidebar.tsx`)
   - Move General from "Coach" section to "Topics" section
   - Update link from `/people/general` to `/topics/[generalTopicId]`
   - Add logic to identify and highlight General topic

2. **API Endpoints** (`app/api/chat/stream/route.ts`, `app/api/messages/route.ts`)
   - Remove special handling for `person_id = 'general'`
   - Update to work with General topic IDs
   - Ensure vector search handles topic IDs correctly

3. **Person Detail Page** (`app/people/[id]/page.tsx`)
   - Remove virtual person creation for 'general'
   - Add redirect from `/people/general` to General topic if needed

### **Medium Priority:**
4. **Vector Search Functions**
   - Update conversation embeddings to use topic IDs
   - Ensure cross-conversation intelligence works with new structure

5. **Management Context Builder**
   - Update to handle General topics in context building
   - Ensure AI responses maintain coaching context

### **Low Priority:**
6. **Debug/Admin Tools**
   - Update any admin interfaces that reference 'general'
   - Update testing scripts and utilities

## Rollback Plan

If rollback is needed, the migration can be reversed by:

1. **Run reverse migration:**
   ```sql
   -- Convert General topics back to person_id = 'general'
   -- Restore old constraints and policies
   -- Update embeddings back to 'general' references
   ```

2. **Revert frontend changes:**
   - Restore hardcoded `/people/general` redirects
   - Remove General topic helper functions
   - Restore virtual person logic

## Testing Checklist

- [ ] New user signup creates General topic automatically
- [ ] Existing users are redirected to their General topic
- [ ] OAuth signup/login works with new flow
- [ ] Email signup/login works with new flow
- [ ] General topic creation is idempotent (safe to call multiple times)
- [ ] Fallback routes work if topic creation fails
- [ ] Database constraints prevent invalid message states
- [ ] RLS policies properly isolate user data

## Success Metrics

- **Data Integrity:** Zero `person_id = 'general'` messages after migration
- **User Experience:** No broken redirects or 404 errors
- **Performance:** Topic creation adds minimal latency to signup flow
- **Functionality:** All General chat features work as before

## Next Steps

1. **Execute migration:** Run the database migration files
2. **Update frontend:** Implement the sidebar and API changes
3. **Test thoroughly:** Verify all user flows work correctly
4. **Monitor:** Watch for any issues in production
5. **Cleanup:** Remove any deprecated code references to virtual person approach

This migration represents a significant architectural improvement while maintaining full backward compatibility and user experience.