# Firestore Read Optimizations Log

To drastically reduce Firestore reads (targeting a drop from ~120k to under 25k daily reads), we have significantly refactored the data-fetching layer across the application. 

Here is a summary of the completed refactorings:

## 1. API Helper Updates (`src/lib/api.ts`)
- **Removed mass `onSnapshot` dependencies** and shifted arrays to single-fire paginated retrievals to prevent runaway stream reads.
- **Implemented `api.listPaginated`**: This function pulls documents in batches (e.g. 50 at a time) and leverages Firestore's `startAfter()` cursor mechanics locally to execute "Load More" functionality seamlessly.
- **Implemented `api.getStats()`**: Added an aggregated global cache `stats/global` to immediately lookup the total length of Assets, Employees, Assignments, and Users without querying mapping arrays.

## 2. Dashboard Logic Modifications (`src/pages/Dashboard.tsx`)
- Completely decoupled from `assets`, `employees`, and `assignments` full collections.
- Dashboard now pulls exactly **1 combined index document** (`stats/global`) via `api.getStats()` saving *thousands* of reads per mount. 
- The Quick charts and "Recent Assignments" cards now query heavily filtered data (`api.listPaginated('assignments', [orderBy('assignedAt', 'desc')], 5);`) pulling only 5 documents at a time strictly sorted down by date.

## 3. Real-time Listeners Replaced (Paginated UI Example)
- Modified `Assets.tsx` and `Employees.tsx` to stop subscribing to the entire fleet of hardware using `onSnapshot`. We swapped to `listPaginated` initialized natively in `useEffect`, limiting the first query to 50 results. 
- Integrated a `loadAssets(true)` function paired with a **"Load More"** UI `<Button>` embedded at the end of the lists that gracefully appends the next 50 indexes using the returned `lastDoc` Firestore reference.

## 4. Admin Queries Capped (`src/pages/Admin.tsx`)
- The internal Analytics panel mapped heavily on `users` and `audit_logs` recursive lists.
- Switched default Admin.tsx fetchers to fetch exactly `100` elements synchronously (`limit(100)` logic bound tightly). `audit_logs` specifically returns the top 100 correctly ordered by descent. 

***

## 5. Cloud Function Implementation (Audit Cleanup Script)
To fulfill the requirement to **automatically purge old Audit logs** (e.g., keeping only recent items to reduce storage and read clutter), here is a serverless Firebase function snippet. You may append this immediately into `functions/src/index.ts`:

```typescript
import * as admin from 'firebase-admin';
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";

const db = admin.firestore();

// Executes every night at midnight to delete audit_logs older than 24 hours
export const cleanupOldAuditLogs = onSchedule("every day 00:00", async (event) => {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Find all logs instantiated before 24 Hours ago
    const oldLogsSnapshot = await db.collection("audit_logs")
      .where("timestamp", "<", admin.firestore.Timestamp.fromDate(yesterday))
      .limit(500) // Process in batches of 500
      .get();
      
    if (oldLogsSnapshot.empty) {
      logger.info('No old audit logs found to delete.');
      return;
    }

    // Execute standard clustered batch delete 
    const batch = db.batch();
    oldLogsSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    logger.info(`Successfully deleted ${oldLogsSnapshot.size} old audit logs.`);
    
  } catch (error) {
    logger.error('Failed to cleanup audit logs:', error);
  }
});
```

To enable this scheduled task natively on your cloud environment, deploy your functions running `firebase deploy --only functions`.
