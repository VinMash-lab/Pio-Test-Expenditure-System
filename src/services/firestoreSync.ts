import { db, auth } from './firebase';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  writeBatch,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

type ErrorListener = (info: FirestoreErrorInfo) => void;
const errorListeners = new Set<ErrorListener>();

export function subscribeFirestoreErrors(listener: ErrorListener): () => void {
  errorListeners.add(listener);
  return () => {
    errorListeners.delete(listener);
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  const serialized = JSON.stringify(errInfo);
  console.error('Firestore Error: ', serialized);
  errorListeners.forEach((listener) => {
    try {
      listener(errInfo);
    } catch {
      // ignore listener failures
    }
  });
  throw new Error(serialized);
}

export interface CloudSyncContext {
  uid: string;
  email: string | null;
  isAdmin: boolean;
}

let activeSyncContext: CloudSyncContext | null = null;

export function setCloudSyncContext(ctx: CloudSyncContext | null): void {
  activeSyncContext = ctx;
}

export function getCloudSyncContext(): CloudSyncContext | null {
  return activeSyncContext;
}

export function isCloudSyncReady(): boolean {
  return Boolean(auth.currentUser && auth.currentUser.emailVerified && activeSyncContext);
}

/**
 * Collection field allowlists & volumetric maxLength limits synchronized verbatim with firebase-blueprint.json
 */
const COLLECTION_MAX_LENGTHS: Record<string, Record<string, number>> = {
  budgets: {
    id: 128, ownerId: 128, code: 64, financialYear: 16, legalEntity: 16, quarter: 16,
    departmentId: 128, departmentName: 160, projectId: 128, projectName: 200, campaign: 200,
    strategicInitiative: 200, category: 120, costCentre: 120, fundingSource: 120, activity: 200,
    notes: 2000, description: 1000, status: 32, sharedGroupId: 128, allocationMethod: 32,
    createdBy: 128, createdDate: 32, updatedAt: 64,
  },
  expenditures: {
    id: 128, ownerId: 128, expenseId: 64, date: 32, expenseDate: 32, paymentMethod: 64,
    legalEntity: 16, quarter: 16, departmentId: 128, departmentName: 160, budgetId: 128,
    projectId: 128, projectName: 200, campaignName: 200, strategicInitiative: 200, costCentre: 120,
    fundingSource: 120, activity: 200, supplierId: 128, supplierName: 200, category: 120,
    description: 1000, invoiceNumber: 64, purchaseOrder: 64, paymentStatus: 32,
    sharedGroupId: 128, allocationMethod: 32, receiptFileName: 255, receiptFileUrl: 2048,
    remarks: 1000, authorizedBy: 128, createdBy: 128, createdAt: 64,
  },
  projects: {
    id: 128, ownerId: 128, code: 64, name: 200, projectType: 64, entity: 16,
    departmentId: 128, departmentName: 160, budgetCategory: 120, strategicInitiative: 200,
    campaignType: 120, costCentre: 120, fundingSource: 120, targetAudience: 200,
    expectedROI: 200, kpiTarget: 200, projectOwner: 128, projectManager: 128,
    vendor: 200, vendorId: 128, startDate: 32, expectedCompletionDate: 32,
    actualCompletionDate: 32, endDate: 32, description: 2000, status: 32, notes: 2000,
  },
  suppliers: {
    id: 128, ownerId: 128, name: 200, contactPerson: 160, phone: 64, email: 160,
    pin: 32, address: 300, status: 32, category: 120,
  },
  lpos: {
    id: 128, ownerId: 128, lpoNumber: 80, lpoDate: 32, legalEntity: 16, supplierId: 128,
    supplierName: 200, projectId: 128, projectName: 200, budgetId: 128, budgetCode: 64,
    budgetCategory: 120, departmentId: 128, departmentName: 160, description: 1000,
    currency: 16, lpoStatus: 32, status: 32, expectedDeliveryDate: 32, invoiceStatus: 32,
    paymentStatus: 32, relatedInvoice: 80, documentId: 128, documentFileName: 255,
    documentDataUrl: 2048, remarks: 1000, createdBy: 128, createdAt: 64, updatedAt: 64,
  },
  documents: {
    id: 128, ownerId: 128, docNumber: 80, title: 200, type: 80, category: 80,
    departmentId: 128, departmentName: 160, legalEntity: 16, projectId: 128, projectName: 200,
    budgetId: 128, budgetCode: 64, expenditureId: 128, expenseCode: 64, supplierId: 128,
    supplierName: 200, lpoId: 128, lpoNumber: 80, fileName: 255, fileSize: 32, fileType: 16,
    mimeType: 128, dataUrl: 200000, uploadedBy: 128, uploadDate: 32, downloadUrl: 2048,
    status: 32, remarks: 1000,
  },
  quotations: {
    id: 128, ownerId: 128, quotationNumber: 80, vendorId: 128, vendorName: 200,
    supplierId: 128, supplierName: 200, projectId: 128, projectName: 200, legalEntity: 16,
    quotationDate: 32, validUntil: 32, currency: 16, status: 32, description: 1000,
    documentId: 128, documentFileName: 255, documentDataUrl: 2048, remarks: 1000,
    createdBy: 128, createdAt: 64, updatedAt: 64,
  },
  invoices: {
    id: 128, ownerId: 128, invoiceNumber: 80, vendorId: 128, vendorName: 200,
    supplierId: 128, supplierName: 200, lpoNumber: 80, lpoId: 128, projectId: 128,
    projectName: 200, legalEntity: 16, invoiceDate: 32, dueDate: 32, currency: 16,
    paymentStatus: 32, paymentDate: 32, description: 1000, notes: 1000, documentId: 128,
    documentFileName: 255, documentDataUrl: 2048, remarks: 1000, createdBy: 128,
    createdAt: 64, updatedAt: 64,
  },
  paymentRequests: {
    id: 128, ownerId: 128, requestNumber: 80, vendorId: 128, vendorName: 200,
    supplierId: 128, supplierName: 200, lpoNumber: 80, invoiceNumber: 80, invoiceId: 128,
    paymentMethod: 64, bankDetails: 300, requesterName: 128, projectId: 128, projectName: 200,
    legalEntity: 16, requestDate: 32, currency: 16, purpose: 1000, priority: 32,
    status: 32, paymentDate: 32, paymentVoucherFileName: 255, approvedBy: 128,
    approvalDate: 32, documentId: 128, documentFileName: 255, documentDataUrl: 2048,
    remarks: 1000, createdBy: 128, createdAt: 64, updatedAt: 64,
  },
  departments: {
    id: 128, ownerId: 128, code: 32, name: 160, headOfDepartment: 128, description: 1000,
  },
  importHistory: {
    id: 128, ownerId: 128, fileName: 255, dataType: 32, dateImported: 64, importedBy: 128, status: 32,
  },
  auditTrail: {
    id: 128, ownerId: 128, action: 64, entity: 64, entityId: 128, details: 1000,
    performedBy: 128, userRole: 64, timestamp: 64, ipAddress: 64,
  },
  notifications: {
    id: 128, ownerId: 128, type: 32, title: 200, message: 1000, timestamp: 64,
    relatedEntityId: 128, severity: 16,
  },
  archive: {
    id: 128, ownerId: 128, originalId: 128, entityType: 32, entityId: 128, itemType: 32,
    itemTitle: 200, description: 500, legalEntity: 32, financialYear: 16, archivedBy: 128,
    archivedAt: 64, deletedBy: 128, deletedAt: 64, reason: 500,
  },
  officialManuals: {
    id: 128, ownerId: 128, version: 32, title: 200, lastUpdated: 32, uploadedBy: 128,
    fileType: 16, fileName: 255, fileSize: 32, downloadUrl: 2048, dataUrl: 200000, notes: 1000,
  },
};

const COLLECTION_NUMERIC_BOUNDS: Record<string, string[]> = {
  budgets: ['allocatedAmount', 'revisedBudget', 'actualExpenditure', 'committedSpend', 'remainingBudget', 'utilizationPercent', 'paclSharePercent', 'pgilSharePercent', 'paclAllocation', 'pgilAllocation'],
  expenditures: ['amount', 'vatAmount', 'totalAmount', 'paclSharePercent', 'pgilSharePercent'],
  projects: ['originalBudget', 'approvedBudget', 'revisedBudget', 'budget', 'spent', 'actualSpend', 'committedSpend', 'remaining', 'remainingBudget', 'utilizationPercent', 'progressPercent', 'totalBudget', 'paclAllocation', 'pgilAllocation', 'paclActual', 'pgilActual'],
  suppliers: ['totalPaid', 'rating'],
  lpos: ['lpoAmount', 'amountBeforeVat', 'vatAmount', 'totalLpoValue', 'totalLpoAmount'],
  documents: ['currentVersion'],
  quotations: ['amountBeforeVat', 'vatAmount', 'totalAmount'],
  invoices: ['amountBeforeVat', 'vatAmount', 'totalAmount'],
  paymentRequests: ['requestedAmount', 'vatAmount', 'totalAmount'],
  departments: ['allocatedBudget', 'totalSpent', 'headcount'],
  importHistory: ['totalRecords', 'successfulRecords', 'failedRecords'],
};

const COLLECTION_BOOLEAN_FIELDS: Record<string, string[]> = {
  expenditures: ['isBudgetExceeded', 'requiresAuthorization'],
  projects: ['paclApplicable', 'pgilApplicable'],
  notifications: ['isRead'],
  officialManuals: ['isOfficial'],
};

const COLLECTION_ARRAY_FIELDS: Record<string, { keys: string[]; maxItems: number; maxStrLen?: number; perKeyMaxItems?: Record<string, number> }> = {
  projects: { keys: ['attachedDocuments'], maxItems: 25, maxStrLen: 255 },
  suppliers: { keys: ['servicesOffered'], maxItems: 25, maxStrLen: 120 },
  documents: { keys: ['versions', 'activityLog'], maxItems: 50, perKeyMaxItems: { versions: 20, activityLog: 50 } },
  quotations: { keys: ['items'], maxItems: 50 },
  departments: { keys: ['costCentres'], maxItems: 25, maxStrLen: 120 },
};

function sanitizeId(raw: string): string {
  const cleaned = String(raw || '').replace(/[^a-zA-Z0-9_\-]/g, '-').slice(0, 128);
  return cleaned || `id-${Date.now()}`;
}

function sanitizeForFirestore<T>(data: T): any {
  if (data === null || data === undefined) return null;
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForFirestore(item));
  }
  if (typeof data === 'object' && !(data instanceof Date)) {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeForFirestore(value);
      }
    }
    return cleaned;
  }
  return data;
}

function prepareDomainPayload(collectionName: string, item: Record<string, any>): Record<string, any> {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('Authentication required before writing to Firestore.');
  }

  const maxMap = COLLECTION_MAX_LENGTHS[collectionName];
  if (!maxMap) {
    return sanitizeForFirestore(item);
  }

  const numKeys = new Set(COLLECTION_NUMERIC_BOUNDS[collectionName] || []);
  const boolKeys = new Set(COLLECTION_BOOLEAN_FIELDS[collectionName] || []);
  const arrayConf = COLLECTION_ARRAY_FIELDS[collectionName];
  const arrayKeys = new Set(arrayConf?.keys || []);

  const payload: Record<string, any> = {};
  const source: Record<string, any> = {
    ...item,
    id: sanitizeId(item.id),
    ownerId: sanitizeId(item.ownerId || uid),
  };

  // Ensure required baseline fields have safe non-empty values for blueprint & firestore.rules compliance
  const todayStr = new Date().toISOString().split('T')[0];
  const nowIso = new Date().toISOString();
  const actorName = auth.currentUser?.displayName || 'System';

  if (collectionName === 'budgets') {
    source.code = source.code || `BDG-${source.id}`;
    source.financialYear = source.financialYear || '2026';
    source.legalEntity = ['PACL', 'PGIL', 'Shared'].includes(source.legalEntity) ? source.legalEntity : 'PACL';
    source.departmentId = source.departmentId || 'dept-mcx';
    source.departmentName = source.departmentName || 'Marketing & Customer Experience';
    source.category = source.category || 'General';
    source.allocatedAmount = Number(source.allocatedAmount || 0);
    source.description = source.description ?? '';
    source.status = ['Approved', 'Pending', 'Draft', 'Exceeded', 'Closed'].includes(source.status) ? source.status : 'Approved';
    source.createdBy = source.createdBy || actorName;
    source.createdDate = source.createdDate || todayStr;
  } else if (collectionName === 'expenditures') {
    source.expenseId = source.expenseId || source.id;
    source.date = source.date || source.expenseDate || todayStr;
    source.expenseDate = source.expenseDate || source.date;
    source.legalEntity = source.legalEntity === 'PGIL' ? 'PGIL' : 'PACL';
    source.departmentId = source.departmentId || 'dept-mcx';
    source.departmentName = source.departmentName || 'Marketing & Customer Experience';
    source.supplierId = source.supplierId || 'sup-general';
    source.supplierName = source.supplierName || 'Vendor';
    source.category = source.category || 'General';
    source.description = source.description ?? '';
    source.amount = Number(source.amount || 0);
    source.vatAmount = Number(source.vatAmount || 0);
    source.totalAmount = Number(source.totalAmount ?? (source.amount + source.vatAmount));
    source.paymentStatus = ['Paid', 'Pending Approval', 'Rejected', 'Approved'].includes(source.paymentStatus)
      ? source.paymentStatus
      : 'Approved';
    source.createdBy = source.createdBy || actorName;
    source.createdAt = source.createdAt || nowIso;
  } else if (collectionName === 'projects') {
    source.code = source.code || `PRJ-${source.id}`;
    source.name = source.name || 'Corporate Initiative';
    source.projectType = source.projectType || 'Departmental Project';
    source.paclApplicable = Boolean(source.paclApplicable);
    source.pgilApplicable = Boolean(source.pgilApplicable);
    source.departmentId = source.departmentId || 'dept-mcx';
    source.departmentName = source.departmentName || 'Marketing & Customer Experience';
    source.projectManager = source.projectManager || 'Marketing & CX Lead';
    source.startDate = source.startDate || todayStr;
    source.endDate = source.endDate || todayStr;
    source.status = source.status || 'In Progress';
  } else if (collectionName === 'suppliers') {
    source.name = source.name || 'Vendor';
    source.contactPerson = source.contactPerson ?? '';
    source.phone = source.phone ?? '';
    source.email = source.email ?? '';
    source.pin = source.pin ?? '';
    source.address = source.address ?? '';
    source.servicesOffered = Array.isArray(source.servicesOffered) ? source.servicesOffered : [];
    source.status = ['Active', 'Inactive', 'Preferred'].includes(source.status) ? source.status : 'Active';
    source.totalPaid = Number(source.totalPaid || 0);
  } else if (collectionName === 'lpos') {
    source.lpoNumber = source.lpoNumber || source.id;
    source.lpoDate = source.lpoDate || todayStr;
    source.legalEntity = source.legalEntity === 'PGIL' ? 'PGIL' : 'PACL';
    source.supplierId = source.supplierId || 'sup-general';
    source.supplierName = source.supplierName || 'Vendor';
    source.description = source.description ?? '';
    source.lpoAmount = Number(source.lpoAmount ?? source.amountBeforeVat ?? 0);
    source.vatAmount = Number(source.vatAmount ?? 0);
    source.totalLpoValue = Number(source.totalLpoValue ?? source.totalLpoAmount ?? (source.lpoAmount + source.vatAmount));
    source.currency = source.currency || 'KES';
    source.lpoStatus = source.lpoStatus || source.status || 'Issued';
    source.invoiceStatus = source.invoiceStatus || 'Not Invoiced';
    source.paymentStatus = source.paymentStatus || 'Unpaid';
    source.createdBy = source.createdBy || actorName;
    source.createdAt = source.createdAt || nowIso;
  } else if (collectionName === 'documents') {
    source.title = source.title || source.fileName || 'Document';
    source.type = source.type || 'Other';
    source.departmentName = source.departmentName || 'Marketing & Customer Experience';
    source.fileName = source.fileName || 'document.pdf';
    source.fileSize = String(source.fileSize || '0 KB');
    source.fileType = ['pdf', 'doc', 'xls', 'image', 'other'].includes(source.fileType) ? source.fileType : 'other';
    source.uploadedBy = source.uploadedBy || actorName;
    source.uploadDate = source.uploadDate || todayStr;
    if (typeof source.dataUrl === 'string' && source.dataUrl.length > 200000) {
      delete source.dataUrl;
    }
    if (Array.isArray(source.versions)) {
      source.versions = source.versions.slice(0, 20).map((v: any) => {
        if (v && typeof v === 'object' && typeof v.dataUrl === 'string' && v.dataUrl.length > 20000) {
          const { dataUrl: _omitted, ...rest } = v;
          return rest;
        }
        return v;
      });
    }
  } else if (collectionName === 'quotations') {
    source.quotationNumber = source.quotationNumber || source.id;
    source.vendorName = source.vendorName || source.supplierName || 'Vendor';
    source.quotationDate = source.quotationDate || todayStr;
    source.totalAmount = Number(source.totalAmount || 0);
    source.currency = source.currency || 'KES';
    source.status = source.status || 'Pending';
    source.description = source.description ?? '';
    source.createdBy = source.createdBy || actorName;
    source.createdAt = source.createdAt || nowIso;
  } else if (collectionName === 'invoices') {
    source.invoiceNumber = source.invoiceNumber || source.id;
    source.vendorId = source.vendorId || source.supplierId || 'sup-general';
    source.vendorName = source.vendorName || source.supplierName || 'Vendor';
    source.legalEntity = source.legalEntity || 'PACL';
    source.invoiceDate = source.invoiceDate || todayStr;
    source.amountBeforeVat = Number(source.amountBeforeVat || 0);
    source.vatAmount = Number(source.vatAmount || 0);
    source.totalAmount = Number(source.totalAmount ?? (source.amountBeforeVat + source.vatAmount));
    source.currency = source.currency || 'KES';
    source.paymentStatus = source.paymentStatus || 'Unpaid';
    source.description = source.description ?? '';
    source.createdBy = source.createdBy || actorName;
    source.createdAt = source.createdAt || nowIso;
  } else if (collectionName === 'paymentRequests') {
    source.requestNumber = source.requestNumber || source.id;
    source.legalEntity = source.legalEntity || 'PACL';
    source.requestedAmount = Number(source.requestedAmount || 0);
    source.currency = source.currency || 'KES';
    source.purpose = source.purpose ?? '';
    source.status = source.status || 'Draft';
    source.createdBy = source.createdBy || actorName;
    source.createdAt = source.createdAt || nowIso;
  } else if (collectionName === 'departments') {
    source.code = source.code || 'DEPT';
    source.name = source.name || 'Department';
    source.headOfDepartment = source.headOfDepartment ?? '';
    source.allocatedBudget = Number(source.allocatedBudget || 0);
    source.totalSpent = Number(source.totalSpent || 0);
    source.headcount = Number(source.headcount || 0);
    source.description = source.description ?? '';
  } else if (collectionName === 'importHistory') {
    source.fileName = source.fileName || 'import.xlsx';
    source.dataType = source.dataType || 'Budgets';
    source.dateImported = source.dateImported || nowIso;
    source.totalRecords = Number(source.totalRecords || 0);
    source.successfulRecords = Number(source.successfulRecords || 0);
    source.failedRecords = Number(source.failedRecords || 0);
    source.importedBy = source.importedBy || actorName;
    source.status = ['Successful', 'Partial Success', 'Failed'].includes(source.status) ? source.status : 'Successful';
  } else if (collectionName === 'auditTrail') {
    source.action = source.action || 'UPDATE';
    source.entity = source.entity || 'Settings';
    source.details = source.details || 'System activity recorded';
    source.performedBy = source.performedBy || actorName;
    source.userRole = source.userRole || 'Administrator';
    source.timestamp = source.timestamp || nowIso;
    source.ipAddress = source.ipAddress ?? '';
  } else if (collectionName === 'notifications') {
    source.type = source.type || 'budget_status';
    source.title = source.title || 'Notification';
    source.message = source.message || 'Budget alert';
    source.timestamp = source.timestamp || nowIso;
    source.isRead = Boolean(source.isRead);
    source.severity = ['info', 'warning', 'danger', 'success'].includes(source.severity) ? source.severity : 'info';
  } else if (collectionName === 'archive') {
    source.originalId = source.originalId || source.id;
    source.itemType = source.itemType || 'Budget';
    source.itemTitle = source.itemTitle || 'Archived Record';
    source.archivedBy = source.archivedBy || actorName;
    source.archivedAt = source.archivedAt || nowIso;
  } else if (collectionName === 'officialManuals') {
    source.version = source.version || '1.0';
    source.title = source.title || 'User Manual';
    source.lastUpdated = source.lastUpdated || todayStr;
    source.uploadedBy = source.uploadedBy || actorName;
    source.fileType = source.fileType === 'docx' ? 'docx' : 'pdf';
    source.fileName = source.fileName || 'manual.pdf';
    source.fileSize = String(source.fileSize || '0 KB');
    source.isOfficial = Boolean(source.isOfficial);
    if (typeof source.dataUrl === 'string' && source.dataUrl.length > 200000) {
      delete source.dataUrl;
    }
  }

  for (const [key, maxLen] of Object.entries(maxMap)) {
    const val = source[key];
    if (val !== undefined && val !== null) {
      if (key === 'dataUrl' && String(val).length > maxLen) {
        continue;
      }
      payload[key] = String(val).slice(0, maxLen);
    }
  }

  for (const key of numKeys) {
    const val = source[key];
    if (val !== undefined && val !== null && !Number.isNaN(Number(val))) {
      payload[key] = Math.max(0, Number(val));
    }
  }

  for (const key of boolKeys) {
    if (source[key] !== undefined && source[key] !== null) {
      payload[key] = Boolean(source[key]);
    }
  }

  for (const key of arrayKeys) {
    const val = source[key];
    if (Array.isArray(val) && arrayConf) {
      const limit = arrayConf.perKeyMaxItems?.[key] ?? arrayConf.maxItems;
      const sliced = val.slice(0, limit);
      payload[key] = arrayConf.maxStrLen
        ? sliced.map((entry) => String(entry ?? '').slice(0, arrayConf.maxStrLen))
        : sanitizeForFirestore(sliced);
    }
  }

  if (collectionName === 'archive' && source.dataPayload && typeof source.dataPayload === 'object') {
    payload.dataPayload = sanitizeForFirestore(source.dataPayload);
  }

  payload.syncedAt = serverTimestamp();
  return payload;
}

function convertFirestoreTimestamps<T>(value: any): T {
  if (value === null || value === undefined) return value;
  if (value instanceof Timestamp) {
    return value.toDate().toISOString() as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => convertFirestoreTimestamps(v)) as unknown as T;
  }
  if (typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === 'syncedAt') continue;
      out[k] = convertFirestoreTimestamps(v);
    }
    return out as T;
  }
  return value;
}

export async function checkIsAdminUser(uid: string, email: string | null, emailVerified: boolean): Promise<boolean> {
  if (!emailVerified) return false;
  if (email === 'alvinmamo1995@gmail.com') return true;
  const path = `admins/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'admins', uid));
    return snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function syncAuthenticatedUserProfile(params: {
  uid: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  isAdmin: boolean;
}): Promise<void> {
  const userPath = `users/${params.uid}`;
  const privatePath = `users/${params.uid}/private/contact`;

  try {
    const existingSnap = await getDoc(doc(db, 'users', params.uid));
    if (!existingSnap.exists()) {
      await setDoc(doc(db, 'users', params.uid), {
        id: params.uid,
        uid: params.uid,
        name: (params.name || 'Pioneer User').slice(0, 160),
        role: params.isAdmin ? 'Administrator' : 'Read Only',
        departmentName: 'Marketing & Customer Experience',
        status: 'Active',
        avatarUrl: params.avatarUrl ? params.avatarUrl.slice(0, 2048) : null,
        lastLogin: new Date().toISOString(),
        createdAt: serverTimestamp(),
      });
    } else {
      await setDoc(
        doc(db, 'users', params.uid),
        {
          name: (params.name || 'Pioneer User').slice(0, 160),
          avatarUrl: params.avatarUrl ? params.avatarUrl.slice(0, 2048) : null,
          lastLogin: new Date().toISOString(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }

  try {
    await setDoc(
      doc(db, 'users', params.uid, 'private', 'contact'),
      {
        id: 'contact',
        email: params.email.slice(0, 160),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, privatePath);
  }
}

export async function saveUserRecordToCloud(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  department?: string;
  departmentId?: string;
  departmentName?: string;
  status: 'Active' | 'Inactive';
  avatarUrl?: string;
  phone?: string;
  lastLogin?: string;
}): Promise<void> {
  if (!isCloudSyncReady()) return;
  const safeId = sanitizeId(user.id);
  const userPath = `users/${safeId}`;
  const privatePath = `users/${safeId}/private/contact`;

  try {
    const existingSnap = await getDoc(doc(db, 'users', safeId));
    const profileData: Record<string, any> = {
      id: safeId,
      uid: safeId,
      name: (user.name || 'User').slice(0, 160),
      role: user.role,
      department: user.department ? user.department.slice(0, 160) : null,
      departmentId: user.departmentId ? user.departmentId.slice(0, 128) : null,
      departmentName: user.departmentName ? user.departmentName.slice(0, 160) : null,
      status: user.status,
      avatarUrl: user.avatarUrl ? user.avatarUrl.slice(0, 2048) : null,
      lastLogin: user.lastLogin ? user.lastLogin.slice(0, 64) : null,
    };

    if (!existingSnap.exists()) {
      profileData.createdAt = serverTimestamp();
      await setDoc(doc(db, 'users', safeId), profileData);
    } else {
      profileData.updatedAt = serverTimestamp();
      await setDoc(doc(db, 'users', safeId), profileData, { merge: true });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }

  if (user.email || user.phone) {
    try {
      await setDoc(
        doc(db, 'users', safeId, 'private', 'contact'),
        {
          id: 'contact',
          email: (user.email || 'user@pioneerassurance.co.ke').slice(0, 160),
          phone: user.phone ? user.phone.slice(0, 64) : null,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, privatePath);
    }
  }
}

export async function saveToCloud<T extends { id: string }>(
  collectionName: string,
  item: T
): Promise<void> {
  if (!isCloudSyncReady() || !item || !item.id) return;
  const safeId = sanitizeId(item.id);
  const path = `${collectionName}/${safeId}`;
  try {
    const docRef = doc(db, collectionName, safeId);
    const payload = prepareDomainPayload(collectionName, item as Record<string, any>);
    await setDoc(docRef, payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteFromCloud(collectionName: string, id: string): Promise<void> {
  if (!isCloudSyncReady() || !id) return;
  const safeId = sanitizeId(id);
  const path = `${collectionName}/${safeId}`;
  try {
    await deleteDoc(doc(db, collectionName, safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function deleteUserFromCloud(id: string): Promise<void> {
  if (!isCloudSyncReady() || !id) return;
  const safeId = sanitizeId(id);
  try {
    await deleteDoc(doc(db, 'users', safeId, 'private', 'contact')).catch(() => {});
    await deleteDoc(doc(db, 'users', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${safeId}`);
  }
}

export async function saveCollectionToCloud<T extends { id: string }>(
  collectionName: string,
  items: T[]
): Promise<void> {
  if (!isCloudSyncReady() || !items || items.length === 0) return;
  try {
    const batchSize = 400;
    for (let i = 0; i < items.length; i += batchSize) {
      const chunk = items.slice(i, i + batchSize);
      const batch = writeBatch(db);
      for (const item of chunk) {
        if (item && item.id) {
          const safeId = sanitizeId(item.id);
          const docRef = doc(db, collectionName, safeId);
          const payload = prepareDomainPayload(collectionName, item as Record<string, any>);
          batch.set(docRef, payload, { merge: true });
        }
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, collectionName);
  }
}

export async function fetchCollectionFromCloud<T>(collectionName: string): Promise<T[]> {
  if (!isCloudSyncReady() || !activeSyncContext) return [];
  try {
    const colRef = collection(db, collectionName);
    const q = activeSyncContext.isAdmin
      ? colRef
      : query(colRef, where('ownerId', '==', activeSyncContext.uid));
    const querySnapshot = await getDocs(q);
    const items: T[] = [];
    querySnapshot.forEach((docSnap) => {
      items.push(convertFirestoreTimestamps<T>(docSnap.data()));
    });
    return items;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, collectionName);
  }
}

export async function clearCollectionInCloud(collectionName: string): Promise<void> {
  if (!isCloudSyncReady() || !activeSyncContext) return;
  try {
    const colRef = collection(db, collectionName);
    const q = activeSyncContext.isAdmin
      ? colRef
      : query(colRef, where('ownerId', '==', activeSyncContext.uid));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) return;

    const batchSize = 400;
    const docs = querySnapshot.docs;
    for (let i = 0; i < docs.length; i += batchSize) {
      const chunk = docs.slice(i, i + batchSize);
      const batch = writeBatch(db);
      chunk.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, collectionName);
  }
}
