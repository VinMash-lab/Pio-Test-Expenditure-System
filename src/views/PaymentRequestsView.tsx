import React, { useState, useMemo } from 'react';
import { DatabaseService } from '../services/db';
import { ExcelService } from '../services/excelService';
import { PDFService } from '../services/pdfService';
import { confirmDialog, showToast } from '../services/uiFeedback';
import { PaymentRequestRecord, RoleType } from '../types';

interface PaymentRequestsViewProps {
  role: RoleType;
  onRefresh: () => void;
}

export const PaymentRequestsView: React.FC<PaymentRequestsViewProps> = ({ role, onRefresh }) => {
  const reqs = DatabaseService.getPaymentRequests();
  const invoices = DatabaseService.getInvoices();
  const lpos = DatabaseService.getLPOs();
  const projs = DatabaseService.getProjects();
  const suppliers = DatabaseService.getSuppliers();
  const settings = DatabaseService.getSettings();

  const [search, setSearch] = useState('');
  const [selectedEntity, setSelectedEntity] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingReq, setEditingReq] = useState<PaymentRequestRecord | null>(null);

  // Form Fields
  const [requestNumber, setRequestNumber] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [lpoNumber, setLpoNumber] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [legalEntity, setLegalEntity] = useState<'PACL' | 'PGIL' | 'Shared'>('PACL');
  const [requestedAmount, setRequestedAmount] = useState<number>(100000);
  const [requestDate, setRequestDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<PaymentRequestRecord['status']>('Submitted');
  const [priority, setPriority] = useState<PaymentRequestRecord['priority']>('Medium');
  const [purpose, setPurpose] = useState('');
  const [voucherFileName, setVoucherFileName] = useState('');

  // Filtered List
  const filteredReqs = useMemo(() => {
    return reqs.filter((r) => {
      if (selectedEntity !== 'All' && r.legalEntity !== selectedEntity) return false;
      if (selectedStatus && r.status !== selectedStatus) return false;
      if (selectedPriority && r.priority !== selectedPriority) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !(r.requestNumber || '').toLowerCase().includes(q) &&
          !(r.supplierName || '').toLowerCase().includes(q) &&
          !(r.invoiceNumber || '').toLowerCase().includes(q) &&
          !(r.lpoNumber || '').toLowerCase().includes(q) &&
          !(r.projectName || '').toLowerCase().includes(q) &&
          !(r.purpose || '').toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [reqs, selectedEntity, selectedStatus, selectedPriority, search]);

  // Summary Metrics
  const summary = useMemo(() => {
    const totalAmount = filteredReqs.reduce((sum, r) => sum + Number(r.requestedAmount || 0), 0);
    const paidAmount = filteredReqs
      .filter((r) => r.status === 'Paid')
      .reduce((sum, r) => sum + Number(r.requestedAmount || 0), 0);
    const pendingAmount = filteredReqs
      .filter((r) => r.status === 'Submitted' || r.status === 'Finance Review' || r.status === 'Approved')
      .reduce((sum, r) => sum + Number(r.requestedAmount || 0), 0);
    const urgentCount = filteredReqs.filter((r) => r.priority === 'Urgent' && r.status !== 'Paid').length;

    return {
      totalAmount,
      paidAmount,
      pendingAmount,
      urgentCount,
      count: filteredReqs.length,
    };
  }, [filteredReqs]);

  const handleOpenCreate = () => {
    setEditingReq(null);
    setRequestNumber(`PR-2026-${Math.floor(100 + Math.random() * 900)}`);
    setInvoiceNumber('');
    setLpoNumber('');
    setSupplierId(suppliers[0]?.id || '');
    setProjectId(projs[0]?.id || '');
    setLegalEntity('PACL');
    setRequestedAmount(100000);
    setRequestDate(new Date().toISOString().split('T')[0]);
    setStatus('Submitted');
    setPriority('Medium');
    setPurpose('');
    setVoucherFileName('');
    setShowModal(true);
  };

  const handleOpenEdit = (r: PaymentRequestRecord) => {
    setEditingReq(r);
    setRequestNumber(r.requestNumber);
    setInvoiceNumber(r.invoiceNumber || '');
    setLpoNumber(r.lpoNumber || '');
    setSupplierId(r.supplierId);
    setProjectId(r.projectId || '');
    setLegalEntity(r.legalEntity);
    setRequestedAmount(r.requestedAmount);
    setRequestDate(r.requestDate);
    setStatus(r.status);
    setPriority(r.priority);
    setPurpose(r.purpose || '');
    setVoucherFileName(r.paymentVoucherFileName || '');
    setShowModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const suppObj = suppliers.find((s) => s.id === supplierId);
    const projObj = projs.find((p) => p.id === projectId);

    const recordToSave: PaymentRequestRecord = {
      id: editingReq ? editingReq.id : 'pr-' + Date.now(),
      requestNumber,
      invoiceNumber: invoiceNumber || undefined,
      lpoNumber: lpoNumber || undefined,
      supplierId,
      supplierName: suppObj?.name || 'Selected Vendor',
      projectId: projectId || undefined,
      projectName: projObj?.name || undefined,
      legalEntity,
      requestedAmount,
      currency: settings.currencySymbol || 'KES',
      requestDate,
      status,
      priority,
      purpose,
      paymentVoucherFileName: voucherFileName || (editingReq ? editingReq.paymentVoucherFileName : undefined),
      createdBy: editingReq ? editingReq.createdBy : `${role} User`,
      createdAt: editingReq ? editingReq.createdAt : new Date().toISOString(),
    };

    DatabaseService.savePaymentRequest(recordToSave, `${role} User`, role);
    onRefresh();
    setShowModal(false);
  };

  const handleQuickApprove = async (r: PaymentRequestRecord) => {
    const confirmed = await confirmDialog({
      title: 'Approve Payment Request',
      message: `Approve Payment Request ${r.requestNumber} for ${r.supplierName}?`,
      confirmLabel: 'Approve Request',
      variant: 'primary',
    });
    if (confirmed) {
      DatabaseService.savePaymentRequest({ ...r, status: 'Approved' }, `${role} User`, role);
      onRefresh();
      showToast(`Payment Request ${r.requestNumber} approved.`, 'success');
    }
  };

  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const handleMarkAsPaid = (r: PaymentRequestRecord) => {
    const today = new Date().toISOString().split('T')[0];
    const updatedPR: PaymentRequestRecord = {
      ...r,
      status: 'Paid',
      paymentDate: today,
    };
    DatabaseService.savePaymentRequest(updatedPR, `${role} User`, role);
    const exp = DatabaseService.syncPaymentRequestToExpenditure(updatedPR, `${role} User`, role);

    setSuccessBanner(
      `Disbursement confirmed for ${r.requestNumber} (${Number(r.requestedAmount || 0).toLocaleString()} KES)! Automatically posted to Expenditure Tracker as ${exp.expenseId} and synced with accounts payable.`
    );
    setTimeout(() => setSuccessBanner(null), 6000);
    onRefresh();
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirmDialog({
      title: 'Delete Payment Request',
      message: 'Are you sure you want to delete this payment request?',
      confirmLabel: 'Delete Request',
      variant: 'danger',
    });
    if (confirmed) {
      DatabaseService.deletePaymentRequest(id, `${role} User`, role);
      onRefresh();
      showToast('Payment request deleted.', 'success');
    }
  };

  const handleExportExcel = () => {
    const exportData = filteredReqs.map((r) => ({
      'Request No': r.requestNumber,
      'Date': r.requestDate,
      'Vendor': r.supplierName,
      'Entity': r.legalEntity,
      'Project': r.projectName || 'N/A',
      'Invoice No': r.invoiceNumber || 'N/A',
      'LPO No': r.lpoNumber || 'N/A',
      'Amount (KES)': r.requestedAmount,
      'Priority': r.priority,
      'Status': r.status,
      'Purpose': r.purpose,
    }));
    ExcelService.exportCustomDataset(exportData, 'Payment_Requests_Registry');
  };

  const handleExportPDF = () => {
    const cols = ['Request No', 'Date', 'Vendor', 'Entity', 'Invoice / LPO', 'Amount (KES)', 'Priority', 'Status'];
    const rows = filteredReqs.map((r) => [
      r.requestNumber,
      r.requestDate,
      r.supplierName,
      r.legalEntity,
      `${r.invoiceNumber || ''} ${r.lpoNumber ? `(${r.lpoNumber})` : ''}`.trim() || 'Direct',
      `${Number(r.requestedAmount || 0).toLocaleString()} ${settings.currencySymbol}`,
      r.priority,
      r.status,
    ]);
    PDFService.generateReportPDF('PAYMENT REQUESTS & DISBURSEMENT AUTHORIZATIONS', `Entity: ${selectedEntity} | FY ${settings.financialYear}`, cols, rows, settings);
  };

  return (
    <div className="d-flex flex-column gap-4">
      {/* Header */}
      {successBanner && (
        <div className="alert alert-success d-flex align-items-center gap-2 p-3 shadow-sm mb-0 tab-fadeIn">
          <i className="bi bi-check-circle-fill fs-5 text-success"></i>
          <div>
            <strong>Payment Disbursed Successfully:</strong> {successBanner}
          </div>
        </div>
      )}

      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 pb-2 border-bottom">
        <div>
          <div className="d-flex align-items-center gap-2">
            <h3 className="fw-bold mb-0 text-dark" style={{ fontFamily: 'Tahoma, sans-serif' }}>
              Payment Requests & Authorizations
            </h3>
            <span className="badge bg-danger text-white px-2 py-1">Disbursements</span>
          </div>
          <p className="text-muted small mb-0 mt-1">
            Initiate, authorize, and track payment requisitions for marketing campaigns, media buying, agency retainers, and vendors.
          </p>
        </div>
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <button id="btn-export-excel-payreq" onClick={handleExportExcel} className="btn btn-outline-success btn-sm d-flex align-items-center gap-1 shadow-sm">
            <i className="bi bi-file-earmark-excel"></i> Export Excel
          </button>
          <button id="btn-export-pdf-payreq" onClick={handleExportPDF} className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1 shadow-sm">
            <i className="bi bi-file-earmark-pdf"></i> Export PDF
          </button>
          {role !== 'Viewer' && (
            <button id="btn-create-payreq" onClick={handleOpenCreate} className="btn btn-danger btn-sm d-flex align-items-center gap-1 shadow-sm">
              <i className="bi bi-plus-circle"></i> Create Payment Request
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="row g-3">
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card card-erp p-3 border-start border-4 border-dark h-100 shadow-sm">
            <span className="text-muted small text-uppercase fw-semibold">Total Requisitioned</span>
            <div className="fs-5 fw-bold text-dark mt-1">
              {summary.totalAmount.toLocaleString()} <span className="small text-muted">{settings.currencySymbol}</span>
            </div>
            <span className="text-muted extra-small mt-1">{summary.count} Registered Requisitions</span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card card-erp p-3 border-start border-4 border-warning h-100 shadow-sm">
            <span className="text-muted small text-uppercase fw-semibold">Pending Authorization</span>
            <div className="fs-5 fw-bold text-dark mt-1">
              {summary.pendingAmount.toLocaleString()} <span className="small text-muted">{settings.currencySymbol}</span>
            </div>
            <span className="text-muted extra-small mt-1">Awaiting Finance payment</span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card card-erp p-3 border-start border-4 border-success h-100 shadow-sm">
            <span className="text-muted small text-uppercase fw-semibold">Settled / Paid Out</span>
            <div className="fs-5 fw-bold text-success mt-1">
              {summary.paidAmount.toLocaleString()} <span className="small text-muted">{settings.currencySymbol}</span>
            </div>
            <span className="text-muted extra-small mt-1">Disbursed to suppliers</span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card card-erp p-3 border-start border-4 border-danger h-100 shadow-sm">
            <span className="text-muted small text-uppercase fw-semibold">Urgent Requisitions</span>
            <div className="fs-5 fw-bold text-danger mt-1">
              {summary.urgentCount} <span className="small text-muted">High Priority</span>
            </div>
            <span className="text-muted extra-small mt-1">Requires immediate signoff</span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card card-erp p-3 shadow-sm">
        <div className="row g-2 align-items-center">
          <div className="col-12 col-md-5">
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-light text-muted border-end-0">
                <i className="bi bi-search"></i>
              </span>
              <input
                id="input-search-payreq"
                type="text"
                className="form-control form-control-sm border-start-0"
                placeholder="Search request number, vendor, invoice, LPO..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="col-6 col-md-2">
            <select
              id="select-payreq-entity"
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
              id="select-payreq-priority"
              className="form-select form-select-sm"
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
            >
              <option value="">All Priorities</option>
              <option value="Urgent">Urgent</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          <div className="col-6 col-md-3">
            <select
              id="select-payreq-status"
              className="form-select form-select-sm"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="Submitted">Submitted</option>
              <option value="Finance Review">Finance Review</option>
              <option value="Approved">Approved</option>
              <option value="Paid">Paid / Settled</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card card-erp shadow-sm overflow-hidden">
        <div className="card-header bg-white py-3 px-4 d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-2">
            <h6 className="mb-0 fw-bold text-dark">Payment Requisitions Ledger</h6>
            <span className="badge bg-light text-dark border">
              {filteredReqs.length} Records
            </span>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0 erp-table">
            <thead className="table-light">
              <tr className="small text-uppercase text-muted">
                <th style={{ width: '130px' }}>Request No.</th>
                <th>Date</th>
                <th>Supplier / Payee</th>
                <th>Entity</th>
                <th>Matched Documents</th>
                <th>Project Focus</th>
                <th className="text-end">Requested Amount</th>
                <th>Priority</th>
                <th>Status</th>
                <th className="text-center" style={{ width: '130px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredReqs.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-5 text-muted">
                    <i className="bi bi-wallet2 fs-2 d-block mb-2 text-secondary opacity-50"></i>
                    No payment requests match your criteria.
                  </td>
                </tr>
              ) : (
                filteredReqs.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span className="fw-bold text-dark">{r.requestNumber}</span>
                    </td>
                    <td className="small text-muted">{r.requestDate}</td>
                    <td>
                      <div className="fw-semibold text-dark">{r.supplierName}</div>
                      {r.purpose && <div className="extra-small text-muted text-truncate" style={{ maxWidth: '200px' }}>{r.purpose}</div>}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          r.legalEntity === 'PACL'
                            ? 'bg-dark text-white'
                            : r.legalEntity === 'PGIL'
                            ? 'bg-danger text-white'
                            : 'bg-primary text-white'
                        }`}
                      >
                        {r.legalEntity}
                      </span>
                    </td>
                    <td>
                      <div className="d-flex flex-column gap-1">
                        {r.invoiceNumber && <span className="badge bg-light text-dark border extra-small">Inv: {r.invoiceNumber}</span>}
                        {r.lpoNumber && <span className="badge bg-light text-dark border extra-small">LPO: {r.lpoNumber}</span>}
                        {!r.invoiceNumber && !r.lpoNumber && <span className="text-muted extra-small">Direct Request</span>}
                      </div>
                    </td>
                    <td>
                      {r.projectName ? (
                        <span className="badge bg-light text-dark border">{r.projectName}</span>
                      ) : (
                        <span className="text-muted small">Departmental</span>
                      )}
                    </td>
                    <td className="text-end fw-bold text-dark">
                      {Number(r.requestedAmount || 0).toLocaleString()} <span className="extra-small text-muted">{settings.currencySymbol}</span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          r.priority === 'Urgent'
                            ? 'bg-danger text-white'
                            : r.priority === 'High'
                            ? 'bg-warning text-dark'
                            : 'bg-light text-dark border'
                        }`}
                      >
                        {r.priority}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          r.status === 'Paid'
                            ? 'bg-success text-white'
                            : r.status === 'Approved'
                            ? 'bg-primary text-white'
                            : r.status === 'Finance Review' || r.status === 'Submitted'
                            ? 'bg-warning-subtle text-warning border border-warning'
                            : 'bg-secondary text-white'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="text-center">
                      <div className="btn-group btn-group-sm">
                        {role !== 'Viewer' && r.status !== 'Approved' && r.status !== 'Paid' && (
                          <button
                            id={`btn-approve-pr-${r.id}`}
                            onClick={() => handleQuickApprove(r)}
                            className="btn btn-outline-primary btn-sm p-1"
                            title="Approve Request"
                          >
                            <i className="bi bi-check-lg"></i>
                          </button>
                        )}
                        {role !== 'Viewer' && r.status !== 'Paid' && (
                          <button
                            id={`btn-pay-pr-${r.id}`}
                            onClick={() => handleMarkAsPaid(r)}
                            className="btn btn-outline-success btn-sm p-1"
                            title="Mark as Paid / Settled"
                          >
                            <i className="bi bi-cash-stack"></i>
                          </button>
                        )}
                        {role !== 'Viewer' && (
                          <button
                            id={`btn-edit-pr-${r.id}`}
                            onClick={() => handleOpenEdit(r)}
                            className="btn btn-outline-secondary btn-sm p-1"
                            title="Edit Requisition"
                          >
                            <i className="bi bi-pencil"></i>
                          </button>
                        )}
                        {role === 'Administrator' && (
                          <button
                            id={`btn-delete-pr-${r.id}`}
                            onClick={() => handleDelete(r.id)}
                            className="btn btn-outline-danger btn-sm p-1"
                            title="Delete Requisition"
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
            {filteredReqs.length > 0 && (
              <tfoot className="table-light fw-bold">
                <tr>
                  <td colSpan={6} className="text-uppercase small">Total Requisitions</td>
                  <td className="text-end">{summary.totalAmount.toLocaleString()} {settings.currencySymbol}</td>
                  <td colSpan={3}></td>
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
                  {editingReq ? 'Edit Payment Request' : 'Create Payment Requisition'}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowModal(false)}></button>
              </div>
              <form onSubmit={handleSave}>
                <div className="modal-body p-4">
                  <div className="row g-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-semibold">Request Number *</label>
                      <input
                        type="text"
                        className="form-control"
                        required
                        value={requestNumber}
                        onChange={(e) => setRequestNumber(e.target.value)}
                      />
                    </div>

                    <div className="col-12 col-md-3">
                      <label className="form-label small fw-semibold">Request Date *</label>
                      <input
                        type="date"
                        className="form-control"
                        required
                        value={requestDate}
                        onChange={(e) => setRequestDate(e.target.value)}
                      />
                    </div>

                    <div className="col-12 col-md-3">
                      <label className="form-label small fw-semibold">Priority *</label>
                      <select
                        className="form-select"
                        value={priority}
                        onChange={(e) => setPriority(e.target.value as any)}
                        required
                      >
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                        <option value="Urgent">Urgent</option>
                      </select>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-semibold">Supplier / Payee *</label>
                      <select
                        className="form-select"
                        value={supplierId}
                        onChange={(e) => setSupplierId(e.target.value)}
                        required
                      >
                        <option value="">-- Select Payee --</option>
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

                    <div className="col-12 col-md-4">
                      <label className="form-label small fw-semibold">Matched Invoice No. (Optional)</label>
                      <select
                        className="form-select"
                        value={invoiceNumber}
                        onChange={(e) => {
                          const val = e.target.value;
                          setInvoiceNumber(val);
                          const matchedInv = invoices.find((i) => i.invoiceNumber === val);
                          if (matchedInv) {
                            setSupplierId(matchedInv.supplierId);
                            setProjectId(matchedInv.projectId || '');
                            setLegalEntity(matchedInv.legalEntity);
                            setRequestedAmount(matchedInv.totalAmount);
                            if (matchedInv.lpoNumber) setLpoNumber(matchedInv.lpoNumber);
                          }
                        }}
                      >
                        <option value="">-- Direct Requisition --</option>
                        {invoices.map((inv) => (
                          <option key={inv.id} value={inv.invoiceNumber}>
                            {inv.invoiceNumber} - {inv.supplierName} ({inv.totalAmount.toLocaleString()} KES)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-12 col-md-4">
                      <label className="form-label small fw-semibold">Matched LPO No. (Optional)</label>
                      <select
                        className="form-select"
                        value={lpoNumber}
                        onChange={(e) => setLpoNumber(e.target.value)}
                      >
                        <option value="">-- None --</option>
                        {lpos.map((l) => (
                          <option key={l.id} value={l.lpoNumber}>
                            {l.lpoNumber} - {l.supplierName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-12 col-md-4">
                      <label className="form-label small fw-semibold">Requested Amount ({settings.currencySymbol}) *</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        className="form-control font-monospace"
                        required
                        value={requestedAmount}
                        onChange={(e) => setRequestedAmount(Number(e.target.value))}
                      />
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-semibold">Status *</label>
                      <select
                        className="form-select"
                        value={status}
                        onChange={(e) => setStatus(e.target.value as any)}
                        required
                      >
                        <option value="Draft">Draft</option>
                        <option value="Submitted">Submitted</option>
                        <option value="Finance Review">Finance Review</option>
                        <option value="Approved">Approved</option>
                        <option value="Paid">Paid / Settled</option>
                        <option value="Rejected">Rejected</option>
                      </select>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-semibold">Payment Voucher / Bank Proof</label>
                      <input
                        type="file"
                        className="form-control"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setVoucherFileName(e.target.files[0].name);
                          }
                        }}
                      />
                      {voucherFileName && <div className="extra-small text-success mt-1">Attached: {voucherFileName}</div>}
                    </div>

                    <div className="col-12">
                      <label className="form-label small fw-semibold">Payment Justification / Particulars</label>
                      <textarea
                        className="form-control"
                        rows={2}
                        value={purpose}
                        onChange={(e) => setPurpose(e.target.value)}
                        placeholder="Detailed purpose of disbursement..."
                      ></textarea>
                    </div>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-danger px-4">
                    {editingReq ? 'Update Request' : 'Submit Payment Request'}
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
