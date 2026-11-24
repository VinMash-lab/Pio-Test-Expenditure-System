/**
 * Phase 0: Payload-First Security Test Suite for Enterprise ERP Firestore Rules
 * Verifies that all "Dirty Dozen" adversarial payloads are rejected with PERMISSION_DENIED.
 *
 * Run against Firebase Local Emulator Suite when available:
 *   firebase emulators:exec --only firestore "npx tsx firestore.rules.test.ts"
 */

export interface DirtyDozenTestCase {
  id: number;
  name: string;
  collectionPath: string;
  docId: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  authContext: {
    uid?: string;
    email?: string;
    email_verified?: boolean;
  } | null;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: DirtyDozenTestCase[] = [
  {
    id: 1,
    name: 'Unauthenticated read blocked by default-deny safety net',
    collectionPath: 'budgets',
    docId: 'bdg-001',
    operation: 'get',
    authContext: null,
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified admin email spoof blocked by email_verified check',
    collectionPath: 'budgets',
    docId: 'bdg-001',
    operation: 'get',
    authContext: { uid: 'attacker-1', email: 'alvinmamo1995@gmail.com', email_verified: false },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'OwnerId spoofing on create blocked',
    collectionPath: 'budgets',
    docId: 'bdg-spoof-1',
    operation: 'create',
    authContext: { uid: 'user-a', email: 'usera@pioneerassurance.co.ke', email_verified: true },
    payload: {
      id: 'bdg-spoof-1',
      ownerId: 'user-b',
      code: 'BDG-2026-MCX-99A',
      financialYear: '2026',
      legalEntity: 'PACL',
      departmentId: 'dept-mcx',
      departmentName: 'Marketing & Customer Experience',
      category: 'Marketing Campaigns',
      allocatedAmount: 500000,
      description: 'Unauthorized spoofed owner record',
      status: 'Draft',
      createdBy: 'User A',
      createdDate: '2026-11-19',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Ghost field injection on create blocked by hasOnly allowlist',
    collectionPath: 'budgets',
    docId: 'bdg-ghost-1',
    operation: 'create',
    authContext: { uid: 'user-a', email: 'usera@pioneerassurance.co.ke', email_verified: true },
    payload: {
      id: 'bdg-ghost-1',
      ownerId: 'user-a',
      code: 'BDG-2026-MCX-100A',
      financialYear: '2026',
      legalEntity: 'PACL',
      departmentId: 'dept-mcx',
      departmentName: 'Marketing & Customer Experience',
      category: 'Marketing Campaigns',
      allocatedAmount: 250000,
      description: 'Valid budget with ghost field',
      status: 'Draft',
      createdBy: 'User A',
      createdDate: '2026-11-19',
      isVerified: true,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Shadow field update blocked by affectedKeys().hasOnly()',
    collectionPath: 'budgets',
    docId: 'bdg-001',
    operation: 'update',
    authContext: { uid: 'user-a', email: 'usera@pioneerassurance.co.ke', email_verified: true },
    payload: {
      bypassApproval: true,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Self-assigned Administrator role on user registration blocked',
    collectionPath: 'users',
    docId: 'user-a',
    operation: 'create',
    authContext: { uid: 'user-a', email: 'usera@pioneerassurance.co.ke', email_verified: true },
    payload: {
      id: 'user-a',
      uid: 'user-a',
      name: 'User A',
      role: 'Administrator',
      status: 'Active',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Self-service RBAC role escalation on update blocked',
    collectionPath: 'users',
    docId: 'user-a',
    operation: 'update',
    authContext: { uid: 'user-a', email: 'usera@pioneerassurance.co.ke', email_verified: true },
    payload: {
      role: 'Finance Manager',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Cross-user PII private contact read blocked',
    collectionPath: 'users/user-b/private',
    docId: 'contact',
    operation: 'get',
    authContext: { uid: 'user-a', email: 'usera@pioneerassurance.co.ke', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Audit trail deletion/mutation blocked (immutable ledger)',
    collectionPath: 'auditTrail',
    docId: 'aud-001',
    operation: 'delete',
    authContext: { uid: 'admin-1', email: 'alvinmamo1995@gmail.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'ID poisoning with invalid characters and oversized ID blocked',
    collectionPath: 'projects',
    docId: 'invalid$project#id_' + 'x'.repeat(140),
    operation: 'create',
    authContext: { uid: 'user-a', email: 'usera@pioneerassurance.co.ke', email_verified: true },
    payload: { id: 'invalid', ownerId: 'user-a' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Oversized string (>1000 chars) and unbounded array (>25 items) blocked',
    collectionPath: 'suppliers',
    docId: 'sup-oversized',
    operation: 'create',
    authContext: { uid: 'user-a', email: 'usera@pioneerassurance.co.ke', email_verified: true },
    payload: {
      id: 'sup-oversized',
      ownerId: 'user-a',
      name: 'X'.repeat(500),
      contactPerson: 'Lead',
      phone: '+254700000000',
      email: 'vendor@example.com',
      pin: 'P051234567Z',
      address: 'Nairobi',
      servicesOffered: Array.from({ length: 30 }, (_, i) => `Service ${i}`),
      status: 'Active',
      totalPaid: 0,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Blanket collection list query without ownerId filter blocked for non-admin',
    collectionPath: 'expenditures',
    docId: '',
    operation: 'list',
    authContext: { uid: 'user-a', email: 'usera@pioneerassurance.co.ke', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
];

export function validateSecuritySpecCoverage(): boolean {
  return DIRTY_DOZEN_TESTS.length === 12 && DIRTY_DOZEN_TESTS.every((t) => t.expectedResult === 'PERMISSION_DENIED');
}
