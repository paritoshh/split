# Offline Support Architecture

## Overview
All offline features are **client-side** (browser-based). No server-side changes required.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    USER'S BROWSER (Client)                    │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              React App (Frontend)                        │ │
│  │  - Dashboard, Groups, Expenses pages                    │ │
│  │  - API calls via axios                                  │ │
│  └─────────────────────────────────────────────────────────┘ │
│                        │                                      │
│                        ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │         Offline Services (Client-Side)                  │ │
│  │  - offlineDetector.js (monitors network)                │ │
│  │  - cache.js (manages cache)                             │ │
│  │  - database.js (IndexedDB operations)                  │ │
│  └─────────────────────────────────────────────────────────┘ │
│                        │                                      │
│                        ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              IndexedDB (Browser Database)               │ │
│  │  - Stored on USER'S DEVICE (mobile/laptop)              │ │
│  │  - Expenses, Groups, Balances cache                     │ │
│  │  - Sync queue (future)                                   │ │
│  └─────────────────────────────────────────────────────────┘ │
│                        │                                      │
│                        ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │         Service Worker (Browser Feature)                 │ │
│  │  - Caches static files (HTML, CSS, JS)                  │ │
│  │  - Intercepts network requests                          │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                        │
                        │ (Network Request - Only when online)
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    AWS INFRASTRUCTURE                        │
│                                                               │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │   S3     │───▶│CloudFront│───▶│  Lambda  │              │
│  │(Frontend)│    │  (CDN)   │    │ (Backend)│              │
│  └──────────┘    └──────────┘    └──────────┘              │
│                                         │                    │
│                                         ▼                    │
│                                  ┌──────────┐                │
│                                  │DynamoDB │                │
│                                  │(Database)│                │
│                                  └──────────┘                │
└─────────────────────────────────────────────────────────────┘
```

## Key Points

### 1. Client-Side Only
- ✅ All offline logic runs in the browser
- ✅ No server-side code changes
- ✅ No additional AWS services

### 2. Storage Location
- ✅ IndexedDB: User's device (mobile/laptop)
- ✅ Service Worker Cache: User's device
- ✅ Data never leaves the user's device (privacy)

### 3. AWS Costs
- ✅ **NO increase** in AWS costs
- ✅ **Potential reduction** in Lambda invocations
- ✅ Same S3, CloudFront, DynamoDB usage

### 4. Works Everywhere
- ✅ Works on deployed version (hisab.paritoshagarwal.com)
- ✅ Works on local development
- ✅ Works on mobile browsers
- ✅ Works on desktop browsers

## Data Flow

### Online Mode
```
User Action → API Call → Lambda → DynamoDB
                ↓
         Cache Response (IndexedDB)
                ↓
         Display Data
```

### Offline Mode
```
User Action → Check Cache (IndexedDB)
                ↓
         Return Cached Data
                ↓
         Display Data (with "Offline" indicator)
```

## Storage Limits

| Browser | IndexedDB Limit |
|---------|----------------|
| Chrome  | ~50% of disk space (usually 1GB+) |
| Firefox | ~50% of disk space (usually 1GB+) |
| Safari  | ~50% of disk space (usually 1GB+) |
| Edge    | ~50% of disk space (usually 1GB+) |

**For your app:** Expenses, groups, balances are small. Even 1000 expenses = ~1MB. Well within limits.

## Privacy & Security

- ✅ Data stored locally on user's device
- ✅ Never sent to AWS or any server
- ✅ Cleared when user clears browser data
- ✅ Per-domain isolation (hisab.paritoshagarwal.com)

## Cost Analysis

### Before Offline Support
- User visits dashboard: 4 Lambda invocations
- User refreshes: 4 more Lambda invocations
- **Total: 8 invocations per session**

### After Offline Support
- User visits dashboard (online): 4 Lambda invocations + cache
- User refreshes (offline): 0 Lambda invocations (uses cache)
- **Total: 4 invocations per session (50% reduction)**

### Estimated Savings
- If 100 users visit dashboard daily:
  - Before: 800 Lambda invocations/day
  - After: 400 Lambda invocations/day (when offline)
  - **Savings: 400 invocations/day**

## Testing

### Test on Deployed Version
1. Visit `https://hisab.paritoshagarwal.com`
2. Open DevTools → Application → IndexedDB
3. See "HisabDB" database created
4. Turn off network (DevTools → Network → Offline)
5. Refresh page → Should show cached data

### Test on Mobile
1. Open `https://hisab.paritoshagarwal.com` on mobile
2. Enable airplane mode
3. Refresh page → Should show cached data

## Conclusion

✅ **Works on deployed version**  
✅ **Stored on user's device**  
✅ **No AWS cost increase**  
✅ **Potential cost reduction**

