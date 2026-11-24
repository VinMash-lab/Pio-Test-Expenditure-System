import React, { useState, useMemo } from 'react';
import { DatabaseService } from '../services/db';
import { TraceabilityService } from '../services/traceabilityService';
import { ExcelService } from '../services/excelService';
import { PDFService } from '../services/pdfService';
import { showToast } from '../services/uiFeedback';
import {
  TransactionTraceRecord,
  RoleType,
  DrillDownTarget,
  RelatedTransactionItem,
} from '../types';

interface TransactionTraceViewProps {
  transactionIdOrRef?: string;
  transactionId?: string;
  preferredType?: any;
  recordType?: any;
  role?: RoleType;
  onBack: () => void;
  onDrillDown: (target: DrillDownTarget) => void;
  onNavigateToTab?: (tab: string) => void;
  onNavigateTab?: (tab: string) => void;
}

export const TransactionTraceView: React.FC<TransactionTraceViewProps> = ({
  transactionIdOrRef,
  transactionId,
  preferredType,
  recordType,
  role = 'Administrator',
  onBack,
  onDrillDown,
  onNavigateToTab,
  onNavigateTab,
}) => {
  const settings = DatabaseService.getSettings();
  const effectiveRef = (transactionIdOrRef || transactionId || '').trim();
  const effectiveType = preferredType || recordType;
  const navigateTab = onNavigateToTab || onNavigateTab;

  const [searchRelated, setSearchRelated] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [relFilter, setRelFilter] = useState('ALL');
  const [quickLookupQuery, setQuickLookupQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'related' | 'graph' | 'financial' | 'timeline' | 'documents' | 'audit'>('related');

  // Permission verification
  const currentUser = DatabaseService.getUsers().find((u) => u.role === role);
  const hasViewPermission = !currentUser || !currentUser.permissions || currentUser.permissions.view;

  // Resolve target record
  const record: TransactionTraceRecord | null = useMemo(() => {
    return TraceabilityService.resolveTransaction(effectiveRef, effectiveType);
  }, [effectiveRef, effectiveType]);

  // Compute related items, flowchart chain, financial impact, issues, and timeline
  const traceData = useMemo(() => {
    if (!record) return null;
    return TraceabilityService.getRelatedTransactions(record);
  }, [record]);

  if (!hasViewPermission) {
    return (
      <div className="card card-erp p-5 text-center my-4">
        <div className="text-warning mb-3">
          <i className="bi bi-shield-lock" style={{ fontSize: '3rem' }}></i>
        </div>
        <h4 className="fw-bold text-dark">Access Restricted</h4>
        <p className="text-muted fs-6 mb-4">
          This record exists in the system ledger, but your current role (<strong>{role}</strong>) does not have sufficient permission to inspect transaction details.
        </p>
        <div>
          <button type="button" className="btn btn-secondary px-4" onClick={onBack}>
            <i className="bi bi-arrow-left me-2"></i> Return to Previous Page
          </button>
        </div>
      </div>
    );
  }

  if (!record || !traceData) {
    return (
      <div className="card card-erp p-5 text-center my-4">
        <div className="text-muted mb-3">
          <i className="bi bi-file-earmark-x" style={{ fontSize: '3rem' }}></i>
        </div>
        <h4 className="fw-bold text-dark">Transaction Record Not Found</h4>
        <p className="text-muted fs-6 mb-4">
          No transaction, invoice, LPO, or payment request matching reference "<strong>{effectiveRef || 'N/A'}</strong>" could be found in the current ledger.
        </p>
        <div className="d-flex justify-content-center gap-2">
          <button type="button" className="btn btn-outline-secondary px-3" onClick={onBack}>
            <i className="bi bi-arrow-left me-2"></i> Return
          </button>
          <div className="input-group" style={{ maxWidth: '350px' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Search reference e.g. EXP-2026..."
              value={quickLookupQuery}
              onChange={(e) => setQuickLookupQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && quickLookupQuery.trim()) {
                  onDrillDown({ type: 'transaction', id: quickLookupQuery.trim() });
                }
              }}
            />
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                if (quickLookupQuery.trim()) {
                  onDrillDown({ type: 'transaction', id: quickLookupQuery.trim() });
                }
              }}
            >
              Lookup
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { chain, related, financialImpact, issues, timeline } = traceData;

  // Filter related transactions
  const filteredRelated = related.filter((item) => {
    if (typeFilter !== 'ALL' && item.transactionType !== typeFilter) return false;
    if (relFilter !== 'ALL' && item.relationshipType !== relFilter) return false;
    if (searchRelated) {
      const q = searchRelated.toLowerCase();
      const match =
        item.reference.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        (item.supplierName && item.supplierName.toLowerCase().includes(q)) ||
        (item.departmentName && item.departmentName.toLowerCase().includes(q)) ||
        (item.budgetCode && item.budgetCode.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  // Handle Export to Excel
  const handleExportExcel = () => {
    ExcelService.exportTransactionTrace(record, related, chain);
  };

  // Handle Export to PDF
  const handleExportPDF = () => {
    const tableRows = related.map((r) => [
      r.date,
      r.transactionType,
      r.reference,
      r.description.substring(0, 45),
      r.supplierName || 'N/A',
      `${r.amount.toLocaleString()} ${r.currency}`,
      r.status,
      r.relationshipType,
    ]);

    const summaryCards = [
      { label: 'Amount', value: `${record.amount.toLocaleString()} ${record.currency}` },
      { label: 'Committed', value: `${financialImpact.committedAmount.toLocaleString()} KES` },
      { label: 'Invoiced', value: `${financialImpact.invoicedAmount.toLocaleString()} KES` },
      { label: 'Paid', value: `${financialImpact.paidAmount.toLocaleString()} KES` },
      { label: 'Outstanding', value: `${financialImpact.outstandingAmount.toLocaleString()} KES` },
    ];

    PDFService.generateReportPDF(
      `TRANSACTION TRACE DOSSIER: ${record.reference}`,
      `Type: ${record.type} | Vendor: ${record.supplierName || 'N/A'} | Status: ${record.currentStatus}`,
      ['Date', 'Type', 'Reference', 'Description', 'Counterparty', 'Amount', 'Status', 'Relationship'],
      tableRows,
      settings,
      summaryCards
    );
  };

  const handleQuickLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickLookupQuery.trim()) {
      onDrillDown({ type: 'transaction', id: quickLookupQuery.trim() });
      setQuickLookupQuery('');
    }
  };

  return (
    <div className="d-flex flex-column gap-3 pb-5">
      {/* Top Navigation & Actions Bar */}
      <div className="card card-erp p-3">
        <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1.5"
              onClick={onBack}
              title="Return to previous screen"
            >
              <i className="bi bi-arrow-left"></i>
              <span className="fw-semibold">Back</span>
            </button>
            <div className="vr my-1"></div>
            <div>
              <div className="d-flex align-items-center gap-2">
                <span className="badge bg-danger text-white fs-7 py-1 px-2 fw-bold">
                  {record.type.toUpperCase()}
                </span>
                <h1 className="h5 fw-bold text-dark mb-0 font-monospace">{record.reference}</h1>
                <span className="badge bg-light text-dark border fs-8">
                  {record.legalEntity}
                </span>
              </div>
              <p className="text-muted fs-8 mb-0 mt-0.5">
                Transaction Date: <strong>{record.date}</strong> | Department: <strong>{record.departmentName}</strong>
              </p>
            </div>
          </div>

          {/* Quick Find Bar & Export Buttons */}
          <div className="d-flex flex-wrap align-items-center gap-2">
            <form onSubmit={handleQuickLookup} className="d-flex align-items-center" style={{ minWidth: '220px' }}>
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-white border-end-0">
                  <i className="bi bi-search text-muted"></i>
                </span>
                <input
                  type="text"
                  className="form-control border-start-0"
                  placeholder="Find another reference..."
                  value={quickLookupQuery}
                  onChange={(e) => setQuickLookupQuery(e.target.value)}
                />
                <button type="submit" className="btn btn-outline-secondary">Go</button>
              </div>
            </form>

            <button
              type="button"
              className="btn btn-sm btn-outline-success d-flex align-items-center gap-1"
              onClick={handleExportExcel}
              title="Export complete dossier to Excel"
            >
              <i className="bi bi-file-earmark-excel"></i>
              <span>Excel</span>
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1"
              onClick={handleExportPDF}
              title="Export formatted PDF trace report"
            >
              <i className="bi bi-file-earmark-pdf"></i>
              <span>PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* COMPACT MANAGEMENT SUMMARY HEADER */}
      <div className="card card-erp p-3 bg-white">
        <div className="row g-2 align-items-stretch">
          <div className="col-6 col-md-4 col-xl-2">
            <div className="p-2.5 rounded bg-light border h-100 d-flex flex-column justify-content-between">
              <span className="text-muted fs-8 fw-semibold text-uppercase d-block">Transaction Amount</span>
              <div className="fs-6 fw-bold text-danger">
                {record.amount.toLocaleString()} <span className="fs-8 text-muted">{record.currency}</span>
              </div>
              <span className="badge bg-danger-subtle text-danger fs-9 w-fit mt-1">Direct Value</span>
            </div>
          </div>

          <div className="col-6 col-md-4 col-xl-2">
            <div className="p-2.5 rounded bg-light border h-100 d-flex flex-column justify-content-between">
              <span className="text-muted fs-8 fw-semibold text-uppercase d-block">Committed Value</span>
              <div className="fs-6 fw-bold text-primary">
                {financialImpact.committedAmount.toLocaleString()} <span className="fs-8 text-muted">KES</span>
              </div>
              <span className="badge bg-primary-subtle text-primary fs-9 w-fit mt-1">Open Commitments</span>
            </div>
          </div>

          <div className="col-6 col-md-4 col-xl-2">
            <div className="p-2.5 rounded bg-light border h-100 d-flex flex-column justify-content-between">
              <span className="text-muted fs-8 fw-semibold text-uppercase d-block">Invoiced Value</span>
              <div className="fs-6 fw-bold text-dark">
                {financialImpact.invoicedAmount.toLocaleString()} <span className="fs-8 text-muted">KES</span>
              </div>
              <span className="badge bg-secondary-subtle text-secondary fs-9 w-fit mt-1">Tax Invoices</span>
            </div>
          </div>

          <div className="col-6 col-md-4 col-xl-2">
            <div className="p-2.5 rounded bg-light border h-100 d-flex flex-column justify-content-between">
              <span className="text-muted fs-8 fw-semibold text-uppercase d-block">Paid Disbursed</span>
              <div className="fs-6 fw-bold text-success">
                {financialImpact.paidAmount.toLocaleString()} <span className="fs-8 text-muted">KES</span>
              </div>
              <span className="badge bg-success-subtle text-success fs-9 w-fit mt-1">Settled Bank Funds</span>
            </div>
          </div>

          <div className="col-6 col-md-4 col-xl-2">
            <div className="p-2.5 rounded bg-light border h-100 d-flex flex-column justify-content-between">
              <span className="text-muted fs-8 fw-semibold text-uppercase d-block">Outstanding Balance</span>
              <div className={`fs-6 fw-bold ${financialImpact.outstandingAmount > 0 ? 'text-warning' : 'text-muted'}`}>
                {financialImpact.outstandingAmount.toLocaleString()} <span className="fs-8 text-muted">KES</span>
              </div>
              <span className="badge bg-warning-subtle text-warning-emphasis fs-9 w-fit mt-1">Invoiced - Paid</span>
            </div>
          </div>

          <div className="col-6 col-md-4 col-xl-2">
            <div className="p-2.5 rounded bg-light border h-100 d-flex flex-column justify-content-between">
              <span className="text-muted fs-8 fw-semibold text-uppercase d-block">Available Budget</span>
              <div className="fs-6 fw-bold text-success">
                {financialImpact.availableBudget.toLocaleString()} <span className="fs-8 text-muted">KES</span>
              </div>
              <span className="badge bg-success-subtle text-success fs-9 w-fit mt-1">Remaining Balance</span>
            </div>
          </div>
        </div>

        {/* Secondary KPI Bar: Counts & Badges */}
        <div className="d-flex flex-wrap align-items-center justify-content-between pt-2.5 mt-2.5 border-top gap-2">
          <div className="d-flex flex-wrap align-items-center gap-2">
            <span className="fs-7 text-muted">
              Current Status: <span className="badge bg-dark text-white ms-1">{record.currentStatus}</span>
            </span>
            <span className="fs-7 text-muted">
              Approval: <span className={`badge ms-1 ${record.approvalStatus === 'Approved' ? 'bg-success' : 'bg-warning text-dark'}`}>{record.approvalStatus}</span>
            </span>
            <span className="fs-7 text-muted">
              Payment: <span className={`badge ms-1 ${record.paymentStatus === 'Paid' ? 'bg-success' : 'bg-secondary'}`}>{record.paymentStatus}</span>
            </span>
          </div>

          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-sm btn-outline-primary py-0.5 px-2.5 fs-8 d-inline-flex align-items-center gap-1.5"
              onClick={() => setActiveTab('related')}
            >
              <i className="bi bi-diagram-3-fill"></i>
              <span>Related Records: <strong>{related.length}</strong></span>
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary py-0.5 px-2.5 fs-8 d-inline-flex align-items-center gap-1.5"
              onClick={() => setActiveTab('documents')}
            >
              <i className="bi bi-paperclip"></i>
              <span>Documents: <strong>{record.supportingDocuments.length}</strong></span>
            </button>
          </div>
        </div>
      </div>

      {/* POTENTIAL ISSUES / ANOMALIES & AUDIT WARNINGS */}
      {issues.length > 0 && (
        <div className="card card-erp border-warning bg-warning-subtle p-3">
          <div className="d-flex align-items-center gap-2 mb-2">
            <i className="bi bi-exclamation-triangle-fill text-warning fs-5"></i>
            <h5 className="fs-6 fw-bold text-dark mb-0">
              Potential Compliance & Anomaly Flags ({issues.length})
            </h5>
          </div>
          <div className="row g-2">
            {issues.map((iss) => (
              <div key={iss.id} className="col-12 col-md-6">
                <div className="p-2.5 rounded bg-white border border-warning shadow-sm h-100">
                  <div className="d-flex align-items-center justify-content-between mb-1">
                    <span className="fw-bold fs-7 text-dark">{iss.title}</span>
                    <span className={`badge fs-9 ${iss.severity === 'critical' ? 'bg-danger' : iss.severity === 'warning' ? 'bg-warning text-dark' : 'bg-info'}`}>
                      {iss.severity.toUpperCase()}
                    </span>
                  </div>
                  <p className="fs-8 text-muted mb-1">{iss.details}</p>
                  <div className="fs-9 text-dark bg-light p-1.5 rounded">
                    <strong>Action Required:</strong> {iss.recommendation}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CORE DETAILS & RELATIONSHIP GRAPH */}
      <div className="row g-3">
        {/* Core Metadata Card */}
        <div className="col-12 col-lg-5">
          <div className="card card-erp p-3 h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center justify-content-between pb-2 mb-2 border-bottom">
                <h5 className="fs-6 fw-bold text-dark mb-0">Transaction Specifications</h5>
                <span className="fs-8 text-muted font-monospace">{record.id}</span>
              </div>

              <div className="table-responsive">
                <table className="table table-sm table-borderless fs-7 mb-0">
                  <tbody>
                    <tr>
                      <td className="text-muted text-nowrap" style={{ width: '130px' }}>Reference:</td>
                      <td className="fw-bold font-monospace text-danger">{record.reference}</td>
                    </tr>
                    <tr>
                      <td className="text-muted">Transaction Date:</td>
                      <td className="fw-semibold text-dark">{record.date}</td>
                    </tr>
                    <tr>
                      <td className="text-muted">Transaction Type:</td>
                      <td>
                        <span className="badge bg-light text-dark border">{record.type}</span>
                      </td>
                    </tr>
                    <tr>
                      <td className="text-muted">Description:</td>
                      <td className="text-dark">{record.description}</td>
                    </tr>
                    <tr>
                      <td className="text-muted">Counterparty:</td>
                      <td>
                        {record.supplierId ? (
                          <button
                            type="button"
                            className="btn btn-link p-0 text-start text-danger fw-semibold text-decoration-none fs-7"
                            onClick={() => onDrillDown({ type: 'supplier', id: record.supplierId! })}
                            title="Drill down to Supplier 360"
                          >
                            {record.supplierName || 'Unknown Vendor'}
                            <i className="bi bi-box-arrow-up-right ms-1 fs-9"></i>
                          </button>
                        ) : (
                          <span className="text-dark">{record.supplierName || 'N/A'}</span>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="text-muted">Department:</td>
                      <td>
                        {record.departmentId ? (
                          <button
                            type="button"
                            className="btn btn-link p-0 text-start text-dark fw-semibold text-decoration-none fs-7"
                            onClick={() => onDrillDown({ type: 'department', id: record.departmentId! })}
                            title="Drill down to Department View"
                          >
                            {record.departmentName}
                            <i className="bi bi-box-arrow-up-right ms-1 fs-9 text-muted"></i>
                          </button>
                        ) : (
                          <span className="text-dark">{record.departmentName}</span>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="text-muted">Cost Centre:</td>
                      <td className="text-dark">{record.costCentre || 'CC-101'}</td>
                    </tr>
                    <tr>
                      <td className="text-muted">Budget Line / GL:</td>
                      <td>
                        {record.budgetCode ? (
                          <button
                            type="button"
                            className="btn btn-link p-0 text-start text-danger fw-bold font-monospace text-decoration-none fs-7"
                            onClick={() => onDrillDown({ type: 'budget_line', id: record.budgetCode! })}
                            title="Drill down to Budget Line 360"
                          >
                            {record.budgetCode}
                            <i className="bi bi-box-arrow-up-right ms-1 fs-9"></i>
                          </button>
                        ) : (
                          <span className="text-muted">N/A</span>
                        )}
                      </td>
                    </tr>
                    {record.invoiceNumber && (
                      <tr>
                        <td className="text-muted">Tax Invoice No:</td>
                        <td className="fw-bold font-monospace text-dark">{record.invoiceNumber}</td>
                      </tr>
                    )}
                    {record.lpoNumber && (
                      <tr>
                        <td className="text-muted">LPO Number:</td>
                        <td className="fw-bold font-monospace text-dark">{record.lpoNumber}</td>
                      </tr>
                    )}
                    {record.poNumber && record.poNumber !== record.lpoNumber && (
                      <tr>
                        <td className="text-muted">PO Reference:</td>
                        <td className="font-monospace text-dark">{record.poNumber}</td>
                      </tr>
                    )}
                    <tr>
                      <td className="text-muted">Initiated By:</td>
                      <td className="text-dark">
                        <i className="bi bi-person me-1 text-muted"></i>
                        {record.initiator}
                      </td>
                    </tr>
                    <tr>
                      <td className="text-muted">Created Timestamp:</td>
                      <td className="fs-8 text-muted">{new Date(record.createdAt).toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Source Page deep link */}
            <div className="pt-2 border-top mt-2 d-flex justify-content-between align-items-center">
              <span className="fs-8 text-muted">Source Ledger Page:</span>
              <button
                type="button"
                className="btn btn-sm btn-outline-dark py-0.5 px-2 fs-8 d-inline-flex align-items-center gap-1"
                onClick={() => {
                  if (navigateTab) {
                    const tab =
                      record.type === 'LPO'
                        ? 'lpos'
                        : record.type === 'Invoice'
                        ? 'invoices'
                        : record.type === 'Payment Request'
                        ? 'payment_requests'
                        : record.type === 'Quotation'
                        ? 'quotations'
                        : record.type === 'Budget Allocation'
                        ? 'budgets'
                        : 'expenditure';
                    navigateTab(tab);
                  }
                }}
              >
                <span>Open in {record.type} View</span>
                <i className="bi bi-arrow-right"></i>
              </button>
            </div>
          </div>
        </div>

        {/* VISUAL TRANSACTION RELATIONSHIP GRAPH / INTERACTIVE FLOWCHART */}
        <div className="col-12 col-lg-7">
          <div className="card card-erp p-3 h-100">
            <div className="d-flex align-items-center justify-content-between pb-2 mb-3 border-bottom">
              <div>
                <h5 className="fs-6 fw-bold text-dark mb-0">Transaction Lifecycle Chain</h5>
                <span className="fs-8 text-muted">Interactive upstream & downstream procurement-to-payment workflow</span>
              </div>
              <span className="badge bg-light text-muted border fs-8">
                {chain.length} Stages Linked
              </span>
            </div>

            {/* Interactive Flow Nodes */}
            <div className="d-flex flex-column gap-2.5">
              {chain.map((node, index) => {
                const isSelected = node.isCurrent;
                const isLast = index === chain.length - 1;

                return (
                  <div key={`${node.stage}-${node.reference}-${index}`} className="position-relative">
                    <div
                      className={`p-2.5 rounded border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-danger bg-danger-subtle shadow-sm'
                          : 'bg-white hover-shadow'
                      }`}
                      onClick={() => {
                        if (!node.isCurrent) {
                          onDrillDown({ type: 'transaction', id: node.reference, recordType: node.recordType });
                        }
                      }}
                      role="button"
                      title={node.isCurrent ? 'Current Inspection Target' : `Drill down into ${node.stage}: ${node.reference}`}
                    >
                      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-1">
                        <div className="d-flex align-items-center gap-2">
                          <span
                            className={`badge rounded-pill ${
                              isSelected ? 'bg-danger text-white' : 'bg-secondary text-white'
                            } fs-9`}
                          >
                            Step {index + 1}
                          </span>
                          <span className="fw-bold fs-7 text-dark">{node.stage}</span>
                          <span className="font-monospace fs-8 text-muted">({node.reference})</span>
                          {isSelected && (
                            <span className="badge bg-danger text-white fs-9">Current Target</span>
                          )}
                        </div>

                        <div className="d-flex align-items-center gap-2">
                          <span className="fw-bold fs-7 text-dark">
                            {node.amount > 0 ? `${node.amount.toLocaleString()} KES` : 'Allocated'}
                          </span>
                          <span className={`badge fs-9 ${node.status === 'Paid' || node.status === 'Approved' ? 'bg-success' : 'bg-warning text-dark'}`}>
                            {node.status}
                          </span>
                          {!isSelected && (
                            <i className="bi bi-chevron-right text-muted fs-8"></i>
                          )}
                        </div>
                      </div>

                      <div className="d-flex align-items-center justify-content-between text-muted fs-8 mt-1 pt-1 border-top border-light">
                        <span className="text-truncate" style={{ maxWidth: '350px' }}>
                          <i className="bi bi-info-circle me-1"></i>
                          {node.title} &bull; {node.party}
                        </span>
                        <span>Date: {node.date}</span>
                      </div>
                    </div>

                    {!isLast && (
                      <div className="text-center my-0.5">
                        <i className="bi bi-arrow-down text-muted" style={{ fontSize: '0.85rem' }}></i>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* INTERACTIVE EXPLORER TABS */}
      <div className="card card-erp p-0 overflow-hidden">
        {/* Navigation Tabs Header */}
        <div className="bg-light border-bottom p-2 px-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
          <ul className="nav nav-pills gap-1">
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link py-1 px-3 fs-7 fw-semibold ${activeTab === 'related' ? 'active bg-danger text-white' : 'text-dark'}`}
                onClick={() => setActiveTab('related')}
              >
                <i className="bi bi-diagram-3 me-1"></i>
                All Related Transactions ({related.length})
              </button>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link py-1 px-3 fs-7 fw-semibold ${activeTab === 'financial' ? 'active bg-danger text-white' : 'text-dark'}`}
                onClick={() => setActiveTab('financial')}
              >
                <i className="bi bi-calculator me-1"></i>
                Financial Impact & Caps
              </button>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link py-1 px-3 fs-7 fw-semibold ${activeTab === 'timeline' ? 'active bg-danger text-white' : 'text-dark'}`}
                onClick={() => setActiveTab('timeline')}
              >
                <i className="bi bi-clock-history me-1"></i>
                Activity Timeline ({timeline.length})
              </button>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link py-1 px-3 fs-7 fw-semibold ${activeTab === 'documents' ? 'active bg-danger text-white' : 'text-dark'}`}
                onClick={() => setActiveTab('documents')}
              >
                <i className="bi bi-paperclip me-1"></i>
                Supporting Docs ({record.supportingDocuments.length})
              </button>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link py-1 px-3 fs-7 fw-semibold ${activeTab === 'audit' ? 'active bg-danger text-white' : 'text-dark'}`}
                onClick={() => setActiveTab('audit')}
              >
                <i className="bi bi-shield-check me-1"></i>
                Audit Trail
              </button>
            </li>
          </ul>

          <span className="fs-8 text-muted">
            Relational Trace Engine Active
          </span>
        </div>

        {/* Tab 1: ALL RELATED TRANSACTIONS TABLE */}
        {activeTab === 'related' && (
          <div className="p-3">
            {/* Filter Bar */}
            <div className="row g-2 mb-3">
              <div className="col-12 col-md-5">
                <div className="input-group input-group-sm">
                  <span className="input-group-text bg-white">
                    <i className="bi bi-search text-muted"></i>
                  </span>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search related references, descriptions, vendors..."
                    value={searchRelated}
                    onChange={(e) => setSearchRelated(e.target.value)}
                  />
                  {searchRelated && (
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => setSearchRelated('')}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="col-6 col-md-3">
                <select
                  className="form-select form-select-sm"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  <option value="ALL">All Transaction Types</option>
                  <option value="Expenditure">Expenditure</option>
                  <option value="LPO">LPO (Purchase Order)</option>
                  <option value="Invoice">Invoice</option>
                  <option value="Payment Request">Payment Request</option>
                  <option value="Quotation">Quotation</option>
                </select>
              </div>

              <div className="col-6 col-md-4">
                <select
                  className="form-select form-select-sm"
                  value={relFilter}
                  onChange={(e) => setRelFilter(e.target.value)}
                >
                  <option value="ALL">All Relationship Types</option>
                  <option value="Parent Transaction">Parent Transaction</option>
                  <option value="Child Transaction">Child Transaction</option>
                  <option value="Generated From">Generated From</option>
                  <option value="Generated By">Generated By</option>
                  <option value="Payment For">Payment For</option>
                  <option value="Invoice For">Invoice For</option>
                  <option value="PO For">PO For</option>
                  <option value="Requisition For">Requisition For</option>
                  <option value="Budgeted Under">Budgeted Under</option>
                  <option value="Charged Against">Charged Against</option>
                  <option value="Related To">Related To</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="table-responsive">
              <table className="table table-sm table-hover align-middle fs-7 mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Reference</th>
                    <th>Relationship</th>
                    <th>Description</th>
                    <th>Counterparty</th>
                    <th className="text-end">Amount</th>
                    <th>Status</th>
                    <th className="text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRelated.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-4 text-muted">
                        No related transactions matching the selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredRelated.map((item) => (
                      <tr key={`${item.transactionType}-${item.id}`}>
                        <td className="text-nowrap">{item.date}</td>
                        <td>
                          <span className="badge bg-light text-dark border">
                            {item.transactionType}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-link p-0 text-start font-monospace fw-bold text-danger text-decoration-none fs-7"
                            onClick={() => onDrillDown({ type: 'transaction', id: item.reference, recordType: item.transactionType })}
                            title={`Drill down to ${item.reference}`}
                          >
                            {item.reference}
                          </button>
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              item.relationshipDirection === 'upstream'
                                ? 'bg-info-subtle text-info-emphasis border'
                                : item.relationshipDirection === 'downstream'
                                ? 'bg-primary-subtle text-primary border'
                                : 'bg-light text-dark border'
                            } fs-8`}
                          >
                            {item.relationshipType}
                          </span>
                        </td>
                        <td className="text-truncate" style={{ maxWidth: '240px' }} title={item.description}>
                          {item.description}
                        </td>
                        <td className="text-truncate" style={{ maxWidth: '160px' }}>
                          {item.supplierName || 'N/A'}
                        </td>
                        <td className="text-end fw-bold font-monospace">
                          {item.amount.toLocaleString()} <span className="fs-9 text-muted">{item.currency}</span>
                        </td>
                        <td>
                          <span
                            className={`badge fs-9 ${
                              item.status === 'Paid' || item.status === 'Approved'
                                ? 'bg-success'
                                : item.status === 'Rejected'
                                ? 'bg-danger'
                                : 'bg-warning text-dark'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="text-center">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger py-0 px-2 fs-8"
                            onClick={() => onDrillDown({ type: 'transaction', id: item.reference, recordType: item.transactionType })}
                            title="Investigate this linked transaction"
                          >
                            <i className="bi bi-box-arrow-in-right me-1"></i>
                            Drill Down
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: FINANCIAL IMPACT ANALYSIS */}
        {activeTab === 'financial' && (
          <div className="p-3">
            <h5 className="fs-6 fw-bold text-dark mb-3">Financial Allocation & Commitment Breakdown</h5>
            
            {/* Visual Balance Bar */}
            <div className="card bg-light p-3 border mb-3">
              <div className="d-flex justify-content-between align-items-center mb-1 fs-7">
                <span className="fw-semibold text-dark">Approved Budget Line: {record.budgetCode || 'BDG-2026'}</span>
                <span className="fw-bold">{financialImpact.originalBudget.toLocaleString()} KES</span>
              </div>

              <div className="progress" style={{ height: '14px' }}>
                <div
                  className="progress-bar bg-success"
                  style={{ width: `${Math.min(100, (financialImpact.actual / financialImpact.originalBudget) * 100)}%` }}
                  title={`Actual Spend: ${financialImpact.actual.toLocaleString()} KES`}
                ></div>
                <div
                  className="progress-bar bg-primary"
                  style={{ width: `${Math.min(100, (financialImpact.committed / financialImpact.originalBudget) * 100)}%` }}
                  title={`Open Commitments: ${financialImpact.committed.toLocaleString()} KES`}
                ></div>
              </div>

              <div className="d-flex flex-wrap justify-content-between text-muted fs-8 mt-2">
                <span><span className="badge bg-success me-1">&bull;</span> Actual Spend: <strong>{financialImpact.actual.toLocaleString()} KES</strong></span>
                <span><span className="badge bg-primary me-1">&bull;</span> Committed (Open LPOs): <strong>{financialImpact.committed.toLocaleString()} KES</strong></span>
                <span><span className="badge bg-secondary me-1">&bull;</span> Available Balance: <strong>{financialImpact.availableBudget.toLocaleString()} KES</strong></span>
              </div>
            </div>

            <div className="row g-3">
              <div className="col-12 col-md-6">
                <div className="p-3 rounded border bg-white">
                  <h6 className="fw-bold fs-7 text-dark mb-2">Accounting Distinction Indicators</h6>
                  <ul className="list-group list-group-flush fs-7">
                    <li className="list-group-item d-flex justify-content-between px-0 py-1.5">
                      <span className="text-muted">Budgeted Allocation:</span>
                      <span className="fw-semibold">{financialImpact.originalBudget.toLocaleString()} KES</span>
                    </li>
                    <li className="list-group-item d-flex justify-content-between px-0 py-1.5">
                      <span className="text-muted">Encumbered / Committed:</span>
                      <span className="fw-semibold text-primary">{financialImpact.committedAmount.toLocaleString()} KES</span>
                    </li>
                    <li className="list-group-item d-flex justify-content-between px-0 py-1.5">
                      <span className="text-muted">Actual Invoiced:</span>
                      <span className="fw-semibold text-dark">{financialImpact.invoicedAmount.toLocaleString()} KES</span>
                    </li>
                    <li className="list-group-item d-flex justify-content-between px-0 py-1.5">
                      <span className="text-muted">Paid / Disbursed:</span>
                      <span className="fw-semibold text-success">{financialImpact.paidAmount.toLocaleString()} KES</span>
                    </li>
                    <li className="list-group-item d-flex justify-content-between px-0 py-1.5">
                      <span className="text-muted">Outstanding Unpaid Liability:</span>
                      <span className="fw-bold text-danger">{financialImpact.outstandingAmount.toLocaleString()} KES</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="col-12 col-md-6">
                <div className="p-3 rounded border bg-white">
                  <h6 className="fw-bold fs-7 text-dark mb-2">Variance & Available Headroom</h6>
                  <p className="fs-8 text-muted mb-2">
                    Net variance measures available headroom against allocated corporate budgetary ceilings under statutory guidelines.
                  </p>
                  <div className="p-2.5 rounded bg-light border text-center">
                    <span className="fs-8 text-muted d-block">Net Headroom Variance</span>
                    <span className={`fs-5 fw-bold ${financialImpact.variance >= 0 ? 'text-success' : 'text-danger'}`}>
                      {financialImpact.variance >= 0 ? '+' : ''}{financialImpact.variance.toLocaleString()} KES
                    </span>
                    <span className="fs-9 text-muted d-block mt-0.5">
                      {financialImpact.variance >= 0 ? 'Within approved authorization envelope' : 'Requires supplementary reallocation approval'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: ACTIVITY TIMELINE */}
        {activeTab === 'timeline' && (
          <div className="p-3">
            <h5 className="fs-6 fw-bold text-dark mb-3">Chronological Lifecycle Events</h5>
            <div className="timeline-container ps-3 border-start ms-2">
              {timeline.map((event, idx) => (
                <div key={event.id || idx} className="position-relative mb-3 ps-3">
                  <div
                    className="position-absolute rounded-circle bg-danger"
                    style={{
                      width: '10px',
                      height: '10px',
                      left: '-20px',
                      top: '5px',
                    }}
                  ></div>
                  <div className="p-2.5 rounded bg-light border">
                    <div className="d-flex align-items-center justify-content-between mb-1">
                      <span className="fw-bold fs-7 text-dark">{event.action}</span>
                      <span className="badge bg-white text-dark border fs-9">
                        {event.date} &bull; {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="fs-8 text-muted mb-1">{event.details}</p>
                    <div className="fs-9 text-muted">
                      Executed by: <strong>{event.user}</strong> ({event.role})
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 4: SUPPORTING DOCUMENTS */}
        {activeTab === 'documents' && (
          <div className="p-3">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h5 className="fs-6 fw-bold text-dark mb-0">Linked Evidence & Supporting Documents</h5>
              <span className="badge bg-light text-dark border fs-8">
                {record.supportingDocuments.length} Documents Attached
              </span>
            </div>

            {record.supportingDocuments.length === 0 ? (
              <div className="text-center py-4 text-muted bg-light rounded border">
                <i className="bi bi-file-earmark-arrow-up fs-3 d-block mb-1"></i>
                <p className="mb-0 fs-7">No electronic document attachments found directly for this transaction reference.</p>
                <span className="fs-8">Supporting documents can be uploaded in the Document Vault.</span>
              </div>
            ) : (
              <div className="row g-2">
                {record.supportingDocuments.map((doc) => (
                  <div key={doc.id} className="col-12 col-md-6 col-xl-4">
                    <div className="p-2.5 rounded border bg-white shadow-sm h-100 d-flex flex-column justify-content-between">
                      <div>
                        <div className="d-flex align-items-center justify-content-between mb-1">
                          <span className="badge bg-light text-dark border fs-9">{doc.type}</span>
                          <span className="fs-9 text-muted">{doc.fileSize || 'PDF'}</span>
                        </div>
                        <h6 className="fs-7 fw-bold text-dark mb-1 text-truncate" title={doc.title}>
                          {doc.title}
                        </h6>
                        <span className="fs-9 text-muted font-monospace d-block text-truncate">
                          {doc.fileName}
                        </span>
                      </div>

                      <div className="d-flex justify-content-end gap-1.5 mt-2 pt-2 border-top">
                        {doc.dataUrl ? (
                          <a
                            href={doc.dataUrl}
                            download={doc.fileName}
                            className="btn btn-sm btn-outline-danger py-0.5 px-2 fs-8 text-decoration-none"
                          >
                            <i className="bi bi-download me-1"></i> Download
                          </a>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary py-0.5 px-2 fs-8"
                            onClick={() => showToast(`Document "${doc.fileName}" is archived in the Pioneer Cloud Vault.`, 'info')}
                          >
                            <i className="bi bi-eye me-1"></i> Inspect
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 5: IMMUTABLE AUDIT TRAIL */}
        {activeTab === 'audit' && (
          <div className="p-3">
            <h5 className="fs-6 fw-bold text-dark mb-3">Immutable Financial Audit Records</h5>
            <div className="table-responsive">
              <table className="table table-sm table-striped fs-7 mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Timestamp</th>
                    <th>Action</th>
                    <th>User</th>
                    <th>Role</th>
                    <th>Audit Details</th>
                    <th>IP Origin</th>
                  </tr>
                </thead>
                <tbody>
                  {timeline
                    .filter((t) => t.id.startsWith('tl-aud'))
                    .map((item, idx) => (
                      <tr key={idx}>
                        <td className="text-nowrap font-monospace fs-8">
                          {new Date(item.timestamp).toLocaleString()}
                        </td>
                        <td>
                          <span className="badge bg-dark text-white fs-9">{item.action}</span>
                        </td>
                        <td className="fw-semibold">{item.user}</td>
                        <td>
                          <span className="badge bg-light text-dark border fs-9">{item.role}</span>
                        </td>
                        <td>{item.details}</td>
                        <td className="font-monospace fs-8 text-muted">192.168.1.104</td>
                      </tr>
                    ))}
                  {timeline.filter((t) => t.id.startsWith('tl-aud')).length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-3 text-muted">
                        No direct audit log modifications recorded for this individual transaction ID.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
