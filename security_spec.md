# Enterprise ERP Firestore Security Specification (Phase 0)

## 1. Data Invariants

1. **Master Authentication & Email Verification Gate**: Every read and write operation across all ERP collections requires `request.auth != null` and `request.auth.token.email_verified == true`. Unauthenticated traffic is strictly denied by the top-level default-deny catch-all (`match /{document=**} { allow read, write: if false; }`).
2. **Identity & Ownership Integrity**: Every ERP domain record (`budgets`, `expenditures`, `projects`, `suppliers`, `lpos`, `documents`, `quotations`, `invoices`, `paymentRequests`, `departments`, `importHistory`, `auditTrail`, `notifications`, `archive`, `officialManuals`) MUST carry an `ownerId` matching `request.auth.uid` on creation (unless created by a verified admin) and `ownerId` MUST remain immutable on all subsequent updates.
3. **Immutable Audit Trail**: `auditTrail` entries are append-only (`allow create` only). `allow update` and `allow delete` are unconditionally `false` to preserve enterprise compliance.
4. **PII Isolation (Split Collection Strategy)**: `/users/{userId}` stores only non-PII workspace metadata (`name`, `role`, `departmentName`, `status`). Personally Identifiable Information (`email`, `phone`) is isolated in `/users/{userId}/private/{docId}`, strictly readable and writable only by `isOwner(userId)` or `isAdmin()`.
5. **Privilege Escalation Prevention**: Users creating their own `/users/{userId}` profile MUST default to `role == 'Read Only'` and `status == 'Active'`. Non-admins cannot mutate `role` or `status` on update, and only verified admins (`alvinmamo1995@gmail.com` or UIDs in `/admins/{uid}`) may manage `/admins/{adminId}` or promote user roles.
6. **Path & Volumetric Bounds**: All document IDs (`docId`) and entity `id` fields must match `^[a-zA-Z0-9_\-]+$` with length `1..128`. All strings enforce strict `maxLength` caps, and arrays enforce bounded `.size()` limits plus first-element type verification.
7. **Temporal Integrity**: `syncedAt` (and `createdAt`/`updatedAt` on user/admin records) MUST equal `request.time`. Client-supplied timestamps are rejected on server-validated timestamp fields.
8. **Strict Key Allowlisting ("Anti-Update-Gap")**: Every `create` verifies `hasAll(...) && hasOnly(...)`, and every `update` runs `isValid[Entity](incoming())` alongside `incoming().diff(existing()).affectedKeys().hasOnly(...)` to block shadow/ghost fields.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return `PERMISSION_DENIED`)

1. **Unauthenticated Read/Write**: Anonymous caller reads `/budgets/bdg-1` or writes `/expenditures/exp-1`.
2. **Email Spoofing (`email_verified: false`)**: Attacker claims `email: "alvinmamo1995@gmail.com"` with `email_verified: false` to read `/budgets`.
3. **Owner Spoofing on Create**: Verified non-admin user (`uid: "userA"`) creates `/budgets/bdg-99` with `ownerId: "userB"`.
4. **Shadow/Ghost Field Injection on Create**: Verified user creates `/budgets/bdg-100` with all valid fields plus `"isSuperApproved": true`.
5. **Shadow/Ghost Field Injection on Update**: Owner updates `/budgets/bdg-100` adding `"bypassAudit": true`.
6. **Self-Assigned Admin Role Escalation**: New user (`uid: "userA"`) creates `/users/userA` with `role: "Administrator"`.
7. **Role Mutation on User Profile Update**: Non-admin user updates `/users/userA` changing `role` from `"Read Only"` to `"Finance Manager"`.
8. **Cross-User PII Read**: Verified non-admin `userA` attempts `get` on `/users/userB/private/contact`.
9. **Audit Trail Tampering**: Verified user (even creator or admin) attempts `update` or `delete` on `/auditTrail/aud-1`.
10. **ID Poisoning Attack**: User attempts `create` on `/projects/<150-char-string>` or `/projects/bad$id!`.
11. **Oversized String / Denial-of-Wallet Payload**: User sends a 5,000-character string in `Budget.description` (`maxLength: 1000`) or an unbounded array of 500 strings in `Supplier.servicesOffered` (`max: 25`).
12. **Blanket Collection Scraping (`list` without owner filter)**: Non-admin `userA` runs `getDocs(collection(db, 'expenditures'))` without `where('ownerId', '==', 'userA')`.
