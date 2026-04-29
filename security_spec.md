# Security Specification & TDD

## Data Invariants
1. **Multi-Tenancy**: No user can read or write data belonging to another organization (`orgId` must match).
2. **Role-Based Access Control (RBAC)**:
   - `owner` and `admin` have full control over organization assets and configuration.
   - `manager` can manage assets and employees but not audit logs or configuration.
   - `viewer` can only read data.
3. **Immutability**: `createdAt` and `orgId` fields must never change after creation.
4. **Validation**: All strings must have size limits to prevent Denial of Wallet attacks.
5. **Verified Email**: Users must have a verified email to perform any write operation.

## The Dirty Dozen Payloads (Target: PERMISSION_DENIED)

1. **Identity Spoofing**: Attempt to create an asset with another organization's `orgId`.
2. **Privilege Escalation**: A `manager` trying to update their own role to `owner`.
3. **Shadow Update**: Adding a `isVerified: true` field to a user profile update.
4. **Resource Poisoning**: Using a 2KB string as a `name` field.
5. **ID Poisoning**: Attempting to create a document with a path-traversal ID like `../../secrets/config`.
6. **Relational Breach**: Creating an asset referencing a vendor that doesn't exist in the organization.
7. **Orphaned Write**: Creating an asset assignment without a valid asset ID.
8. **Unverified Sabotage**: Attempting to delete an asset from an account with `emailVerified: false`.
9. **Query Scraping**: Listing assets without providing a `where('orgId', '==', ...)` filter.
10. **State Shortcutting**: Updating an asset status directly to `retired` without going through `available` or `maintenance` (if logic enforced).
11. **PII Leak**: A `viewer` attempting to read another user's private settings.
12. **History Tampering**: Attempting to update or delete a record in the `asset_history` collection.

## Test Runner (firestore.rules.test.ts)

```typescript
// Initial test suite for security validation
import { assertFails, assertSucceeds, initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'nv-it-assets-rpj',
    firestore: { rules: await fs.readFile('firestore.rules', 'utf8') }
  });
});

test('Disallows unverified email writes', async () => {
  const alice = testEnv.authenticatedContext('alice', { email_verified: false });
  await assertFails(setDoc(doc(alice.firestore(), 'assets/test'), { name: 'Broken', orgId: 'org1' }));
});

test('Enforces multi-tenancy on read', async () => {
  const alice = testEnv.authenticatedContext('alice', { email_verified: true, orgId: 'org1' });
  await assertFails(getDoc(doc(alice.firestore(), 'assets/org2-asset')));
});
```
