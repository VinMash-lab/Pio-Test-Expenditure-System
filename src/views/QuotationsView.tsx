import React, { useState, useMemo } from 'react';
import { DatabaseService } from '../services/db';
import { ExcelService } from '../services/excelService';
import { PDFService } from '../services/pdfService';
import { confirmDialog, showToast } from '../services/uiFeedback';
import { QuotationRecord, RoleType, LPORecord } from '../types';

interface QuotationsViewProps {
  role: RoleType;
  onRefresh: () => void;
}

export const QuotationsView: React.FC<QuotationsViewProps> = ({ role, onRefresh }) => {
  const quotations = DatabaseService.getQuotations();
  const projs = DatabaseService.getProjects();
  const suppliers = DatabaseService.getSuppliers();
  const settings = DatabaseService.getSettings();

  const [search, setSearch] = useState('');
  const [selectedEntity, setSelectedEntity] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState<QuotationRecord | null>(null);

  // Form Fields
  const [quotationNumber, setQuotationNumber] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [legalEntity, setLegalEntity] = useState<'PACL' | 'PGIL' | 'Shared'>('PACL');
  const [quotationDate, setQuotationDate] = useState(new Date().toISOString().split('T')[0]);
  const [validUntil, setValidUntil] = useState('');
  const [amountBeforeVat, setAmountBeforeVat] = useState<string>('50000');
  const [hasVat, setHasVat] = useState<boolean>(true);
  const [vatAmount, setVatAmount] = useState<string>(
    String(Number((50000 * ((settings.vatRatePercent ?? 16) / 100)).toFixed(10)))
  );
  const [status, setStatus] = useState<QuotationRecord['status']>('Received');
  const [description, setDescription] = useState('');
  const [docFileName, setDocFileName] = useState('');

  // Filtered List
  const filteredQuotations = useMemo(() => {
    return quotations.filter((q) => {
      if (selectedEntity !== 'All' && q.legalEntity !== selectedEntity) return false;
      if (selectedStatus && q.status !== selectedStatus) return false;
      if (search) {
        const query = search.toLowerCase();
        if (
          !(q.quotationNumber || '').toLowerCase().includes(query) &&
          !(q.vendorName || '').toLowerCase().includes(query) &&
          !(q.projectName || '').toLowerCase().includes(query) &&
          !(q.description || '').toLowerCase().includes(query)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [quotations, selectedEntity, selectedStatus, search]);

  // Summary Metrics
  const summary = useMemo(() => {
    const totalAmount = filteredQuotations.reduce((sum, q) => sum + Number(q.totalAmount || 0), 0);
    const approvedCount = filteredQuotations.filter((q) => q.status === 'Approved' || q.status === 'Converted to LPO').length;
    const underReviewCount = filteredQuotations.filter((q) => q.status === 'Under Review' || q.status === 'Received').length;

    return {
      totalAmount,
      approvedCount,
      underReviewCount,
      count: filteredQuotations.length,
    };
  }, [filteredQuotations]);

  const handleOpenCreate = () => {
    setEditingQuotation(null);
    setQuotationNumber(`QT-2026-${Math.floor(100 + Math.random() * 900)}`);
    setVendorId(suppliers[0]?.id || '');
    setProjectId(projs[0]?.id || '');
    setLegalEntity('PACL');
    setQuotationDate(new Date().toISOString().split('T')[0]);
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
    setValidUntil(thirtyDaysLater.toISOString().split('T')[0]);
    setAmountBeforeVat('50000');
    setHasVat(true);
    setVatAmount(String(Number((50000 * ((settings.vatRatePercent ?? 16) / 100)).toFixed(10))));
    setStatus('Received');
    setDescription('');
    setDocFileName('');
    setShowModal(true);
  };

  const handleOpenEdit = (q: QuotationRecord) => {
    setEditingQuotation(q);
    setQuotationNumber(q.quotationNumber);
    setVendorId(q.vendorId);
    setProjectId(q.projectId || '');
    setLegalEntity(q.legalEntity);
    setQuotationDate(q.quotationDate);
    setValidUntil(q.validUntil || '');
    setAmountBeforeVat(String(Number(q.amountBeforeVat || 0)));
    setHasVat(Number(q.vatAmount || 0) > 0);
    setVatAmount(String(Number(q.vatAmount || 0)));
    setStatus(q.status);
    setDescription(q.description || '');
    setDocFileName(q.documentFileName || '');
    setShowModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const vendorObj = suppliers.find((s) => s.id === vendorId);
    const projObj = projs.find((p) => p.id === projectId);

    const netVal = Number(amountBeforeVat || 0);
    const vatVal = hasVat ? Number(vatAmount || 0) : 0;
    const totalVal = Number((netVal + vatVal).toFixed(10));

    const recordToSave: QuotationRecord = {
      id: editingQuotation ? editingQuotation.id : 'qt-' + Date.now(),
      quotationNumber,
      vendorId,
      vendorName: vendorObj?.name || 'Selected Vendor',
      projectId: projectId || undefined,
      projectName: projObj?.name || undefined,
      legalEntity,
      quotationDate,
      validUntil: validUntil || undefined,
      amountBeforeVat: netVal,
      vatAmount: vatVal,
      totalAmount: totalVal,
      currency: settings.currencySymbol || 'KES',
      status,
      description,
      documentFileName: docFileName || (editingQuotation ? editingQuotation.documentFileName : undefined),
      createdBy: editingQuotation ? editingQuotation.createdBy : `${role} User`,
      createdAt: editingQuotation ? editingQuotation.createdAt : new Date().toISOString(),
    };

    DatabaseService.saveQuotation(recordToSave, `${role} User`, role);
    onRefresh();
    setShowModal(false);
  };

  const handleConvertToLPO = async (q: QuotationRecord) => {
    const confirmed = await confirmDialog({
      title: 'Convert Quotation to LPO',
      message: `Convert quotation ${q.quotationNumber} from ${q.vendorName} into a formal LPO?`,
      confirmLabel: 'Convert to LPO',
      variant: 'primary',
    });
    if (confirmed) {
      const targetEntity = q.legalEntity === 'Shared' ? 'PACL' : q.legalEntity;
      const newLpoNumber = DatabaseService.generateLpoNumber(targetEntity);

      const newLpo: LPORecord = {
        id: 'lpo-' + Date.now(),
        lpoNumber: newLpoNumber,
        projectId: q.projectId,
        projectName: q.projectName,
        departmentId: 'dept-mcx',
        departmentName: 'Marketing & Customer Experience',
        legalEntity: q.legalEntity as any,
        supplierId: q.vendorId,
        supplierName: q.vendorName,
        lpoDate: new Date().toISOString().split('T')[0],
        lpoAmount: Number(q.amountBeforeVat || 0),
        amountBeforeVat: Number(q.amountBeforeVat || 0),
        vatAmount: Number(q.vatAmount || 0),
        totalLpoValue: Number(q.totalAmount || 0),
        totalLpoAmount: Number(q.totalAmount || 0),
        currency: q.currency,
        lpoStatus: 'Issued',
        status: 'Issued',
        invoiceStatus: 'Uninvoiced',
        paymentStatus: 'Unpaid',
        description: `Generated from Quotation ${q.quotationNumber}. ${q.description || ''}`,
        createdBy: `${role} User`,
        createdAt: new Date().toISOString(),
      };

      DatabaseService.saveLPO(newLpo, `${role} User`, role);

      // Update quotation status
      DatabaseService.saveQuotation({ ...q, status: 'Converted to LPO' }, `${role} User`, role);
      onRefresh();
      showToast(`LPO ${newLpoNumber} created successfully! View it in LPO Management.`, 'success');
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirmDialog({
      title: 'Delete Quotation',
      message: 'Are you sure you want to delete this quotation?',
      confirmLabel: 'Delete Quotation',
      variant: 'danger',
    });
    if (confirmed) {
      DatabaseService.deleteQuotation(id, `${role} User`, role);
      onRefresh();
      showToast('Quotation deleted.', 'success');
    }
  };

  const handleExportExcel = () => {
    const exportData = filteredQuotations.map((q) => ({
      'Quotation No': q.quotationNumber,
      'Vendor Name': q.vendorName,
      'Project': q.projectName || 'N/A',
      'Entity': q.legalEntity,
      'Quotation Date': q.quotationDate,
      'Valid Until': q.validUntil || 'N/A',
      'Amount Excl VAT': q.amountBeforeVat,
      'VAT Amount': q.vatAmount,
      'Total Amount (KES)': q.totalAmount,
      'Status': q.status,
      'Description': q.description,
    }));
    ExcelService.exportCustomDataset(exportData, 'Quotations_Register_Report');
  };

  const handleExportPDF = () => {
    const cols = ['Quotation No', 'Vendor', 'Project', 'Entity', 'Date', 'Valid Until', 'Total Amount', 'Status'];
    const rows = filteredQuotations.map((q) => [
      q.quotationNumber,
      q.vendorName,
      q.projectName || 'N/A',
      q.legalEntity,
      q.quotationDate,
      q.validUntil || 'N/A',
      `${Number(q.totalAmount || 0).toLocaleString()} ${settings.currencySymbol}`,
      q.status,
    ]);
    PDFService.generateReportPDF('VENDOR QUOTATIONS & PROPOSALS REGISTER', `Entity: ${selectedEntity} | FY ${settings.financialYear}`, cols, rows, settings);
  };

  return (
    <div className="d-flex flex-column gap-4">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 pb-2 border-bottom">
        <div>
          <div className="d-flex align-items-center gap-2">
            <h3 className="fw-bold mb-0 text-dark" style={{ fontFamily: 'Tahoma, sans-serif' }}>
              Quotations & Cost Estimates
            </h3>
            <span className="badge bg-danger text-white px-2 py-1">Procurement Proposals</span>
          </div>
          <p className="text-muted small mb-0 mt-1">
            Maintain supplier quotations, competitive pricing comparisons, and fast conversion to Local Purchase Orders (LPOs).
          </p>
        </div>
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <button id="btn-export-excel-quotations" onClick={handleExportExcel} className="btn btn-outline-success btn-sm d-flex align-items-center gap-1 shadow-sm">
            <i className="bi bi-file-earmark-excel"></i> Export Excel
          </button>
          <button id="btn-export-pdf-quotations" onClick={handleExportPDF} className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1 shadow-sm">
            <i className="bi bi-file-earmark-pdf"></i> Export PDF
          </button>
          {role !== 'Viewer' && (
            <button id="btn-create-quotation" onClick={handleOpenCreate} className="btn btn-danger btn-sm d-flex align-items-center gap-1 shadow-sm">
              <i className="bi bi-plus-circle"></i> Log Quotation
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="row g-3">
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card card-erp p-3 border-start border-4 border-dark h-100 shadow-sm">
            <span className="text-muted small text-uppercase fw-semibold">Total Proposals</span>
            <div className="fs-5 fw-bold text-dark mt-1">
              {summary.totalAmount.toLocaleString()} <span className="small text-muted">{settings.currencySymbol}</span>
            </div>
            <span className="text-muted extra-small mt-1">{summary.count} Registered Quotes</span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card card-erp p-3 border-start border-4 border-warning h-100 shadow-sm">
            <span className="text-muted small text-uppercase fw-semibold">Under Review / Sourcing</span>
            <div className="fs-5 fw-bold text-dark mt-1">
              {summary.underReviewCount} <span className="small text-muted">Proposals</span>
            </div>
            <span className="text-muted extra-small mt-1">Evaluating vendor quotes</span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card card-erp p-3 border-start border-4 border-success h-100 shadow-sm">
            <span className="text-muted small text-uppercase fw-semibold">Approved / LPO Converted</span>
            <div className="fs-5 fw-bold text-success mt-1">
              {summary.approvedCount} <span className="small text-muted">Quotes</span>
            </div>
            <span className="text-muted extra-small mt-1">Authorized for procurement</span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card card-erp p-3 border-start border-4 border-primary h-100 shadow-sm">
            <span className="text-muted small text-uppercase fw-semibold">Standard VAT Rate</span>
            <div className="fs-5 fw-bold text-primary mt-1">
              {settings.vatRatePercent || 16}%
            </div>
            <span className="text-muted extra-small mt-1">Automatically computed</span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card card-erp p-3 shadow-sm">
        <div className="row g-2 align-items-center">
          <div className="col-12 col-md-6">
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-light text-muted border-end-0">
                <i className="bi bi-search"></i>
              </span>
              <input
                id="input-search-quotes"
                type="text"
                className="form-control form-control-sm border-start-0"
                placeholder="Search quotation number, vendor, project..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="col-6 col-md-3">
            <select
              id="select-quote-entity"
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
              id="select-quote-status"
              className="form-select form-select-sm"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="Received">Received</option>
              <option value="Under Review">Under Review</option>
              <option value="Approved">Approved</option>
              <option value="Converted to LPO">Converted to LPO</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Quotations Table */}
      <div className="card card-erp shadow-sm overflow-hidden">
        <div className="card-header bg-white py-3 px-4 d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-2">
            <h6 className="mb-0 fw-bold text-dark">Supplier Quotations Ledger</h6>
            <span className="badge bg-light text-dark border">
              {filteredQuotations.length} Records
            </span>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0 erp-table">
            <thead className="table-light">
              <tr className="small text-uppercase text-muted">
                <th style={{ width: '130px' }}>Quote No.</th>
                <th>Supplier / Vendor</th>
                <th>Entity</th>
                <th>Project Focus</th>
                <th>Date Received</th>
                <th>Valid Until</th>
                <th className="text-end">Excl. VAT</th>
                <th className="text-end">VAT (16%)</th>
                <th className="text-end">Total Amount</th>
                <th>Status</th>
                <th className="text-center" style={{ width: '120px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuotations.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-5 text-muted">
                    <i className="bi bi-receipt fs-2 d-block mb-2 text-secondary opacity-50"></i>
                    No quotations registered matching your search criteria.
                  </td>
                </tr>
              ) : (
                filteredQuotations.map((q) => (
                  <tr key={q.id}>
                    <td>
                      <span className="fw-bold text-dark">{q.quotationNumber}</span>
                    </td>
                    <td>
                      <div className="fw-semibold text-dark">{q.vendorName}</div>
                      {q.description && <div className="extra-small text-muted text-truncate" style={{ maxWidth: '200px' }}>{q.description}</div>}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          q.legalEntity === 'PACL'
                            ? 'bg-dark text-white'
                            : q.legalEntity === 'PGIL'
                            ? 'bg-danger text-white'
                            : 'bg-primary text-white'
                        }`}
                      >
                        {q.legalEntity}
                      </span>
                    </td>
                    <td>
                      {q.projectName ? (
                        <span className="badge bg-light text-dark border">{q.projectName}</span>
                      ) : (
                        <span className="text-muted small">Departmental</span>
                      )}
                    </td>
                    <td className="small text-muted">{q.quotationDate}</td>
                    <td className="small text-muted">{q.validUntil || 'N/A'}</td>
                    <td className="text-end text-muted small">
                      {Number(q.amountBeforeVat || 0).toLocaleString(undefined, { maximumFractionDigits: 10 })}
                    </td>
                    <td className="text-end text-muted small">
                      {Number(q.vatAmount || 0).toLocaleString(undefined, { maximumFractionDigits: 10 })}
                    </td>
                    <td className="text-end fw-bold text-dark font-monospace">
                      {Number(q.totalAmount || 0).toLocaleString(undefined, { maximumFractionDigits: 10 })} <span className="extra-small text-muted">{settings.currencySymbol}</span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          q.status === 'Converted to LPO'
                            ? 'bg-primary text-white'
                            : q.status === 'Approved'
                            ? 'bg-success-subtle text-success border border-success'
                            : q.status === 'Under Review' || q.status === 'Received'
                            ? 'bg-warning-subtle text-warning border border-warning'
                            : 'bg-secondary text-white'
                        }`}
                      >
                        {q.status}
                      </span>
                    </td>
                    <td className="text-center">
                      <div className="btn-group btn-group-sm">
                        {role !== 'Viewer' && q.status !== 'Converted to LPO' && (
                          <button
                            id={`btn-convert-quote-${q.id}`}
                            onClick={() => handleConvertToLPO(q)}
                            className="btn btn-outline-success btn-sm p-1"
                            title="Convert Quotation to LPO"
                          >
                            <i className="bi bi-cart-check"></i>
                          </button>
                        )}
                        {role !== 'Viewer' && (
                          <button
                            id={`btn-edit-quote-${q.id}`}
                            onClick={() => handleOpenEdit(q)}
                            className="btn btn-outline-secondary btn-sm p-1"
                            title="Edit Quotation"
                          >
                            <i className="bi bi-pencil"></i>
                          </button>
                        )}
                        {role === 'Administrator' && (
                          <button
                            id={`btn-delete-quote-${q.id}`}
                            onClick={() => handleDelete(q.id)}
                            className="btn btn-outline-danger btn-sm p-1"
                            title="Delete Quotation"
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
                  {editingQuotation ? 'Edit Quotation Details' : 'Log Vendor Quotation'}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowModal(false)}></button>
              </div>
              <form onSubmit={handleSave}>
                <div className="modal-body p-4">
                  <div className="row g-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-semibold">Quotation Number *</label>
                      <input
                        type="text"
                        className="form-control"
                        required
                        value={quotationNumber}
                        onChange={(e) => setQuotationNumber(e.target.value)}
                        placeholder="e.g. QT-2026-001"
                      />
                    </div>

                    <div className="col-12 col-md-3">
                      <label className="form-label small fw-semibold">Quote Date *</label>
                      <input
                        type="date"
                        className="form-control"
                        required
                        value={quotationDate}
                        onChange={(e) => setQuotationDate(e.target.value)}
                      />
                    </div>

                    <div className="col-12 col-md-3">
                      <label className="form-label small fw-semibold">Valid Until</label>
                      <input
                        type="date"
                        className="form-control"
                        value={validUntil}
                        onChange={(e) => setValidUntil(e.target.value)}
                      />
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-semibold">Vendor / Supplier *</label>
                      <select
                        className="form-select"
                        value={vendorId}
                        onChange={(e) => setVendorId(e.target.value)}
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
                        <option value="">-- None --</option>
                        {projs.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.code} - {p.name}
                          </option>
                        ))}
                      </select>
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
                            id="checkVatQt"
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
                          <label className="form-check-label extra-small fw-normal" htmlFor="checkVatQt">
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
                      <label className="form-label small fw-semibold">Total Quoted Amount</label>
                      <div className="form-control bg-light fw-bold text-dark font-monospace">
                        {Number((Number(amountBeforeVat || 0) + (hasVat ? Number(vatAmount || 0) : 0)).toFixed(10)).toLocaleString(
                          undefined,
                          { maximumFractionDigits: 10 }
                        )}{' '}
                        {settings.currencySymbol}
                      </div>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-semibold">Status *</label>
                      <select
                        className="form-select"
                        value={status}
                        onChange={(e) => setStatus(e.target.value as any)}
                        required
                      >
                        <option value="Received">Received</option>
                        <option value="Under Review">Under Review</option>
                        <option value="Approved">Approved</option>
                        <option value="Converted to LPO">Converted to LPO</option>
                        <option value="Rejected">Rejected</option>
                      </select>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-semibold">Supporting Quotation Document</label>
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
                      <label className="form-label small fw-semibold">Scope / Quotation Details</label>
                      <textarea
                        className="form-control"
                        rows={2}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Deliverables, turnaround timelines, payment terms, or unit breakdowns..."
                      ></textarea>
                    </div>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-danger px-4">
                    {editingQuotation ? 'Update Quotation' : 'Save Quotation'}
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
