import React, { useState, useMemo } from 'react';
import { DatabaseService } from '../services/db';
import { TraceabilityService } from '../services/traceabilityService';
import { ExcelService } from '../services/excelService';
import { PDFService } from '../services/pdfService';
import {
  AmountTraceContext,
  DrillDownTarget,
  RoleType,
} from '../types';

interface AmountTraceViewProps {
  context: AmountTraceContext;
  role: RoleType;
  onBack: () => void;
  onDrillDown: (target: DrillDownTarget) => void;
}

export const AmountTraceView: React.FC<AmountTraceViewProps> = ({
  context,
  role,
  onBack,
  onDrillDown,
}) => {
  const settings = DatabaseService.getSettings();
  const departments = DatabaseService.getDepartments();
  const suppliers = DatabaseService.getSuppliers();

  // Filters state
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');

  // Universal trace execution
  const traceResult = useMemo(() => {
    return TraceabilityService.traceAmount(context, {
      search: search.trim() || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      department: departmentFilter || undefined,
      supplier: supplierFilter || undefined,
      status: statusFilter || undefined,
      minAmount: minAmount ? parseFloat(minAmount) : undefined,
      maxAmount: maxAmount ? parseFloat(maxAmount) : undefined,
    });
  }, [context, search, dateFrom, dateTo, departmentFilter, supplierFilter, statusFilter, minAmount, maxAmount]);

  const { reconciledAmount, reportedAmount, variance, reconciles, records, formulaBreakdown } = traceResult;

  // Reset filters
  const handleResetFilters = () => {
    setSearch('');
    setDateFrom('');
    setDateTo('');
    setDepartmentFilter('');
    setSupplierFilter('');
    setStatusFilter('');
    setMinAmount('');
    setMaxAmount('');
  };

  // Export to Excel
  const handleExportExcel = () => {
    ExcelService.exportAmountTrace(context, records, reconciledAmount, variance);
  };

  // Export to PDF
  const handleExportPDF = () => {
    const tableRows = records.map((r) => [
      r.date,
      r.reference,
      r.transactionType,
      (r.description || '').substring(0, 45),
      r.supplierName || 'N/A',
      `${Number(r.amount || 0).toLocaleString()} ${r.currency || 'KES'}`,
      r.status || 'N/A',
    ]);

    const summaryCards = [
      { label: 'Reported Metric', value: `${reportedAmount.toLocaleString()} ${context.currency}` },
      { label: 'Reconciled Sum', value: `${reconciledAmount.toLocaleString()} ${context.currency}` },
      { label: 'Variance', value: `${variance.toLocaleString()} ${context.currency}` },
      { label: 'Records Count', value: `${records.length} Transactions` },
    ];

    PDFService.generateReportPDF(
      `AMOUNT RECONCILIATION AUDIT: ${context.metricName}`,
      `Financial Year: ${context.financialYear} | Formula: ${context.formula}`,
      ['Date', 'Reference', 'Type', 'Description', 'Counterparty', 'Amount', 'Status'],
      tableRows,
      settings,
      summaryCards
    );
  };

  return (
    <div className="d-flex flex-column gap-3 pb-5">
      {/* Top Header & Navigation Bar */}
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
                  AMOUNT TRACE
                </span>
                <h1 className="h5 fw-bold text-dark mb-0">{context.metricName}</h1>
                <span className="badge bg-light text-dark border fs-8">
                  FY {context.financialYear || '2026'}
                </span>
              </div>
              <p className="text-muted fs-8 mb-0 mt-0.5">
                {context.departmentName ? `Department: ${context.departmentName}` : 'Corporate Ledger Aggregate'}
                {context.budgetLine ? ` | Budget Line: ${context.budgetLine}` : ''}
                {context.supplierName ? ` | Supplier: ${context.supplierName}` : ''}
              </p>
            </div>
          </div>

          {/* Export Action Buttons */}
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-sm btn-outline-success d-flex align-items-center gap-1"
              onClick={handleExportExcel}
              title="Export complete reconciliation to Excel"
            >
              <i className="bi bi-file-earmark-excel"></i>
              <span>Excel Export</span>
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1"
              onClick={handleExportPDF}
              title="Export reconciliation PDF audit report"
            >
              <i className="bi bi-file-earmark-pdf"></i>
              <span>PDF Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* MATHEMATICAL CALCULATION BREAKDOWN & RECONCILIATION STATUS */}
      <div className="row g-3">
        <div className="col-12 col-lg-8">
          <div className="card card-erp p-3 h-100">
            <div className="d-flex align-items-center justify-content-between pb-2 mb-2 border-bottom">
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-calculator-fill text-danger fs-5"></i>
                <h5 className="fs-6 fw-bold text-dark mb-0">Mathematical Calculation Breakdown</h5>
              </div>
              <span className="badge bg-light text-dark border fs-8">Audit Integrity Engine</span>
            </div>

            <div className="p-2.5 rounded bg-light border font-monospace fs-7 text-dark mb-2.5">
              <strong>Formula:</strong> {context.formula}
            </div>

            <div className="fs-8 text-muted mb-3">
              {context.formulaExplanation}
            </div>

            <div className="list-group list-group-flush fs-8">
              {formulaBreakdown.steps.map((step, idx) => (
                <div key={idx} className="list-group-item px-0 py-1.5 text-muted border-0">
                  <i className="bi bi-check2-circle text-success me-1.5"></i>
                  {step}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 100% RECONCILIATION VERIFICATION CARD */}
        <div className="col-12 col-lg-4">
          <div className="card card-erp p-3 h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center justify-content-between pb-2 mb-2 border-bottom">
                <h5 className="fs-6 fw-bold text-dark mb-0">Reconciliation Audit</h5>
                <span className={`badge fs-8 ${reconciles ? 'bg-success' : 'bg-warning text-dark'}`}>
                  {reconciles ? '100% MATCH' : 'FILTERED VIEW'}
                </span>
              </div>

              <div className="mb-3">
                <span className="fs-8 text-muted d-block">Reported Figure</span>
                <div className="fs-5 fw-bold text-dark">
                  {reportedAmount.toLocaleString()} <span className="fs-8 text-muted">{context.currency}</span>
                </div>
              </div>

              <div className="mb-3">
                <span className="fs-8 text-muted d-block">Sum of Underlying Records</span>
                <div className="fs-5 fw-bold text-danger">
                  {reconciledAmount.toLocaleString()} <span className="fs-8 text-muted">{context.currency}</span>
                </div>
              </div>

              <div className="mb-3">
                <span className="fs-8 text-muted d-block">Reconciliation Variance</span>
                <div className={`fs-6 fw-bold ${variance < 1 ? 'text-success' : 'text-warning'}`}>
                  {variance < 1 ? '0.00 KES (Zero Variance)' : `${variance.toLocaleString()} KES`}
                </div>
              </div>
            </div>

            <div className={`p-2.5 rounded border text-center fs-8 ${reconciles ? 'bg-success-subtle text-success-emphasis border-success-subtle' : 'bg-warning-subtle text-warning-emphasis border-warning-subtle'}`}>
              <i className={`bi ${reconciles ? 'bi-shield-check' : 'bi-funnel'} me-1`}></i>
              {reconciles
                ? 'All contributing ledger rows account exactly for this reported balance.'
                : 'Filters are currently narrowing the displayed subset of records.'}
            </div>
          </div>
        </div>
      </div>

      {/* INTERACTIVE MULTI-CRITERIA FILTER BAR */}
      <div className="card card-erp p-3">
        <div className="d-flex align-items-center justify-content-between mb-2.5">
          <div className="d-flex align-items-center gap-2">
            <i className="bi bi-funnel text-danger"></i>
            <h6 className="fs-7 fw-bold text-dark mb-0">Filter Contributing Transactions</h6>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-link p-0 text-decoration-none text-danger fs-8"
            onClick={handleResetFilters}
          >
            Reset Filters
          </button>
        </div>

        <div className="row g-2">
          <div className="col-12 col-md-4">
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="Search reference, description, supplier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="col-6 col-md-2">
            <input
              type="date"
              className="form-control form-control-sm"
              placeholder="From Date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              title="Filter from date"
            />
          </div>

          <div className="col-6 col-md-2">
            <input
              type="date"
              className="form-control form-control-sm"
              placeholder="To Date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              title="Filter to date"
            />
          </div>

          <div className="col-6 col-md-2">
            <select
              className="form-select form-select-sm"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.name}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className="col-6 col-md-2">
            <select
              className="form-select form-select-sm"
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
            >
              <option value="">All Suppliers</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="col-6 col-md-2">
            <select
              className="form-select form-select-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="Paid">Paid</option>
              <option value="Approved">Approved</option>
              <option value="Pending Approval">Pending Approval</option>
              <option value="Issued">Issued</option>
              <option value="Draft">Draft</option>
            </select>
          </div>

          <div className="col-6 col-md-2">
            <input
              type="number"
              className="form-control form-control-sm"
              placeholder="Min Amount (KES)"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
            />
          </div>

          <div className="col-6 col-md-2">
            <input
              type="number"
              className="form-control form-control-sm"
              placeholder="Max Amount (KES)"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
            />
          </div>

          {/* Live Filter Result Count Badge */}
          <div className="col-12 col-md-6 d-flex align-items-center justify-content-md-end gap-2 mt-2 mt-md-0">
            <span className="badge bg-light text-dark border fs-8 py-1.5 px-2.5">
              Filtered Records: <strong>{records.length}</strong>
            </span>
            <span className="badge bg-danger-subtle text-danger border border-danger-subtle fs-8 py-1.5 px-2.5">
              Subtotal: <strong>{reconciledAmount.toLocaleString()} {context.currency}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* CONTRIBUTING UNDERLYING TRANSACTIONS TABLE */}
      <div className="card card-erp p-0 overflow-hidden">
        <div className="p-3 bg-light border-bottom d-flex align-items-center justify-content-between">
          <div>
            <h5 className="fs-6 fw-bold text-dark mb-0">Underlying Ledger Transactions</h5>
            <span className="fs-8 text-muted">Click any transaction reference or 'Drill Down' to open its complete Traceability Dossier</span>
          </div>
          <span className="badge bg-dark text-white fs-8">
            {records.length} Transactions
          </span>
        </div>

        <div className="table-responsive">
          <table className="table table-sm table-hover align-middle fs-7 mb-0">
            <thead className="table-light">
              <tr>
                <th>Date</th>
                <th>Reference</th>
                <th>Type</th>
                <th>Description</th>
                <th>Supplier / Beneficiary</th>
                <th>Department</th>
                <th>Budget Line</th>
                <th className="text-end">Amount</th>
                <th>Status</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-5 text-muted">
                    <i className="bi bi-search fs-3 d-block mb-1"></i>
                    No underlying transactions match the current filter criteria.
                  </td>
                </tr>
              ) : (
                records.map((item) => (
                  <tr key={`${item.transactionType}-${item.id}`}>
                    <td className="text-nowrap">{item.date}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-link p-0 text-start font-monospace fw-bold text-danger text-decoration-none fs-7"
                        onClick={() => onDrillDown({ type: 'transaction', id: item.reference, recordType: item.transactionType })}
                        title={`Investigate ${item.reference}`}
                      >
                        {item.reference}
                      </button>
                    </td>
                    <td>
                      <span className="badge bg-light text-dark border">
                        {item.transactionType}
                      </span>
                    </td>
                    <td className="text-truncate" style={{ maxWidth: '240px' }} title={item.description}>
                      {item.description}
                    </td>
                    <td className="text-truncate" style={{ maxWidth: '160px' }}>
                      {item.supplierName}
                    </td>
                    <td className="text-truncate" style={{ maxWidth: '160px' }}>
                      {item.departmentName}
                    </td>
                    <td className="font-monospace fs-8 text-muted">
                      {item.budgetLine}
                    </td>
                    <td className="text-end fw-bold font-monospace">
                      {Number(item.amount || 0).toLocaleString()} <span className="fs-9 text-muted">{item.currency || 'KES'}</span>
                    </td>
                    <td>
                      <span
                        className={`badge fs-9 ${
                          item.status === 'Paid' || item.status === 'Approved'
                            ? 'bg-success'
                            : item.status === 'Pending Approval' || item.status === 'Draft'
                            ? 'bg-warning text-dark'
                            : 'bg-secondary'
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
                        title="Open complete transaction trace & linked lifecycle"
                      >
                        <i className="bi bi-diagram-3 me-1"></i>
                        Drill Down
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {/* Total Row */}
            {records.length > 0 && (
              <tfoot className="table-light fw-bold">
                <tr>
                  <td colSpan={7} className="text-end text-dark">
                    Reconciled Aggregate Total ({records.length} records):
                  </td>
                  <td className="text-end font-monospace text-danger fs-6">
                    {reconciledAmount.toLocaleString()} <span className="fs-9 text-muted">{context.currency}</span>
                  </td>
                  <td colSpan={2}>
                    <span className="badge bg-success text-white fs-9">
                      {reconciles ? '100% RECONCILED' : 'FILTERED TOTAL'}
                    </span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
