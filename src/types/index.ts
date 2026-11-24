export type RoleType =
  | 'Administrator'
  | 'Marketing & CX Manager'
  | 'Budget Officer'
  | 'Viewer'
  | 'Management'
  | 'Market Research & Insights Lead'
  | 'Marketing Director'
  | 'Finance Manager'
  | 'Campaign Manager'
  | 'Read Only';

export type LegalEntityType = 'PACL' | 'PGIL';
export type ProjectEntityType = 'PACL' | 'PGIL' | 'Shared';
export type LegalEntityFilter = 'All' | 'PACL' | 'PGIL' | 'Shared';

export type ProjectType = 'Shared Project' | 'PACL Standalone' | 'PGIL Standalone';

export type AllocationMethod = 'Percentage' | 'Fixed Amount' | 'Direct Entity';

export type QuarterType = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'Annual';

export interface PermissionSet {
  view: boolean;
  add: boolean;
  edit: boolean;
  delete: boolean;
  approve: boolean;
  export: boolean;
  import: boolean;
  manageUsers: boolean;
}

export type BudgetStatus = 'Approved' | 'Pending' | 'Draft' | 'Exceeded' | 'Closed';

export interface Budget {
  id: string;
  code: string; // e.g. BDG-2026-MCX-01
  financialYear: string; // e.g. 2026
  legalEntity: LegalEntityType | 'Shared'; // Mandatory: PACL, PGIL, or Shared
  quarter?: QuarterType;
  departmentId: string;
  departmentName: string;
  projectId?: string;
  projectName?: string;
  campaign?: string;
  strategicInitiative?: string;
  category: string;
  costCentre?: string;
  fundingSource?: string;
  activity?: string;
  allocatedAmount: number; // Approved budget amount
  revisedBudget?: number; // Optional revised budget allocation
  actualExpenditure?: number; // Calculated or recorded actual
  committedSpend?: number; // Outstanding LPOs / committed vouchers
  remainingBudget?: number; // Allocated - Actual - Committed
  utilizationPercent?: number; // Actual / (Approved/Revised) * 100
  notes?: string;
  description: string;
  status: BudgetStatus;
  sharedGroupId?: string; // Links split budgets if created from shared allocation
  allocationMethod?: AllocationMethod;
  paclSharePercent?: number;
  pgilSharePercent?: number;
  paclAllocation?: number;
  pgilAllocation?: number;
  createdBy: string;
  createdDate: string;
  updatedAt?: string;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  headOfDepartment: string;
  allocatedBudget: number;
  totalSpent: number;
  headcount: number;
  description: string;
  costCentres?: string[];
}

export type ProjectStatus =
  | 'Draft'
  | 'Planned'
  | 'Pending Approval'
  | 'Approved'
  | 'In Progress'
  | 'On Hold'
  | 'Completed'
  | 'Cancelled'
  | 'Delayed'
  | 'Planning';

export interface Project {
  id: string; // Unique Project ID
  code: string;
  name: string; // Common Project / Campaign Name
  projectType: ProjectType; // 'Shared Project' | 'PACL Standalone' | 'PGIL Standalone'
  entity?: ProjectEntityType; // 'PACL' | 'PGIL' | 'Shared'
  paclApplicable: boolean;
  pgilApplicable: boolean;
  departmentId: string;
  departmentName: string;
  budgetCategory?: string;
  strategicInitiative?: string;
  campaignType?: string;
  costCentre?: string;
  fundingSource?: string;
  targetAudience?: string;
  expectedROI?: string;
  kpiTarget?: string;
  projectOwner?: string;
  projectManager: string;
  vendor?: string;
  vendorId?: string;
  startDate: string;
  expectedCompletionDate?: string;
  actualCompletionDate?: string;
  endDate: string;
  description?: string;
  status: ProjectStatus;
  // Financial Information
  originalBudget?: number;
  approvedBudget?: number;
  revisedBudget?: number;
  budget?: number; // Active combined or view budget
  spent?: number; // Active actual spend
  actualSpend?: number;
  committedSpend?: number;
  remaining?: number;
  remainingBudget?: number;
  utilizationPercent?: number;
  progressPercent?: number;
  // Ephemeral UI-computed invoice rollups (computed in DatabaseService.getProjects, stripped before cloud write)
  invoicedAmount?: number;
  pendingInvoicesAmount?: number;
  pendingInvoicesCount?: number;
  paidInvoicesAmount?: number;
  invoiceCount?: number;
  // Shared Project Allocations
  totalBudget?: number;
  paclAllocation?: number;
  pgilAllocation?: number;
  paclActual?: number;
  pgilActual?: number;
  notes?: string;
  attachedDocuments?: string[];
}

export interface ProjectEntityAllocation {
  projectId: string;
  projectName: string;
  legalEntity: LegalEntityType;
  allocatedBudget: number;
  actualSpend: number;
  remainingBalance: number;
  utilizationPercent: number;
}

export type QuotationStatus = 'Draft' | 'Received' | 'Under Review' | 'Approved' | 'Rejected' | 'Converted to LPO';

export interface QuotationRecord {
  id: string;
  quotationNumber: string; // e.g. QT-2026-001
  vendorId?: string;
  vendorName: string;
  supplierId?: string;
  supplierName?: string;
  projectId?: string;
  projectName?: string;
  legalEntity?: ProjectEntityType; // 'PACL' | 'PGIL' | 'Shared'
  quotationDate: string;
  validUntil?: string;
  amountBeforeVat?: number;
  vatAmount?: number;
  totalAmount: number;
  currency: string;
  status: QuotationStatus;
  description: string;
  items?: any[];
  documentId?: string;
  documentFileName?: string;
  documentDataUrl?: string;
  remarks?: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

export type InvoicePaymentStatus = 'Pending' | 'Submitted' | 'Approved' | 'Paid' | 'Partially Paid' | 'Rejected';

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string; // e.g. INV-2026-001
  vendorId: string;
  vendorName: string;
  supplierId?: string;
  supplierName?: string;
  lpoNumber?: string;
  lpoId?: string;
  projectId?: string;
  projectName?: string;
  legalEntity: ProjectEntityType; // 'PACL' | 'PGIL' | 'Shared'
  invoiceDate: string;
  dueDate?: string;
  amountBeforeVat: number;
  vatAmount: number;
  totalAmount: number;
  currency: string;
  paymentStatus: InvoicePaymentStatus;
  paymentDate?: string;
  description: string;
  notes?: string;
  documentId?: string;
  documentFileName?: string;
  documentDataUrl?: string;
  remarks?: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

export type PaymentRequestStatus = 'Draft' | 'Submitted' | 'Finance Review' | 'Approved' | 'Paid' | 'Rejected';
export type PaymentPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export interface PaymentRequestRecord {
  id: string;
  requestNumber: string; // e.g. PR-2026-001
  vendorId?: string;
  vendorName?: string;
  supplierId?: string;
  supplierName?: string;
  lpoNumber?: string;
  invoiceNumber?: string;
  invoiceId?: string;
  paymentMethod?: string;
  bankDetails?: string;
  requesterName?: string;
  projectId?: string;
  projectName?: string;
  legalEntity: ProjectEntityType; // 'PACL' | 'PGIL' | 'Shared'
  requestedAmount: number;
  requestDate?: string;
  vatAmount?: number;
  totalAmount?: number;
  currency: string;
  purpose: string;
  priority?: PaymentPriority;
  status: PaymentRequestStatus;
  paymentDate?: string;
  paymentVoucherFileName?: string;
  approvedBy?: string;
  approvalDate?: string;
  documentId?: string;
  documentFileName?: string;
  documentDataUrl?: string;
  remarks?: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: RoleType;
  department?: string;
  departmentId?: string;
  departmentName?: string;
  status: 'Active' | 'Inactive';
  lastLogin?: string;
  createdAt?: string;
  avatarUrl?: string;
  phone?: string;
  permissions?: PermissionSet;
}

export interface DataArchiveItem {
  id: string;
  originalId?: string;
  entityType?: string;
  entityId?: string;
  itemType?: 'Budget' | 'Project' | 'LPO' | 'Invoice' | 'Quotation' | 'PaymentRequest' | 'Document';
  itemTitle?: string;
  description?: string;
  legalEntity?: string;
  financialYear?: string;
  archivedBy?: string;
  archivedAt?: string;
  deletedBy?: string;
  deletedAt?: string;
  reason?: string;
  dataPayload?: any;
}

export interface OfficialManualDoc {
  id: string;
  version: string;
  title: string;
  lastUpdated: string;
  uploadedBy: string;
  fileType: 'pdf' | 'docx';
  fileName: string;
  fileSize: string;
  downloadUrl?: string;
  dataUrl?: string;
  isOfficial: boolean;
  notes?: string;
}

export type PaymentStatus = 'Paid' | 'Pending Approval' | 'Rejected' | 'Approved';

export interface Expenditure {
  id: string;
  expenseId: string; // e.g. EXP-2026-001
  date: string;
  expenseDate?: string;
  paymentMethod?: string;
  legalEntity: LegalEntityType; // Mandatory: PACL or PGIL
  quarter?: QuarterType;
  departmentId: string;
  departmentName: string;
  budgetId?: string;
  projectId?: string;
  projectName?: string;
  campaignName?: string;
  strategicInitiative?: string;
  costCentre?: string;
  fundingSource?: string;
  activity?: string;
  supplierId: string;
  supplierName: string;
  category: string;
  description: string;
  invoiceNumber: string;
  purchaseOrder: string;
  amount: number;
  vatAmount: number; // e.g. 16%
  totalAmount: number;
  paymentStatus: PaymentStatus;
  sharedGroupId?: string; // Grouping ID for joint shared allocations
  allocationMethod?: AllocationMethod;
  paclSharePercent?: number;
  pgilSharePercent?: number;
  receiptFileName?: string;
  receiptFileUrl?: string;
  remarks?: string;
  isBudgetExceeded?: boolean;
  requiresAuthorization?: boolean;
  authorizedBy?: string;
  createdBy: string;
  createdAt: string;
}

export type SupplierStatus = 'Active' | 'Inactive' | 'Preferred';

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  pin: string; // Tax ID / KRA PIN
  address: string;
  servicesOffered: string[];
  status: SupplierStatus;
  totalPaid: number;
  rating?: number; // 1 to 5
  category?: string;
}

export type DocumentType =
  | 'Local Purchase Order (LPO)'
  | 'Purchase Requisition'
  | 'Invoice'
  | 'Quotation'
  | 'Contract'
  | 'Agreement'
  | 'Delivery Note'
  | 'Receipt'
  | 'Payment Voucher'
  | 'Approval Document'
  | 'Purchase Order'
  | 'Memo'
  | 'Event Document'
  | 'Sponsorship Agreement'
  | 'Supplier Document'
  | 'Project Brief'
  | 'Campaign Document'
  | 'Report'
  | 'Other Supporting Document'
  | string;

export type DocumentStatus = 'Draft' | 'Pending Review' | 'Approved' | 'Rejected' | 'Superseded' | 'Archived';

export interface DocumentVersion {
  versionNumber: number;
  uploadDate: string;
  uploadedBy: string;
  reasonForRevision: string;
  fileName: string;
  fileSize: string;
  dataUrl?: string;
}

export interface DocumentActivity {
  id: string;
  timestamp: string;
  user: string;
  action: 'Uploaded' | 'Viewed' | 'Downloaded' | 'Edited' | 'Replaced' | 'Approved' | 'Rejected' | 'Archived';
  details?: string;
}

export interface ERPDocument {
  id: string;
  docNumber?: string; // e.g. DOC-PACL-2026-001
  title: string;
  type: DocumentType;
  category?: string;
  departmentId?: string;
  departmentName: string;
  legalEntity?: LegalEntityType | 'Combined';
  projectId?: string;
  projectName?: string;
  budgetId?: string;
  budgetCode?: string;
  expenditureId?: string;
  expenseCode?: string;
  supplierId?: string;
  supplierName?: string;
  lpoId?: string;
  lpoNumber?: string;
  fileName: string;
  fileSize: string;
  fileType: 'pdf' | 'doc' | 'xls' | 'image' | 'other';
  mimeType?: string;
  dataUrl?: string; // Base64 or Blob storage for preview
  uploadedBy: string;
  uploadDate: string;
  downloadUrl?: string;
  status?: DocumentStatus;
  currentVersion?: number;
  versions?: DocumentVersion[];
  activityLog?: DocumentActivity[];
  remarks?: string;
}

export type LPOStatus =
  | 'Draft'
  | 'Submitted'
  | 'Pending Approval'
  | 'Approved'
  | 'Issued'
  | 'Partially Fulfilled'
  | 'Partially Utilized'
  | 'Fully Fulfilled'
  | 'Fully Utilized'
  | 'Cancelled'
  | 'Closed';

export type LPOInvoiceStatus = 'Uninvoiced' | 'Partially Invoiced' | 'Fully Invoiced';
export type LPOPaymentStatus = 'Unpaid' | 'Partially Paid' | 'Fully Paid' | 'Paid' | 'Pending';

export interface LPORecord {
  id: string;
  lpoNumber: string; // e.g. PACL/MCX/LPO/001/2026
  lpoDate: string;
  legalEntity: LegalEntityType; // 'PACL' | 'PGIL'
  supplierId: string;
  supplierName: string;
  projectId?: string;
  projectName?: string;
  budgetId?: string;
  budgetCode?: string;
  budgetCategory?: string;
  departmentId?: string;
  departmentName?: string;
  description: string;
  lpoAmount: number; // Subtotal
  amountBeforeVat?: number;
  vatAmount: number; // VAT (e.g. 16%)
  totalLpoValue: number; // Total value = Subtotal + VAT
  totalLpoAmount?: number;
  currency: string;
  lpoStatus: LPOStatus;
  status?: LPOStatus;
  expectedDeliveryDate?: string;
  invoiceStatus: LPOInvoiceStatus;
  paymentStatus: LPOPaymentStatus;
  relatedInvoice?: string;
  documentId?: string; // Attachment ID
  documentFileName?: string;
  documentDataUrl?: string;
  remarks?: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AuditTrail {
  id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'EXCEED_BUDGET_OVERRIDE' | 'EXPORT' | 'IMPORT' | 'CATEGORY_MANAGE';
  entity: 'Budget' | 'Expenditure' | 'Project' | 'Department' | 'Supplier' | 'Document' | 'Settings' | 'Category';
  entityId?: string;
  details: string;
  performedBy: string;
  userRole: RoleType;
  timestamp: string;
  ipAddress: string;
}

export interface ERPNotification {
  id: string;
  type: 'threshold_50' | 'threshold_75' | 'threshold_90' | 'budget_exceeded' | 'pending_approval' | 'project_ending' | 'budget_status' | 'info';
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  relatedEntityId?: string;
  severity: 'info' | 'warning' | 'danger' | 'success';
}

export interface SystemSettings {
  companyName: string;
  departmentName: string;
  leadTitle: string;
  companyLogoUrl: string;
  financialYear: string;
  currencySymbol: string;
  currencyCode: string;
  kraPin: string;
  address: string;
  phone: string;
  email: string;
  vatRatePercent: number;
  notificationThresholds: {
    warn50: boolean;
    warn75: boolean;
    warn90: boolean;
    warnExceeded: boolean;
  };
  approvalLevels: {
    level1Limit: number;
    level2Limit: number;
    level3Limit: number;
  };
  expenseCategories: string[];
  costCentres: string[];
  strategicInitiatives: string[];
  fundingSources: string[];
  documentCategories?: string[];
}

export interface GlobalFilterState {
  financialYear: string;
  legalEntity: LegalEntityFilter; // 'All' | 'PACL' | 'PGIL'
  quarter: string;
  departmentId: string;
  projectId: string;
  campaign: string;
  month: string;
  category: string;
  costCentre: string;
  supplierId: string;
  status: string;
  searchQuery: string;
  dateFrom: string;
  dateTo: string;
}

export interface ImportHistoryRecord {
  id: string;
  fileName: string;
  dataType: 'Budget' | 'Expenditure' | 'Projects' | 'Suppliers' | 'LPOs' | 'Documents';
  dateImported: string;
  totalRecords: number;
  successfulRecords: number;
  failedRecords: number;
  importedBy: string;
  status: 'Successful' | 'Partial Success' | 'Failed';
}

export interface ExcelImportRow {
  rowNumber?: number;
  budgetCode?: string;
  expenseId?: string;
  lpoNumber?: string;
  docNumber?: string;
  legalEntity?: LegalEntityType; // 'PACL' | 'PGIL'
  financialYear?: string;
  quarter?: QuarterType;
  department?: string;
  project?: string;
  projectType?: ProjectType;
  campaign?: string;
  strategicInitiative?: string;
  category?: string;
  costCentre?: string;
  fundingSource?: string;
  activity?: string;
  allocatedAmount?: number;
  amount?: number;
  lpoAmount?: number;
  supplierName?: string;
  supplierEmail?: string;
  supplierPhone?: string;
  kraPin?: string;
  date?: string;
  invoiceNumber?: string;
  title?: string;
  type?: string;
  fileName?: string;
  description: string;
  isValid: boolean;
  errorMessages: string[];
}

// ==================== TRANSACTION DRILL-DOWN & TRACEABILITY TYPES ====================

export type TraceableRecordType =
  | 'Expenditure'
  | 'LPO'
  | 'Invoice'
  | 'Payment Request'
  | 'Quotation'
  | 'Budget Allocation'
  | 'Supporting Document';

export type RelationshipType =
  | 'Parent Transaction'
  | 'Child Transaction'
  | 'Generated From'
  | 'Generated By'
  | 'Related To'
  | 'Payment For'
  | 'Invoice For'
  | 'PO For'
  | 'Requisition For'
  | 'Budgeted Under'
  | 'Charged Against'
  | 'Reversal Of'
  | 'Adjustment To'
  | 'Duplicate Of';

export interface TraceableDocumentRef {
  id: string;
  title: string;
  type: string;
  fileName: string;
  fileSize?: string;
  url?: string;
  dataUrl?: string;
  uploadedBy?: string;
  uploadedDate?: string;
}

export interface TransactionTraceRecord {
  id: string;
  reference: string;
  date: string;
  type: TraceableRecordType;
  description: string;
  amount: number;
  currency: string;
  legalEntity: string;
  departmentId?: string;
  departmentName?: string;
  costCentre?: string;
  budgetId?: string;
  budgetCode?: string;
  budgetCategory?: string;
  projectId?: string;
  projectName?: string;
  supplierId?: string;
  supplierName?: string;
  initiator: string;
  currentStatus: string;
  approvalStatus: string;
  paymentStatus: string;
  invoiceNumber?: string;
  poNumber?: string;
  lpoNumber?: string;
  requestNumber?: string;
  quotationNumber?: string;
  supportingDocuments: TraceableDocumentRef[];
  createdAt: string;
  updatedAt?: string;
  rawRecord?: any;
}

export interface RelatedTransactionItem {
  id: string;
  date: string;
  transactionType: TraceableRecordType;
  reference: string;
  description: string;
  supplierName?: string;
  departmentName?: string;
  costCentre?: string;
  budgetCode?: string;
  amount: number;
  currency: string;
  status: string;
  paymentStatus?: string;
  relationshipType: RelationshipType;
  relationshipDirection: 'upstream' | 'downstream' | 'lateral';
  sourcePage: string;
  recordId: string;
}

export interface TransactionChainNode {
  stage: 'Budget Line' | 'Budget Allocation' | 'Quotation / Requisition' | 'LPO / PO' | 'Supplier Invoice' | 'Payment Request' | 'Disbursed Payment';
  title: string;
  reference: string;
  amount: number;
  date: string;
  status: string;
  party: string;
  isCurrent: boolean;
  recordId: string;
  recordType: TraceableRecordType;
  sourcePage: string;
}

export interface FinancialImpactSummary {
  originalBudget: number;
  revisedBudget: number;
  committedAmount: number;
  invoicedAmount: number;
  paidAmount: number;
  outstandingAmount: number; // Invoiced - Paid
  availableBudget: number; // Budget - Committed
  variance: number;
  budgeted: number;
  committed: number;
  actual: number;
  paid: number;
  outstanding: number;
  encumbered: number;
}

export interface PotentialIssueItem {
  id: string;
  title: string;
  severity: 'critical' | 'warning' | 'info';
  details: string;
  recommendation: string;
}

export interface TransactionActivityTimelineItem {
  id: string;
  timestamp: string;
  date: string;
  user: string;
  role: string;
  action: string;
  details: string;
  statusBadge?: string;
}

export interface AmountTraceContext {
  metricId: string;
  metricName: string;
  totalAmount: number;
  currency: string;
  financialYear: string;
  period?: string;
  category?: string;
  departmentId?: string;
  departmentName?: string;
  costCentre?: string;
  budgetLine?: string;
  projectId?: string;
  projectName?: string;
  supplierId?: string;
  supplierName?: string;
  formula: string;
  formulaExplanation: string;
  formulaInputs?: { label: string; value: string | number }[];
}

export interface UnderlyingTransactionItem {
  id: string;
  date: string;
  transactionId: string;
  reference: string;
  transactionType: TraceableRecordType;
  description: string;
  supplierName: string;
  departmentName: string;
  costCentre: string;
  budgetLine: string;
  project: string;
  amount: number;
  currency: string;
  status: string;
  paymentStatus: string;
  sourcePage: string;
  recordId: string;
}

export type DrillDownTarget =
  | { type: 'transaction'; id: string; recordType?: string }
  | { type: 'amount'; context: AmountTraceContext }
  | { type: 'supplier'; id: string }
  | { type: 'budget_line'; id: string }
  | { type: 'department'; id: string };

export interface DrillDownBreadcrumb {
  label: string;
  target?: DrillDownTarget;
  active?: boolean;
}
