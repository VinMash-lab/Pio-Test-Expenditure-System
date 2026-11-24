import React, { useState } from 'react';
import { DatabaseService } from '../services/db';
import { ExcelService } from '../services/excelService';
import { PDFService } from '../services/pdfService';
import { confirmDialog, showToast } from '../services/uiFeedback';
import { Expenditure, RoleType, PaymentStatus, DrillDownTarget, AmountTraceContext } from '../types';
import { TraceAmountButton } from '../components/TraceAmountButton';

interface ExpendituresViewProps {
  role: RoleType;
  onRefresh: () => void;
  onDrillDown?: (target: DrillDownTarget) => void;
  onTraceAmount?: (context: AmountTraceContext) => void;
}

export const ExpendituresView: React.FC<ExpendituresViewProps> = ({ role, onRefresh, onDrillDown, onTraceAmount }) => {
  const exps = DatabaseService.getExpenditures();
  const depts = DatabaseService.getDepartments();
  const projs = DatabaseService.getProjects();
  const sups = DatabaseService.getSuppliers();
  const lpos = DatabaseService.getLPOs();
  const settings = DatabaseService.getSettings();

  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedLegalEntity, setSelectedLegalEntity] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingExp, setEditingExp] = useState<Expenditure | null>(null);

  // Form Fields
  const [expenseId, setExpenseId] = useState('');
  const [legalEntity, setLegalEntity] = useState<'PACL' | 'PGIL'>('PACL');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [deptId, setDeptId] = useState('');
  const [projId, setProjId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [category, setCategory] = useState(settings.expenseCategories[0]);
  const [description, setDescription] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [poNo, setPoNo] = useState('');
  const [baseAmount, setBaseAmount] = useState<string>('1000000');
  const [vatAmount, setVatAmount] = useState<string>(
    String(Number((1000000 * ((settings.vatRatePercent ?? 16) / 100)).toFixed(10)))
  );
  const [status, setStatus] = useState<PaymentStatus>('Paid');
  const [receiptName, setReceiptName] = useState('');
  const [remarks, setRemarks] = useState('');

  // Budget Validation warning
  const [validationAlert, setValidationAlert] = useState<string | null>(null);
  const [forceOverride, setForceOverride] = useState(false);

  const filteredExpenses = exps.filter((e) => {
    if (
      search &&
      !(e.expenseId || '').toLowerCase().includes(search.toLowerCase()) &&
      !(e.invoiceNumber || '').toLowerCase().includes(search.toLowerCase()) &&
      !(e.purchaseOrder || '').toLowerCase().includes(search.toLowerCase()) &&
      !(e.description || '').toLowerCase().includes(search.toLowerCase())
    )
      return false;

    if (selectedDept && e.departmentId !== selectedDept) return false;
    if (selectedLegalEntity && e.legalEntity !== selectedLegalEntity) return false;
    if (selectedSupplier && e.supplierId !== selectedSupplier) return false;
    if (selectedStatus && e.paymentStatus !== selectedStatus) return false;

    return true;
  });

  const totalPages = Math.ceil(filteredExpenses.length / pageSize) || 1;
  const paginatedExpenses = filteredExpenses.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleOpenCreate = () => {
    setEditingExp(null);
    const targetDeptCode = (deptId ? depts.find((d) => d.id === deptId)?.code : depts[0]?.code) || 'MCX';
    setExpenseId(DatabaseService.generateExpenseId(targetDeptCode, 'PACL'));
    setLegalEntity('PACL');
    setDate(new Date().toISOString().split('T')[0]);
    setDeptId(depts[0]?.id || '');
    setProjId('');
    setSupplierId(sups[0]?.id || '');
    setCategory(settings.expenseCategories[0]);
    setDescription('');
    setInvoiceNo(`INV-${Math.floor(1000 + Math.random() * 9000)}`);
    setPoNo(DatabaseService.generatePoNumber(targetDeptCode));
    setBaseAmount('1000000');
    setVatAmount(String(Number((1000000 * ((settings.vatRatePercent ?? 16) / 100)).toFixed(10))));
    setStatus('Paid');
    setReceiptName('');
    setRemarks('');
    setValidationAlert(null);
    setForceOverride(false);
    setShowModal(true);
  };

  const handleOpenEdit = (e: Expenditure) => {
    setEditingExp(e);
    setExpenseId(e.expenseId);
    setLegalEntity(e.legalEntity || 'PACL');
    setDate(e.date);
    setDeptId(e.departmentId);
    setProjId(e.projectId || '');
    setSupplierId(e.supplierId);
    setCategory(e.category);
    setDescription(e.description);
    setInvoiceNo(e.invoiceNumber);
    setPoNo(e.purchaseOrder);
    setBaseAmount(String(e.amount ?? 0));
    setVatAmount(String(e.vatAmount ?? 0));
    setStatus(e.paymentStatus);
    setReceiptName(e.receiptFileName || '');
    setRemarks(e.remarks || '');
    setValidationAlert(null);
    setForceOverride(false);
    setShowModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    const amt = Number(baseAmount || 0);
    const vat = Number(vatAmount || 0);
    const total = Number((amt + vat).toFixed(10));

    // Validate budget
    const validation = DatabaseService.validateExpenditureBudget(deptId, projId || undefined, total, editingExp?.id);

    if (!validation.isValid && !forceOverride) {
      setValidationAlert(validation.warningMessage || 'Budget Limit Exceeded!');
      return;
    }

    const deptObj = depts.find((d) => d.id === deptId);
    const projObj = projs.find((p) => p.id === projId);
    const supObj = sups.find((s) => s.id === supplierId);

    const expToSave: Expenditure = {
      id: editingExp ? editingExp.id : 'exp-' + Date.now(),
      expenseId,
      legalEntity,
      date,
      departmentId: deptId,
      departmentName: deptObj?.name || 'General',
      projectId: projId || undefined,
      projectName: projObj?.name || undefined,
      supplierId,
      supplierName: supObj?.name || 'Vendor',
      category,
      description,
      invoiceNumber: invoiceNo,
      purchaseOrder: poNo,
      amount: amt,
      vatAmount: vat,
      totalAmount: total,
      paymentStatus: status,
      receiptFileName: receiptName.trim() || undefined,
      remarks,
      isBudgetExceeded: !validation.isValid,
      requiresAuthorization: !validation.isValid,
      authorizedBy: !validation.isValid ? `${role} Override` : undefined,
      createdBy: editingExp ? editingExp.createdBy : `${role} User`,
      createdAt: editingExp ? editingExp.createdAt : new Date().toISOString(),
    };

    DatabaseService.saveExpenditure(expToSave, `${role} User`, role);
    onRefresh();
    setShowModal(false);
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirmDialog({
      title: 'Delete Expenditure Log',
      message: 'Are you sure you want to delete this expenditure log?',
      confirmLabel: 'Delete Expenditure',
      variant: 'danger',
    });
    if (confirmed) {
      DatabaseService.deleteExpenditure(id, `${role} User`, role);
      onRefresh();
      showToast('Expenditure record deleted.', 'success');
    }
  };

  // Export handlers
  const handleExportExcel = () => {
    ExcelService.exportExpendituresToExcel(filteredExpenses);
  };

  const handleExportPDF = () => {
    const cols = ['Expense ID', 'Date', 'Department', 'Supplier', 'Invoice', 'PO', 'Amount (KES)', 'Status'];
    const rows = filteredExpenses.map((e) => [
      e.expenseId,
      e.date || e.expenseDate || '',
      e.departmentName,
      e.supplierName,
      e.invoiceNumber,
      e.purchaseOrder,
      `${Number(e.totalAmount || 0).toLocaleString(undefined, { maximumFractionDigits: 10 })} ${settings.currencySymbol}`,
      e.paymentStatus,
    ]);
    PDFService.generateReportPDF('EXPENDITURE & INVOICE LEDGER REPORT', 'Detailed Disburser Logs', cols, rows, settings);
  };

  return (
    <div className="d-flex flex-column gap-4">
      {/* Search & Filter Bar */}
      <div className="card card-erp p-3">
        <div className="row g-2 align-items-center">
          <div className="col-12 col-md-4 col-lg-2">
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-white">
                <i className="bi bi-search text-muted"></i>
              </span>
              <input
                type="text"
                className="form-control"
                placeholder="Search ID, Invoice, PO..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
          </div>

          <div className="col-6 col-md-4 col-lg-2">
            <select
              className="form-select form-select-sm"
              value={selectedDept}
              onChange={(e) => {
                setSelectedDept(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Departments</option>
              {depts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="col-6 col-md-4 col-lg-2">
            <select
              className="form-select form-select-sm fw-semibold"
              value={selectedLegalEntity}
              onChange={(e) => {
                setSelectedLegalEntity(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Entities (Combined)</option>
              <option value="PACL">PACL</option>
              <option value="PGIL">PGIL</option>
            </select>
          </div>

          <div className="col-6 col-md-4 col-lg-2">
            <select
              className="form-select form-select-sm"
              value={selectedSupplier}
              onChange={(e) => {
                setSelectedSupplier(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Suppliers</option>
              {sups.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="col-6 col-md-4 col-lg-2">
            <select
              className="form-select form-select-sm"
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Statuses</option>
              <option value="Paid">Paid</option>
              <option value="Approved">Approved</option>
              <option value="Pending Approval">Pending Approval</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          <div className="col-12 col-md-4 col-lg-2 text-end">
            <button type="button" onClick={handleOpenCreate} className="btn btn-corporate btn-sm d-flex align-items-center gap-1 ms-auto">
              <i className="bi bi-plus-lg"></i>
              <span>Record Expense</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Expenditure Table */}
      <div className="card card-erp p-0 overflow-hidden">
        <div className="card-header bg-white d-flex flex-wrap align-items-center justify-content-between gap-2 py-2.5 px-3">
          <div className="d-flex align-items-center gap-2">
            <span className="fw-bold fs-7 text-uppercase">
              <i className="bi bi-receipt-cutoff me-1 text-corporate-primary"></i> Expenditure Logs ({filteredExpenses.length})
            </span>
            {onTraceAmount && (
              <TraceAmountButton
                amount={filteredExpenses.reduce((s, e) => s + e.totalAmount, 0)}
                metricName="Filtered Expenditures Total"
                contextType="expenditure"
                onTraceAmount={onTraceAmount}
              />
            )}
          </div>
          <div className="d-flex align-items-center gap-2">
            <button type="button" onClick={handleExportExcel} className="btn btn-sm btn-outline-secondary">
              <i className="bi bi-download me-1 text-success"></i> Excel
            </button>
            <button type="button" onClick={handleExportPDF} className="btn btn-sm btn-outline-secondary">
              <i className="bi bi-file-pdf me-1 text-danger"></i> PDF
            </button>
            <button type="button" onClick={() => window.print()} className="btn btn-sm btn-outline-secondary">
              <i className="bi bi-printer me-1"></i> Print
            </button>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-hover table-erp align-middle mb-0" style={{ fontSize: '0.83rem' }}>
            <thead>
              <tr>
                <th>Expense ID</th>
                <th>Entity</th>
                <th>Date</th>
                <th>Department & Project</th>
                <th>Supplier</th>
                <th>Invoice / PO</th>
                <th>Base Amt</th>
                <th>VAT (16%)</th>
                <th>Total (KES)</th>
                <th>Status</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedExpenses.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-4 text-muted">
                    No expenditure records found matching current filters.
                  </td>
                </tr>
              ) : (
                paginatedExpenses.map((e) => (
                  <tr key={e.id} className={e.isBudgetExceeded ? 'tr-budget-exceeded' : ''}>
                    <td>
                      <button
                        type="button"
                        className="btn btn-link p-0 text-decoration-none fw-bold text-danger font-monospace text-start"
                        title="Click to drill down into transaction trace"
                        onClick={() =>
                          onDrillDown &&
                          onDrillDown({
                            type: 'transaction',
                            id: e.expenseId,
                            recordType: 'Expenditure',
                          })
                        }
                      >
                        {e.expenseId}
                      </button>
                      {e.isBudgetExceeded && (
                        <div>
                          <span className="badge bg-danger text-white rounded-pill px-1.5" style={{ fontSize: '0.65rem' }}>
                            <i className="bi bi-exclamation-triangle-fill me-1"></i> EXCEEDED OVERRIDE
                          </span>
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${e.legalEntity === 'PACL' ? 'bg-danger text-white' : 'bg-dark text-white'} px-2 py-1 fs-7 fw-bold`}>
                        {e.legalEntity || 'PACL'}
                      </span>
                    </td>
                    <td className="text-muted">{e.date}</td>
                    <td>
                      <div className="fw-semibold text-dark">{e.departmentName}</div>
                      <small className="text-muted" style={{ fontSize: '0.72rem' }}>
                        {e.projectName || 'Dept Wide'}
                      </small>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-link p-0 text-decoration-none text-dark fw-semibold text-start"
                        title="View Supplier 360"
                        onClick={() =>
                          onDrillDown &&
                          onDrillDown({
                            type: 'supplier',
                            id: e.supplierId || e.supplierName,
                          })
                        }
                      >
                        {e.supplierName}
                      </button>
                    </td>
                    <td>
                      <div>
                        Inv:{' '}
                        {e.invoiceNumber ? (
                          <button
                            type="button"
                            className="btn btn-link p-0 text-decoration-none fw-mono text-dark"
                            title="Trace Invoice"
                            onClick={() =>
                              onDrillDown &&
                              onDrillDown({
                                type: 'transaction',
                                id: e.invoiceNumber,
                                recordType: 'Invoice',
                              })
                            }
                          >
                            {e.invoiceNumber}
                          </button>
                        ) : (
                          <span className="text-muted">N/A</span>
                        )}
                      </div>
                      <small className="text-muted" style={{ fontSize: '0.72rem' }}>
                        PO:{' '}
                        {e.purchaseOrder ? (
                          <button
                            type="button"
                            className="btn btn-link p-0 text-decoration-none text-muted"
                            title="Trace PO / LPO"
                            onClick={() =>
                              onDrillDown &&
                              onDrillDown({
                                type: 'transaction',
                                id: e.purchaseOrder,
                                recordType: 'LPO',
                              })
                            }
                          >
                            {e.purchaseOrder}
                          </button>
                        ) : (
                          'N/A'
                        )}
                      </small>
                    </td>
                    <td>{Number(e.amount || 0).toLocaleString(undefined, { maximumFractionDigits: 10 })}</td>
                    <td className="text-muted">{Number(e.vatAmount || 0).toLocaleString(undefined, { maximumFractionDigits: 10 })}</td>
                    <td className="fw-bold text-dark">
                      {Number(e.totalAmount || 0).toLocaleString(undefined, { maximumFractionDigits: 10 })} {settings.currencySymbol}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          e.paymentStatus === 'Paid'
                            ? 'bg-success'
                            : e.paymentStatus === 'Approved'
                            ? 'bg-primary'
                            : e.paymentStatus === 'Pending Approval'
                            ? 'bg-warning text-dark'
                            : 'bg-danger'
                        }`}
                      >
                        {e.paymentStatus}
                      </span>
                    </td>
                    <td className="text-end">
                      <div className="btn-group btn-group-sm">
                        <button
                          type="button"
                          className="btn btn-light text-danger border p-1 px-2"
                          title="Drill Down & Trace"
                          onClick={() =>
                            onDrillDown &&
                            onDrillDown({
                              type: 'transaction',
                              id: e.expenseId,
                              recordType: 'Expenditure',
                            })
                          }
                        >
                          <i className="bi bi-search me-1"></i>Trace
                        </button>
                        <button
                          type="button"
                          className="btn btn-light text-primary border p-1 px-2"
                          title="Edit"
                          onClick={() => handleOpenEdit(e)}
                        >
                          <i className="bi bi-pencil-fill"></i>
                        </button>
                        <button
                          type="button"
                          className="btn btn-light text-danger border p-1 px-2"
                          title="Delete"
                          onClick={() => handleDelete(e.id)}
                        >
                          <i className="bi bi-trash-fill"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination */}
        <div className="card-footer bg-white d-flex align-items-center justify-content-between py-2 px-3">
          <span className="text-muted fs-7">
            Showing Page {currentPage} of {totalPages} ({filteredExpenses.length} Records)
          </span>
          <div className="btn-group btn-group-sm">
            <button
              type="button"
              className="btn btn-outline-secondary"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Modal Form */}
      {showModal && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content shadow-lg border-0">
              <div className="modal-header bg-dark text-white py-2.5 px-3">
                <h5 className="modal-title fw-bold fs-6">{editingExp ? 'Edit Expenditure Record' : 'Record New Expenditure'}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowModal(false)}></button>
              </div>

              <form onSubmit={handleSave}>
                <div className="modal-body p-3">
                  {validationAlert && (
                    <div className="alert alert-danger p-3 mb-3 border-start border-4 border-danger" role="alert">
                      <div className="fw-bold d-flex align-items-center gap-2 mb-1">
                        <i className="bi bi-exclamation-triangle-fill fs-5"></i>
                        <span>Budget Exceeded Warning!</span>
                      </div>
                      <p className="fs-7 mb-2">{validationAlert}</p>
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="checkForceOverride"
                          checked={forceOverride}
                          onChange={(e) => setForceOverride(e.target.checked)}
                        />
                        <label className="form-check-label fw-bold text-dark fs-7" htmlFor="checkForceOverride">
                          Authorization Override: Log this expense as an Over-Budget transaction in Audit Trail.
                        </label>
                      </div>
                    </div>
                  )}

                  <div className="row g-3">
                    <div className="col-md-3">
                      <label className="form-label fw-semibold fs-7">Expense ID *</label>
                      <input type="text" className="form-control fs-7" value={expenseId} onChange={(e) => setExpenseId(e.target.value)} required />
                    </div>

                    <div className="col-md-3">
                      <label className="form-label fw-semibold fs-7 text-danger">Legal Entity *</label>
                      <select className="form-select fs-7 fw-bold border-danger" value={legalEntity} onChange={(e) => setLegalEntity(e.target.value as 'PACL' | 'PGIL')} required>
                        <option value="PACL">PACL – Pioneer Assurance</option>
                        <option value="PGIL">PGIL – Pioneer General Insurance</option>
                      </select>
                    </div>

                    <div className="col-md-3">
                      <label className="form-label fw-semibold fs-7">Expense Date *</label>
                      <input type="date" className="form-control fs-7" value={date} onChange={(e) => setDate(e.target.value)} required />
                    </div>

                    <div className="col-md-3">
                      <label className="form-label fw-semibold fs-7">Payment Status *</label>
                      <select className="form-select fs-7" value={status} onChange={(e) => setStatus(e.target.value as PaymentStatus)}>
                        <option value="Paid">Paid</option>
                        <option value="Approved">Approved</option>
                        <option value="Pending Approval">Pending Approval</option>
                        <option value="Rejected">Rejected</option>
                      </select>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label fw-semibold fs-7">Department *</label>
                      <select className="form-select fs-7" value={deptId} onChange={(e) => setDeptId(e.target.value)} required>
                        {depts.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label fw-semibold fs-7">Project (Optional)</label>
                      <select className="form-select fs-7" value={projId} onChange={(e) => setProjId(e.target.value)}>
                        <option value="">-- Department Wide --</option>
                        {projs.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label fw-semibold fs-7">Supplier / Vendor *</label>
                      <select className="form-select fs-7" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required>
                        {sups.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label fw-semibold fs-7">Expense Category *</label>
                      <select className="form-select fs-7" value={category} onChange={(e) => setCategory(e.target.value)}>
                        {settings.expenseCategories.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-md-4">
                      <label className="form-label fw-semibold fs-7">Base Amount ({settings.currencySymbol}) *</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        className="form-control fs-7 font-monospace"
                        value={baseAmount}
                        onChange={(e) => {
                          const raw = e.target.value;
                          setBaseAmount(raw);
                          const numericBase = Number(raw || 0);
                          const rate = (settings.vatRatePercent ?? 16) / 100;
                          setVatAmount(String(Number((numericBase * rate).toFixed(10))));
                        }}
                        required
                      />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label fw-semibold fs-7">
                        VAT / Tax ({settings.vatRatePercent ?? 16}% – Exact) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        className="form-control fs-7 font-monospace"
                        value={vatAmount}
                        onChange={(e) => setVatAmount(e.target.value)}
                        required
                      />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label fw-semibold fs-7">Total Amount ({settings.currencySymbol})</label>
                      <div className="form-control fs-7 bg-light fw-bold text-dark font-monospace">
                        {Number((Number(baseAmount || 0) + Number(vatAmount || 0)).toFixed(10)).toLocaleString(undefined, {
                          maximumFractionDigits: 10,
                        })}{' '}
                        {settings.currencySymbol}
                      </div>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label fw-semibold fs-7">Invoice Number *</label>
                      <input type="text" className="form-control fs-7" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} required />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label fw-semibold fs-7">Link LPO / Purchase Order</label>
                      <select
                        className="form-select fs-7 font-mono"
                        value={poNo}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPoNo(val);
                          const matchedLpo = lpos.find((l) => l.lpoNumber === val);
                          if (matchedLpo) {
                            setLegalEntity(matchedLpo.legalEntity);
                            if (matchedLpo.supplierId) setSupplierId(matchedLpo.supplierId);
                            if (matchedLpo.projectId) setProjId(matchedLpo.projectId);
                            const matchedNet = Number(matchedLpo.amountBeforeVat ?? matchedLpo.lpoAmount ?? 0);
                            if (matchedNet > 0) {
                              setBaseAmount(String(matchedNet));
                              const matchedVat =
                                matchedLpo.vatAmount !== undefined
                                  ? Number(matchedLpo.vatAmount)
                                  : Number((matchedNet * ((settings.vatRatePercent ?? 16) / 100)).toFixed(10));
                              setVatAmount(String(matchedVat));
                            }
                          }
                        }}
                      >
                        <option value="">-- Manual or No LPO --</option>
                        {lpos.map((l) => (
                          <option key={l.id} value={l.lpoNumber}>
                            [{l.legalEntity}] {l.lpoNumber} ({l.supplierName})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-12">
                      <label className="form-label fw-semibold fs-7">Description</label>
                      <textarea
                        className="form-control fs-7"
                        rows={2}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Detailed line item details..."
                      ></textarea>
                    </div>

                    {/* Supporting Documents Checklist & Attachment */}
                    <div className="col-12">
                      <div className="p-3 bg-light rounded border">
                        <label className="form-label fw-bold fs-7 text-dark mb-2 d-flex align-items-center gap-1.5">
                          <i className="bi bi-file-earmark-check-fill text-danger"></i>
                          <span>Expenditure Supporting Documents Checklist</span>
                        </label>
                        <div className="row g-2 fs-8 font-mono mb-2">
                          <div className="col-6 col-md-3">
                            <div className="form-check">
                              <input className="form-check-input" type="checkbox" id="chkLpo" defaultChecked />
                              <label className="form-check-label text-dark" htmlFor="chkLpo">
                                LPO Verified
                              </label>
                            </div>
                          </div>
                          <div className="col-6 col-md-3">
                            <div className="form-check">
                              <input className="form-check-input" type="checkbox" id="chkInvoice" defaultChecked />
                              <label className="form-check-label text-dark" htmlFor="chkInvoice">
                                Tax Invoice Attached
                              </label>
                            </div>
                          </div>
                          <div className="col-6 col-md-3">
                            <div className="form-check">
                              <input className="form-check-input" type="checkbox" id="chkDelivery" defaultChecked />
                              <label className="form-check-label text-dark" htmlFor="chkDelivery">
                                Delivery Note / Signoff
                              </label>
                            </div>
                          </div>
                          <div className="col-6 col-md-3">
                            <div className="form-check">
                              <input className="form-check-input" type="checkbox" id="chkApproval" defaultChecked />
                              <label className="form-check-label text-dark" htmlFor="chkApproval">
                                Approval Memo Signed
                              </label>
                            </div>
                          </div>
                        </div>

                        <div className="border border-dashed p-2.5 rounded text-center bg-white">
                          <label className="fs-8 text-muted d-block mb-1">Attach Primary Receipt / Invoice File (Optional)</label>
                          <input
                            type="file"
                            className="form-control form-control-sm"
                            onChange={(ev) => {
                              if (ev.target.files && ev.target.files[0]) {
                                setReceiptName(ev.target.files[0].name);
                              }
                            }}
                          />
                          {receiptName ? (
                            <div className="fw-bold fs-7 text-danger font-mono mt-1">{receiptName}</div>
                          ) : (
                            <div className="fs-8 text-muted mt-1">No file attached</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="modal-footer py-2 px-3">
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-corporate btn-sm">
                    {editingExp ? 'Save Changes' : 'Record Expenditure'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
