# API Optimization Implementation

## Problem Solved

Fixed excessive API calls during person switching that were causing performance issues and unnecessary server load. Previously, every navigation between people would trigger multiple redundant API calls to `/api/people` and `/api/messages`.

## Root Causes Identified

1. **Multiple components fetching same data**: Both `app/people/page.tsx` and `app/people/[id]/page.tsx` were independently calling `/api/people`
2. **No state management**: Each component managed its own state with individual `useState` hooks
3. **No caching mechanism**: Every navigation triggered fresh API calls regardless of data freshness
4. **Lack of request deduplication**: Multiple simultaneous requests for the same data were possible

## Solution Implementation

### 1. People Context Provider (`lib/contexts/people-context.tsx`)

**Features:**
- Global state management for people data using React Context + useReducer
- Built-in caching with 5-minute TTL (Time To Live)
- Request deduplication to prevent multiple simultaneous API calls
- Optimistic updates for add/update/delete operations
- Error handling and loading states

**Key Benefits:**
- Single source of truth for people data
- Automatic cache invalidation
- Prevents duplicate API requests
- Provides `getPerson()` for instant person lookup

### 2. Messages Hook (`lib/hooks/use-messages.tsx`)

**Features:**
- Per-person message caching with 1-minute TTL
- Request abortion for cancelled/stale requests
- Global message cache with Map-based storage
- Request deduplication using pending request tracking
- Optimistic message updates

**Key Benefits:**
- Fast person switching with cached messages
- Prevents race conditions during rapid navigation
- Memory-efficient caching strategy
- Automatic cleanup of aborted requests

### 3. Updated Components

#### People Layout (`app/people/layout.tsx`)
- Wraps all people pages with `PeopleProvider`
- Ensures context is available throughout the people section

#### People Page (`app/people/page.tsx`)
- **Before**: Made API call on every visit via `fetchPeople()`
- **After**: Uses `usePeople()` hook, no direct API calls
- Eliminated redundant state management and useEffect

#### Person Detail Page (`app/people/[id]/page.tsx`)
- **Before**: Fetched people list AND messages on every person switch
- **After**: Uses context for people, custom hook for messages
- Reduced from 2 API calls per navigation to 0 (when cached)
- Faster person switching with instant data access

#### New Person Page (`app/people/new/page.tsx`)
- **Before**: Created person but didn't update existing state
- **After**: Adds person to context immediately after creation
- Prevents refetch when navigating to newly created person

## Performance Improvements

### API Call Reduction
- **Before**: 2-4 API calls per person navigation
  - `/api/people` from people page
  - `/api/people` from person detail page  
  - `/api/messages?person_id=X` from person detail page
  - Potential duplicate calls during rapid navigation

- **After**: 0-1 API calls per person navigation
  - `/api/messages?person_id=X` only if not cached
  - `/api/people` only on initial load or cache expiry

### Caching Strategy
- **People Data**: 5-minute cache (changes infrequently)
- **Messages Data**: 1-minute cache (changes more frequently)
- **Memory Management**: Automatic cleanup and cache invalidation

### User Experience
- **Instant Navigation**: Person switching is now immediate when data is cached
- **No Loading States**: Eliminated loading spinners for cached data
- **Consistent State**: Single source of truth prevents state inconsistencies

## Implementation Details

### Context Architecture
```typescript
interface PeopleContextType {
  people: Person[];
  isLoading: boolean;
  lastFetched: number | null;
  error: string | null;
  fetchPeople: (force?: boolean) => Promise<void>;
  addPerson: (person: Person) => void;
  updatePerson: (person: Person) => void;
  deletePerson: (id: string) => void;
  getPerson: (id: string) => Person | null;
}
```

### Message Hook Interface
```typescript
interface UseMessagesResult {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  addMessage: (message: Message) => void;
  clearMessages: () => void;
  refresh: () => Promise<void>;
}
```

## Cache Management

### Automatic Cache Invalidation
- People cache expires after 5 minutes
- Message cache expires after 1 minute
- Force refresh available via `fetchPeople(true)`

### Memory Optimization
- Global caches use Map for efficient storage
- Automatic cleanup of aborted requests
- Cache keys based on person IDs

## Error Handling

### Network Errors
- Graceful fallback with error states
- Retry mechanisms built into context
- User-friendly error messages

### Race Condition Prevention
- Request abortion for cancelled operations
- Pending request tracking
- Component cleanup on unmount

## Testing Metrics

### Expected Performance Gains
- **API calls reduced by 75-90%** during normal usage
- **Page navigation speed**: Instant for cached data
- **Server load**: Significant reduction in redundant requests
- **User experience**: Seamless person switching

### Monitoring
- Network tab should show minimal duplicate requests
- Person switching should be instant after initial load
- API call frequency should match cache TTL settings

## Future Enhancements

### Potential Improvements
1. **Offline Support**: Cache data in localStorage/IndexedDB
2. **Optimistic UI**: Show updates before server confirmation
3. **Background Refresh**: Update cache in background
4. **Smart Prefetching**: Preload likely-to-be-visited person data

### Additional Caching Opportunities
- User profile data
- Application settings
- Chat conversation metadata

## Migration Impact

### Breaking Changes
- None - all changes are internal optimizations

### Backward Compatibility
- All existing functionality preserved
- API contracts unchanged
- Component interfaces remain the same

This implementation dramatically reduces API calls while maintaining all existing functionality and improving user experience through faster navigation and more responsive interactions. 