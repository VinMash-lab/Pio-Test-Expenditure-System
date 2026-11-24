import React, { useState, useMemo } from 'react';
import { DatabaseService } from '../services/db';
import { ExcelService } from '../services/excelService';
import { PDFService } from '../services/pdfService';
import { confirmDialog, showToast } from '../services/uiFeedback';
import { InvoiceRecord, RoleType, PaymentRequestRecord, DrillDownTarget, AmountTraceContext } from '../types';

interface InvoiceManagementViewProps {
  role: RoleType;
  onRefresh: () => void;
  onDrillDown?: (target: DrillDownTarget) => void;
  onTraceAmount?: (context: AmountTraceContext) => void;
}

export const InvoiceManagementView: React.FC<InvoiceManagementViewProps> = ({ role, onRefresh, onDrillDown, onTraceAmount }) => {
  const invoices = DatabaseService.getInvoices();
  const lpos = DatabaseService.getLPOs();
  const projs = DatabaseService.getProjects();
  const suppliers = DatabaseService.getSuppliers();
  const settings = DatabaseService.getSettings();

  const [search, setSearch] = useState('');
  const [selectedEntity, setSelectedEntity] = useState('All');
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<InvoiceRecord | null>(null);

  // Form Fields
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [lpoNumber, setLpoNumber] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [legalEntity, setLegalEntity] = useState<'PACL' | 'PGIL' | 'Shared'>('PACL');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [amountBeforeVat, setAmountBeforeVat] = useState<string>('100000');
  const [hasVat, setHasVat] = useState<boolean>(true);
  const [vatAmount, setVatAmount] = useState<string>(
    String(Number((100000 * ((settings.vatRatePercent ?? 16) / 100)).toFixed(10)))
  );
  const [paymentStatus, setPaymentStatus] = useState<InvoiceRecord['paymentStatus']>('Pending');
  const [paymentDate, setPaymentDate] = useState('');
  const [description, setDescription] = useState('');
  const [docFileName, setDocFileName] = useState('');

  const selectedProjectObj = useMemo(
    () => (selectedProject ? projs.find((p) => p.id === selectedProject) || null : null),
    [projs, selectedProject]
  );

  // Filtered List
  const filteredInvoices = useMemo(() => {
    const norm = (v?: string) => (v || '').trim().toLowerCase();
    return invoices.filter((inv) => {
      if (selectedEntity !== 'All' && inv.legalEntity !== selectedEntity) return false;
      if (selectedStatus && inv.paymentStatus !== selectedStatus) return false;
      if (selectedProjectObj) {
        const matchId = inv.projectId && (inv.projectId === selectedProjectObj.id || norm(inv.projectId) === norm(selectedProjectObj.code));
        const matchName = inv.projectName && selectedProjectObj.name && norm(inv.projectName) === norm(selectedProjectObj.name);
        if (!matchId && !matchName) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        if (
          !(inv.invoiceNumber || '').toLowerCase().includes(q) &&
          !(inv.supplierName || '').toLowerCase().includes(q) &&
          !(inv.lpoNumber || '').toLowerCase().includes(q) &&
          !(inv.projectName || '').toLowerCase().includes(q) &&
          !(inv.description || '').toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [invoices, selectedEntity, selectedStatus, selectedProjectObj, search]);

  // Summary Metrics
  const summary = useMemo(() => {
    const active = filteredInvoices.filter((inv) => inv.paymentStatus !== 'Rejected');
    const totalAmount = active.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);
    const paidAmount = active
      .filter((inv) => inv.paymentStatus === 'Paid')
      .reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);
    const pendingList = active.filter((inv) => inv.paymentStatus !== 'Paid');
    const pendingAmount = pendingList.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);
    const pendingCount = pendingList.length;

    return {
      totalAmount,
      paidAmount,
      pendingAmount,
      pendingCount,
      count: filteredInvoices.length,
    };
  }, [filteredInvoices]);

  const handleOpenCreate = () => {
    setEditingInvoice(null);
    setInvoiceNumber(`INV-2026-${Math.floor(1000 + Math.random() * 9000)}`);
    setLpoNumber('');
    setSupplierId(suppliers[0]?.id || '');
    setProjectId(selectedProject || projs[0]?.id || '');
    setLegalEntity('PACL');
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    const due = new Date();
    due.setDate(due.getDate() + 30);
    setDueDate(due.toISOString().split('T')[0]);
    setAmountBeforeVat('100000');
    setHasVat(true);
    setVatAmount(String(Number((100000 * ((settings.vatRatePercent ?? 16) / 100)).toFixed(10))));
    setPaymentStatus('Pending');
    setPaymentDate('');
    setDescription('');
    setDocFileName('');
    setShowModal(true);
  };

  const handleOpenEdit = (inv: InvoiceRecord) => {
    setEditingInvoice(inv);
    setInvoiceNumber(inv.invoiceNumber);
    setLpoNumber(inv.lpoNumber || '');
    setSupplierId(inv.supplierId);
    setProjectId(inv.projectId || '');
    setLegalEntity(inv.legalEntity);
    setInvoiceDate(inv.invoiceDate);
    setDueDate(inv.dueDate || '');
    setAmountBeforeVat(String(inv.amountBeforeVat ?? 0));
    setHasVat(Number(inv.vatAmount || 0) > 0);
    setVatAmount(String(inv.vatAmount ?? 0));
    setPaymentStatus(inv.paymentStatus);
    setPaymentDate(inv.paymentDate || '');
    setDescription(inv.description || '');
    setDocFileName(inv.documentFileName || '');
    setShowModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const suppObj = suppliers.find((s) => s.id === supplierId);
    const projObj = projs.find((p) => p.id === projectId);

    const netVal = Number(amountBeforeVat || 0);
    const vatVal = hasVat ? Number(vatAmount || 0) : 0;
    const totalVal = Number((netVal + vatVal).toFixed(10));

    const recordToSave: InvoiceRecord = {
      ...(editingInvoice || {}),
      id: editingInvoice ? editingInvoice.id : 'inv-' + Date.now(),
      invoiceNumber,
      vendorId: supplierId,
      vendorName: suppObj?.name || 'Selected Vendor',
      lpoNumber: lpoNumber || undefined,
      supplierId,
      supplierName: suppObj?.name || 'Selected Vendor',
      projectId: projectId || undefined,
      projectName: projObj?.name || undefined,
      legalEntity,
      invoiceDate,
      dueDate: dueDate || undefined,
      amountBeforeVat: netVal,
      vatAmount: vatVal,
      totalAmount: totalVal,
      currency: settings.currencySymbol || 'KES',
      paymentStatus,
      paymentDate: paymentStatus === 'Paid' ? (paymentDate || new Date().toISOString().split('T')[0]) : undefined,
      description,
      documentFileName: docFileName || (editingInvoice ? editingInvoice.documentFileName : undefined),
      createdBy: editingInvoice ? editingInvoice.createdBy : `${role} User`,
      createdAt: editingInvoice ? editingInvoice.createdAt : new Date().toISOString(),
    };

    const saved = DatabaseService.saveInvoice(recordToSave, `${role} User`, role);
    showToast(
      `Invoice ${saved.invoiceNumber} ${editingInvoice ? 'updated' : 'logged'}${saved.projectName ? ` under ${saved.projectName}` : ''}.`,
      'success'
    );
    onRefresh();
    setShowModal(false);
  };

  const handleGeneratePaymentRequest = async (inv: InvoiceRecord) => {
    const confirmed = await confirmDialog({
      title: 'Initiate Payment Request',
      message: `Initiate Payment Request for invoice ${inv.invoiceNumber} (${Number(inv.totalAmount || 0).toLocaleString()} KES)?`,
      confirmLabel: 'Submit Payment Request',
      variant: 'primary',
    });
    if (confirmed) {
      const newReq: PaymentRequestRecord = {
        id: 'pr-' + Date.now(),
        requestNumber: `PR-2026-${Math.floor(100 + Math.random() * 900)}`,
        invoiceNumber: inv.invoiceNumber,
        lpoNumber: inv.lpoNumber,
        supplierId: inv.supplierId,
        supplierName: inv.supplierName,
        projectId: inv.projectId,
        projectName: inv.projectName,
        legalEntity: inv.legalEntity,
        requestedAmount: Number(inv.totalAmount || 0),
        currency: inv.currency,
        requestDate: new Date().toISOString().split('T')[0],
        status: 'Submitted',
        priority: 'Medium',
        purpose: `Settlement for Invoice ${inv.invoiceNumber}. ${inv.description || ''}`,
        createdBy: `${role} User`,
        createdAt: new Date().toISOString(),
      };

      DatabaseService.savePaymentRequest(newReq, `${role} User`, role);
      DatabaseService.saveInvoice({ ...inv, paymentStatus: 'Submitted' }, `${role} User`, role);
      onRefresh();
      showToast(`Payment Request ${newReq.requestNumber} logged and submitted to Finance!`, 'success');
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirmDialog({
      title: 'Delete Invoice',
      message: 'Are you sure you want to delete this invoice?',
      confirmLabel: 'Delete Invoice',
      variant: 'danger',
    });
    if (confirmed) {
      DatabaseService.deleteInvoice(id, `${role} User`, role);
      onRefresh();
      showToast('Invoice deleted.', 'success');
    }
  };

  const handleExportExcel = () => {
    const exportData = filteredInvoices.map((inv) => ({
      'Invoice Number': inv.invoiceNumber,
      'Vendor Name': inv.supplierName,
      'Related LPO': inv.lpoNumber || 'Direct',
      'Project': inv.projectName || 'N/A',
      'Entity': inv.legalEntity,
      'Invoice Date': inv.invoiceDate,
      'Due Date': inv.dueDate || 'N/A',
      'Amount Excl. VAT': inv.amountBeforeVat,
      'VAT Amount': inv.vatAmount,
      'Total Amount (KES)': inv.totalAmount,
      'Payment Status': inv.paymentStatus,
      'Payment Date': inv.paymentDate || 'N/A',
      'Description': inv.description,
    }));
    ExcelService.exportCustomDataset(exportData, 'Invoices_Register_Report');
  };

  const handleExportPDF = () => {
    const cols = ['Invoice No', 'Vendor', 'LPO No', 'Entity', 'Date', 'Amount Excl. VAT', 'VAT', 'Total (KES)', 'Status'];
    const rows = filteredInvoices.map((inv) => [
      inv.invoiceNumber,
      inv.supplierName,
      inv.lpoNumber || 'Direct',
      inv.legalEntity,
      inv.invoiceDate,
      `${Number(inv.amountBeforeVat || 0).toLocaleString(undefined, { maximumFractionDigits: 10 })}`,
      `${Number(inv.vatAmount || 0).toLocaleString(undefined, { maximumFractionDigits: 10 })}`,
      `${Number(inv.totalAmount || 0).toLocaleString(undefined, { maximumFractionDigits: 10 })} ${settings.currencySymbol}`,
      inv.paymentStatus,
    ]);
    PDFService.generateReportPDF('ACCOUNTS PAYABLE & INVOICES REGISTER', `Entity: ${selectedEntity} | FY ${settings.financialYear}`, cols, rows, settings);
  };

  return (
    <div className="d-flex flex-column gap-4">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 pb-2 border-bottom">
        <div>
          <div className="d-flex align-items-center gap-2">
            <h3 className="fw-bold mb-0 text-dark" style={{ fontFamily: 'Tahoma, sans-serif' }}>
              Invoice Registry & Accounts Payable
            </h3>
            <span className="badge bg-danger text-white px-2 py-1">Invoices</span>
          </div>
          <p className="text-muted small mb-0 mt-1">
            Track vendor tax invoices, match with approved LPOs, verify VAT compliance, and authorize payment disbursements.
          </p>
        </div>
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <button id="btn-export-excel-invoices" onClick={handleExportExcel} className="btn btn-outline-success btn-sm d-flex align-items-center gap-1 shadow-sm">
            <i className="bi bi-file-earmark-excel"></i> Export Excel
          </button>
          <button id="btn-export-pdf-invoices" onClick={handleExportPDF} className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1 shadow-sm">
            <i className="bi bi-file-earmark-pdf"></i> Export PDF
          </button>
          {role !== 'Viewer' && (
            <button id="btn-create-invoice" onClick={handleOpenCreate} className="btn btn-danger btn-sm d-flex align-items-center gap-1 shadow-sm">
              <i className="bi bi-plus-circle"></i> Log Vendor Invoice
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="row g-3">
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card card-erp p-3 border-start border-4 border-dark h-100 shadow-sm">
            <span className="text-muted small text-uppercase fw-semibold">Total Invoiced</span>
            <div className="fs-5 fw-bold text-dark mt-1">
              {summary.totalAmount.toLocaleString()} <span className="small text-muted">{settings.currencySymbol}</span>
            </div>
            <span className="text-muted extra-small mt-1">{summary.count} Registered Invoices</span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card card-erp p-3 border-start border-4 border-success h-100 shadow-sm">
            <span className="text-muted small text-uppercase fw-semibold">Settled / Paid</span>
            <div className="fs-5 fw-bold text-success mt-1">
              {summary.paidAmount.toLocaleString()} <span className="small text-muted">{settings.currencySymbol}</span>
            </div>
            <span className="text-muted extra-small mt-1">Disbursed to suppliers</span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card card-erp p-3 border-start border-4 border-warning h-100 shadow-sm">
            <span className="text-muted small text-uppercase fw-semibold">Pending Settlement</span>
            <div className="fs-5 fw-bold text-dark mt-1">
              {summary.pendingAmount.toLocaleString()} <span className="small text-muted">{settings.currencySymbol}</span>
            </div>
            <span className="text-muted extra-small mt-1">{summary.pendingCount} Invoices awaiting payment</span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card card-erp p-3 border-start border-4 border-info h-100 shadow-sm">
            <span className="text-muted small text-uppercase fw-semibold">3-Way Match Verification</span>
            <div className="fs-5 fw-bold text-info mt-1">
              Active
            </div>
            <span className="text-muted extra-small mt-1">LPO & Budget cross-check</span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card card-erp p-3 shadow-sm">
        <div className="row g-2 align-items-center">
          <div className="col-12 col-md-4">
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-light text-muted border-end-0">
                <i className="bi bi-search"></i>
              </span>
              <input
                id="input-search-invoices"
                type="text"
                className="form-control form-control-sm border-start-0"
                placeholder="Search invoice number, supplier, LPO..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="col-12 col-md-4">
            <select
              id="select-invoice-project"
              className="form-select form-select-sm"
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
            >
              <option value="">All Projects</option>
              {projs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} - {p.name} ({p.invoiceCount ?? 0} inv)
                </option>
              ))}
            </select>
          </div>

          <div className="col-6 col-md-2">
            <select
              id="select-invoice-entity"
              className="form-select form-select-sm"
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
            >
              <option value="All">All Entities</option>
              <option value="PACL">PACL</option>
              <option value="PGIL">PGIL</option>
              <option value="Shared">Shared</option>
            </select>
          </div>

          <div className="col-6 col-md-2">
            <select
              id="select-invoice-status"
              className="form-select form-select-sm"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="">All Payment Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Submitted">Submitted to Finance</option>
              <option value="Approved">Approved</option>
              <option value="Paid">Paid</option>
              <option value="Partially Paid">Partially Paid</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Selected Project Pending Balance Banner */}
      {selectedProjectObj && (
        <div className="card card-erp p-3 border-start border-4 border-primary bg-light shadow-sm">
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2">
            <div>
              <div className="fw-bold text-dark">
                <i className="bi bi-folder2-open text-primary me-2"></i>
                {selectedProjectObj.code} — {selectedProjectObj.name}
              </div>
              <small className="text-muted">
                Live Project Balance Reconciliation ({selectedProjectObj.invoiceCount ?? 0} active invoices)
              </small>
            </div>
            <div className="d-flex flex-wrap gap-3 font-monospace small">
              <div>
                <span className="text-muted d-block extra-small">Project Budget</span>
                <strong>{Number(selectedProjectObj.totalBudget ?? selectedProjectObj.approvedBudget ?? selectedProjectObj.budget ?? 0).toLocaleString()} {settings.currencySymbol}</strong>
              </div>
              <div>
                <span className="text-muted d-block extra-small">Total Invoiced</span>
                <strong className="text-primary">{Number(selectedProjectObj.invoicedAmount ?? 0).toLocaleString()} {settings.currencySymbol}</strong>
              </div>
              <div>
                <span className="text-muted d-block extra-small">Paid / Settled</span>
                <strong className="text-danger">{Number(selectedProjectObj.spent ?? 0).toLocaleString()} {settings.currencySymbol}</strong>
              </div>
              <div>
                <span className="text-muted d-block extra-small">Pending Invoices ({selectedProjectObj.pendingInvoicesCount ?? 0})</span>
                <strong className="text-warning-emphasis">{Number(selectedProjectObj.pendingInvoicesAmount ?? 0).toLocaleString()} {settings.currencySymbol}</strong>
              </div>
              <div>
                <span className="text-muted d-block extra-small">Net Pending Balance</span>
                <strong className={Number(selectedProjectObj.remainingBudget ?? 0) < 0 ? 'text-danger' : 'text-success'}>
                  {Number(selectedProjectObj.remainingBudget ?? 0).toLocaleString()} {settings.currencySymbol}
                </strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card card-erp shadow-sm overflow-hidden">
        <div className="card-header bg-white py-3 px-4 d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-2">
            <h6 className="mb-0 fw-bold text-dark">Accounts Payable & Invoice Register</h6>
            <span className="badge bg-light text-dark border">
              {filteredInvoices.length} Records
            </span>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0 erp-table">
            <thead className="table-light">
              <tr className="small text-uppercase text-muted">
                <th style={{ width: '140px' }}>Invoice No.</th>
                <th>Supplier / Vendor</th>
                <th>Related LPO</th>
                <th>Entity</th>
                <th>Project Focus</th>
                <th>Invoice Date</th>
                <th>Due Date</th>
                <th className="text-end">Excl. VAT</th>
                <th className="text-end">VAT (16%)</th>
                <th className="text-end">Total Amount</th>
                <th>Status</th>
                <th className="text-center" style={{ width: '120px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-5 text-muted">
                    <i className="bi bi-receipt-cutoff fs-2 d-block mb-2 text-secondary opacity-50"></i>
                    No invoices registered for the current filter criteria.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <button
                        type="button"
                        className="btn btn-link p-0 text-decoration-none fw-bold text-danger font-monospace text-start"
                        title="Click to drill down into transaction trace"
                        onClick={() =>
                          onDrillDown &&
                          onDrillDown({
                            type: 'transaction',
                            id: inv.invoiceNumber,
                            recordType: 'Invoice',
                          })
                        }
                      >
                        {inv.invoiceNumber}
                      </button>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-link p-0 text-decoration-none fw-semibold text-dark text-start"
                        title="View Supplier 360"
                        onClick={() =>
                          onDrillDown &&
                          onDrillDown({
                            type: 'supplier',
                            id: inv.supplierId || inv.supplierName,
                          })
                        }
                      >
                        {inv.supplierName}
                      </button>
                      {inv.description && <div className="extra-small text-muted text-truncate" style={{ maxWidth: '180px' }}>{inv.description}</div>}
                    </td>
                    <td>
                      {inv.lpoNumber ? (
                        <button
                          type="button"
                          className="btn btn-link p-0 text-decoration-none badge bg-light text-primary border"
                          title="Trace LPO"
                          onClick={() =>
                            onDrillDown &&
                            onDrillDown({
                              type: 'transaction',
                              id: inv.lpoNumber!,
                              recordType: 'LPO',
                            })
                          }
                        >
                          {inv.lpoNumber}
                        </button>
                      ) : (
                        <span className="text-muted extra-small">Direct Requisition</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          inv.legalEntity === 'PACL'
                            ? 'bg-dark text-white'
                            : inv.legalEntity === 'PGIL'
                            ? 'bg-danger text-white'
                            : 'bg-primary text-white'
                        }`}
                      >
                        {inv.legalEntity}
                      </span>
                    </td>
                    <td>
                      {inv.projectName ? (
                        <span className="badge bg-light text-dark border">{inv.projectName}</span>
                      ) : (
                        <span className="text-muted small">Departmental</span>
                      )}
                    </td>
                    <td className="small text-muted">{inv.invoiceDate}</td>
                    <td className="small text-muted">{inv.dueDate || 'N/A'}</td>
                    <td className="text-end text-muted small">
                      {Number(inv.amountBeforeVat || 0).toLocaleString(undefined, { maximumFractionDigits: 10 })}
                    </td>
                    <td className="text-end text-muted small">
                      {Number(inv.vatAmount || 0).toLocaleString(undefined, { maximumFractionDigits: 10 })}
                    </td>
                    <td className="text-end fw-bold text-dark font-monospace">
                      {Number(inv.totalAmount || 0).toLocaleString(undefined, { maximumFractionDigits: 10 })} <span className="extra-small text-muted">{settings.currencySymbol}</span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          inv.paymentStatus === 'Paid'
                            ? 'bg-success text-white'
                            : inv.paymentStatus === 'Submitted'
                            ? 'bg-warning-subtle text-warning border border-warning'
                            : inv.paymentStatus === 'Approved'
                            ? 'bg-primary text-white'
                            : 'bg-secondary-subtle text-secondary border'
                        }`}
                      >
                        {inv.paymentStatus}
                      </span>
                    </td>
                    <td className="text-center">
                      <div className="btn-group btn-group-sm">
                        <button
                          type="button"
                          className="btn btn-outline-danger btn-sm p-1"
                          title="Trace Transaction Lifecycle"
                          onClick={() =>
                            onDrillDown &&
                            onDrillDown({
                              type: 'transaction',
                              id: inv.invoiceNumber,
                              recordType: 'Invoice',
                            })
                          }
                        >
                          <i className="bi bi-search"></i>
                        </button>
                        {role !== 'Viewer' && inv.paymentStatus === 'Pending' && (
                          <button
                            id={`btn-pay-req-${inv.id}`}
                            onClick={() => handleGeneratePaymentRequest(inv)}
                            className="btn btn-outline-success btn-sm p-1"
                            title="Generate Payment Request"
                          >
                            <i className="bi bi-credit-card-2-front"></i>
                          </button>
                        )}
                        {role !== 'Viewer' && (
                          <button
                            id={`btn-edit-inv-${inv.id}`}
                            onClick={() => handleOpenEdit(inv)}
                            className="btn btn-outline-secondary btn-sm p-1"
                            title="Edit Invoice"
                          >
                            <i className="bi bi-pencil"></i>
                          </button>
                        )}
                        {role === 'Administrator' && (
                          <button
                            id={`btn-delete-inv-${inv.id}`}
                            onClick={() => handleDelete(inv.id)}
                            className="btn btn-outline-danger btn-sm p-1"
                            title="Delete Invoice"
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredInvoices.length > 0 && (
              <tfoot className="table-light fw-bold">
                <tr>
                  <td colSpan={9} className="text-uppercase small">Total Filtered Invoices</td>
                  <td className="text-end">{summary.totalAmount.toLocaleString()} {settings.currencySymbol}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content shadow-lg border-0">
              <div className="modal-header bg-danger text-white">
                <h5 className="modal-title fw-bold">
                  {editingInvoice ? 'Edit Vendor Invoice' : 'Log Vendor Tax Invoice'}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowModal(false)}></button>
              </div>
              <form onSubmit={handleSave}>
                <div className="modal-body p-4">
                  <div className="row g-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-semibold">Invoice Number *</label>
                      <input
                        type="text"
                        className="form-control"
                        required
                        value={invoiceNumber}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                        placeholder="e.g. INV-2026-001"
                      />
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-semibold">Matching LPO Number (Optional)</label>
                      <select
                        className="form-select"
                        value={lpoNumber}
                        onChange={(e) => {
                          const val = e.target.value;
                          setLpoNumber(val);
                          const matched = lpos.find((l) => l.lpoNumber === val);
                          if (matched) {
                            setSupplierId(matched.supplierId);
                            if (matched.projectId) {
                              setProjectId(matched.projectId);
                            }
                            setLegalEntity(matched.legalEntity);
                            const matchedNet = Number(matched.amountBeforeVat ?? matched.lpoAmount ?? 0);
                            setAmountBeforeVat(String(matchedNet));
                            const matchedVat = Number(matched.vatAmount ?? 0);
                            setHasVat(matchedVat > 0);
                            setVatAmount(String(matchedVat));
                          }
                        }}
                      >
                        <option value="">-- Direct Requisition (No LPO) --</option>
                        {lpos.map((l) => (
                          <option key={l.id} value={l.lpoNumber}>
                            {l.lpoNumber} - {l.supplierName} ({Number(l.totalLpoValue ?? l.totalLpoAmount ?? 0).toLocaleString()} KES)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-semibold">Supplier / Vendor *</label>
                      <select
                        className="form-select"
                        value={supplierId}
                        onChange={(e) => setSupplierId(e.target.value)}
                        required
                      >
                        <option value="">-- Select Vendor --</option>
                        {suppliers.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-12 col-md-3">
                      <label className="form-label small fw-semibold">Legal Entity *</label>
                      <select
                        className="form-select"
                        value={legalEntity}
                        onChange={(e) => setLegalEntity(e.target.value as any)}
                        required
                      >
                        <option value="PACL">PACL</option>
                        <option value="PGIL">PGIL</option>
                        <option value="Shared">Shared</option>
                      </select>
                    </div>

                    <div className="col-12 col-md-3">
                      <label className="form-label small fw-semibold">Linked Project</label>
                      <select
                        className="form-select"
                        value={projectId}
                        onChange={(e) => setProjectId(e.target.value)}
                      >
                        <option value="">-- General --</option>
                        {projs.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.code} - {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {projectId && (() => {
                      const targetProj = projs.find((p) => p.id === projectId);
                      if (!targetProj) return null;
                      const currentNetBal = Number(targetProj.remainingBudget ?? targetProj.remaining ?? 0);
                      const draftTotal = Number(amountBeforeVat || 0) + (hasVat ? Number(vatAmount || 0) : 0);
                      const existingDraftVal = editingInvoice && editingInvoice.projectId === projectId && editingInvoice.paymentStatus !== 'Rejected'
                        ? Number(editingInvoice.totalAmount || 0)
                        : 0;
                      const projectedBalance = paymentStatus === 'Rejected'
                        ? currentNetBal + existingDraftVal
                        : currentNetBal + existingDraftVal - draftTotal;
                      return (
                        <div className="col-12">
                          <div className="p-2 rounded bg-light border d-flex flex-wrap justify-content-between align-items-center gap-2 extra-small">
                            <span>
                              <strong>{targetProj.name}</strong>: Budget{' '}
                              <span className="font-monospace">{Number(targetProj.totalBudget ?? targetProj.budget ?? 0).toLocaleString()}</span> •
                              Existing Invoices: <span className="font-monospace">{Number(targetProj.invoicedAmount ?? 0).toLocaleString()}</span> ({targetProj.invoiceCount ?? 0}) •
                              Pending: <span className="font-monospace text-warning-emphasis">{Number(targetProj.pendingInvoicesAmount ?? 0).toLocaleString()}</span>
                            </span>
                            <span className={`fw-bold font-monospace ${projectedBalance < 0 ? 'text-danger' : 'text-success'}`}>
                              Projected Pending Balance: {projectedBalance.toLocaleString(undefined, { maximumFractionDigits: 10 })} {settings.currencySymbol}
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="col-12 col-md-3">
                      <label className="form-label small fw-semibold">Invoice Date *</label>
                      <input
                        type="date"
                        className="form-control"
                        required
                        value={invoiceDate}
                        onChange={(e) => setInvoiceDate(e.target.value)}
                      />
                    </div>

                    <div className="col-12 col-md-3">
                      <label className="form-label small fw-semibold">Due Date</label>
                      <input
                        type="date"
                        className="form-control"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                      />
                    </div>

                    <div className="col-12 col-md-4">
                      <label className="form-label small fw-semibold">Amount Excl. VAT ({settings.currencySymbol}) *</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        className="form-control font-monospace"
                        required
                        value={amountBeforeVat}
                        onChange={(e) => {
                          const raw = e.target.value;
                          setAmountBeforeVat(raw);
                          if (hasVat) {
                            const rate = (settings.vatRatePercent ?? 16) / 100;
                            setVatAmount(String(Number((Number(raw || 0) * rate).toFixed(10))));
                          }
                        }}
                      />
                    </div>

                    <div className="col-12 col-md-4">
                      <label className="form-label small fw-semibold d-flex align-items-center justify-content-between">
                        <span>VAT / Tax ({settings.vatRatePercent ?? 16}%)</span>
                        <span className="form-check form-check-inline m-0">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            id="checkVatInv"
                            checked={hasVat}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setHasVat(checked);
                              if (checked) {
                                const rate = (settings.vatRatePercent ?? 16) / 100;
                                setVatAmount(String(Number((Number(amountBeforeVat || 0) * rate).toFixed(10))));
                              } else {
                                setVatAmount('0');
                              }
                            }}
                          />
                          <label className="form-check-label extra-small fw-normal" htmlFor="checkVatInv">
                            Apply
                          </label>
                        </span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        className="form-control font-monospace"
                        value={hasVat ? vatAmount : '0'}
                        disabled={!hasVat}
                        onChange={(e) => setVatAmount(e.target.value)}
                      />
                    </div>

                    <div className="col-12 col-md-4">
                      <label className="form-label small fw-semibold">Total Invoice Amount</label>
                      <div className="form-control bg-light fw-bold text-dark font-monospace">
                        {Number((Number(amountBeforeVat || 0) + (hasVat ? Number(vatAmount || 0) : 0)).toFixed(10)).toLocaleString(
                          undefined,
                          { maximumFractionDigits: 10 }
                        )}{' '}
                        {settings.currencySymbol}
                      </div>
                    </div>

                    <div className="col-12 col-md-4">
                      <label className="form-label small fw-semibold">Payment Status</label>
                      <select
                        className="form-select"
                        value={paymentStatus}
                        onChange={(e) => setPaymentStatus(e.target.value as any)}
                      >
                        <option value="Pending">Pending</option>
                        <option value="Submitted">Submitted to Finance</option>
                        <option value="Approved">Approved</option>
                        <option value="Paid">Paid</option>
                        <option value="Partially Paid">Partially Paid</option>
                        <option value="Rejected">Rejected</option>
                      </select>
                    </div>

                    <div className="col-12 col-md-4">
                      <label className="form-label small fw-semibold">Payment Settlement Date</label>
                      <input
                        type="date"
                        className="form-control"
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                      />
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-semibold">Scanned Invoice Attachment</label>
                      <input
                        type="file"
                        className="form-control"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setDocFileName(e.target.files[0].name);
                          }
                        }}
                      />
                      {docFileName && <div className="extra-small text-success mt-1">Attached: {docFileName}</div>}
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-semibold">Line Items / Remarks</label>
                      <input
                        type="text"
                        className="form-control"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Invoice description or notes..."
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-danger px-4">
                    {editingInvoice ? 'Update Invoice' : 'Save Invoice'}
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
