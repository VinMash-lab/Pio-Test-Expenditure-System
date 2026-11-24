import React, { useState } from 'react';
import { DatabaseService } from '../services/db';
import {
  ERPDocument,
  RoleType,
  DocumentType,
  LegalEntityType,
} from '../types';
import { confirmDialog, showToast } from '../services/uiFeedback';

interface DocumentsViewProps {
  role: RoleType;
  onRefresh: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const DocumentsView: React.FC<DocumentsViewProps> = ({ role, onRefresh, onNavigateTab }) => {
  const docs = DatabaseService.getDocuments();
  const lpos = DatabaseService.getLPOs();
  const depts = DatabaseService.getDepartments();
  const projs = DatabaseService.getProjects();
  const bdgs = DatabaseService.getBudgets();
  const exps = DatabaseService.getExpenditures();
  const sups = DatabaseService.getSuppliers();
  const settings = DatabaseService.getSettings();

  // Filters for Vault
  const [search, setSearch] = useState('');
  const [filterEntity, setFilterEntity] = useState<string>('All');
  const [filterType, setFilterType] = useState<string>('');
  const [filterProj, setFilterProj] = useState<string>('');
  const [filterSupplier, setFilterSupplier] = useState<string>('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Categories list from settings or defaults
  const docCategories: string[] = settings.documentCategories || [
    'Local Purchase Order (LPO)',
    'Purchase Requisition',
    'Invoice',
    'Quotation',
    'Contract',
    'Agreement',
    'Delivery Note',
    'Receipt',
    'Payment Voucher',
    'Approval Document',
    'Purchase Order',
    'Memo',
    'Event Document',
    'Sponsorship Agreement',
    'Supplier Document',
    'Project Brief',
    'Campaign Document',
    'Report',
    'Other Supporting Document',
  ];

  // Modal States
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // Selected document for preview / versioning
  const [previewDoc, setPreviewDoc] = useState<ERPDocument | null>(null);

  // Upload Form Fields
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [docTitle, setDocTitle] = useState('');
  const [docNumber, setDocNumber] = useState('');
  const [docType, setDocType] = useState<DocumentType>('Invoice');
  const [docEntity, setDocEntity] = useState<LegalEntityType | 'Combined'>('PACL');
  const [docDeptId, setDocDeptId] = useState(depts[0]?.id || '');
  const [docProjId, setDocProjId] = useState('');
  const [docBudgetId, setDocBudgetId] = useState('');
  const [docExpenseId, setDocExpenseId] = useState('');
  const [docSupplierId, setDocSupplierId] = useState('');
  const [docLpoId, setDocLpoId] = useState('');
  const [docFileName, setDocFileName] = useState('');
  const [docFileSize, setDocFileSize] = useState('1.2 MB');
  const [docFileType, setDocFileType] = useState<'pdf' | 'doc' | 'xls' | 'image' | 'other'>('pdf');
  const [docDataUrl, setDocDataUrl] = useState<string | undefined>(undefined);
  const [docRemarks, setDocRemarks] = useState('');
  const [autoStandardizeFilename, setAutoStandardizeFilename] = useState(true);

  // Version Revision Fields
  const [versionReason, setVersionReason] = useState('');
  const [newVersionFileName, setNewVersionFileName] = useState('');
  const [newVersionFileSize, setNewVersionFileSize] = useState('1.5 MB');
  const [newVersionDataUrl, setNewVersionDataUrl] = useState<string | undefined>(undefined);

  // Custom Category Input
  const [newCategoryName, setNewCategoryName] = useState('');

  // Drag and Drop Dragging Indicator
  const [isDragging, setIsDragging] = useState(false);

  // Filtered Documents
  const filteredDocs = docs.filter((d) => {
    const q = search.toLowerCase();
    if (
      search &&
      !(d.title || '').toLowerCase().includes(q) &&
      !(d.fileName || '').toLowerCase().includes(q) &&
      !(d.docNumber || '').toLowerCase().includes(q)
    )
      return false;
    if (filterEntity !== 'All') {
      if (filterEntity === 'Combined' && d.legalEntity !== 'Combined') return false;
      if (filterEntity !== 'Combined' && d.legalEntity !== filterEntity && d.legalEntity !== 'Combined') return false;
    }
    if (filterType && d.type !== filterType) return false;
    if (filterProj && d.projectId !== filterProj) return false;
    if (filterSupplier && d.supplierId !== filterSupplier) return false;
    return true;
  });

  // KPI Calculations
  const totalDocumentsCount = docs.length;
  const paclDocsCount = docs.filter((d) => d.legalEntity === 'PACL').length;
  const pgilDocsCount = docs.filter((d) => d.legalEntity === 'PGIL').length;
  const jointDocsCount = docs.filter((d) => d.legalEntity === 'Combined').length;

  // File Upload Handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    const rawName = file.name;
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
    const ext = rawName.split('.').pop()?.toLowerCase() || '';

    let detectedType: 'pdf' | 'doc' | 'xls' | 'image' | 'other' = 'other';
    if (ext === 'pdf') detectedType = 'pdf';
    else if (['doc', 'docx'].includes(ext)) detectedType = 'doc';
    else if (['xls', 'xlsx', 'csv'].includes(ext)) detectedType = 'xls';
    else if (['jpg', 'jpeg', 'png', 'svg'].includes(ext)) detectedType = 'image';

    setDocFileName(rawName);
    setDocFileSize(sizeMB);
    setDocFileType(detectedType);

    // Read Base64 Data URL for preview if applicable
    const reader = new FileReader();
    reader.onload = () => {
      setDocDataUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Open Document Upload Modal
  const handleOpenUpload = (existing?: ERPDocument) => {
    if (existing) {
      setEditingDocId(existing.id);
      setDocTitle(existing.title);
      setDocNumber(existing.docNumber || '');
      setDocType(existing.type);
      setDocEntity(existing.legalEntity || 'PACL');
      setDocDeptId(existing.departmentId || depts[0]?.id || '');
      setDocProjId(existing.projectId || '');
      setDocBudgetId(existing.budgetId || '');
      setDocExpenseId(existing.expenditureId || '');
      setDocSupplierId(existing.supplierId || '');
      setDocLpoId(existing.lpoId || '');
      setDocFileName(existing.fileName);
      setDocFileSize(existing.fileSize);
      setDocFileType(existing.fileType);
      setDocDataUrl(existing.dataUrl);
      setDocRemarks(existing.remarks || '');
    } else {
      setEditingDocId(null);
      setDocTitle('');
      setDocNumber(DatabaseService.generateDocumentNumber('PACL', 'Invoice'));
      setDocType('Invoice');
      setDocEntity('PACL');
      setDocDeptId(depts[0]?.id || '');
      setDocProjId('');
      setDocBudgetId('');
      setDocExpenseId('');
      setDocSupplierId('');
      setDocLpoId('');
      setDocFileName('');
      setDocFileSize('0 MB');
      setDocFileType('pdf');
      setDocDataUrl(undefined);
      setDocRemarks('');
    }
    setShowUploadModal(true);
  };

  // Save Uploaded Document
  const handleSaveDoc = (e: React.FormEvent) => {
    e.preventDefault();
    const deptObj = depts.find((d) => d.id === docDeptId);
    const projObj = projs.find((p) => p.id === docProjId);
    const bdgObj = bdgs.find((b) => b.id === docBudgetId);
    const expObj = exps.find((ex) => ex.id === docExpenseId);
    const supObj = sups.find((s) => s.id === docSupplierId);
    const lpoObj = lpos.find((l) => l.id === docLpoId);

    let finalFileName = docFileName;
    if (autoStandardizeFilename) {
      finalFileName = DatabaseService.generateStandardizedFilename(
        docEntity,
        docType,
        docNumber || '001',
        projObj?.name
      );
    }

    const newDoc: ERPDocument = {
      id: editingDocId || 'doc-' + Date.now(),
      docNumber: docNumber || `DOC-${docEntity}-2026-${Math.floor(100 + Math.random() * 900)}`,
      title: docTitle || `${docType} - ${projObj?.name || 'Marketing Activity'}`,
      type: docType,
      category: docType,
      departmentId: docDeptId,
      departmentName: deptObj?.name || 'Marketing & Customer Experience',
      legalEntity: docEntity,
      projectId: docProjId || undefined,
      projectName: projObj?.name || undefined,
      budgetId: docBudgetId || undefined,
      budgetCode: bdgObj?.code || undefined,
      expenditureId: docExpenseId || undefined,
      expenseCode: expObj?.expenseId || undefined,
      supplierId: docSupplierId || undefined,
      supplierName: supObj?.name || undefined,
      lpoId: docLpoId || undefined,
      lpoNumber: lpoObj?.lpoNumber || undefined,
      fileName: finalFileName,
      fileSize: docFileSize,
      fileType: docFileType,
      dataUrl: docDataUrl,
      uploadedBy: `${role} User`,
      uploadDate: new Date().toISOString().split('T')[0],
      remarks: docRemarks,
      status: 'Approved',
    };

    DatabaseService.saveDocument(newDoc, `${role} User`, role);
    showToast(editingDocId ? 'Document metadata updated.' : 'Document uploaded to vault.', 'success');
    onRefresh();
    setShowUploadModal(false);
  };

  // Delete Document
  const handleDeleteDoc = async (id: string, title: string) => {
    const confirmed = await confirmDialog({
      title: 'Delete Document',
      message: `Are you sure you want to delete "${title}" from the Document Vault?`,
      confirmLabel: 'Delete Document',
      variant: 'danger',
    });
    if (confirmed) {
      DatabaseService.deleteDocument(id, `${role} User`, role);
      showToast('Document removed from vault.', 'info');
      onRefresh();
    }
  };

  // Handle Version Replacement Upload
  const handleSaveVersion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!previewDoc) return;

    DatabaseService.addDocumentVersion(
      previewDoc.id,
      newVersionFileName || previewDoc.fileName,
      newVersionFileSize,
      newVersionDataUrl || previewDoc.dataUrl,
      versionReason || 'Updated revision upload',
      `${role} User`,
      role
    );

    // Refresh preview document
    const updatedDocs = DatabaseService.getDocuments();
    const reloaded = updatedDocs.find((d) => d.id === previewDoc.id);
    if (reloaded) setPreviewDoc(reloaded);

    onRefresh();
    setShowVersionModal(false);
    setVersionReason('');
  };

  // Add Category Handler
  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    const currentSettings = DatabaseService.getSettings();
    const updatedCats = Array.from(new Set([...(currentSettings.documentCategories || docCategories), newCategoryName.trim()]));

    DatabaseService.updateSettings(
      {
        ...currentSettings,
        documentCategories: updatedCats,
      },
      `${role} User`,
      role
    );

    setNewCategoryName('');
    onRefresh();
    setShowCategoryModal(false);
  };

  return (
    <div className="d-flex flex-column gap-4">
      {/* Top Header & Quick Links */}
      <div className="card card-erp p-3 shadow-sm border-0">
        <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3">
          <div>
            <h2 className="h5 fw-bold text-dark mb-1 d-flex align-items-center gap-2">
              <i className="bi bi-folder-symlink-fill text-danger fs-4"></i>
              <span>Marketing &amp; CX Enterprise Document Vault</span>
            </h2>
            <p className="text-muted fs-7 mb-0">
              Centralized supporting document lifecycle, revision history, and legal entity audit trail for PACL &amp; PGIL.
            </p>
          </div>

          <div className="d-flex align-items-center gap-2 flex-wrap">
            {onNavigateTab && (
              <>
                <button
                  type="button"
                  onClick={() => onNavigateTab('lpos')}
                  className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1.5"
                >
                  <i className="bi bi-file-earmark-spreadsheet-fill"></i>
                  <span>LPO Management ({lpos.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateTab('projects')}
                  className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1.5"
                >
                  <i className="bi bi-kanban-fill"></i>
                  <span>Projects &amp; Co-Funding ({projs.length})</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => handleOpenUpload()}
              className="btn btn-corporate btn-sm d-flex align-items-center gap-1.5 shadow-sm"
            >
              <i className="bi bi-cloud-arrow-up-fill"></i>
              <span>Upload Document</span>
            </button>
            <button
              type="button"
              onClick={() => setShowCategoryModal(true)}
              className="btn btn-light text-secondary border btn-sm"
              title="Manage Categories"
            >
              <i className="bi bi-gear-fill"></i>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Highlight Strip */}
      <div className="row g-3">
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card card-erp p-3 border-start border-4 border-danger shadow-sm">
            <span className="text-muted fs-7 fw-semibold text-uppercase font-mono">Total Document Vault Files</span>
            <div className="h4 fw-bold text-dark mt-1 mb-0">{totalDocumentsCount} Documents</div>
            <span className="fs-7 text-muted mt-1">Across {docCategories.length} Document Types</span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card card-erp p-3 border-start border-4 border-dark shadow-sm">
            <span className="text-muted fs-7 fw-semibold text-uppercase font-mono">PACL Documents</span>
            <div className="h4 fw-bold text-dark mt-1 mb-0">{paclDocsCount} Files</div>
            <span className="fs-7 text-muted mt-1">Pioneer Assurance Company Ltd</span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card card-erp p-3 border-start border-4 border-primary shadow-sm">
            <span className="text-muted fs-7 fw-semibold text-uppercase font-mono">PGIL Documents</span>
            <div className="h4 fw-bold text-primary mt-1 mb-0">{pgilDocsCount} Files</div>
            <span className="fs-7 text-muted mt-1">Pioneer General Insurance Ltd</span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card card-erp p-3 border-start border-4 border-success shadow-sm">
            <span className="text-muted fs-7 fw-semibold text-uppercase font-mono">Combined / Joint Docs</span>
            <div className="h4 fw-bold text-success mt-1 mb-0">{jointDocsCount} Files</div>
            <span className="fs-7 text-muted mt-1">Shared Group &amp; Co-Funded Files</span>
          </div>
        </div>
      </div>

      {/* DOCUMENT VAULT */}
      <div className="d-flex flex-column gap-3">
          {/* Filters Bar */}
          <div className="card card-erp p-3">
            <div className="row g-2 align-items-center">
              <div className="col-12 col-md-4">
                <div className="input-group input-group-sm">
                  <span className="input-group-text bg-white border-end-0">
                    <i className="bi bi-search text-muted"></i>
                  </span>
                  <input
                    type="text"
                    className="form-control border-start-0"
                    placeholder="Search by Title, Doc #, File Name..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="col-6 col-md-2">
                <select className="form-select form-select-sm fw-bold text-danger border-danger" value={filterEntity} onChange={(e) => setFilterEntity(e.target.value)}>
                  <option value="All">🏢 All Legal Entities</option>
                  <option value="PACL">PACL – Pioneer Assurance</option>
                  <option value="PGIL">PGIL – Pioneer General</option>
                  <option value="Combined">Combined / Joint Docs</option>
                </select>
              </div>

              <div className="col-6 col-md-2">
                <select className="form-select form-select-sm" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                  <option value="">📁 All Document Types</option>
                  {docCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-6 col-md-2">
                <select className="form-select form-select-sm" value={filterProj} onChange={(e) => setFilterProj(e.target.value)}>
                  <option value="">🎯 All Projects</option>
                  {projs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-6 col-md-2 d-flex justify-content-end gap-1">
                <button
                  type="button"
                  className={`btn btn-sm ${viewMode === 'cards' ? 'btn-danger' : 'btn-outline-secondary'}`}
                  onClick={() => setViewMode('cards')}
                  title="Card View"
                >
                  <i className="bi bi-grid-3x3-gap-fill"></i>
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${viewMode === 'table' ? 'btn-danger' : 'btn-outline-secondary'}`}
                  onClick={() => setViewMode('table')}
                  title="Table View"
                >
                  <i className="bi bi-list-task"></i>
                </button>
              </div>
            </div>
          </div>

          {/* Quick Drag & Drop Upload Zone Bar */}
          <div
            className={`card card-erp p-3 text-center border-2 border-dashed ${
              isDragging ? 'border-danger bg-danger-subtle' : 'border-secondary-subtle bg-light'
            }`}
            style={{ cursor: 'pointer', transition: 'all 0.2s ease-in-out' }}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => handleOpenUpload()}
          >
            <div className="d-flex align-items-center justify-content-center gap-3">
              <i className="bi bi-cloud-upload text-danger fs-2"></i>
              <div className="text-start">
                <div className="fw-bold text-dark fs-7">
                  Drag & Drop Supporting Files Here, or <span className="text-danger underline">Browse Local Files</span>
                </div>
                <div className="text-muted fs-8">
                  Supports LPOs, Invoices, Contracts, Quotations, Receipts, Delivery Notes (PDF, DOCX, XLSX, Images up to 25MB)
                </div>
              </div>
            </div>
          </div>

          {/* Document Content Display */}
          {filteredDocs.length === 0 ? (
            <div className="card card-erp p-5 text-center">
              <i className="bi bi-folder-x text-muted fs-1 mb-2"></i>
              <h5 className="h6 text-secondary">No documents matched your filter criteria</h5>
              <p className="fs-7 text-muted">Try clearing search keywords or choosing "All Legal Entities".</p>
            </div>
          ) : viewMode === 'cards' ? (
            <div className="row g-3">
              {filteredDocs.map((d) => (
                <div key={d.id} className="col-12 col-md-6 col-xl-4">
                  <div className="card card-erp p-3 h-100 d-flex flex-column justify-content-between shadow-sm hover-shadow">
                    <div>
                      {/* Badge Top Line */}
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <span
                          className={`badge ${
                            d.legalEntity === 'PACL'
                              ? 'bg-danger text-white'
                              : d.legalEntity === 'PGIL'
                              ? 'bg-primary text-white'
                              : 'bg-dark text-white'
                          } font-mono fs-8`}
                        >
                          {d.legalEntity || 'PACL'}
                        </span>
                        <span className="badge bg-light text-secondary border font-mono fs-8">{d.type}</span>
                        <span className="fs-8 text-muted">{d.uploadDate}</span>
                      </div>

                      {/* Title & File Icon */}
                      <div className="d-flex align-items-start gap-2.5 mb-2">
                        <i
                          className={`bi ${
                            d.fileType === 'pdf'
                              ? 'bi-file-earmark-pdf-fill text-danger'
                              : d.fileType === 'xls'
                              ? 'bi-file-earmark-excel-fill text-success'
                              : d.fileType === 'doc'
                              ? 'bi-file-earmark-word-fill text-primary'
                              : 'bi-file-earmark-image-fill text-warning'
                          } fs-2 flex-shrink-0`}
                        ></i>
                        <div className="overflow-hidden">
                          <h4 className="h6 fw-bold mb-0 text-dark text-truncate" title={d.title}>
                            {d.title}
                          </h4>
                          <div className="text-muted fs-8 font-mono text-truncate">
                            {d.docNumber ? `${d.docNumber} • ` : ''}
                            {d.fileName} ({d.fileSize})
                          </div>
                        </div>
                      </div>

                      {/* Linking Trace Metadata */}
                      <div className="p-2 rounded bg-light border fs-8 mb-2 font-mono">
                        {d.projectName && (
                          <div className="text-truncate text-secondary mb-0.5">
                            <strong className="text-dark">Project:</strong> {d.projectName}
                          </div>
                        )}
                        {d.budgetCode && (
                          <div className="text-truncate text-secondary mb-0.5">
                            <strong className="text-dark">Budget Code:</strong> {d.budgetCode}
                          </div>
                        )}
                        {d.supplierName && (
                          <div className="text-truncate text-secondary mb-0.5">
                            <strong className="text-dark">Supplier:</strong> {d.supplierName}
                          </div>
                        )}
                        {d.lpoNumber && (
                          <div className="text-truncate text-danger fw-bold">
                            <strong>LPO #:</strong> {d.lpoNumber}
                          </div>
                        )}
                      </div>

                      <p className="fs-8 text-secondary mb-2 line-clamp-2">{d.remarks || 'No specific remarks recorded.'}</p>
                    </div>

                    {/* Card Footer Actions */}
                    <div className="d-flex align-items-center justify-content-between pt-2 border-top">
                      <span className="fs-8 text-muted">v{d.currentVersion || 1} • {d.uploadedBy}</span>
                      <div className="btn-group btn-group-sm">
                        <button
                          type="button"
                          className="btn btn-light text-primary border px-2 py-1"
                          onClick={() => {
                            setPreviewDoc(d);
                            setShowPreviewModal(true);
                          }}
                          title="Preview & History"
                        >
                          <i className="bi bi-eye-fill me-1"></i> Preview
                        </button>
                        <button
                          type="button"
                          className="btn btn-light text-secondary border px-2 py-1"
                          onClick={() => handleOpenUpload(d)}
                          title="Edit Document"
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button
                          type="button"
                          className="btn btn-light text-danger border px-2 py-1"
                          onClick={() => handleDeleteDoc(d.id, d.title)}
                          title="Delete"
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Table View */
            <div className="card card-erp overflow-hidden shadow-sm">
              <div className="table-responsive">
                <table className="table table-hover table-striped align-middle mb-0 fs-7">
                  <thead className="table-dark">
                    <tr>
                      <th>Doc # / Title</th>
                      <th>Legal Entity</th>
                      <th>Type</th>
                      <th>Linked Project / Budget</th>
                      <th>Supplier</th>
                      <th>File / Size</th>
                      <th>Uploaded By</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDocs.map((d) => (
                      <tr key={d.id}>
                        <td>
                          <div className="fw-bold text-dark">{d.title}</div>
                          <div className="fs-8 text-muted font-mono">{d.docNumber || 'DOC-UNASSIGNED'}</div>
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              d.legalEntity === 'PACL'
                                ? 'bg-danger text-white'
                                : d.legalEntity === 'PGIL'
                                ? 'bg-primary text-white'
                                : 'bg-dark text-white'
                            }`}
                          >
                            {d.legalEntity || 'PACL'}
                          </span>
                        </td>
                        <td>
                          <span className="badge bg-light text-dark border">{d.type}</span>
                        </td>
                        <td>
                          <div className="fw-semibold text-dark fs-8">{d.projectName || 'General'}</div>
                          <div className="text-muted fs-8 font-mono">{d.budgetCode ? `Code: ${d.budgetCode}` : ''}</div>
                        </td>
                        <td>
                          <div className="fs-8 text-secondary">{d.supplierName || 'N/A'}</div>
                          {d.lpoNumber && <div className="fs-8 text-danger font-mono fw-bold">{d.lpoNumber}</div>}
                        </td>
                        <td>
                          <div className="font-mono fs-8">{d.fileName}</div>
                          <div className="text-muted fs-8">{d.fileSize}</div>
                        </td>
                        <td>
                          <div className="fs-8">{d.uploadedBy}</div>
                          <div className="text-muted fs-8">{d.uploadDate}</div>
                        </td>
                        <td className="text-end">
                          <div className="btn-group btn-group-sm">
                            <button
                              type="button"
                              className="btn btn-light text-primary border"
                              onClick={() => {
                                setPreviewDoc(d);
                                setShowPreviewModal(true);
                              }}
                            >
                              <i className="bi bi-eye-fill"></i>
                            </button>
                            <button type="button" className="btn btn-light text-secondary border" onClick={() => handleOpenUpload(d)}>
                              <i className="bi bi-pencil"></i>
                            </button>
                            <button type="button" className="btn btn-light text-danger border" onClick={() => handleDeleteDoc(d.id, d.title)}>
                              <i className="bi bi-trash"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
      </div>

      {/* MODAL 1: DOCUMENT UPLOAD & METADATA ASSIGNMENT */}
      {showUploadModal && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content shadow-lg border-0">
              <div className="modal-header bg-dark text-white py-2.5 px-3">
                <h5 className="modal-title fw-bold fs-6">
                  {editingDocId ? 'Edit Document Metadata' : 'Upload Supporting Document to Enterprise Vault'}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowUploadModal(false)}></button>
              </div>

              <form onSubmit={handleSaveDoc}>
                <div className="modal-body p-3">
                  <div className="row g-3">
                    {/* Title & Doc Number */}
                    <div className="col-md-8">
                      <label className="form-label fw-semibold fs-7">Document Title *</label>
                      <input
                        type="text"
                        className="form-control fs-7"
                        placeholder="e.g. Kantar CSAT Survey Tax Invoice"
                        value={docTitle}
                        onChange={(e) => setDocTitle(e.target.value)}
                        required
                      />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label fw-semibold fs-7">Document Ref #</label>
                      <input type="text" className="form-control fs-7 font-mono" value={docNumber} onChange={(e) => setDocNumber(e.target.value)} />
                    </div>

                    {/* Legal Entity & Document Type */}
                    <div className="col-md-6">
                      <label className="form-label fw-semibold fs-7 text-danger">Mandatory Legal Entity *</label>
                      <select
                        className="form-select fs-7 fw-bold border-danger"
                        value={docEntity}
                        onChange={(e) => setDocEntity(e.target.value as any)}
                        required
                      >
                        <option value="PACL">PACL – Pioneer Assurance Company Limited</option>
                        <option value="PGIL">PGIL – Pioneer General Insurance Limited</option>
                        <option value="Combined">Combined / Joint Group Document</option>
                      </select>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label fw-semibold fs-7">Document Category *</label>
                      <select className="form-select fs-7" value={docType} onChange={(e) => setDocType(e.target.value as DocumentType)}>
                        {docCategories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Trace Linking */}
                    <div className="col-md-6">
                      <label className="form-label fw-semibold fs-7">Link to Project</label>
                      <select className="form-select fs-7" value={docProjId} onChange={(e) => setDocProjId(e.target.value)}>
                        <option value="">-- Optional: Select Project --</option>
                        {projs.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label fw-semibold fs-7">Link to Budget Line</label>
                      <select className="form-select fs-7" value={docBudgetId} onChange={(e) => setDocBudgetId(e.target.value)}>
                        <option value="">-- Optional: Select Budget --</option>
                        {bdgs.map((b) => (
                          <option key={b.id} value={b.id}>
                            [{b.legalEntity}] {b.code} - {b.category}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label fw-semibold fs-7">Link to Supplier</label>
                      <select className="form-select fs-7" value={docSupplierId} onChange={(e) => setDocSupplierId(e.target.value)}>
                        <option value="">-- Optional: Select Supplier --</option>
                        {sups.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label fw-semibold fs-7">Link to LPO Number</label>
                      <select className="form-select fs-7 font-mono" value={docLpoId} onChange={(e) => setDocLpoId(e.target.value)}>
                        <option value="">-- Optional: Select LPO --</option>
                        {lpos.map((l) => (
                          <option key={l.id} value={l.id}>
                            [{l.legalEntity}] {l.lpoNumber} - KES {Number(l.totalLpoValue ?? l.totalLpoAmount ?? 0).toLocaleString()}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* File Drop & Name */}
                    <div className="col-12">
                      <label className="form-label fw-semibold fs-7">File Attachment *</label>
                      <input type="file" className="form-control fs-7 mb-2" onChange={handleFileSelect} />
                      <div className="row g-2">
                        <div className="col-md-8">
                          <input type="text" className="form-control fs-7 font-mono" placeholder="Auto-generated if standardized, or enter filename..." value={docFileName} onChange={(e) => setDocFileName(e.target.value)} required={!autoStandardizeFilename} />
                        </div>
                        <div className="col-md-4">
                          <div className="form-check pt-1.5">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id="checkAutoStandard"
                              checked={autoStandardizeFilename}
                              onChange={(e) => setAutoStandardizeFilename(e.target.checked)}
                            />
                            <label className="form-check-label fs-8 text-dark fw-semibold" htmlFor="checkAutoStandard">
                              Standardize Filename Format
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Remarks */}
                    <div className="col-12">
                      <label className="form-label fw-semibold fs-7">File Notes / Audit Remarks</label>
                      <textarea
                        className="form-control fs-7"
                        rows={2}
                        placeholder="e.g. Verified by Procurement Lead; original signed hardcopy archived."
                        value={docRemarks}
                        onChange={(e) => setDocRemarks(e.target.value)}
                      ></textarea>
                    </div>
                  </div>
                </div>

                <div className="modal-footer py-2 px-3">
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setShowUploadModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-corporate btn-sm">
                    {editingDocId ? 'Save Metadata Changes' : 'Upload to Vault'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: DOCUMENT PREVIEW, REVISION HISTORY & AUDIT TRAIL */}
      {showPreviewModal && previewDoc && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="modal-dialog modal-xl modal-dialog-centered">
            <div className="modal-content shadow-lg border-0">
              <div className="modal-header bg-dark text-white py-2.5 px-3">
                <div className="d-flex align-items-center gap-2">
                  <span className="badge bg-danger font-mono">{previewDoc.legalEntity || 'PACL'}</span>
                  <h5 className="modal-title fw-bold fs-6">{previewDoc.title}</h5>
                </div>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowPreviewModal(false)}></button>
              </div>

              <div className="modal-body p-3">
                <div className="row g-3">
                  {/* Left View Column - Document Viewer */}
                  <div className="col-12 col-lg-7">
                    <div className="card card-erp p-3 bg-light h-100 d-flex flex-column justify-content-between">
                      <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
                        <div>
                          <span className="badge bg-secondary me-2">{previewDoc.type}</span>
                          <span className="fs-8 font-mono text-muted">{previewDoc.fileName}</span>
                        </div>
                        <span className="badge bg-success">v{previewDoc.currentVersion || 1} Approved</span>
                      </div>

                      {/* Embedded File Renderer / Visual Viewer */}
                      <div
                        className="my-3 p-4 bg-white border rounded text-center d-flex flex-column align-items-center justify-content-center shadow-inner"
                        style={{ minHeight: '320px' }}
                      >
                        {previewDoc.dataUrl && previewDoc.fileType === 'image' ? (
                          <img src={previewDoc.dataUrl} alt="Preview" className="img-fluid rounded max-vh-40" />
                        ) : (
                          <>
                            <i
                              className={`bi ${
                                previewDoc.fileType === 'pdf'
                                  ? 'bi-file-earmark-pdf-fill text-danger'
                                  : previewDoc.fileType === 'xls'
                                  ? 'bi-file-earmark-excel-fill text-success'
                                  : 'bi-file-earmark-word-fill text-primary'
                              } display-1 mb-2`}
                            ></i>
                            <h4 className="h6 fw-bold text-dark">{previewDoc.fileName}</h4>
                            <p className="fs-8 text-muted mb-3 font-mono">Size: {previewDoc.fileSize} • Format: {(previewDoc.fileType || 'pdf').toUpperCase()}</p>
                            <div className="alert alert-light border fs-8 text-start w-100 font-mono">
                              <strong>Document ID:</strong> {previewDoc.id}<br />
                              <strong>Vault Storage Path:</strong> /mcx-vault/{previewDoc.legalEntity || 'PACL'}/{(previewDoc.type || 'doc').toLowerCase()}/{previewDoc.fileName}
                            </div>
                          </>
                        )}
                      </div>

                      <div className="d-flex justify-content-between align-items-center">
                        <span className="fs-8 text-muted">Uploaded on {previewDoc.uploadDate} by {previewDoc.uploadedBy}</span>
                        <button
                          type="button"
                          className="btn btn-outline-danger btn-sm"
                          onClick={() => {
                            setShowVersionModal(true);
                          }}
                        >
                          <i className="bi bi-cloud-arrow-up me-1"></i> Upload Version {(previewDoc.currentVersion || 1) + 1}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right View Column - Metadata, Version History & Audit Trail */}
                  <div className="col-12 col-lg-5">
                    <div className="d-flex flex-column gap-3">
                      {/* Linking Trace Card */}
                      <div className="card card-erp p-3 bg-white">
                        <h4 className="fs-7 fw-bold text-dark mb-2">Audit Traceability</h4>
                        <div className="p-2 rounded bg-light border font-mono fs-8">
                          <div className="mb-1"><strong>Legal Entity:</strong> {previewDoc.legalEntity || 'PACL'}</div>
                          <div className="mb-1"><strong>Project:</strong> {previewDoc.projectName || 'N/A'}</div>
                          <div className="mb-1"><strong>Budget Code:</strong> {previewDoc.budgetCode || 'N/A'}</div>
                          <div className="mb-1"><strong>Supplier:</strong> {previewDoc.supplierName || 'N/A'}</div>
                          <div className="mb-1 text-danger"><strong>LPO Number:</strong> {previewDoc.lpoNumber || 'N/A'}</div>
                          <div className="mb-0"><strong>Remarks:</strong> {previewDoc.remarks || 'None'}</div>
                        </div>
                      </div>

                      {/* Revision Version History */}
                      <div className="card card-erp p-3 bg-white">
                        <h4 className="fs-7 fw-bold text-dark mb-2">Version History</h4>
                        <div className="d-flex flex-column gap-2 max-vh-30 overflow-y-auto">
                          {(previewDoc.versions || []).map((v) => (
                            <div key={v.versionNumber} className="p-2 border rounded bg-light fs-8">
                              <div className="d-flex justify-content-between fw-bold">
                                <span>Version {v.versionNumber}</span>
                                <span className="text-muted">{v.uploadDate}</span>
                              </div>
                              <div className="text-secondary">{v.fileName} ({v.fileSize})</div>
                              <div className="text-muted fst-italic">"{v.reasonForRevision}"</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Activity Trail Drawer */}
                      <div className="card card-erp p-3 bg-white">
                        <h4 className="fs-7 fw-bold text-dark mb-2">Document Activity Trail</h4>
                        <div className="d-flex flex-column gap-2 max-vh-30 overflow-y-auto">
                          {(previewDoc.activityLog || []).map((act) => (
                            <div key={act.id} className="p-2 border-start border-3 border-danger bg-light fs-8">
                              <div className="d-flex justify-content-between fw-semibold">
                                <span className="text-danger">{act.action}</span>
                                <span className="text-muted">{act.timestamp}</span>
                              </div>
                              <div className="text-dark">{act.user}</div>
                              <div className="text-muted">{act.details}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer py-2 px-3">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowPreviewModal(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: UPLOAD NEW VERSION */}
      {showVersionModal && previewDoc && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0">
              <div className="modal-header bg-dark text-white py-2.5 px-3">
                <h5 className="modal-title fw-bold fs-6">Upload Version {(previewDoc.currentVersion || 1) + 1}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowVersionModal(false)}></button>
              </div>

              <form onSubmit={handleSaveVersion}>
                <div className="modal-body p-3">
                  <p className="fs-7 text-muted mb-3">
                    Uploading a new version replaces the active file view while retaining complete prior version history for audit purposes.
                  </p>

                  <div className="mb-3">
                    <label className="form-label fw-semibold fs-7">Select New Revision File *</label>
                    <input
                      type="file"
                      className="form-control fs-7"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setNewVersionFileName(file.name);
                          setNewVersionFileSize((file.size / (1024 * 1024)).toFixed(2) + ' MB');
                          const reader = new FileReader();
                          reader.onload = () => setNewVersionDataUrl(reader.result as string);
                          reader.readAsDataURL(file);
                        }
                      }}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold fs-7">Reason for Revision *</label>
                    <textarea
                      className="form-control fs-7"
                      rows={3}
                      placeholder="e.g. Updated countersigned agreement with revised pricing schedules."
                      value={versionReason}
                      onChange={(e) => setVersionReason(e.target.value)}
                      required
                    ></textarea>
                  </div>
                </div>

                <div className="modal-footer py-2 px-3">
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setShowVersionModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-corporate btn-sm">
                    Upload Version {(previewDoc.currentVersion || 1) + 1}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: CATEGORY MANAGEMENT */}
      {showCategoryModal && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0">
              <div className="modal-header bg-dark text-white py-2.5 px-3">
                <h5 className="modal-title fw-bold fs-6">Manage Document Categories</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowCategoryModal(false)}></button>
              </div>

              <div className="modal-body p-3">
                <form onSubmit={handleAddCategory} className="d-flex gap-2 mb-3">
                  <input
                    type="text"
                    className="form-control fs-7"
                    placeholder="Enter new category name (e.g. Media Approvals)"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    required
                  />
                  <button type="submit" className="btn btn-corporate btn-sm flex-shrink-0">
                    Add Category
                  </button>
                </form>

                <h6 className="fs-7 fw-bold text-dark mb-2">Existing Document Categories ({docCategories.length})</h6>
                <div className="d-flex flex-wrap gap-1.5 max-vh-40 overflow-y-auto p-2 border rounded bg-light">
                  {docCategories.map((c) => (
                    <span key={c} className="badge bg-white text-dark border p-2 fs-8 font-mono">
                      {c}
                    </span>
                  ))}
                </div>
              </div>

              <div className="modal-footer py-2 px-3">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowCategoryModal(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
