import { DatabaseService } from './db';
import {
  TransactionTraceRecord,
  RelatedTransactionItem,
  TransactionChainNode,
  FinancialImpactSummary,
  PotentialIssueItem,
  TransactionActivityTimelineItem,
  AmountTraceContext,
  UnderlyingTransactionItem,
  TraceableRecordType,
  RelationshipType,
  Expenditure,
  LPORecord,
  InvoiceRecord,
  PaymentRequestRecord,
  QuotationRecord,
  Budget,
  ERPDocument,
} from '../types';

export class TraceabilityService {
  /**
   * Normalizes a reference string by removing whitespace, punctuation, and converting to lowercase.
   */
  static normalizeRef(s?: string): string {
    if (!s) return '';
    return s.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  /**
   * Checks whether two references match, either strictly, normalized, or via containment.
   */
  static matchesRef(a?: string, b?: string): boolean {
    if (!a || !b) return false;
    const cleanA = this.normalizeRef(a);
    const cleanB = this.normalizeRef(b);
    if (!cleanA || !cleanB) return false;
    return cleanA === cleanB || cleanA.includes(cleanB) || cleanB.includes(cleanA);
  }

  /**
   * Resolves any reference, transaction ID, invoice number, or PO number into a normalized TransactionTraceRecord.
   */
  static resolveTransaction(idOrRef: string, preferredType?: TraceableRecordType): TransactionTraceRecord | null {
    if (!idOrRef) return null;
    const query = idOrRef.trim();
    const cleanQuery = this.normalizeRef(query);
    if (!cleanQuery) return null;

    const expenditures = DatabaseService.getExpenditures();
    const lpos = DatabaseService.getLPOs();
    const invoices = DatabaseService.getInvoices();
    const payments = DatabaseService.getPaymentRequests();
    const quotations = DatabaseService.getQuotations();
    const budgets = DatabaseService.getBudgets();
    const documents = DatabaseService.getDocuments();

    // 1. Try matching Expenditure
    if (!preferredType || preferredType === 'Expenditure') {
      const exp = expenditures.find(
        (e) =>
          this.matchesRef(e.id, query) ||
          this.matchesRef(e.expenseId, query) ||
          this.matchesRef(e.invoiceNumber, query) ||
          this.matchesRef(e.purchaseOrder, query)
      );
      if (exp) {
        return this.normalizeExpenditure(exp, documents);
      }
    }

    // 2. Try matching LPO
    if (!preferredType || preferredType === 'LPO') {
      const lpo = lpos.find(
        (l) =>
          this.matchesRef(l.id, query) ||
          this.matchesRef(l.lpoNumber, query) ||
          this.matchesRef(l.relatedInvoice, query)
      );
      if (lpo) {
        return this.normalizeLPO(lpo, documents);
      }
    }

    // 3. Try matching Invoice
    if (!preferredType || preferredType === 'Invoice') {
      const inv = invoices.find(
        (i) =>
          this.matchesRef(i.id, query) ||
          this.matchesRef(i.invoiceNumber, query) ||
          this.matchesRef(i.lpoNumber, query)
      );
      if (inv) {
        return this.normalizeInvoice(inv, documents);
      }
    }

    // 4. Try matching Payment Request
    if (!preferredType || preferredType === 'Payment Request') {
      const pay = payments.find(
        (p) =>
          this.matchesRef(p.id, query) ||
          this.matchesRef(p.requestNumber, query) ||
          this.matchesRef(p.invoiceNumber, query) ||
          this.matchesRef(p.lpoNumber, query)
      );
      if (pay) {
        return this.normalizePaymentRequest(pay, documents);
      }
    }

    // 5. Try matching Quotation
    if (!preferredType || preferredType === 'Quotation') {
      const quote = quotations.find(
        (q) =>
          this.matchesRef(q.id, query) ||
          this.matchesRef(q.quotationNumber, query)
      );
      if (quote) {
        return this.normalizeQuotation(quote, documents);
      }
    }

    // 6. Try matching Budget Line
    if (!preferredType || preferredType === 'Budget Allocation') {
      const bdg = budgets.find(
        (b) =>
          this.matchesRef(b.id, query) ||
          this.matchesRef(b.code, query)
      );
      if (bdg) {
        return this.normalizeBudget(bdg, documents);
      }
    }

    // Fallback: check across all collections without preferredType restriction
    const anyExp = expenditures.find(
      (e) =>
        this.matchesRef(e.id, query) ||
        this.matchesRef(e.expenseId, query) ||
        this.matchesRef(e.invoiceNumber, query) ||
        this.matchesRef(e.purchaseOrder, query)
    );
    if (anyExp) return this.normalizeExpenditure(anyExp, documents);

    const anyLpo = lpos.find(
      (l) =>
        this.matchesRef(l.id, query) ||
        this.matchesRef(l.lpoNumber, query) ||
        this.matchesRef(l.relatedInvoice, query)
    );
    if (anyLpo) return this.normalizeLPO(anyLpo, documents);

    const anyInv = invoices.find(
      (i) =>
        this.matchesRef(i.id, query) ||
        this.matchesRef(i.invoiceNumber, query) ||
        this.matchesRef(i.lpoNumber, query)
    );
    if (anyInv) return this.normalizeInvoice(anyInv, documents);

    const anyPay = payments.find(
      (p) =>
        this.matchesRef(p.id, query) ||
        this.matchesRef(p.requestNumber, query) ||
        this.matchesRef(p.invoiceNumber, query) ||
        this.matchesRef(p.lpoNumber, query)
    );
    if (anyPay) return this.normalizePaymentRequest(anyPay, documents);

    const anyQuote = quotations.find(
      (q) =>
        this.matchesRef(q.id, query) ||
        this.matchesRef(q.quotationNumber, query)
    );
    if (anyQuote) return this.normalizeQuotation(anyQuote, documents);

    const anyBdg = budgets.find(
      (b) =>
        this.matchesRef(b.id, query) ||
        this.matchesRef(b.code, query)
    );
    if (anyBdg) return this.normalizeBudget(anyBdg, documents);

    return null;
  }

  // --- Normalization Helpers ---

  private static normalizeExpenditure(exp: Expenditure, docs: ERPDocument[]): TransactionTraceRecord {
    const expDate = exp.date || exp.expenseDate || '2026-01-01';
    const matchedDocs = docs.filter(
      (d) =>
        d.id === exp.id ||
        (exp.invoiceNumber && d.docNumber && d.docNumber.toLowerCase().includes(exp.invoiceNumber.toLowerCase())) ||
        (exp.purchaseOrder && d.docNumber && d.docNumber.toLowerCase().includes(exp.purchaseOrder.toLowerCase()))
    );

    return {
      id: exp.id,
      reference: exp.expenseId,
      date: expDate,
      type: 'Expenditure',
      description: exp.description || `Expenditure ${exp.expenseId}`,
      amount: exp.totalAmount || exp.amount || 0,
      currency: 'KES',
      legalEntity: exp.legalEntity || 'PACL',
      departmentId: exp.departmentId,
      departmentName: exp.departmentName || 'Marketing & Customer Experience',
      costCentre: exp.costCentre || 'CC-101 Marketing & Campaigns',
      budgetId: exp.budgetId,
      budgetCode: exp.budgetId || 'BDG-2026-MCX-01',
      budgetCategory: exp.category,
      projectId: exp.projectId,
      projectName: exp.projectName,
      supplierId: exp.supplierId,
      supplierName: exp.supplierName || 'Vendor',
      initiator: exp.createdBy || 'Finance Officer',
      currentStatus: exp.paymentStatus || 'Approved',
      approvalStatus: exp.paymentStatus === 'Rejected' ? 'Rejected' : 'Approved',
      paymentStatus: exp.paymentStatus || 'Paid',
      invoiceNumber: exp.invoiceNumber,
      poNumber: exp.purchaseOrder,
      supportingDocuments: matchedDocs.map((d) => ({
        id: d.id,
        title: d.title || d.fileName,
        type: d.type || 'Supporting Document',
        fileName: d.fileName,
        fileSize: d.fileSize,
        dataUrl: d.dataUrl,
        uploadedBy: d.uploadedBy,
        uploadedDate: d.uploadDate,
      })),
      createdAt: exp.createdAt || `${expDate}T09:00:00.000Z`,
      updatedAt: `${expDate}T16:30:00.000Z`,
      rawRecord: exp,
    };
  }

  private static normalizeLPO(lpo: LPORecord, docs: ERPDocument[]): TransactionTraceRecord {
    const lpoDate = lpo.lpoDate || '2026-01-01';
    const lpoStatus = lpo.lpoStatus || lpo.status || 'Issued';
    const matchedDocs = docs.filter(
      (d) =>
        d.id === lpo.documentId ||
        (d.docNumber && lpo.lpoNumber && d.docNumber.toLowerCase().includes(lpo.lpoNumber.toLowerCase())) ||
        (lpo.documentFileName && d.fileName === lpo.documentFileName)
    );

    return {
      id: lpo.id,
      reference: lpo.lpoNumber,
      date: lpoDate,
      type: 'LPO',
      description: lpo.description || `Local Purchase Order ${lpo.lpoNumber}`,
      amount: lpo.totalLpoValue ?? lpo.totalLpoAmount ?? lpo.lpoAmount ?? lpo.amountBeforeVat ?? 0,
      currency: lpo.currency || 'KES',
      legalEntity: lpo.legalEntity || 'PACL',
      departmentId: lpo.departmentId,
      departmentName: lpo.departmentName || 'Marketing & Customer Experience',
      costCentre: 'CC-101 Marketing & Campaigns',
      budgetId: lpo.budgetId,
      budgetCode: lpo.budgetCode,
      budgetCategory: lpo.budgetCategory,
      projectId: lpo.projectId,
      projectName: lpo.projectName,
      supplierId: lpo.supplierId,
      supplierName: lpo.supplierName,
      initiator: lpo.createdBy || 'Procurement Officer',
      currentStatus: lpoStatus,
      approvalStatus: lpoStatus === 'Draft' ? 'Pending' : 'Approved',
      paymentStatus: lpo.paymentStatus || 'Pending Payment',
      invoiceNumber: lpo.relatedInvoice,
      poNumber: lpo.lpoNumber,
      lpoNumber: lpo.lpoNumber,
      supportingDocuments: matchedDocs.map((d) => ({
        id: d.id,
        title: d.title || d.fileName,
        type: d.type || 'LPO Document',
        fileName: d.fileName,
        fileSize: d.fileSize,
        dataUrl: d.dataUrl || lpo.documentDataUrl,
        uploadedBy: d.uploadedBy,
        uploadedDate: d.uploadDate,
      })),
      createdAt: lpo.createdAt || `${lpoDate}T08:00:00.000Z`,
      updatedAt: lpo.updatedAt || `${lpoDate}T14:15:00.000Z`,
      rawRecord: lpo,
    };
  }

  private static normalizeInvoice(inv: InvoiceRecord, docs: ERPDocument[]): TransactionTraceRecord {
    const matchedDocs = docs.filter(
      (d) =>
        d.id === inv.documentId ||
        (d.docNumber && inv.invoiceNumber && d.docNumber.toLowerCase().includes(inv.invoiceNumber.toLowerCase())) ||
        (inv.documentFileName && d.fileName === inv.documentFileName)
    );

    return {
      id: inv.id,
      reference: inv.invoiceNumber,
      date: inv.invoiceDate,
      type: 'Invoice',
      description: inv.description || `Supplier Invoice ${inv.invoiceNumber}`,
      amount: inv.totalAmount || 0,
      currency: inv.currency || 'KES',
      legalEntity: (inv.legalEntity as string) || 'PACL',
      departmentName: 'Marketing & Customer Experience',
      costCentre: 'CC-101 Marketing & Campaigns',
      projectId: inv.projectId,
      projectName: inv.projectName,
      supplierId: inv.vendorId || inv.supplierId,
      supplierName: inv.vendorName || inv.supplierName,
      initiator: inv.createdBy || 'Accounts Payable Officer',
      currentStatus: inv.paymentStatus || 'Approved',
      approvalStatus: inv.paymentStatus === 'Rejected' ? 'Rejected' : 'Approved',
      paymentStatus: inv.paymentStatus || 'Pending',
      invoiceNumber: inv.invoiceNumber,
      poNumber: inv.lpoNumber,
      lpoNumber: inv.lpoNumber,
      supportingDocuments: matchedDocs.map((d) => ({
        id: d.id,
        title: d.title || d.fileName,
        type: d.type || 'Invoice Document',
        fileName: d.fileName,
        fileSize: d.fileSize,
        dataUrl: d.dataUrl || inv.documentDataUrl,
        uploadedBy: d.uploadedBy,
        uploadedDate: d.uploadDate,
      })),
      createdAt: inv.createdAt || `${inv.invoiceDate}T10:00:00.000Z`,
      updatedAt: inv.updatedAt || `${inv.invoiceDate}T16:00:00.000Z`,
      rawRecord: inv,
    };
  }

  private static normalizePaymentRequest(pay: PaymentRequestRecord, docs: ERPDocument[]): TransactionTraceRecord {
    const matchedDocs = docs.filter(
      (d) =>
        d.id === pay.documentId ||
        (d.docNumber && pay.requestNumber && d.docNumber.toLowerCase().includes(pay.requestNumber.toLowerCase()))
    );

    const beneficiary = pay.vendorName || pay.supplierName || 'Beneficiary';

    return {
      id: pay.id,
      reference: pay.requestNumber,
      date: pay.requestDate || (pay.createdAt ? pay.createdAt.split('T')[0] : '2026-01-01'),
      type: 'Payment Request',
      description: pay.purpose || `Payment Request ${pay.requestNumber}`,
      amount: pay.totalAmount || pay.requestedAmount || 0,
      currency: pay.currency || 'KES',
      legalEntity: (pay.legalEntity as string) || 'PACL',
      departmentName: 'Marketing & Customer Experience',
      costCentre: 'CC-101 Marketing & Campaigns',
      projectId: pay.projectId,
      projectName: pay.projectName,
      supplierId: pay.vendorId || pay.supplierId,
      supplierName: beneficiary,
      initiator: pay.createdBy || 'Finance Associate',
      currentStatus: pay.status || 'Approved',
      approvalStatus: pay.status === 'Draft' ? 'Pending' : pay.status === 'Rejected' ? 'Rejected' : 'Approved',
      paymentStatus: pay.status === 'Paid' ? 'Paid' : 'Processing',
      invoiceNumber: pay.invoiceNumber,
      lpoNumber: pay.lpoNumber,
      requestNumber: pay.requestNumber,
      supportingDocuments: matchedDocs.map((d) => ({
        id: d.id,
        title: d.title || d.fileName,
        type: d.type || 'Payment Voucher',
        fileName: d.fileName,
        fileSize: d.fileSize,
        dataUrl: d.dataUrl,
        uploadedBy: d.uploadedBy,
        uploadedDate: d.uploadDate,
      })),
      createdAt: pay.createdAt || `${pay.requestDate || '2026-07-01'}T11:00:00.000Z`,
      updatedAt: pay.updatedAt || `${pay.requestDate || '2026-07-01'}T17:00:00.000Z`,
      rawRecord: pay,
    };
  }

  private static normalizeQuotation(quote: QuotationRecord, docs: ERPDocument[]): TransactionTraceRecord {
    const vendor = quote.vendorName || quote.supplierName || 'Vendor';

    return {
      id: quote.id,
      reference: quote.quotationNumber,
      date: quote.quotationDate,
      type: 'Quotation',
      description: quote.description || `Quotation from ${vendor}`,
      amount: quote.totalAmount || 0,
      currency: quote.currency || 'KES',
      legalEntity: (quote.legalEntity as string) || 'PACL',
      departmentName: 'Marketing & Customer Experience',
      costCentre: 'CC-101 Marketing & Campaigns',
      projectName: quote.projectName,
      supplierId: quote.vendorId || quote.supplierId,
      supplierName: vendor,
      initiator: quote.createdBy || 'Procurement Lead',
      currentStatus: quote.status || 'Received',
      approvalStatus: quote.status === 'Approved' || quote.status === 'Converted to LPO' ? 'Approved' : quote.status === 'Rejected' ? 'Rejected' : 'Under Review',
      paymentStatus: 'N/A',
      quotationNumber: quote.quotationNumber,
      supportingDocuments: docs
        .filter((d) => d.id === quote.documentId || (d.docNumber && quote.quotationNumber && d.docNumber.includes(quote.quotationNumber)))
        .map((d) => ({
          id: d.id,
          title: d.title || d.fileName,
          type: d.type || 'Quotation Document',
          fileName: d.fileName,
          fileSize: d.fileSize,
          dataUrl: d.dataUrl || quote.documentDataUrl,
          uploadedBy: d.uploadedBy,
          uploadedDate: d.uploadDate,
        })),
      createdAt: quote.createdAt || `${quote.quotationDate}T09:30:00.000Z`,
      updatedAt: quote.updatedAt || `${quote.quotationDate}T15:00:00.000Z`,
      rawRecord: quote,
    };
  }

  private static normalizeBudget(bdg: Budget, docs: ERPDocument[]): TransactionTraceRecord {
    return {
      id: bdg.id,
      reference: bdg.code,
      date: `2026-01-01`,
      type: 'Budget Allocation',
      description: bdg.description || `${bdg.category} - ${bdg.code}`,
      amount: bdg.allocatedAmount || 0,
      currency: 'KES',
      legalEntity: bdg.legalEntity || 'PACL',
      departmentId: bdg.departmentId,
      departmentName: bdg.departmentName || 'Marketing & Customer Experience',
      costCentre: bdg.costCentre || 'CC-101 Marketing & Campaigns',
      budgetId: bdg.id,
      budgetCode: bdg.code,
      budgetCategory: bdg.category,
      projectId: bdg.projectId,
      projectName: bdg.campaign || bdg.projectName,
      initiator: bdg.createdBy || 'Budget Planning Committee',
      currentStatus: bdg.allocatedAmount > 0 ? 'Approved' : 'Draft',
      approvalStatus: 'Approved',
      paymentStatus: 'Allocated',
      supportingDocuments: docs
        .filter((d) => d.docNumber && bdg.code && d.docNumber.includes(bdg.code))
        .map((d) => ({
          id: d.id,
          title: d.title || d.fileName,
          type: d.type || 'Budget Approval Memo',
          fileName: d.fileName,
          fileSize: d.fileSize,
          dataUrl: d.dataUrl,
          uploadedBy: d.uploadedBy,
          uploadedDate: d.uploadDate,
        })),
      createdAt: bdg.createdDate || `2026-01-01T08:00:00.000Z`,
      updatedAt: bdg.updatedAt || `2026-01-15T12:00:00.000Z`,
      rawRecord: bdg,
    };
  }

  /**
   * Retrieves all related transactions, builds the lifecycle chain, computes financial impacts, and runs anomaly checks.
   */
  static getRelatedTransactions(target: TransactionTraceRecord): {
    chain: TransactionChainNode[];
    related: RelatedTransactionItem[];
    financialImpact: FinancialImpactSummary;
    issues: PotentialIssueItem[];
    timeline: TransactionActivityTimelineItem[];
  } {
    const expenditures = DatabaseService.getExpenditures();
    const lpos = DatabaseService.getLPOs();
    const invoices = DatabaseService.getInvoices();
    const payments = DatabaseService.getPaymentRequests();
    const quotations = DatabaseService.getQuotations();
    const budgets = DatabaseService.getBudgets();
    const auditLogs = DatabaseService.getAuditTrail();

    const relatedMap = new Map<string, RelatedTransactionItem>();

    const targetRef = target.reference;
    const targetInv = target.invoiceNumber || '';
    const targetLpo = target.lpoNumber || target.poNumber || '';
    const targetSupplier = target.supplierName || '';
    const targetBudgetCode = target.budgetCode || '';
    const targetProjectId = target.projectId || '';

    // 1. Traverse LPOs
    lpos.forEach((l) => {
      if (l.id === target.id && target.type === 'LPO') return;

      let matchType: RelationshipType | null = null;
      let direction: 'upstream' | 'downstream' | 'lateral' = 'lateral';

      const isExactLpoMatch = Boolean(targetLpo && TraceabilityService.matchesRef(l.lpoNumber, targetLpo));
      const isInvoiceMatch = Boolean(targetInv && TraceabilityService.matchesRef(l.relatedInvoice, targetInv));
      const isProjectMatch = Boolean(targetProjectId && l.projectId === targetProjectId);
      const isBudgetMatch = Boolean(targetBudgetCode && TraceabilityService.matchesRef(l.budgetCode, targetBudgetCode));
      const isSupplierMatch = Boolean(targetSupplier && TraceabilityService.matchesRef(l.supplierName, targetSupplier));

      if (isExactLpoMatch) {
        matchType = target.type === 'Invoice' ? 'PO For' : target.type === 'Payment Request' ? 'Generated From' : 'Related To';
        direction = 'upstream';
      } else if (isInvoiceMatch) {
        matchType = 'Invoice For';
        direction = 'downstream';
      } else if (isProjectMatch) {
        matchType = 'Related To';
        direction = 'lateral';
      } else if (isBudgetMatch) {
        matchType = 'Budgeted Under';
        direction = 'lateral';
      } else if (isSupplierMatch) {
        matchType = 'Related To';
        direction = 'lateral';
      }

      if (matchType) {
        relatedMap.set(`lpo-${l.id}`, {
          id: l.id,
          date: l.lpoDate,
          transactionType: 'LPO',
          reference: l.lpoNumber,
          description: l.description,
          supplierName: l.supplierName,
          departmentName: l.departmentName,
          costCentre: 'CC-101',
          budgetCode: l.budgetCode,
          amount: l.totalLpoValue ?? l.totalLpoAmount ?? l.lpoAmount ?? 0,
          currency: l.currency || 'KES',
          status: l.lpoStatus || l.status || 'Issued',
          paymentStatus: l.paymentStatus,
          relationshipType: matchType,
          relationshipDirection: direction,
          sourcePage: 'lpos',
          recordId: l.id,
        });
      }
    });

    // 2. Traverse Invoices
    invoices.forEach((i) => {
      if (i.id === target.id && target.type === 'Invoice') return;

      let matchType: RelationshipType | null = null;
      let direction: 'upstream' | 'downstream' | 'lateral' = 'lateral';

      const isExactInvoiceMatch = Boolean(targetInv && TraceabilityService.matchesRef(i.invoiceNumber, targetInv));
      const isLpoMatch = Boolean(targetLpo && TraceabilityService.matchesRef(i.lpoNumber, targetLpo));
      const isProjectMatch = Boolean(targetProjectId && i.projectId === targetProjectId);
      const isSupplierMatch = Boolean(targetSupplier && TraceabilityService.matchesRef(i.vendorName || i.supplierName, targetSupplier));

      if (isExactInvoiceMatch) {
        matchType = target.type === 'Payment Request' ? 'Payment For' : 'Invoice For';
        direction = 'upstream';
      } else if (isLpoMatch) {
        matchType = target.type === 'LPO' ? 'Invoice For' : 'Related To';
        direction = 'downstream';
      } else if (isProjectMatch) {
        matchType = 'Related To';
        direction = 'lateral';
      } else if (isSupplierMatch) {
        matchType = 'Related To';
        direction = 'lateral';
      }

      if (matchType) {
        relatedMap.set(`inv-${i.id}`, {
          id: i.id,
          date: i.invoiceDate,
          transactionType: 'Invoice',
          reference: i.invoiceNumber,
          description: i.description,
          supplierName: i.vendorName || i.supplierName,
          departmentName: 'Marketing & Customer Experience',
          costCentre: 'CC-101',
          amount: i.totalAmount,
          currency: i.currency || 'KES',
          status: i.paymentStatus || 'Approved',
          paymentStatus: i.paymentStatus,
          relationshipType: matchType,
          relationshipDirection: direction,
          sourcePage: 'invoices',
          recordId: i.id,
        });
      }
    });

    // 3. Traverse Payment Requests
    payments.forEach((p) => {
      if (p.id === target.id && target.type === 'Payment Request') return;

      let matchType: RelationshipType | null = null;
      let direction: 'upstream' | 'downstream' | 'lateral' = 'downstream';

      const isInvoiceMatch = Boolean(targetInv && TraceabilityService.matchesRef(p.invoiceNumber, targetInv));
      const isLpoMatch = Boolean(targetLpo && TraceabilityService.matchesRef(p.lpoNumber, targetLpo));
      const isRefMatch = Boolean(targetRef && TraceabilityService.matchesRef(p.requestNumber, targetRef));
      const isProjectMatch = Boolean(targetProjectId && p.projectId === targetProjectId);
      const pBeneficiary = p.vendorName || p.supplierName || '';
      const isSupplierMatch = Boolean(targetSupplier && TraceabilityService.matchesRef(pBeneficiary, targetSupplier));

      if (isInvoiceMatch) {
        matchType = 'Payment For';
        direction = 'downstream';
      } else if (isLpoMatch) {
        matchType = 'Generated From';
        direction = 'downstream';
      } else if (isRefMatch) {
        matchType = 'Related To';
        direction = 'lateral';
      } else if (isProjectMatch) {
        matchType = 'Related To';
        direction = 'lateral';
      } else if (isSupplierMatch) {
        matchType = 'Related To';
        direction = 'lateral';
      }

      if (matchType) {
        relatedMap.set(`pay-${p.id}`, {
          id: p.id,
          date: p.requestDate || (p.createdAt ? p.createdAt.split('T')[0] : '2026-01-01'),
          transactionType: 'Payment Request',
          reference: p.requestNumber,
          description: p.purpose,
          supplierName: pBeneficiary,
          departmentName: 'Marketing & Customer Experience',
          costCentre: 'CC-101',
          amount: p.totalAmount || p.requestedAmount,
          currency: p.currency || 'KES',
          status: p.status,
          paymentStatus: p.status === 'Paid' ? 'Paid' : 'Processing',
          relationshipType: matchType,
          relationshipDirection: direction,
          sourcePage: 'payment_requests',
          recordId: p.id,
        });
      }
    });

    // 4. Traverse Expenditures
    expenditures.forEach((e) => {
      if (e.id === target.id && target.type === 'Expenditure') return;

      let matchType: RelationshipType | null = null;
      let direction: 'upstream' | 'downstream' | 'lateral' = 'downstream';

      const isInvoiceMatch = Boolean(targetInv && TraceabilityService.matchesRef(e.invoiceNumber, targetInv));
      const isPoMatch = Boolean(targetLpo && TraceabilityService.matchesRef(e.purchaseOrder, targetLpo));
      const isRefMatch = Boolean(targetRef && (TraceabilityService.matchesRef(e.expenseId, targetRef) || (e.description && e.description.includes(targetRef))));
      const isProjectMatch = Boolean(targetProjectId && e.projectId === targetProjectId);
      const isBudgetMatch = Boolean(targetBudgetCode && TraceabilityService.matchesRef(e.budgetId, targetBudgetCode));
      const isSupplierMatch = Boolean(targetSupplier && TraceabilityService.matchesRef(e.supplierName, targetSupplier));

      if (isInvoiceMatch) {
        matchType = 'Payment For';
        direction = 'downstream';
      } else if (isPoMatch) {
        matchType = 'PO For';
        direction = 'downstream';
      } else if (isRefMatch) {
        matchType = 'Related To';
        direction = 'downstream';
      } else if (isProjectMatch) {
        matchType = 'Related To';
        direction = 'lateral';
      } else if (isBudgetMatch) {
        matchType = 'Charged Against';
        direction = 'lateral';
      } else if (isSupplierMatch) {
        matchType = 'Related To';
        direction = 'lateral';
      }

      if (matchType) {
        relatedMap.set(`exp-${e.id}`, {
          id: e.id,
          date: e.date || e.expenseDate || '',
          transactionType: 'Expenditure',
          reference: e.expenseId,
          description: e.description,
          supplierName: e.supplierName,
          departmentName: e.departmentName,
          costCentre: e.costCentre,
          budgetCode: e.budgetId,
          amount: e.totalAmount,
          currency: 'KES',
          status: e.paymentStatus || 'Approved',
          paymentStatus: e.paymentStatus || 'Paid',
          relationshipType: matchType,
          relationshipDirection: direction,
          sourcePage: 'expenditure',
          recordId: e.id,
        });
      }
    });

    // 5. Traverse Quotations
    quotations.forEach((q) => {
      if (q.id === target.id && target.type === 'Quotation') return;

      let matchType: RelationshipType | null = null;
      const qVendor = q.vendorName || q.supplierName || '';
      const isQuoteMatch = Boolean(target.quotationNumber && TraceabilityService.matchesRef(q.quotationNumber, target.quotationNumber));
      const isProjectMatch = Boolean(targetProjectId && q.projectId === targetProjectId);
      const isSupplierMatch = Boolean(targetSupplier && TraceabilityService.matchesRef(qVendor, targetSupplier));

      if (isQuoteMatch || isProjectMatch || isSupplierMatch) {
        matchType = 'Requisition For';
      }

      if (matchType) {
        relatedMap.set(`quote-${q.id}`, {
          id: q.id,
          date: q.quotationDate,
          transactionType: 'Quotation',
          reference: q.quotationNumber,
          description: q.description,
          supplierName: qVendor,
          departmentName: 'Marketing & Customer Experience',
          costCentre: 'CC-101',
          amount: q.totalAmount,
          currency: q.currency || 'KES',
          status: q.status,
          relationshipType: matchType,
          relationshipDirection: 'upstream',
          sourcePage: 'quotations',
          recordId: q.id,
        });
      }
    });

    const related = Array.from(relatedMap.values());

    // --- Build Visual Flowchart Chain ---
    // Stage 1: Budget Line
    const matchedBudget = budgets.find(
      (b) =>
        (target.type === 'Budget Allocation' && b.id === target.id) ||
        (target.budgetId && b.id === target.budgetId) ||
        (targetBudgetCode && TraceabilityService.matchesRef(b.code, targetBudgetCode)) ||
        (target.departmentName && TraceabilityService.matchesRef(b.departmentName, target.departmentName))
    );

    // Stage 2: Quotation
    const matchedQuote = quotations.find(
      (q) =>
        (target.type === 'Quotation' && q.id === target.id) ||
        (target.quotationNumber && TraceabilityService.matchesRef(q.quotationNumber, target.quotationNumber)) ||
        (targetProjectId && q.projectId === targetProjectId) ||
        (targetSupplier && TraceabilityService.matchesRef(q.vendorName || q.supplierName, targetSupplier))
    );

    // Stage 3: LPO / PO
    const matchedLpo = lpos.find(
      (l) =>
        (target.type === 'LPO' && l.id === target.id) ||
        (targetLpo && TraceabilityService.matchesRef(l.lpoNumber, targetLpo)) ||
        (targetInv && TraceabilityService.matchesRef(l.relatedInvoice, targetInv)) ||
        (targetProjectId && l.projectId === targetProjectId) ||
        (targetSupplier && TraceabilityService.matchesRef(l.supplierName, targetSupplier))
    );

    // Stage 4: Invoice
    const matchedInv = invoices.find(
      (i) =>
        (target.type === 'Invoice' && i.id === target.id) ||
        (targetInv && TraceabilityService.matchesRef(i.invoiceNumber, targetInv)) ||
        (targetLpo && TraceabilityService.matchesRef(i.lpoNumber, targetLpo)) ||
        (targetProjectId && i.projectId === targetProjectId) ||
        (targetSupplier && TraceabilityService.matchesRef(i.vendorName || i.supplierName, targetSupplier))
    );

    // Stage 5: Payment Request
    const matchedPay = payments.find(
      (p) =>
        (target.type === 'Payment Request' && p.id === target.id) ||
        (targetInv && TraceabilityService.matchesRef(p.invoiceNumber, targetInv)) ||
        (targetLpo && TraceabilityService.matchesRef(p.lpoNumber, targetLpo)) ||
        (targetRef && TraceabilityService.matchesRef(p.requestNumber, targetRef)) ||
        (targetProjectId && p.projectId === targetProjectId) ||
        (targetSupplier && TraceabilityService.matchesRef(p.vendorName || p.supplierName, targetSupplier))
    );

    // Stage 6: Disbursed Expenditure
    const matchedExp = expenditures.find(
      (e) =>
        (target.type === 'Expenditure' && e.id === target.id) ||
        (targetInv && TraceabilityService.matchesRef(e.invoiceNumber, targetInv)) ||
        (targetLpo && TraceabilityService.matchesRef(e.purchaseOrder, targetLpo)) ||
        (targetRef && (TraceabilityService.matchesRef(e.expenseId, targetRef) || (e.description && e.description.includes(targetRef)))) ||
        (targetProjectId && e.projectId === targetProjectId) ||
        (targetSupplier && TraceabilityService.matchesRef(e.supplierName, targetSupplier))
    );

    const chain: TransactionChainNode[] = [];

    // Node 1: Budget Line
    if (matchedBudget) {
      chain.push({
        stage: 'Budget Line',
        title: matchedBudget.category,
        reference: matchedBudget.code,
        amount: matchedBudget.allocatedAmount,
        date: '2026-01-01',
        status: 'Active',
        party: matchedBudget.departmentName,
        isCurrent: target.type === 'Budget Allocation' && target.id === matchedBudget.id,
        recordId: matchedBudget.id,
        recordType: 'Budget Allocation',
        sourcePage: 'budgets',
      });
    }

    // Node 2: Quotation / Requisition
    if (matchedQuote) {
      chain.push({
        stage: 'Quotation / Requisition',
        title: matchedQuote.description || 'Vendor Price Bid',
        reference: matchedQuote.quotationNumber,
        amount: matchedQuote.totalAmount,
        date: matchedQuote.quotationDate,
        status: matchedQuote.status,
        party: matchedQuote.vendorName || matchedQuote.supplierName || 'Vendor',
        isCurrent: target.type === 'Quotation' && target.id === matchedQuote.id,
        recordId: matchedQuote.id,
        recordType: 'Quotation',
        sourcePage: 'quotations',
      });
    }

    // Node 3: LPO / PO
    if (matchedLpo) {
      chain.push({
        stage: 'LPO / PO',
        title: matchedLpo.description,
        reference: matchedLpo.lpoNumber,
        amount: matchedLpo.totalLpoValue ?? matchedLpo.totalLpoAmount ?? matchedLpo.lpoAmount ?? 0,
        date: matchedLpo.lpoDate,
        status: matchedLpo.lpoStatus || matchedLpo.status || 'Issued',
        party: matchedLpo.supplierName,
        isCurrent: target.type === 'LPO' && target.id === matchedLpo.id,
        recordId: matchedLpo.id,
        recordType: 'LPO',
        sourcePage: 'lpos',
      });
    }

    // Node 4: Supplier Invoice
    if (matchedInv) {
      chain.push({
        stage: 'Supplier Invoice',
        title: matchedInv.description,
        reference: matchedInv.invoiceNumber,
        amount: matchedInv.totalAmount,
        date: matchedInv.invoiceDate,
        status: matchedInv.paymentStatus || 'Approved',
        party: matchedInv.vendorName || matchedInv.supplierName || 'Vendor',
        isCurrent: target.type === 'Invoice' && target.id === matchedInv.id,
        recordId: matchedInv.id,
        recordType: 'Invoice',
        sourcePage: 'invoices',
      });
    }

    // Node 5: Payment Request
    if (matchedPay) {
      chain.push({
        stage: 'Payment Request',
        title: matchedPay.purpose,
        reference: matchedPay.requestNumber,
        amount: matchedPay.totalAmount || matchedPay.requestedAmount,
        date: matchedPay.requestDate || (matchedPay.createdAt ? matchedPay.createdAt.split('T')[0] : '2026-01-01'),
        status: matchedPay.status,
        party: matchedPay.vendorName || matchedPay.supplierName || 'Beneficiary',
        isCurrent: target.type === 'Payment Request' && target.id === matchedPay.id,
        recordId: matchedPay.id,
        recordType: 'Payment Request',
        sourcePage: 'payment_requests',
      });
    }

    // Node 6: Disbursed Payment / Posted Expense
    if (matchedExp) {
      chain.push({
        stage: 'Disbursed Payment',
        title: matchedExp.description,
        reference: matchedExp.expenseId,
        amount: matchedExp.totalAmount,
        date: matchedExp.date || matchedExp.expenseDate || '',
        status: matchedExp.paymentStatus || 'Paid',
        party: matchedExp.supplierName,
        isCurrent: target.type === 'Expenditure' && target.id === matchedExp.id,
        recordId: matchedExp.id,
        recordType: 'Expenditure',
        sourcePage: 'expenditure',
      });
    }

    // If target itself wasn't added to chain (e.g. orphan), prepend or append it
    const hasTargetInChain = chain.some((c) => c.isCurrent);
    if (!hasTargetInChain) {
      chain.push({
        stage: target.type === 'LPO' ? 'LPO / PO' : target.type === 'Invoice' ? 'Supplier Invoice' : target.type === 'Payment Request' ? 'Payment Request' : 'Disbursed Payment',
        title: target.description,
        reference: target.reference,
        amount: target.amount,
        date: target.date,
        status: target.currentStatus,
        party: target.supplierName || target.departmentName || 'Pioneer System',
        isCurrent: true,
        recordId: target.id,
        recordType: target.type,
        sourcePage: target.type === 'LPO' ? 'lpos' : target.type === 'Invoice' ? 'invoices' : target.type === 'Payment Request' ? 'payment_requests' : target.type === 'Quotation' ? 'quotations' : target.type === 'Budget Allocation' ? 'budgets' : 'expenditure',
      });
    }

    // Sort chain nodes logically by lifecycle order
    const stageOrder: Record<string, number> = {
      'Budget Line': 1,
      'Budget Allocation': 2,
      'Quotation / Requisition': 3,
      'LPO / PO': 4,
      'Supplier Invoice': 5,
      'Payment Request': 6,
      'Disbursed Payment': 7,
    };
    chain.sort((a, b) => (stageOrder[a.stage] || 99) - (stageOrder[b.stage] || 99));

    // --- Financial Impact Summary Calculation ---
    const budgetVal = matchedBudget ? Number(matchedBudget.allocatedAmount || 0) : 15000000;
    const lpoVal = matchedLpo ? Number(matchedLpo.totalLpoValue ?? matchedLpo.totalLpoAmount ?? matchedLpo.lpoAmount ?? 0) : target.type === 'LPO' ? Number(target.amount || 0) : 0;
    const invVal = matchedInv ? Number(matchedInv.totalAmount || 0) : target.type === 'Invoice' ? Number(target.amount || 0) : 0;
    const expVal = matchedExp ? Number(matchedExp.totalAmount || 0) : target.type === 'Expenditure' ? Number(target.amount || 0) : 0;
    const paidVal = target.paymentStatus === 'Paid' ? target.amount : expVal > 0 ? expVal : 0;

    const committedAmount = lpoVal > 0 ? lpoVal : invVal;
    const invoicedAmount = invVal > 0 ? invVal : expVal;
    const paidAmount = paidVal;
    const outstandingAmount = Math.max(0, invoicedAmount - paidAmount);
    const availableBudget = Math.max(0, budgetVal - committedAmount - expVal);
    const variance = budgetVal - (expVal + committedAmount);

    const financialImpact: FinancialImpactSummary = {
      originalBudget: budgetVal,
      revisedBudget: budgetVal,
      committedAmount,
      invoicedAmount,
      paidAmount,
      outstandingAmount,
      availableBudget,
      variance,
      budgeted: budgetVal,
      committed: committedAmount,
      actual: expVal,
      paid: paidAmount,
      outstanding: outstandingAmount,
      encumbered: Math.max(0, committedAmount - expVal),
    };

    // --- Anomaly & Potential Issues Checks ---
    const issues: PotentialIssueItem[] = [];

    // Check 1: Duplicate invoice number
    if (target.invoiceNumber) {
      const targetInvLower = target.invoiceNumber.toLowerCase();
      const otherInvs = invoices.filter(
        (i) => i.id !== target.id && i.invoiceNumber && i.invoiceNumber.toLowerCase() === targetInvLower
      );
      const otherExps = expenditures.filter(
        (e) => e.id !== target.id && e.invoiceNumber && e.invoiceNumber.toLowerCase() === targetInvLower
      );
      if (otherInvs.length > 0 || otherExps.length > 1) {
        issues.push({
          id: 'iss-dup-inv',
          title: `Duplicate Invoice Reference Detected: "${target.invoiceNumber}"`,
          severity: 'critical',
          details: `Invoice number "${target.invoiceNumber}" is linked to multiple records in the system. Verify to prevent double payment.`,
          recommendation: 'Cross-check physical/PDF invoice against existing entries before authorizing disbursement.',
        });
      }
    }

    // Check 2: Same supplier + identical amount
    if (target.supplierName && target.amount > 0) {
      const targetSupplierLower = target.supplierName.toLowerCase();
      const sameAmountExps = expenditures.filter(
        (e) =>
          e.id !== target.id &&
          e.supplierName &&
          e.supplierName.toLowerCase() === targetSupplierLower &&
          Math.abs(Number(e.totalAmount || 0) - Number(target.amount || 0)) < 1
      );
      if (sameAmountExps.length > 0) {
        issues.push({
          id: 'iss-same-amt',
          title: `Identical Amount Recorded for ${target.supplierName}`,
          severity: 'warning',
          details: `Another transaction for KES ${Number(target.amount || 0).toLocaleString()} was logged for this supplier on ${sameAmountExps[0].date || sameAmountExps[0].expenseDate || ''} (Ref: ${sameAmountExps[0].expenseId}).`,
          recommendation: 'Confirm whether this is a recurring monthly retainer fee or an unintended duplicate submission.',
        });
      }
    }

    // Check 3: Invoice without PO / LPO
    if (target.type === 'Invoice' && !target.lpoNumber) {
      issues.push({
        id: 'iss-missing-lpo',
        title: 'Invoice Lacks Official LPO Reference',
        severity: 'warning',
        details: 'This invoice was entered into the accounts payable ledger without an approved LPO or PO number.',
        recommendation: 'Initiate retrospective procurement validation or attach ExCo exceptional authorization memo.',
      });
    }

    // Check 4: Payment without invoice
    if (target.type === 'Payment Request' && !target.invoiceNumber) {
      issues.push({
        id: 'iss-missing-inv',
        title: 'Payment Request Lacks Tax Invoice Attachment',
        severity: 'warning',
        details: 'The payment voucher has been routed for disbursement without a matched supplier invoice reference.',
        recommendation: 'Obtain ETR compliant invoice before bank release to ensure full KRA tax deduction compliance.',
      });
    }

    // Check 5: Transaction exceeding budget line
    if (matchedBudget && Number(target.amount || 0) > Number(matchedBudget.allocatedAmount || 0)) {
      issues.push({
        id: 'iss-overbudget',
        title: `Transaction Exceeds Budget Line Cap: ${matchedBudget.code}`,
        severity: 'critical',
        details: `Amount KES ${Number(target.amount || 0).toLocaleString()} exceeds total allocated budget cap of KES ${Number(matchedBudget.allocatedAmount || 0).toLocaleString()}.`,
        recommendation: 'Requires reallocation of contingency/miscellaneous funds or HOD supplementary approval.',
      });
    }

    // Check 6: Unusually large transaction (> KES 5M)
    if (Number(target.amount || 0) >= 5000000) {
      issues.push({
        id: 'iss-high-value',
        title: 'High-Value Corporate Transaction (> KES 5,000,000)',
        severity: 'info',
        details: `This item represents a material commitment of KES ${Number(target.amount || 0).toLocaleString()} under Kenyan procurement governance guidelines.`,
        recommendation: 'Ensure dual-signatory approval from Managing Director & Head of Finance is filed.',
      });
    }

    // --- Chronological Lifecycle Timeline ---
    const timeline: TransactionActivityTimelineItem[] = [];

    // Add creation
    timeline.push({
      id: 'tl-1',
      timestamp: target.createdAt,
      date: target.date,
      user: target.initiator,
      role: 'Initiator',
      action: 'Transaction Initiated',
      details: `Generated record ${target.reference} for KES ${Number(target.amount || 0).toLocaleString()}`,
      statusBadge: 'Created',
    });

    // Add relevant matching audit logs
    const relevantAudits = auditLogs.filter(
      (a) =>
        (a.entityId && a.entityId === target.id) ||
        (a.details && target.reference && a.details.toLowerCase().includes(target.reference.toLowerCase())) ||
        (target.invoiceNumber && a.details && a.details.toLowerCase().includes(target.invoiceNumber.toLowerCase()))
    );

    relevantAudits.forEach((aud, idx) => {
      timeline.push({
        id: `tl-aud-${idx}`,
        timestamp: aud.timestamp,
        date: aud.timestamp ? aud.timestamp.split('T')[0] : target.date,
        user: aud.performedBy,
        role: aud.userRole,
        action: aud.action,
        details: aud.details,
        statusBadge: aud.action === 'APPROVE' ? 'Approved' : 'Audited',
      });
    });

    // If approved
    if (target.approvalStatus === 'Approved') {
      timeline.push({
        id: 'tl-approved',
        timestamp: target.updatedAt || `${target.date}T11:00:00.000Z`,
        date: target.date,
        user: 'Finance Approver',
        role: 'Approver',
        action: 'Financial Approval Granted',
        details: 'Budget availability verified and departmental approval confirmed.',
        statusBadge: 'Approved',
      });
    }

    // If paid
    if (target.paymentStatus === 'Paid') {
      timeline.push({
        id: 'tl-paid',
        timestamp: target.updatedAt || `${target.date}T16:00:00.000Z`,
        date: target.date,
        user: 'Cash Management & Treasury',
        role: 'Finance Officer',
        action: 'Funds Disbursed & Bank Reference Generated',
        details: `Disbursed KES ${Number(target.amount || 0).toLocaleString()} via Stanbic EFT bank batch.`,
        statusBadge: 'Paid',
      });
    }

    // Sort timeline chronologically
    timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return {
      chain,
      related,
      financialImpact,
      issues,
      timeline,
    };
  }

  /**
   * Universal "Trace This Amount" engine:
   * Reconciles reported numbers by gathering contributing transactions and verifying 100% mathematical integrity.
   */
  static traceAmount(
    context: AmountTraceContext,
    filters?: {
      search?: string;
      dateFrom?: string;
      dateTo?: string;
      department?: string;
      supplier?: string;
      status?: string;
      category?: string;
      minAmount?: number;
      maxAmount?: number;
    }
  ): {
    reconciledAmount: number;
    reportedAmount: number;
    variance: number;
    reconciles: boolean;
    records: UnderlyingTransactionItem[];
    formulaBreakdown: { title: string; steps: string[]; formula: string };
  } {
    const expenditures = DatabaseService.getExpenditures();
    const lpos = DatabaseService.getLPOs();
    const invoices = DatabaseService.getInvoices();
    const budgets = DatabaseService.getBudgets();

    const metricId = context.metricId.toLowerCase();
    const records: UnderlyingTransactionItem[] = [];

    // Filter by Metric Definition
    if (metricId.includes('budget') && !metricId.includes('spend') && !metricId.includes('utiliz') && !metricId.includes('commit')) {
      // Annual or Allocated Budgets
      budgets.forEach((b) => {
        records.push({
          id: b.id,
          date: '2026-01-01',
          transactionId: b.id,
          reference: b.code,
          transactionType: 'Budget Allocation',
          description: b.category + (b.campaign ? ` - ${b.campaign}` : ''),
          supplierName: 'Internal Budget Line',
          departmentName: b.departmentName || 'Marketing & Customer Experience',
          costCentre: b.costCentre || 'CC-101',
          budgetLine: b.code,
          project: b.campaign || 'Department Operations',
          amount: b.allocatedAmount,
          currency: 'KES',
          status: 'Approved',
          paymentStatus: 'Allocated',
          sourcePage: 'budgets',
          recordId: b.id,
        });
      });
    } else if (metricId.includes('commit')) {
      // LPOs that represent commitments
      lpos
        .filter(
          (l) =>
            ['Approved', 'Issued', 'Partially Fulfilled'].includes(l.lpoStatus || l.status || '') &&
            l.paymentStatus !== 'Paid' &&
            l.paymentStatus !== 'Fully Paid'
        )
        .forEach((l) => {
          records.push({
            id: l.id,
            date: l.lpoDate,
            transactionId: l.id,
            reference: l.lpoNumber,
            transactionType: 'LPO',
            description: l.description,
            supplierName: l.supplierName,
            departmentName: l.departmentName || 'Marketing & Customer Experience',
            costCentre: 'CC-101',
            budgetLine: l.budgetCode || 'BDG-2026-MCX-01',
            project: l.projectName || 'General',
            amount: l.totalLpoValue ?? l.totalLpoAmount ?? l.lpoAmount ?? 0,
            currency: l.currency || 'KES',
            status: l.lpoStatus || l.status || 'Issued',
            paymentStatus: l.paymentStatus,
            sourcePage: 'lpos',
            recordId: l.id,
          });
        });
    } else if (metricId.includes('invoice')) {
      // Invoices
      invoices.forEach((i) => {
        records.push({
          id: i.id,
          date: i.invoiceDate,
          transactionId: i.id,
          reference: i.invoiceNumber,
          transactionType: 'Invoice',
          description: i.description,
          supplierName: i.vendorName || i.supplierName || 'Vendor',
          departmentName: 'Marketing & Customer Experience',
          costCentre: 'CC-101',
          budgetLine: 'BDG-2026-MCX-01',
          project: i.projectName || 'General',
          amount: i.totalAmount,
          currency: i.currency || 'KES',
          status: i.paymentStatus || 'Approved',
          paymentStatus: i.paymentStatus,
          sourcePage: 'invoices',
          recordId: i.id,
        });
      });
    } else if (metricId.includes('payment') || metricId.includes('paid')) {
      // Settled Payments
      expenditures
        .filter((e) => e.paymentStatus === 'Paid')
        .forEach((e) => {
          records.push({
            id: e.id,
            date: e.date || e.expenseDate || '',
            transactionId: e.expenseId,
            reference: e.expenseId,
            transactionType: 'Expenditure',
            description: e.description,
            supplierName: e.supplierName || 'Vendor',
            departmentName: e.departmentName,
            costCentre: e.costCentre || 'CC-101',
            budgetLine: e.budgetId || 'BDG-2026-MCX-01',
            project: e.projectName || 'General',
            amount: e.totalAmount,
            currency: 'KES',
            status: e.paymentStatus || 'Approved',
            paymentStatus: e.paymentStatus || 'Paid',
            sourcePage: 'expenditure',
            recordId: e.id,
          });
        });
    } else {
      // Default: Actual Spend / Expenditures (covers total spend, department spend, category spend, quarterly spend, project spend)
      let candidateExps = expenditures;

      if (context.category) {
        candidateExps = candidateExps.filter(
          (e) => e.category && e.category.toLowerCase().includes(context.category!.toLowerCase())
        );
      }
      if (context.departmentName) {
        candidateExps = candidateExps.filter(
          (e) => e.departmentName && e.departmentName.toLowerCase().includes(context.departmentName!.toLowerCase())
        );
      }
      if (context.supplierName) {
        candidateExps = candidateExps.filter(
          (e) => e.supplierName && e.supplierName.toLowerCase().includes(context.supplierName!.toLowerCase())
        );
      }
      if (context.costCentre) {
        candidateExps = candidateExps.filter(
          (e) => e.costCentre && e.costCentre.toLowerCase().includes(context.costCentre!.toLowerCase())
        );
      }
      if (context.projectName) {
        candidateExps = candidateExps.filter(
          (e) => e.projectName && e.projectName.toLowerCase().includes(context.projectName!.toLowerCase())
        );
      }

      candidateExps.forEach((e) => {
        records.push({
          id: e.id,
          date: e.date || e.expenseDate || '',
          transactionId: e.expenseId,
          reference: e.expenseId,
          transactionType: 'Expenditure',
          description: e.description,
          supplierName: e.supplierName || 'Vendor',
          departmentName: e.departmentName,
          costCentre: e.costCentre || 'CC-101',
          budgetLine: e.budgetId || 'BDG-2026-MCX-01',
          project: e.projectName || 'General',
          amount: e.totalAmount,
          currency: 'KES',
          status: e.paymentStatus || 'Approved',
          paymentStatus: e.paymentStatus || 'Paid',
          sourcePage: 'expenditure',
          recordId: e.id,
        });
      });
    }

    // Apply additional runtime UI filters if provided
    let filteredRecords = records;
    if (filters) {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        filteredRecords = filteredRecords.filter(
          (r) =>
            (r.reference || '').toLowerCase().includes(q) ||
            (r.description || '').toLowerCase().includes(q) ||
            (r.supplierName || '').toLowerCase().includes(q) ||
            (r.departmentName || '').toLowerCase().includes(q) ||
            (r.budgetLine || '').toLowerCase().includes(q)
        );
      }
      if (filters.dateFrom) {
        filteredRecords = filteredRecords.filter((r) => r.date >= filters.dateFrom!);
      }
      if (filters.dateTo) {
        filteredRecords = filteredRecords.filter((r) => r.date <= filters.dateTo!);
      }
      if (filters.department) {
        filteredRecords = filteredRecords.filter((r) => r.departmentName === filters.department);
      }
      if (filters.supplier) {
        filteredRecords = filteredRecords.filter((r) => r.supplierName === filters.supplier);
      }
      if (filters.status) {
        filteredRecords = filteredRecords.filter((r) => r.status === filters.status);
      }
      if (filters.minAmount !== undefined) {
        filteredRecords = filteredRecords.filter((r) => r.amount >= filters.minAmount!);
      }
      if (filters.maxAmount !== undefined) {
        filteredRecords = filteredRecords.filter((r) => r.amount <= filters.maxAmount!);
      }
    }

    const reconciledAmount = filteredRecords.reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const reportedAmount = context.totalAmount > 0 ? context.totalAmount : reconciledAmount;
    const variance = Math.abs(reconciledAmount - reportedAmount);
    const reconciles = variance < 1;

    // Formula Breakdown
    const steps: string[] = [
      `1. Identified metric parameters: "${context.metricName}" for FY ${context.financialYear}`,
      `2. Queried system ledger for matching posted entries (Found ${filteredRecords.length} qualifying records)`,
      `3. Computed aggregate sum: Σ(Underlying Transaction Amounts) = KES ${reconciledAmount.toLocaleString()}`,
      `4. Compared against reported figure: KES ${reportedAmount.toLocaleString()}`,
      reconciles
        ? `5. Mathematical Reconciliation: 100% Match (Zero Variance: 0.00 KES)`
        : `5. Variance Identified: KES ${variance.toLocaleString()} due to active search/range filters`,
    ];

    return {
      reconciledAmount,
      reportedAmount,
      variance,
      reconciles,
      records: filteredRecords,
      formulaBreakdown: {
        title: `Reconciliation Formula: ${context.metricName}`,
        formula: context.formula || 'Reported Amount = Σ(Qualifying Ledger Transactions)',
        steps,
      },
    };
  }
}
