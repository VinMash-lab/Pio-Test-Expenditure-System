import React, { useState, useMemo } from 'react';
import { DatabaseService } from '../services/db';
import { ExcelService } from '../services/excelService';
import { PDFService } from '../services/pdfService';
import { confirmDialog, showToast } from '../services/uiFeedback';
import { LPORecord, RoleType, DrillDownTarget, AmountTraceContext, ERPDocument } from '../types';

interface LPOManagementViewProps {
  role: RoleType;
  onRefresh: () => void;
  onDrillDown?: (target: DrillDownTarget) => void;
  onTraceAmount?: (context: AmountTraceContext) => void;
  onNavigateTab?: (tab: string) => void;
}

export const LPOManagementView: React.FC<LPOManagementViewProps> = ({
  role,
  onRefresh,
  onDrillDown,
  onTraceAmount,
  onNavigateTab,
}) => {
  const lpos = DatabaseService.getLPOs();
  const projs = DatabaseService.getProjects();
  const bdgs = DatabaseService.getBudgets();
  const depts = DatabaseService.getDepartments();
  const suppliers = DatabaseService.getSuppliers();
  const settings = DatabaseService.getSettings();

  const [activeSubTab, setActiveSubTab] = useState<'register' | 'commitments'>('register');
  const [search, setSearch] = useState('');
  const [selectedEntity, setSelectedEntity] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedVendor, setSelectedVendor] = useState('');

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingLpo, setEditingLpo] = useState<LPORecord | null>(null);

  // Form Fields
  const [lpoNumber, setLpoNumber] = useState('');
  const [projectId, setProjectId] = useState('');
  const [budgetId, setBudgetId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [legalEntity, setLegalEntity] = useState<'PACL' | 'PGIL' | 'Shared'>('PACL');
  const [lpoDate, setLpoDate] = useState(new Date().toISOString().split('T')[0]);
  const [amountBeforeVat, setAmountBeforeVat] = useState<string>('100000');
  const [hasVat, setHasVat] = useState<boolean>(true);
  const [vatAmount, setVatAmount] = useState<string>(
    String(Number((100000 * ((settings.vatRatePercent ?? 16) / 100)).toFixed(10)))
  );
  const [status, setStatus] = useState<LPORecord['status']>('Issued');
  const [paymentStatus, setPaymentStatus] = useState<LPORecord['paymentStatus']>('Pending');
  const [description, setDescription] = useState('');
  const [relatedInvoice, setRelatedInvoice] = useState('');
  const [docFileName, setDocFileName] = useState('');

  // Filtered LPOs
  const filteredLpos = useMemo(() => {
    return lpos.filter((l) => {
      const lStatus = l.status || l.lpoStatus || 'Issued';
      if (selectedEntity !== 'All' && l.legalEntity !== selectedEntity) return false;
      if (selectedStatus && lStatus !== selectedStatus) return false;
      if (selectedVendor && l.supplierId !== selectedVendor && l.supplierName !== selectedVendor) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchNum = (l.lpoNumber || '').toLowerCase().includes(q);
        const matchVendor = (l.supplierName || '').toLowerCase().includes(q);
        const matchDesc = (l.description || '').toLowerCase().includes(q);
        const matchProj = (l.projectName || '').toLowerCase().includes(q);
        if (!matchNum && !matchVendor && !matchDesc && !matchProj) return false;
      }
      return true;
    });
  }, [lpos, selectedEntity, selectedStatus, selectedVendor, search]);

  // Summary Metrics
  const summary = useMemo(() => {
    const getTotal = (l: LPORecord) => Number(l.totalLpoValue ?? l.totalLpoAmount ?? 0);
    const getStatus = (l: LPORecord) => l.status || l.lpoStatus || 'Issued';
    const totalAmount = filteredLpos.reduce((sum, l) => sum + getTotal(l), 0);
    const approvedAmount = filteredLpos
      .filter((l) => {
        const s = getStatus(l);
        return s === 'Approved' || s === 'Issued' || s === 'Partially Utilized' || s === 'Partially Fulfilled';
      })
      .reduce((sum, l) => sum + getTotal(l), 0);
    const paidAmount = filteredLpos
      .filter((l) => l.paymentStatus === 'Paid' || l.paymentStatus === 'Fully Paid')
      .reduce((sum, l) => sum + getTotal(l), 0);
    const pendingCount = filteredLpos.filter((l) => {
      const s = getStatus(l);
      return s === 'Submitted' || s === 'Pending Approval' || s === 'Draft';
    }).length;

    return {
      totalAmount,
      approvedAmount,
      paidAmount,
      pendingCount,
      count: filteredLpos.length,
    };
  }, [filteredLpos]);

  const handleOpenCreate = () => {
    setEditingLpo(null);
    const targetEntity = legalEntity === 'Shared' ? 'PACL' : legalEntity;
    setLpoNumber(DatabaseService.generateLpoNumber(targetEntity));
    setProjectId(projs[0]?.id || '');
    setBudgetId(bdgs[0]?.id || '');
    setSupplierId(suppliers[0]?.id || '');
    setLegalEntity('PACL');
    setLpoDate(new Date().toISOString().split('T')[0]);
    setAmountBeforeVat('100000');
    setHasVat(true);
    setVatAmount(String(Number((100000 * ((settings.vatRatePercent ?? 16) / 100)).toFixed(10))));
    setStatus('Issued');
    setPaymentStatus('Pending');
    setDescription('');
    setRelatedInvoice('');
    setDocFileName('');
    setShowModal(true);
  };

  const handleOpenEdit = (l: LPORecord) => {
    const totalVal = Number(l.totalLpoValue ?? l.totalLpoAmount ?? 0);
    const vatRateDecimal = (settings.vatRatePercent ?? 16) / 100;
    const netVal = Number(
      l.amountBeforeVat ?? l.lpoAmount ?? Number((totalVal / (1 + vatRateDecimal)).toFixed(10))
    );
    const savedVat = Number(l.vatAmount ?? 0);
    setEditingLpo(l);
    setLpoNumber(l.lpoNumber);
    setProjectId(l.projectId || '');
    setBudgetId(l.budgetId || '');
    setSupplierId(l.supplierId);
    setLegalEntity((l.legalEntity as any) || 'PACL');
    setLpoDate(l.lpoDate);
    setAmountBeforeVat(String(netVal));
    setHasVat(savedVat > 0);
    setVatAmount(String(savedVat));
    setStatus(l.status || l.lpoStatus || 'Issued');
    setPaymentStatus(l.paymentStatus === 'Fully Paid' ? 'Paid' : (l.paymentStatus || 'Pending'));
    setDescription(l.description || '');
    setRelatedInvoice(l.relatedInvoice || '');
    setDocFileName(l.documentFileName || '');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const projObj = projs.find((p) => p.id === projectId);
    const bdgObj = bdgs.find((b) => b.id === budgetId);
    const suppObj = suppliers.find((s) => s.id === supplierId);
    const deptObj = depts[0];

    const netVal = Number(amountBeforeVat || 0);
    const vatVal = hasVat ? Number(vatAmount || 0) : 0;
    const totalVal = Number((netVal + vatVal).toFixed(10));

    // Check Budget Availability Warning
    if (budgetId && status !== 'Draft' && status !== 'Cancelled') {
      const commitment = DatabaseService.getBudgetCommitment(budgetId);
      const prevLpoVal = editingLpo ? Number(editingLpo.totalLpoValue ?? editingLpo.totalLpoAmount ?? 0) : 0;
      const netAdditional = editingLpo && editingLpo.budgetId === budgetId ? Math.max(0, totalVal - prevLpoVal) : totalVal;
      if (netAdditional > commitment.availableBudget) {
        const proceed = await confirmDialog({
          title: 'Budget Availability Exceeded',
          message: `Total LPO Value (${settings.currencySymbol} ${totalVal.toLocaleString()}) exceeds Available Budget (${settings.currencySymbol} ${commitment.availableBudget.toLocaleString()}) for ${bdgObj?.code || 'this budget line'}. Do you want to proceed anyway?`,
          confirmLabel: 'Proceed Anyway',
          variant: 'warning',
        });
        if (!proceed) {
          return;
        }
      }
    }

    const recordId = editingLpo ? editingLpo.id : 'lpo-' + Date.now();
    const resolvedDocName =
      docFileName ||
      (editingLpo ? editingLpo.documentFileName : `${legalEntity}_LPO_${lpoNumber.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);

    const recordToSave: LPORecord = {
      id: recordId,
      lpoNumber,
      projectId: projectId || undefined,
      projectName: projObj?.name || undefined,
      budgetId: budgetId || undefined,
      budgetCode: bdgObj?.code || undefined,
      budgetCategory: bdgObj?.category || undefined,
      departmentId: projObj?.departmentId || bdgObj?.departmentId || deptObj?.id || 'dept-mcx',
      departmentName: projObj?.departmentName || bdgObj?.departmentName || deptObj?.name || 'Marketing & Customer Experience',
      legalEntity: legalEntity as any,
      supplierId,
      supplierName: suppObj?.name || 'Selected Vendor',
      lpoDate,
      lpoAmount: netVal,
      amountBeforeVat: netVal,
      vatAmount: vatVal,
      totalLpoValue: totalVal,
      totalLpoAmount: totalVal,
      currency: settings.currencySymbol || 'KES',
      lpoStatus: status,
      status,
      invoiceStatus: (relatedInvoice ? 'Partially Invoiced' : (editingLpo?.invoiceStatus || 'Uninvoiced')) as any,
      paymentStatus,
      description,
      relatedInvoice: relatedInvoice || undefined,
      documentFileName: resolvedDocName,
      createdBy: editingLpo ? editingLpo.createdBy : `${role} User`,
      createdAt: editingLpo ? editingLpo.createdAt : new Date().toISOString(),
    };

    DatabaseService.saveLPO(recordToSave, `${role} User`, role);

    // Automatically register an LPO Document in Document Vault when issuing a new LPO
    if (!editingLpo) {
      const lpoDoc: ERPDocument = {
        id: 'doc-lpo-' + Date.now(),
        docNumber: `DOC-${legalEntity === 'Shared' ? 'PACL' : legalEntity}-LPO-${Math.floor(100 + Math.random() * 900)}`,
        title: `${legalEntity} LPO - ${suppObj?.name || 'Supplier'}${projObj?.name ? ` (${projObj.name})` : ''}`,
        type: 'Local Purchase Order (LPO)',
        category: 'Local Purchase Order (LPO)',
        departmentId: recordToSave.departmentId,
        departmentName: recordToSave.departmentName || 'Marketing & CX',
        legalEntity: legalEntity === 'Shared' ? 'Combined' : (legalEntity as 'PACL' | 'PGIL'),
        projectId: projectId || undefined,
        projectName: projObj?.name || undefined,
        budgetId: budgetId || undefined,
        budgetCode: bdgObj?.code || undefined,
        supplierId: supplierId || undefined,
        supplierName: suppObj?.name || undefined,
        lpoId: recordToSave.id,
        lpoNumber: recordToSave.lpoNumber,
        fileName: resolvedDocName || `${legalEntity}_LPO_Document.pdf`,
        fileSize: '0.2 MB',
        fileType: 'pdf',
        uploadedBy: `${role} User`,
        uploadDate: lpoDate,
        status: 'Approved',
        remarks: `Auto-filed from LPO Management: ${description || lpoNumber}`,
      };
      DatabaseService.saveDocument(lpoDoc, `${role} User`, role);
    }

    showToast(editingLpo ? 'LPO updated successfully.' : 'LPO issued and logged in Document Vault.', 'success');
    onRefresh();
    setShowModal(false);
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirmDialog({
      title: 'Delete LPO Record',
      message: 'Are you sure you want to delete / archive this LPO record?',
      confirmLabel: 'Delete LPO',
      variant: 'danger',
    });
    if (confirmed) {
      DatabaseService.deleteLPO(id, `${role} User`, role);
      onRefresh();
      showToast('LPO record removed.', 'success');
    }
  };

  const handleExportExcel = () => {
    const exportData = filteredLpos.map((l) => ({
      'LPO Number': l.lpoNumber,
      'Date': l.lpoDate,
      'Legal Entity': l.legalEntity,
      'Vendor Name': l.supplierName,
      'Linked Project': l.projectName || 'N/A',
      'Amount Before VAT': Number(l.amountBeforeVat ?? l.lpoAmount ?? 0),
      'VAT Amount': Number(l.vatAmount || 0),
      'Total LPO Amount (KES)': Number(l.totalLpoValue ?? l.totalLpoAmount ?? 0),
      'Status': l.status || l.lpoStatus || 'Issued',
      'Payment Status': l.paymentStatus || 'Pending',
      'Related Invoice': l.relatedInvoice || 'None',
      'Description': l.description,
    }));
    ExcelService.exportCustomDataset(exportData, 'LPO_Registry_Report');
  };

  const handleExportPDF = () => {
    const cols = ['LPO Number', 'Date', 'Entity', 'Vendor', 'Project', 'Amount (Excl VAT)', 'VAT', 'Total (KES)', 'Status'];
    const rows = filteredLpos.map((l) => [
      l.lpoNumber,
      l.lpoDate,
      l.legalEntity,
      l.supplierName,
      l.projectName || 'N/A',
      `${Number(l.amountBeforeVat ?? l.lpoAmount ?? 0).toLocaleString(undefined, { maximumFractionDigits: 10 })}`,
      `${Number(l.vatAmount || 0).toLocaleString(undefined, { maximumFractionDigits: 10 })}`,
      `${Number(l.totalLpoValue ?? l.totalLpoAmount ?? 0).toLocaleString(undefined, { maximumFractionDigits: 10 })} ${settings.currencySymbol}`,
      l.status || l.lpoStatus || 'Issued',
    ]);
    PDFService.generateReportPDF('LOCAL PURCHASE ORDER (LPO) REGISTRY', `Entity: ${selectedEntity} | FY ${settings.financialYear}`, cols, rows, settings);
  };

  return (
    <div className="d-flex flex-column gap-4">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 pb-2 border-bottom">
        <div>
          <div className="d-flex align-items-center gap-2">
            <h3 className="fw-bold mb-0 text-dark" style={{ fontFamily: 'Tahoma, sans-serif' }}>
              Local Purchase Order (LPO) Management &amp; Commitments
            </h3>
            <span className="badge bg-danger text-white px-2 py-1">Procurement</span>
          </div>
          <p className="text-muted small mb-0 mt-1">
            Generate, approve, and track LPOs against Marketing &amp; CX budget lines, with automated vault filing and live commitment checks.
          </p>
        </div>
        <div className="d-flex align-items-center gap-2 flex-wrap">
          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('documents')}
              className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1 shadow-sm"
            >
              <i className="bi bi-folder-fill"></i> Document Vault
            </button>
          )}
          <button id="btn-export-excel-lpo" onClick={handleExportExcel} className="btn btn-outline-success btn-sm d-flex align-items-center gap-1 shadow-sm">
            <i className="bi bi-file-earmark-excel"></i> Export Excel
          </button>
          <button id="btn-export-pdf-lpo" onClick={handleExportPDF} className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1 shadow-sm">
            <i className="bi bi-file-earmark-pdf"></i> Export PDF
          </button>
          {role !== 'Viewer' && (
            <button id="btn-create-lpo" onClick={handleOpenCreate} className="btn btn-danger btn-sm d-flex align-items-center gap-1 shadow-sm">
              <i className="bi bi-plus-circle"></i> Create New LPO
            </button>
          )}
        </div>
      </div>

      {/* Unified LPO Workspace Sub-Tabs */}
      <ul className="nav nav-pills gap-2 bg-white p-2 rounded border shadow-xs">
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link btn-sm py-1.5 px-3 fw-semibold ${activeSubTab === 'register' ? 'active bg-danger text-white' : 'text-dark'}`}
            onClick={() => setActiveSubTab('register')}
          >
            <i className="bi bi-journal-bookmark-fill me-1.5"></i>
            LPO Register ({lpos.length})
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link btn-sm py-1.5 px-3 fw-semibold ${activeSubTab === 'commitments' ? 'active bg-danger text-white' : 'text-dark'}`}
            onClick={() => setActiveSubTab('commitments')}
          >
            <i className="bi bi-pie-chart-fill me-1.5"></i>
            LPO vs Budget Commitments ({bdgs.length})
          </button>
        </li>
      </ul>

      {/* KPI Cards */}
      <div className="row g-3">
        <div className="col-12 col-sm-6 col-xl-3">
          <div
            className="card card-erp p-3 border-start border-4 border-dark h-100 shadow-sm"
            style={{ cursor: onTraceAmount ? 'pointer' : 'default' }}
            onClick={() =>
              onTraceAmount &&
              onTraceAmount({
                metricId: 'committed_lpos',
                metricName: 'Total LPOs Issued',
                reportedAmount: summary.totalAmount,
                filtersSnapshot: { legalEntity: selectedEntity },
              })
            }
          >
            <span className="text-muted small text-uppercase fw-semibold">Total Orders Issued</span>
            <div className="fs-5 fw-bold text-dark mt-1">
              {summary.totalAmount.toLocaleString()} <span className="small text-muted">{settings.currencySymbol}</span>
            </div>
            <span className="text-muted extra-small mt-1">{summary.count} Registered LPOs</span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card card-erp p-3 border-start border-4 border-warning h-100 shadow-sm">
            <span className="text-muted small text-uppercase fw-semibold">Committed (Active LPOs)</span>
            <div className="fs-5 fw-bold text-dark mt-1">
              {summary.approvedAmount.toLocaleString()} <span className="small text-muted">{settings.currencySymbol}</span>
            </div>
            <span className="text-muted extra-small mt-1">Approved & Issued orders</span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card card-erp p-3 border-start border-4 border-success h-100 shadow-sm">
            <span className="text-muted small text-uppercase fw-semibold">Settled / Paid LPOs</span>
            <div className="fs-5 fw-bold text-success mt-1">
              {summary.paidAmount.toLocaleString()} <span className="small text-muted">{settings.currencySymbol}</span>
            </div>
            <span className="text-muted extra-small mt-1">Fully Invoiced & Paid</span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card card-erp p-3 border-start border-4 border-danger h-100 shadow-sm">
            <span className="text-muted small text-uppercase fw-semibold">Pending Approval</span>
            <div className="fs-5 fw-bold text-danger mt-1">
              {summary.pendingCount} <span className="small text-muted">Orders</span>
            </div>
            <span className="text-muted extra-small mt-1">Awaiting management signoff</span>
          </div>
        </div>
      </div>

      {activeSubTab === 'register' && (
        <>
          {/* Filter Bar */}
      <div className="card card-erp p-3 shadow-sm">
        <div className="row g-2 align-items-center">
          <div className="col-12 col-md-4">
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-light text-muted border-end-0">
                <i className="bi bi-search"></i>
              </span>
              <input
                id="input-search-lpos"
                type="text"
                className="form-control form-control-sm border-start-0"
                placeholder="Search LPO number, vendor, project..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="col-6 col-md-2">
            <select
              id="select-lpo-entity"
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

          <div className="col-6 col-md-3">
            <select
              id="select-lpo-vendor"
              className="form-select form-select-sm"
              value={selectedVendor}
              onChange={(e) => setSelectedVendor(e.target.value)}
            >
              <option value="">All Suppliers / Vendors</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="col-6 col-md-2">
            <select
              id="select-lpo-status"
              className="form-select form-select-sm"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Submitted">Submitted</option>
              <option value="Approved">Approved</option>
              <option value="Issued">Issued</option>
              <option value="Partially Utilized">Partially Utilized</option>
              <option value="Fully Utilized">Fully Utilized</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <div className="col-6 col-md-1 text-end">
            <button
              id="btn-reset-lpo-filters"
              onClick={() => {
                setSearch('');
                setSelectedEntity('All');
                setSelectedVendor('');
                setSelectedStatus('');
              }}
              className="btn btn-outline-secondary btn-sm w-100"
              title="Reset Filters"
            >
              <i className="bi bi-arrow-counterclockwise"></i>
            </button>
          </div>
        </div>
      </div>

      {/* LPO Table */}
      <div className="card card-erp shadow-sm overflow-hidden">
        <div className="card-header bg-white py-3 px-4 d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-2">
            <h6 className="mb-0 fw-bold text-dark">Local Purchase Order (LPO) Register</h6>
            <span className="badge bg-light text-dark border">
              {filteredLpos.length} Records
            </span>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0 erp-table">
            <thead className="table-light">
              <tr className="small text-uppercase text-muted">
                <th style={{ width: '140px' }}>LPO Number</th>
                <th>Date</th>
                <th>Entity</th>
                <th>Supplier / Vendor</th>
                <th>Linked Project</th>
                <th className="text-end">Excl. VAT</th>
                <th className="text-end">VAT (16%)</th>
                <th className="text-end">Total Amount</th>
                <th>LPO Status</th>
                <th>Payment</th>
                <th>Related Inv</th>
                <th className="text-center" style={{ width: '80px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLpos.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-5 text-muted">
                    <i className="bi bi-file-earmark-spreadsheet fs-2 d-block mb-2 text-secondary opacity-50"></i>
                    No LPOs found matching the criteria.
                    {role !== 'Viewer' && (
                      <div className="mt-2">
                        <button onClick={handleOpenCreate} className="btn btn-sm btn-danger">
                          Issue New LPO
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filteredLpos.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <button
                        type="button"
                        className="btn btn-link p-0 text-decoration-none fw-bold text-primary font-monospace text-start"
                        title="Click to drill down into transaction trace"
                        onClick={() =>
                          onDrillDown &&
                          onDrillDown({
                            type: 'transaction',
                            id: l.lpoNumber,
                            recordType: 'LPO',
                          })
                        }
                      >
                        {l.lpoNumber}
                      </button>
                    </td>
                    <td className="small text-muted">{l.lpoDate}</td>
                    <td>
                      <span
                        className={`badge ${
                          l.legalEntity === 'PACL'
                            ? 'bg-dark text-white'
                            : l.legalEntity === 'PGIL'
                            ? 'bg-danger text-white'
                            : 'bg-primary text-white'
                        }`}
                      >
                        {l.legalEntity}
                      </span>
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
                            id: l.supplierId || l.supplierName,
                          })
                        }
                      >
                        {l.supplierName}
                      </button>
                      {l.description && <div className="extra-small text-muted text-truncate" style={{ maxWidth: '180px' }}>{l.description}</div>}
                    </td>
                    <td>
                      {l.projectName ? (
                        <span className="badge bg-light text-dark border">{l.projectName}</span>
                      ) : (
                        <span className="text-muted small">Direct Requisition</span>
                      )}
                    </td>
                    <td className="text-end text-muted small">
                      {Number(l.amountBeforeVat ?? l.lpoAmount ?? 0).toLocaleString(undefined, { maximumFractionDigits: 10 })}
                    </td>
                    <td className="text-end text-muted small">
                      {Number(l.vatAmount || 0).toLocaleString(undefined, { maximumFractionDigits: 10 })}
                    </td>
                    <td className="text-end fw-bold text-dark font-monospace">
                      {Number(l.totalLpoValue ?? l.totalLpoAmount ?? 0).toLocaleString(undefined, { maximumFractionDigits: 10 })} <span className="extra-small text-muted">{settings.currencySymbol}</span>
                    </td>
                    <td>
                      {(() => {
                        const s = l.status || l.lpoStatus || 'Issued';
                        return (
                          <span
                            className={`badge ${
                              s === 'Issued' || s === 'Approved'
                                ? 'bg-success-subtle text-success border border-success'
                                : s === 'Draft' || s === 'Submitted'
                                ? 'bg-warning-subtle text-warning border border-warning'
                                : s === 'Cancelled'
                                ? 'bg-danger text-white'
                                : 'bg-light text-dark border'
                            }`}
                          >
                            {s}
                          </span>
                        );
                      })()}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          l.paymentStatus === 'Paid' || l.paymentStatus === 'Fully Paid'
                            ? 'bg-success text-white'
                            : l.paymentStatus === 'Partially Paid'
                            ? 'bg-info text-white'
                            : 'bg-secondary-subtle text-secondary border'
                        }`}
                      >
                        {l.paymentStatus || 'Pending'}
                      </span>
                    </td>
                    <td>
                      {l.relatedInvoice ? (
                        <button
                          type="button"
                          className="btn btn-link p-0 text-decoration-none badge bg-light text-primary border"
                          title="Trace Invoice"
                          onClick={() =>
                            onDrillDown &&
                            onDrillDown({
                              type: 'transaction',
                              id: l.relatedInvoice,
                              recordType: 'Invoice',
                            })
                          }
                        >
                          {l.relatedInvoice}
                        </button>
                      ) : (
                        <span className="text-muted extra-small">Unbilled</span>
                      )}
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
                              id: l.lpoNumber,
                              recordType: 'LPO',
                            })
                          }
                        >
                          <i className="bi bi-search"></i>
                        </button>
                        {role !== 'Viewer' && (
                          <button
                            id={`btn-edit-lpo-${l.id}`}
                            onClick={() => handleOpenEdit(l)}
                            className="btn btn-outline-secondary btn-sm p-1"
                            title="Edit LPO"
                          >
                            <i className="bi bi-pencil"></i>
                          </button>
                        )}
                        {role === 'Administrator' && (
                          <button
                            id={`btn-delete-lpo-${l.id}`}
                            onClick={() => handleDelete(l.id)}
                            className="btn btn-outline-danger btn-sm p-1"
                            title="Delete LPO"
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
            {filteredLpos.length > 0 && (
              <tfoot className="table-light fw-bold">
                <tr>
                  <td colSpan={7} className="text-uppercase small">Total Filtered LPOs</td>
                  <td className="text-end">{summary.totalAmount.toLocaleString()} {settings.currencySymbol}</td>
                  <td colSpan={4}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
        </>
      )}

      {/* SUB-TAB 2: LPO vs BUDGET COMMITMENTS */}
      {activeSubTab === 'commitments' && (
        <div className="d-flex flex-column gap-3">
          <div className="alert alert-info border-start border-4 border-info p-3 mb-0" role="alert">
            <h4 className="h6 fw-bold mb-1 d-flex align-items-center gap-1.5">
              <i className="bi bi-info-circle-fill"></i> Financial Commitment &amp; Availability Calculator
            </h4>
            <p className="fs-7 mb-0">
              Breakdown of Allocated Budget, Active Committed LPOs (unpaid purchase orders), Actual Expenditures, and Available Remaining Balance across PACL &amp; PGIL.
            </p>
          </div>

          <div className="row g-3">
            {bdgs.length === 0 ? (
              <div className="col-12">
                <div className="card card-erp p-5 text-center text-muted">
                  No budget lines defined yet. Add budget allocations first to monitor LPO commitment utilization.
                </div>
              </div>
            ) : (
              bdgs.map((b) => {
                const commitment = DatabaseService.getBudgetCommitment(b.id);
                const totalUtilized = commitment.committedAmount + commitment.actualSpend;
                const percentUtilized = Math.min(100, Math.round((totalUtilized / (b.allocatedAmount || 1)) * 100));

                return (
                  <div key={b.id} className="col-12 col-md-6 col-xl-4">
                    <div className="card card-erp p-3 h-100 shadow-sm border-0">
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <span
                          className={`badge ${
                            b.legalEntity === 'PACL' ? 'bg-danger text-white' : b.legalEntity === 'PGIL' ? 'bg-primary text-white' : 'bg-dark text-white'
                          } font-mono`}
                        >
                          {b.legalEntity}
                        </span>
                        <button
                          type="button"
                          className="btn btn-link p-0 text-decoration-none text-muted font-mono fs-8 fw-bold"
                          title="Inspect Budget Line 360"
                          onClick={() =>
                            onDrillDown &&
                            onDrillDown({
                              type: 'budget_line',
                              id: b.code,
                            })
                          }
                        >
                          {b.code}
                        </button>
                      </div>

                      <h4 className="h6 fw-bold text-dark mb-1">{b.category}</h4>
                      <p className="fs-8 text-muted mb-3 font-mono">{b.description || b.category}</p>

                      <div className="p-2.5 rounded bg-light border mb-3 font-mono fs-8">
                        <div className="d-flex justify-content-between mb-1">
                          <span className="text-muted">Allocated Budget:</span>
                          <strong className="text-dark">
                            {settings.currencySymbol} {Number(b.allocatedAmount || 0).toLocaleString()}
                          </strong>
                        </div>
                        <div className="d-flex justify-content-between mb-1">
                          <span className="text-muted">Committed LPOs:</span>
                          <strong className="text-primary">
                            {settings.currencySymbol} {commitment.committedAmount.toLocaleString()}
                          </strong>
                        </div>
                        <div className="d-flex justify-content-between mb-1">
                          <span className="text-muted">Actual Spent:</span>
                          <strong className="text-danger">
                            {settings.currencySymbol} {commitment.actualSpend.toLocaleString()}
                          </strong>
                        </div>
                        <hr className="my-1.5" />
                        <div className="d-flex justify-content-between fw-bold">
                          <span className="text-dark">Available Balance:</span>
                          <span className={commitment.availableBudget > 0 ? 'text-success' : 'text-danger'}>
                            {settings.currencySymbol} {commitment.availableBudget.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div>
                        <div className="d-flex justify-content-between fs-8 font-mono mb-1">
                          <span>Total Utilization (LPOs + Spend):</span>
                          <strong>{percentUtilized}%</strong>
                        </div>
                        <div className="progress" style={{ height: '8px' }}>
                          <div
                            className={`progress-bar ${percentUtilized >= 90 ? 'bg-danger' : percentUtilized >= 75 ? 'bg-warning' : 'bg-success'}`}
                            style={{ width: `${percentUtilized}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content shadow-lg border-0">
              <div className="modal-header bg-danger text-white">
                <h5 className="modal-title fw-bold">
                  {editingLpo ? 'Edit Local Purchase Order' : 'Create Local Purchase Order (LPO)'}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowModal(false)}></button>
              </div>
              <form onSubmit={handleSave}>
                <div className="modal-body p-4">
                  <div className="row g-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-semibold">LPO Number *</label>
                      <input
                        type="text"
                        className="form-control"
                        required
                        value={lpoNumber}
                        onChange={(e) => setLpoNumber(e.target.value)}
                        placeholder="e.g. LPO-2026-PACL-001"
                      />
                    </div>

                    <div className="col-12 col-md-3">
                      <label className="form-label small fw-semibold">LPO Date *</label>
                      <input
                        type="date"
                        className="form-control"
                        required
                        value={lpoDate}
                        onChange={(e) => setLpoDate(e.target.value)}
                      />
                    </div>

                    <div className="col-12 col-md-3">
                      <label className="form-label small fw-semibold">Legal Entity *</label>
                      <select
                        className="form-select"
                        value={legalEntity}
                        onChange={(e) => setLegalEntity(e.target.value as any)}
                        required
                      >
                        <option value="PACL">PACL (Pioneer Assurance)</option>
                        <option value="PGIL">PGIL (Pioneer General)</option>
                        <option value="Shared">Shared Projects</option>
                      </select>
                    </div>

                    <div className="col-12 col-md-4">
                      <label className="form-label small fw-semibold">Supplier / Vendor *</label>
                      <select
                        className="form-select"
                        value={supplierId}
                        onChange={(e) => setSupplierId(e.target.value)}
                        required
                      >
                        <option value="">-- Select Registered Vendor --</option>
                        {suppliers.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.category || 'Vendor'})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-12 col-md-4">
                      <label className="form-label small fw-semibold">Linked Project</label>
                      <select
                        className="form-select"
                        value={projectId}
                        onChange={(e) => setProjectId(e.target.value)}
                      >
                        <option value="">-- Direct / General Expenditure --</option>
                        {projs.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.code} - {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-12 col-md-4">
                      <label className="form-label small fw-semibold">Linked Budget Code</label>
                      <select
                        className="form-select"
                        value={budgetId}
                        onChange={(e) => setBudgetId(e.target.value)}
                      >
                        <option value="">-- Optional: Select Budget Line --</option>
                        {bdgs.map((b) => (
                          <option key={b.id} value={b.id}>
                            [{b.legalEntity}] {b.code} - {b.category}
                          </option>
                        ))}
                      </select>
                      {budgetId && (() => {
                        const c = DatabaseService.getBudgetCommitment(budgetId);
                        return (
                          <div className={`extra-small mt-1 fw-semibold ${c.availableBudget <= 0 ? 'text-danger' : 'text-success'}`}>
                            Available Balance: {settings.currencySymbol} {c.availableBudget.toLocaleString()}
                          </div>
                        );
                      })()}
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
                            id="checkVatLpo"
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
                          <label className="form-check-label extra-small fw-normal" htmlFor="checkVatLpo">
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
                      <label className="form-label small fw-semibold">Calculated Total</label>
                      <div className="form-control bg-light fw-bold text-dark font-monospace">
                        {Number((Number(amountBeforeVat || 0) + (hasVat ? Number(vatAmount || 0) : 0)).toFixed(10)).toLocaleString(
                          undefined,
                          { maximumFractionDigits: 10 }
                        )}{' '}
                        {settings.currencySymbol}
                      </div>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-semibold">LPO Status *</label>
                      <select
                        className="form-select"
                        value={status}
                        onChange={(e) => setStatus(e.target.value as any)}
                        required
                      >
                        <option value="Draft">Draft</option>
                        <option value="Submitted">Submitted for Review</option>
                        <option value="Approved">Approved</option>
                        <option value="Issued">Issued to Vendor</option>
                        <option value="Partially Utilized">Partially Utilized</option>
                        <option value="Fully Utilized">Fully Utilized</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-semibold">Payment Status</label>
                      <select
                        className="form-select"
                        value={paymentStatus}
                        onChange={(e) => setPaymentStatus(e.target.value as any)}
                      >
                        <option value="Pending">Pending Invoice / Payment</option>
                        <option value="Partially Paid">Partially Paid</option>
                        <option value="Paid">Fully Settled</option>
                      </select>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-semibold">Related Invoice No. (Optional)</label>
                      <input
                        type="text"
                        className="form-control"
                        value={relatedInvoice}
                        onChange={(e) => setRelatedInvoice(e.target.value)}
                        placeholder="e.g. INV-2026-904"
                      />
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-semibold">Supporting Document Attachment</label>
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

                    <div className="col-12">
                      <label className="form-label small fw-semibold">Order Description / Deliverables</label>
                      <textarea
                        className="form-control"
                        rows={2}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Specification of goods, services, campaign collateral, or media placement..."
                      ></textarea>
                    </div>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-danger px-4">
                    {editingLpo ? 'Update LPO' : 'Issue LPO'}
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
