# Mano Application Manual Test Checklist

## Test Environment Setup
- Dev server running: `npm run dev` (http://localhost:3000)
- Local Supabase running: `npx supabase start`
- Browser DevTools open to check for console errors

## 1. Desktop Sidebar Behavior ✅
- [ ] Visit app on desktop (width > 1024px)
- [ ] Sidebar should be visible on left side
- [ ] No hamburger menu visible
- [ ] Check sidebar sections:
  - [ ] **Coach** section with General link
  - [ ] **Your Team** section with people list
  - [ ] **Topics** section with topics list
- [ ] Click navigation links - should navigate without page reload
- [ ] Active link should be highlighted

## 2. Mobile Navigation ✅
- [ ] Visit app on mobile viewport (< 1024px) or use DevTools responsive mode
- [ ] Sidebar should NOT be visible by default
- [ ] Hamburger menu (☰) should be visible in top-left
- [ ] First visit should redirect to `/conversations`
- [ ] `/conversations` page should show:
  - [ ] Mobile-optimized list view
  - [ ] All conversations grouped by type
  - [ ] Empty states with appropriate CTAs
- [ ] Click hamburger menu:
  - [ ] Sidebar should slide in from left
  - [ ] Overlay should appear
  - [ ] Clicking overlay should close sidebar
- [ ] Navigate to a conversation - sidebar should auto-close

## 3. General Topic Functionality ✅
- [ ] Click "General" in sidebar under Coach section
- [ ] Should navigate to `/topics/{uuid}` (not `/people/general`)
- [ ] Page should show:
  - [ ] "General" as title
  - [ ] Management coaching context
  - [ ] Chat interface
- [ ] Send a test message:
  - [ ] Type message in input
  - [ ] Press Enter or click send
  - [ ] Message should appear
  - [ ] AI response should stream in
- [ ] Messages should persist on page refresh

## 4. New User Onboarding
- [ ] Sign out and create new account
- [ ] After signup, should redirect to General topic
- [ ] General topic should be automatically created
- [ ] First message should be welcoming/onboarding focused
- [ ] User profile should be created in database

## 5. Existing Conversation Access
- [ ] Sign in as existing user
- [ ] All previous people should appear in sidebar
- [ ] All topics should appear in sidebar
- [ ] Click on a person:
  - [ ] Should load conversation history
  - [ ] Should be able to send new messages
- [ ] Click on a topic:
  - [ ] Should load topic messages
  - [ ] Should show participants

## 6. Vector Search & AI Context
- [ ] Navigate to a person conversation
- [ ] Send a contextual query like:
  - "What did we discuss about performance last time?"
  - "Summarize our recent conversations"
- [ ] AI response should:
  - [ ] Reference previous conversations
  - [ ] Show understanding of context
  - [ ] Include relevant details from past chats
- [ ] Navigate to General and ask about team:
  - [ ] Should have context about all team members
  - [ ] Should provide cross-person insights

## 7. Additional Tests
- [ ] **Add New Person**:
  - [ ] Click + in Your Team section
  - [ ] Complete multi-step form
  - [ ] Person should appear in sidebar
  - [ ] Should navigate to new person's chat
- [ ] **Delete Person**:
  - [ ] Click person's menu (⋮)
  - [ ] Choose delete
  - [ ] Confirm deletion
  - [ ] Should redirect to General/home
  - [ ] Person should disappear from sidebar
- [ ] **Create New Topic**:
  - [ ] Click + in Topics section
  - [ ] Fill in topic details
  - [ ] Topic should appear in sidebar

## Console Error Checks
- [ ] No React hydration errors
- [ ] No 404s for API calls
- [ ] No TypeScript errors in console
- [ ] No failed network requests

## Performance Checks
- [ ] Page loads quickly (< 3s)
- [ ] Sidebar navigation is instant
- [ ] Messages send without delay
- [ ] AI responses stream smoothly

## Known Issues to Verify Fixed
- [ ] `/people/general` URLs should not exist
- [ ] Mobile sidebar should not push content
- [ ] Close button in add person should go to correct location
- [ ] General topic migration completed for existing users