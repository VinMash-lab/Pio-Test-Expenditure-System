import React, { useState, useEffect } from 'react';
import { DatabaseService } from '../services/db';
import { Project, RoleType, ProjectStatus, ProjectType, InvoiceRecord, ERPDocument } from '../types';
import { confirmDialog, showToast } from '../services/uiFeedback';
import { SharedProjectsView } from './SharedProjectsView';

interface ProjectsViewProps {
  role: RoleType;
  onRefresh: () => void;
  initialSubTab?: 'portfolio' | 'shared' | 'documents';
  onNavigateTab?: (tab: string) => void;
}

const normStr = (v?: string) => (v || '').trim().toLowerCase();

const isRecordForProject = (
  proj: Project,
  rec: { projectId?: string; projectName?: string }
): boolean => {
  if (rec.projectId && (rec.projectId === proj.id || normStr(rec.projectId) === normStr(proj.code))) {
    return true;
  }
  if (rec.projectName && proj.name && normStr(rec.projectName) === normStr(proj.name)) {
    return true;
  }
  return false;
};

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  role,
  onRefresh,
  initialSubTab = 'portfolio',
  onNavigateTab,
}) => {
  const projs = DatabaseService.getProjects();
  const depts = DatabaseService.getDepartments();
  const allInvoices = DatabaseService.getInvoices();
  const allSuppliers = DatabaseService.getSuppliers();
  const allLpos = DatabaseService.getLPOs();
  const allDocs = DatabaseService.getDocuments();
  const settings = DatabaseService.getSettings();

  const [activeSubTab, setActiveSubTab] = useState<'portfolio' | 'shared' | 'documents'>(initialSubTab);
  useEffect(() => {
    setActiveSubTab(initialSubTab);
  }, [initialSubTab]);

  const [previewDoc, setPreviewDoc] = useState<ERPDocument | null>(null);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingProj, setEditingProj] = useState<Project | null>(null);

  // Project Invoices & Pending Balance Modal State
  const [inspectProjectId, setInspectProjectId] = useState<string | null>(null);
  const [showQuickInvoiceForm, setShowQuickInvoiceForm] = useState(false);
  const [qiNumber, setQiNumber] = useState('');
  const [qiSupplierId, setQiSupplierId] = useState('');
  const [qiLpoNumber, setQiLpoNumber] = useState('');
  const [qiEntity, setQiEntity] = useState<'PACL' | 'PGIL' | 'Shared'>('PACL');
  const [qiDate, setQiDate] = useState(new Date().toISOString().split('T')[0]);
  const [qiAmountNet, setQiAmountNet] = useState<string>('0');
  const [qiHasVat, setQiHasVat] = useState<boolean>(true);
  const [qiVat, setQiVat] = useState<string>('0');
  const [qiStatus, setQiStatus] = useState<InvoiceRecord['paymentStatus']>('Pending');
  const [qiDescription, setQiDescription] = useState('');

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [projectType, setProjectType] = useState<ProjectType>('Shared Project');
  const [deptId, setDeptId] = useState('');
  const [budget, setBudget] = useState<number>(10000000);
  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState('2026-12-31');
  const [pm, setPm] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('In Progress');
  const [description, setDescription] = useState('');

  const filteredProjects = projs.filter((p) => {
    const q = search.toLowerCase();
    if (search && !(p.name || '').toLowerCase().includes(q) && !(p.code || '').toLowerCase().includes(q)) return false;
    if (selectedDept && p.departmentId !== selectedDept) return false;
    if (selectedStatus && p.status !== selectedStatus) return false;
    return true;
  });

  const inspectedProject = inspectProjectId ? projs.find((p) => p.id === inspectProjectId) || null : null;
  const inspectedInvoices = inspectedProject
    ? allInvoices.filter((inv) => isRecordForProject(inspectedProject, inv))
    : [];
  const inspectedLpos = inspectedProject
    ? allLpos.filter((l) => isRecordForProject(inspectedProject, l))
    : [];

  const handleOpenCreate = () => {
    setEditingProj(null);
    const targetDeptCode = (deptId ? depts.find((d) => d.id === deptId)?.code : depts[0]?.code) || 'MCX';
    setCode(DatabaseService.generateProjectCode(targetDeptCode));
    setName('');
    setProjectType('Shared Project');
    setDeptId(depts[0]?.id || '');
    setBudget(10000000);
    setStartDate('2026-01-01');
    setEndDate('2026-12-31');
    setPm('');
    setStatus('In Progress');
    setDescription('');
    setShowModal(true);
  };

  const handleOpenEdit = (p: Project) => {
    setEditingProj(p);
    setCode(p.code || '');
    setName(p.name || '');
    setProjectType(p.projectType || 'Shared Project');
    setDeptId(p.departmentId || depts[0]?.id || '');
    setBudget(Number(p.totalBudget ?? p.approvedBudget ?? p.budget ?? 0));
    setStartDate(p.startDate || '2026-01-01');
    setEndDate(p.endDate || '2026-12-31');
    setPm(p.projectManager || '');
    setStatus(p.status);
    setDescription(p.description || '');
    setShowModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const deptObj = depts.find((d) => d.id === deptId);
    const numericBudget = Number(budget || 0);
    const isPacl = projectType === 'Shared Project' || projectType === 'PACL Standalone';
    const isPgil = projectType === 'Shared Project' || projectType === 'PGIL Standalone';

    const projToSave: Project = {
      ...(editingProj || {}),
      id: editingProj ? editingProj.id : 'proj-' + Date.now(),
      code: code || `PRJ-${Date.now()}`,
      name,
      projectType,
      entity: projectType === 'PACL Standalone' ? 'PACL' : projectType === 'PGIL Standalone' ? 'PGIL' : 'Shared',
      paclApplicable: isPacl,
      pgilApplicable: isPgil,
      departmentId: deptId,
      departmentName: deptObj?.name || 'General',
      budget: numericBudget,
      totalBudget: numericBudget,
      approvedBudget: numericBudget,
      spent: editingProj ? editingProj.spent : 0,
      remaining: editingProj ? editingProj.remaining : numericBudget,
      progressPercent: editingProj ? editingProj.progressPercent : 0,
      status,
      startDate,
      endDate,
      projectManager: pm,
      description,
    };

    DatabaseService.saveProject(projToSave, `${role} User`, role);
    showToast(editingProj ? 'Project updated successfully.' : 'Project created successfully.', 'success');
    onRefresh();
    setShowModal(false);
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirmDialog({
      title: 'Delete Project',
      message: 'Are you sure you want to delete this project? Associated budget and expenditure references will remain in the ledger.',
      confirmLabel: 'Delete Project',
      variant: 'danger',
    });
    if (confirmed) {
      DatabaseService.deleteProject(id, `${role} User`, role);
      showToast('Project deleted.', 'info');
      onRefresh();
    }
  };

  const handleOpenInspectInvoices = (p: Project) => {
    setInspectProjectId(p.id);
    setShowQuickInvoiceForm(false);
    setQiNumber(`INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
    setQiSupplierId(allSuppliers[0]?.id || '');
    setQiLpoNumber('');
    setQiEntity(p.projectType === 'PGIL Standalone' ? 'PGIL' : p.projectType === 'PACL Standalone' ? 'PACL' : 'Shared');
    setQiDate(new Date().toISOString().split('T')[0]);
    setQiAmountNet('0');
    setQiHasVat(true);
    setQiVat('0');
    setQiStatus('Pending');
    setQiDescription('');
  };

  const handleSaveQuickInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectedProject) return;
    const suppObj = allSuppliers.find((s) => s.id === qiSupplierId);
    const netVal = Number(qiAmountNet || 0);
    const vatVal = qiHasVat ? Number(qiVat || 0) : 0;
    const totalVal = Number((netVal + vatVal).toFixed(10));

    const newInv: InvoiceRecord = {
      id: 'inv-' + Date.now(),
      invoiceNumber: qiNumber.trim() || `INV-${Date.now()}`,
      vendorId: qiSupplierId || 'sup-general',
      vendorName: suppObj?.name || 'Selected Vendor',
      supplierId: qiSupplierId || 'sup-general',
      supplierName: suppObj?.name || 'Selected Vendor',
      lpoNumber: qiLpoNumber || undefined,
      projectId: inspectedProject.id,
      projectName: inspectedProject.name,
      legalEntity: qiEntity,
      invoiceDate: qiDate,
      amountBeforeVat: netVal,
      vatAmount: vatVal,
      totalAmount: totalVal,
      currency: settings.currencySymbol || 'KES',
      paymentStatus: qiStatus,
      paymentDate: qiStatus === 'Paid' ? qiDate : undefined,
      description: qiDescription,
      createdBy: `${role} User`,
      createdAt: new Date().toISOString(),
    };

    DatabaseService.saveInvoice(newInv, `${role} User`, role);
    showToast(`Invoice ${newInv.invoiceNumber} added to ${inspectedProject.name}.`, 'success');
    setShowQuickInvoiceForm(false);
    setQiNumber(`INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
    setQiAmountNet('0');
    setQiVat('0');
    setQiDescription('');
    onRefresh();
  };

  const handleMarkInvoicePaid = (inv: InvoiceRecord) => {
    DatabaseService.saveInvoice(
      {
        ...inv,
        paymentStatus: 'Paid',
        paymentDate: inv.paymentDate || new Date().toISOString().split('T')[0],
      },
      `${role} User`,
      role
    );
    showToast(`Invoice ${inv.invoiceNumber} marked as Paid.`, 'success');
    onRefresh();
  };

  const sharedCount = projs.filter(
    (p) => p.projectType === 'Shared Project' || p.entity === 'Shared' || (p.paclApplicable && p.pgilApplicable)
  ).length;

  return (
    <div className="d-flex flex-column gap-4">
      {/* Unified Sub-Tabs Navigation */}
      <div className="card card-erp p-3 shadow-sm border-0">
        <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2">
          <ul className="nav nav-pills gap-2">
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link btn-sm py-1.5 px-3 fw-semibold ${activeSubTab === 'portfolio' ? 'active bg-danger text-white' : 'text-dark bg-light border'}`}
                onClick={() => setActiveSubTab('portfolio')}
              >
                <i className="bi bi-kanban-fill me-1.5"></i>
                All Projects &amp; Invoices ({projs.length})
              </button>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link btn-sm py-1.5 px-3 fw-semibold ${activeSubTab === 'shared' ? 'active bg-primary text-white' : 'text-dark bg-light border'}`}
                onClick={() => setActiveSubTab('shared')}
              >
                <i className="bi bi-diagram-3-fill me-1.5"></i>
                Shared Co-Funding Split ({sharedCount})
              </button>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link btn-sm py-1.5 px-3 fw-semibold ${activeSubTab === 'documents' ? 'active bg-dark text-white' : 'text-dark bg-light border'}`}
                onClick={() => setActiveSubTab('documents')}
              >
                <i className="bi bi-folder2-open me-1.5"></i>
                Project Documents &amp; Commitments ({allDocs.length})
              </button>
            </li>
          </ul>
          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('documents')}
              className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
            >
              <i className="bi bi-folder-fill"></i> Open Document Vault
            </button>
          )}
        </div>
      </div>

      {activeSubTab === 'shared' && (
        <SharedProjectsView role={role} onNavigateToTab={onNavigateTab} onRefresh={onRefresh} embedded />
      )}

      {activeSubTab === 'documents' && (
        <div className="row g-3">
          {projs.length === 0 ? (
            <div className="col-12">
              <div className="card card-erp p-5 text-center text-muted">
                No projects found. Create a project to link supporting documents, LPOs, and invoices.
              </div>
            </div>
          ) : (
            projs.map((p) => {
              const projDocs = allDocs.filter((d) => isRecordForProject(p, d));
              const projLpos = allLpos.filter((l) => isRecordForProject(p, l));
              const projInvoices = allInvoices.filter((inv) => isRecordForProject(p, inv) && inv.paymentStatus !== 'Rejected');
              const totalProjLpoValue = projLpos.reduce((sum, l) => sum + Number(l.totalLpoValue ?? l.totalLpoAmount ?? 0), 0);
              const pendingInvVal = Number(p.pendingInvoicesAmount ?? 0);
              const pendingBal = Number(p.remainingBudget ?? p.remaining ?? 0);

              return (
                <div key={p.id} className="col-12 col-lg-6">
                  <div className="card card-erp p-3.5 h-100 shadow-sm border-top border-4 border-danger">
                    <div className="d-flex align-items-start justify-content-between mb-2">
                      <div>
                        <span className="badge bg-danger text-white mb-1">{p.projectType || 'Shared Project'}</span>
                        <h3 className="h6 fw-bold text-dark mb-1">{p.name}</h3>
                        <div className="text-muted fs-8 font-mono">{p.code} • {p.campaignType || p.departmentName}</div>
                      </div>
                      <div className="d-flex gap-1">
                        <button
                          type="button"
                          className="badge bg-light text-primary border font-mono"
                          onClick={() => handleOpenInspectInvoices(p)}
                          title="Inspect or add project invoices"
                        >
                          {projInvoices.length} Invoices
                        </button>
                        <span className="badge bg-light text-secondary border font-mono">
                          {projDocs.length} Docs
                        </span>
                      </div>
                    </div>

                    <div className="row g-2 my-2 py-2 bg-light rounded border text-center font-mono fs-8">
                      <div className="col-3">
                        <span className="text-muted d-block">Committed LPOs</span>
                        <strong className="text-danger">{settings.currencySymbol} {totalProjLpoValue.toLocaleString()}</strong>
                      </div>
                      <div className="col-3">
                        <span className="text-muted d-block">Total Invoiced</span>
                        <strong className="text-primary">{settings.currencySymbol} {Number(p.invoicedAmount ?? 0).toLocaleString()}</strong>
                      </div>
                      <div className="col-3">
                        <span className="text-muted d-block">Pending Inv</span>
                        <strong className="text-warning-emphasis">{settings.currencySymbol} {pendingInvVal.toLocaleString()}</strong>
                      </div>
                      <div className="col-3">
                        <span className="text-muted d-block">Pending Bal.</span>
                        <strong className={pendingBal < 0 ? 'text-danger' : 'text-success'}>
                          {settings.currencySymbol} {pendingBal.toLocaleString()}
                        </strong>
                      </div>
                    </div>

                    {projInvoices.length > 0 && (
                      <div className="mb-2">
                        <h4 className="fs-7 fw-bold text-dark mt-2 mb-1.5 d-flex align-items-center gap-1">
                          <i className="bi bi-receipt-cutoff text-primary"></i> Linked Project Invoices ({projInvoices.length})
                        </h4>
                        <div className="d-flex flex-column gap-1">
                          {projInvoices.map((inv) => (
                            <div key={inv.id} className="d-flex align-items-center justify-content-between px-2 py-1 rounded bg-white border fs-8">
                              <div className="text-truncate">
                                <span className="fw-bold font-monospace text-danger me-2">{inv.invoiceNumber}</span>
                                <span className="text-dark">{inv.supplierName || inv.vendorName}</span>
                              </div>
                              <div className="d-flex align-items-center gap-2 flex-shrink-0">
                                <span className="font-monospace fw-bold">
                                  {settings.currencySymbol} {Number(inv.totalAmount || 0).toLocaleString()}
                                </span>
                                <span className={`badge ${inv.paymentStatus === 'Paid' ? 'bg-success' : 'bg-warning text-dark'}`}>
                                  {inv.paymentStatus}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <h4 className="fs-7 fw-bold text-dark mt-2 mb-2 d-flex align-items-center gap-1">
                      <i className="bi bi-files text-danger"></i> Linked Project Documents
                    </h4>

                    {projDocs.length === 0 ? (
                      <div className="p-3 bg-light text-center rounded text-muted fs-8">
                        No documents currently attached to this project.
                      </div>
                    ) : (
                      <div className="d-flex flex-column gap-1.5">
                        {projDocs.map((d) => (
                          <div key={d.id} className="d-flex align-items-center justify-content-between p-2 rounded bg-white border fs-8">
                            <div className="d-flex align-items-center gap-2 overflow-hidden">
                              <i className="bi bi-file-earmark-pdf-fill text-danger fs-6"></i>
                              <div className="text-truncate">
                                <span className="fw-bold text-dark">{d.title}</span>
                                <div className="text-muted font-mono fs-8">{d.fileName}</div>
                              </div>
                            </div>
                            <div className="d-flex align-items-center gap-2 flex-shrink-0">
                              <span className="badge bg-light text-secondary border">{d.type}</span>
                              <button
                                type="button"
                                className="btn btn-sm btn-link p-0 text-danger"
                                onClick={() => setPreviewDoc(d)}
                              >
                                View
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {activeSubTab === 'portfolio' && (
        <>
          {/* Search & Action Bar */}
          <div className="card card-erp p-3">
            <div className="row g-2 align-items-center">
              <div className="col-12 col-md-4">
                <div className="input-group input-group-sm">
                  <span className="input-group-text bg-white">
                    <i className="bi bi-search text-muted"></i>
                  </span>
              <input
                type="text"
                className="form-control"
                placeholder="Search Project Name or Code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="col-6 col-md-3">
            <select className="form-select form-select-sm" value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)}>
              <option value="">All Departments</option>
              {depts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="col-6 col-md-3">
            <select className="form-select form-select-sm" value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="In Progress">In Progress</option>
              <option value="Planning">Planning</option>
              <option value="Completed">Completed</option>
              <option value="Delayed">Delayed</option>
              <option value="On Hold">On Hold</option>
            </select>
          </div>

          <div className="col-12 col-md-2 text-end">
            <button type="button" onClick={handleOpenCreate} className="btn btn-corporate btn-sm d-flex align-items-center gap-1 ms-auto">
              <i className="bi bi-plus-lg"></i>
              <span>New Project</span>
            </button>
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="row g-3">
        {filteredProjects.map((p) => {
          const projInvoices = allInvoices.filter((inv) => isRecordForProject(p, inv) && inv.paymentStatus !== 'Rejected');
          const pendingInvoices = projInvoices.filter((inv) => inv.paymentStatus !== 'Paid');
          const pendingInvAmount = Number(
            p.pendingInvoicesAmount ?? pendingInvoices.reduce((s, inv) => s + Number(inv.totalAmount || 0), 0)
          );
          const pendingInvCount = Number(p.pendingInvoicesCount ?? pendingInvoices.length);
          const progressPct = Number(p.progressPercent || 0);
          const budgetVal = Number(p.totalBudget ?? p.approvedBudget ?? p.budget ?? 0);
          const spentVal = Number(p.spent ?? p.actualSpend ?? 0);
          const committedVal = Number(p.committedSpend ?? 0);
          const remainingVal = Number(p.remaining ?? p.remainingBudget ?? budgetVal - spentVal - pendingInvAmount - committedVal);

          return (
            <div key={p.id} className="col-12 col-md-6 col-xl-4">
              <div className="card card-erp p-3 h-100 d-flex flex-column justify-content-between">
                <div>
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <div className="d-flex align-items-center gap-1.5 flex-wrap">
                      <span className="badge bg-dark font-mono px-2 py-1 fs-7">{p.code}</span>
                      {projInvoices.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleOpenInspectInvoices(p)}
                          className="badge bg-light text-primary border border-primary-subtle px-2 py-1 fs-8"
                          title="View all invoices & pending balance for this project"
                        >
                          <i className="bi bi-receipt me-1"></i>
                          {projInvoices.length} {projInvoices.length === 1 ? 'Invoice' : 'Invoices'}
                        </button>
                      )}
                    </div>
                    <span
                      className={`badge ${
                        p.status === 'In Progress'
                          ? 'bg-primary'
                          : p.status === 'Completed'
                          ? 'bg-success'
                          : p.status === 'Delayed'
                          ? 'bg-danger'
                          : 'bg-secondary'
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>

                  <h3 className="h6 fw-bold mb-1 text-dark">{p.name}</h3>
                  <div className="text-muted fs-7 mb-2">
                    <i className="bi bi-building me-1 text-corporate-primary"></i> {p.departmentName} | <i className="bi bi-person me-1"></i> PM: {p.projectManager}
                  </div>

                  <div className="fs-7 text-muted mb-3 d-flex align-items-center gap-3">
                    <span>
                      <i className="bi bi-calendar3 me-1"></i> {p.startDate}
                    </span>
                    <span>to</span>
                    <span>{p.endDate}</span>
                  </div>

                  <p className="fs-7 text-secondary mb-3" style={{ minHeight: '36px' }}>
                    {p.description}
                  </p>
                </div>

                <div>
                  {/* Progress Bar */}
                  <div className="mb-3">
                    <div className="d-flex justify-content-between fs-7 mb-1">
                      <span className="fw-semibold text-muted">Committed & Spent Utilization</span>
                      <span className="fw-bold text-dark">{progressPct}%</span>
                    </div>
                    <div className="progress" style={{ height: '8px' }}>
                      <div
                        className={`progress-bar ${progressPct >= 90 ? 'bg-danger' : 'bg-success'}`}
                        style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Financial Overview */}
                  <div className="row text-center g-1 pt-2 border-top">
                    <div className="col-6 col-sm-3">
                      <small className="text-muted fs-8 d-block">Budget</small>
                      <span className="fw-bold fs-8 text-dark">{budgetVal.toLocaleString()} {settings.currencySymbol}</span>
                    </div>
                    <div className="col-6 col-sm-3">
                      <small className="text-muted fs-8 d-block">Paid / Spent</small>
                      <span className="fw-bold fs-8 text-danger">{spentVal.toLocaleString()} {settings.currencySymbol}</span>
                    </div>
                    <div className="col-6 col-sm-3">
                      <small className="text-muted fs-8 d-block">
                        Pending Inv {pendingInvCount > 0 ? `(${pendingInvCount})` : ''}
                      </small>
                      <span className={`fw-bold fs-8 ${pendingInvAmount > 0 ? 'text-warning-emphasis' : 'text-muted'}`}>
                        {pendingInvAmount.toLocaleString()} {settings.currencySymbol}
                      </span>
                    </div>
                    <div className="col-6 col-sm-3">
                      <small className="text-muted fs-8 d-block">Pending Bal.</small>
                      <span className={`fw-bold fs-8 ${remainingVal < 0 ? 'text-danger' : 'text-success'}`}>
                        {remainingVal.toLocaleString()} {settings.currencySymbol}
                      </span>
                    </div>
                  </div>
                  {committedVal > 0 && (
                    <div className="text-center fs-8 text-muted mt-1">
                      Includes {committedVal.toLocaleString()} {settings.currencySymbol} in un-invoiced open LPOs
                    </div>
                  )}

                  <div className="d-flex justify-content-between align-items-center gap-2 mt-3 pt-2 border-top">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary py-0.5 px-2"
                      onClick={() => handleOpenInspectInvoices(p)}
                    >
                      <i className="bi bi-receipt-cutoff me-1"></i>
                      Invoices & Balance ({projInvoices.length})
                    </button>
                    <div className="d-flex gap-2">
                      <button type="button" className="btn btn-sm btn-outline-secondary py-0.5 px-2" onClick={() => handleOpenEdit(p)}>
                        <i className="bi bi-pencil me-1"></i> Edit
                      </button>
                      <button type="button" className="btn btn-sm btn-outline-danger py-0.5 px-2" onClick={() => handleDelete(p.id)}>
                        <i className="bi bi-trash me-1"></i> Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
        </>
      )}

      {/* Document Preview Modal (from Project Documents Tab) */}
      {previewDoc && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1060 }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content shadow-lg border-0">
              <div className="modal-header bg-dark text-white py-2.5 px-3">
                <div className="d-flex align-items-center gap-2">
                  <span className="badge bg-danger font-mono">{previewDoc.legalEntity || 'PACL'}</span>
                  <h5 className="modal-title fw-bold fs-6">{previewDoc.title}</h5>
                </div>
                <button type="button" className="btn-close btn-close-white" onClick={() => setPreviewDoc(null)}></button>
              </div>
              <div className="modal-body p-3">
                <div className="p-3 bg-light rounded border font-mono fs-8 mb-3">
                  <div><strong>Document #:</strong> {previewDoc.docNumber || 'N/A'}</div>
                  <div><strong>Type:</strong> {previewDoc.type}</div>
                  <div><strong>File:</strong> {previewDoc.fileName} ({previewDoc.fileSize})</div>
                  <div><strong>Uploaded:</strong> {previewDoc.uploadDate} by {previewDoc.uploadedBy}</div>
                  {previewDoc.remarks && <div><strong>Remarks:</strong> {previewDoc.remarks}</div>}
                </div>
                {previewDoc.dataUrl && previewDoc.fileType === 'image' ? (
                  <div className="text-center">
                    <img src={previewDoc.dataUrl} alt={previewDoc.title} className="img-fluid rounded border" />
                  </div>
                ) : (
                  <div className="p-4 bg-white border rounded text-center text-muted">
                    <i className="bi bi-file-earmark-text display-4 text-danger d-block mb-2"></i>
                    <div className="fw-semibold text-dark">{previewDoc.fileName}</div>
                    <small>Full version history &amp; file management available in Document Vault.</small>
                  </div>
                )}
              </div>
              <div className="modal-footer py-2 px-3">
                {onNavigateTab && (
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm"
                    onClick={() => {
                      setPreviewDoc(null);
                      onNavigateTab('documents');
                    }}
                  >
                    Open in Document Vault
                  </button>
                )}
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPreviewDoc(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Project Invoices & Pending Balance Modal */}
      {inspectedProject && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content shadow-lg border-0">
              <div className="modal-header bg-dark text-white py-2.5 px-3">
                <div>
                  <h5 className="modal-title fw-bold fs-6 mb-0">
                    <i className="bi bi-receipt-cutoff me-2 text-warning"></i>
                    Project Invoices & Pending Balance — {inspectedProject.name}
                  </h5>
                  <small className="text-white-50 font-mono">
                    {inspectedProject.code} • {inspectedProject.departmentName}
                  </small>
                </div>
                <button type="button" className="btn-close btn-close-white" onClick={() => setInspectProjectId(null)}></button>
              </div>

              <div className="modal-body p-3">
                {/* Reconciliation Strip */}
                {(() => {
                  const budgetVal = Number(inspectedProject.totalBudget ?? inspectedProject.approvedBudget ?? inspectedProject.budget ?? 0);
                  const spentVal = Number(inspectedProject.spent ?? inspectedProject.actualSpend ?? 0);
                  const pendingInvVal = Number(inspectedProject.pendingInvoicesAmount ?? 0);
                  const openLpoVal = Number(inspectedProject.committedSpend ?? 0);
                  const netRemaining = Number(inspectedProject.remainingBudget ?? inspectedProject.remaining ?? 0);
                  const totalInvoicedVal = Number(inspectedProject.invoicedAmount ?? 0);

                  return (
                    <div className="row g-2 mb-3">
                      <div className="col-6 col-md">
                        <div className="p-2.5 rounded bg-light border text-center h-100">
                          <div className="text-muted extra-small text-uppercase">Project Budget</div>
                          <div className="fw-bold text-dark fs-6">{budgetVal.toLocaleString()} {settings.currencySymbol}</div>
                        </div>
                      </div>
                      <div className="col-6 col-md">
                        <div className="p-2.5 rounded bg-light border text-center h-100">
                          <div className="text-muted extra-small text-uppercase">Total Invoiced ({inspectedProject.invoiceCount ?? 0})</div>
                          <div className="fw-bold text-primary fs-6">{totalInvoicedVal.toLocaleString()} {settings.currencySymbol}</div>
                        </div>
                      </div>
                      <div className="col-6 col-md">
                        <div className="p-2.5 rounded bg-light border text-center h-100">
                          <div className="text-muted extra-small text-uppercase">Paid / Settled Spend</div>
                          <div className="fw-bold text-danger fs-6">{spentVal.toLocaleString()} {settings.currencySymbol}</div>
                        </div>
                      </div>
                      <div className="col-6 col-md">
                        <div className="p-2.5 rounded bg-warning-subtle border border-warning-subtle text-center h-100">
                          <div className="text-muted extra-small text-uppercase">Pending Invoices ({inspectedProject.pendingInvoicesCount ?? 0})</div>
                          <div className="fw-bold text-warning-emphasis fs-6">{pendingInvVal.toLocaleString()} {settings.currencySymbol}</div>
                        </div>
                      </div>
                      <div className="col-12 col-md">
                        <div className={`p-2.5 rounded border text-center h-100 ${netRemaining < 0 ? 'bg-danger-subtle border-danger' : 'bg-success-subtle border-success'}`}>
                          <div className="text-muted extra-small text-uppercase">Net Pending Balance</div>
                          <div className={`fw-bold fs-6 ${netRemaining < 0 ? 'text-danger' : 'text-success'}`}>
                            {netRemaining.toLocaleString()} {settings.currencySymbol}
                          </div>
                          {openLpoVal > 0 && (
                            <div className="extra-small text-muted">After {openLpoVal.toLocaleString()} open LPOs</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Action Header + Inline Add Invoice Panel */}
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h6 className="fw-bold mb-0 text-dark">
                    Registered Invoices for {inspectedProject.name} ({inspectedInvoices.length})
                  </h6>
                  {role !== 'Viewer' && (
                    <button
                      type="button"
                      className={`btn btn-sm ${showQuickInvoiceForm ? 'btn-outline-secondary' : 'btn-danger'}`}
                      onClick={() => setShowQuickInvoiceForm(!showQuickInvoiceForm)}
                    >
                      <i className={`bi ${showQuickInvoiceForm ? 'bi-x-lg' : 'bi-plus-circle'} me-1`}></i>
                      {showQuickInvoiceForm ? 'Close Form' : 'Add Invoice to Project'}
                    </button>
                  )}
                </div>

                {showQuickInvoiceForm && (
                  <form onSubmit={handleSaveQuickInvoice} className="card p-3 mb-3 bg-light border">
                    <div className="row g-2">
                      <div className="col-12 col-md-3">
                        <label className="form-label extra-small fw-semibold mb-1">Invoice Number *</label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          required
                          value={qiNumber}
                          onChange={(e) => setQiNumber(e.target.value)}
                        />
                      </div>
                      <div className="col-12 col-md-3">
                        <label className="form-label extra-small fw-semibold mb-1">Supplier / Vendor *</label>
                        <select
                          className="form-select form-select-sm"
                          required
                          value={qiSupplierId}
                          onChange={(e) => setQiSupplierId(e.target.value)}
                        >
                          <option value="">-- Select Vendor --</option>
                          {allSuppliers.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-6 col-md-3">
                        <label className="form-label extra-small fw-semibold mb-1">Linked LPO (Optional)</label>
                        <select
                          className="form-select form-select-sm"
                          value={qiLpoNumber}
                          onChange={(e) => {
                            const val = e.target.value;
                            setQiLpoNumber(val);
                            const matched = inspectedLpos.find((l) => l.lpoNumber === val) || allLpos.find((l) => l.lpoNumber === val);
                            if (matched) {
                              setQiSupplierId(matched.supplierId);
                              setQiEntity(matched.legalEntity);
                            }
                          }}
                        >
                          <option value="">-- Direct Invoice --</option>
                          {(inspectedLpos.length > 0 ? inspectedLpos : allLpos).map((l) => (
                            <option key={l.id} value={l.lpoNumber}>
                              {l.lpoNumber} ({Number(l.totalLpoValue ?? 0).toLocaleString()})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-6 col-md-3">
                        <label className="form-label extra-small fw-semibold mb-1">Entity & Date *</label>
                        <div className="input-group input-group-sm">
                          <select
                            className="form-select form-select-sm"
                            value={qiEntity}
                            onChange={(e) => setQiEntity(e.target.value as any)}
                          >
                            <option value="PACL">PACL</option>
                            <option value="PGIL">PGIL</option>
                            <option value="Shared">Shared</option>
                          </select>
                          <input
                            type="date"
                            className="form-control form-control-sm"
                            required
                            value={qiDate}
                            onChange={(e) => setQiDate(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="col-6 col-md-3">
                        <label className="form-label extra-small fw-semibold mb-1">Amount Excl. VAT *</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          className="form-control form-control-sm font-monospace"
                          required
                          value={qiAmountNet}
                          onChange={(e) => {
                            const raw = e.target.value;
                            setQiAmountNet(raw);
                            if (qiHasVat) {
                              const rate = (settings.vatRatePercent ?? 16) / 100;
                              setQiVat(String(Number((Number(raw || 0) * rate).toFixed(10))));
                            }
                          }}
                        />
                      </div>
                      <div className="col-6 col-md-3">
                        <label className="form-label extra-small fw-semibold mb-1 d-flex justify-content-between">
                          <span>VAT ({settings.vatRatePercent ?? 16}%)</span>
                          <span className="form-check form-check-inline m-0">
                            <input
                              type="checkbox"
                              className="form-check-input"
                              checked={qiHasVat}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setQiHasVat(checked);
                                if (checked) {
                                  const rate = (settings.vatRatePercent ?? 16) / 100;
                                  setQiVat(String(Number((Number(qiAmountNet || 0) * rate).toFixed(10))));
                                } else {
                                  setQiVat('0');
                                }
                              }}
                            />
                          </span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          disabled={!qiHasVat}
                          className="form-control form-control-sm font-monospace"
                          value={qiHasVat ? qiVat : '0'}
                          onChange={(e) => setQiVat(e.target.value)}
                        />
                      </div>
                      <div className="col-6 col-md-2">
                        <label className="form-label extra-small fw-semibold mb-1">Status</label>
                        <select
                          className="form-select form-select-sm"
                          value={qiStatus}
                          onChange={(e) => setQiStatus(e.target.value as InvoiceRecord['paymentStatus'])}
                        >
                          <option value="Pending">Pending</option>
                          <option value="Submitted">Submitted</option>
                          <option value="Approved">Approved</option>
                          <option value="Partially Paid">Partially Paid</option>
                          <option value="Paid">Paid</option>
                        </select>
                      </div>
                      <div className="col-6 col-md-4">
                        <label className="form-label extra-small fw-semibold mb-1">Description / Notes</label>
                        <div className="input-group input-group-sm">
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="Milestone or service details..."
                            value={qiDescription}
                            onChange={(e) => setQiDescription(e.target.value)}
                          />
                          <button type="submit" className="btn btn-danger btn-sm fw-semibold">
                            Save Invoice
                          </button>
                        </div>
                      </div>
                    </div>
                  </form>
                )}

                {/* Project Invoices Table */}
                <div className="table-responsive border rounded">
                  <table className="table table-sm table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr className="extra-small text-uppercase text-muted">
                        <th>Invoice No.</th>
                        <th>Date</th>
                        <th>Vendor / Supplier</th>
                        <th>LPO Ref</th>
                        <th>Entity</th>
                        <th className="text-end">Excl. VAT</th>
                        <th className="text-end">VAT</th>
                        <th className="text-end">Total ({settings.currencySymbol})</th>
                        <th>Status</th>
                        {role !== 'Viewer' && <th className="text-center">Action</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {inspectedInvoices.length === 0 ? (
                        <tr>
                          <td colSpan={role !== 'Viewer' ? 10 : 9} className="text-center py-4 text-muted fs-7">
                            No invoices recorded for this project yet.
                          </td>
                        </tr>
                      ) : (
                        inspectedInvoices.map((inv) => (
                          <tr key={inv.id}>
                            <td className="fw-bold font-monospace text-danger small">{inv.invoiceNumber}</td>
                            <td className="small text-muted">{inv.invoiceDate}</td>
                            <td className="small">
                              <div className="fw-semibold text-dark">{inv.supplierName || inv.vendorName}</div>
                              {inv.description && <div className="extra-small text-muted">{inv.description}</div>}
                            </td>
                            <td className="small font-monospace text-muted">{inv.lpoNumber || 'Direct'}</td>
                            <td>
                              <span className={`badge ${inv.legalEntity === 'PGIL' ? 'bg-danger' : inv.legalEntity === 'PACL' ? 'bg-dark' : 'bg-primary'}`}>
                                {inv.legalEntity}
                              </span>
                            </td>
                            <td className="text-end small font-monospace">
                              {Number(inv.amountBeforeVat || 0).toLocaleString(undefined, { maximumFractionDigits: 10 })}
                            </td>
                            <td className="text-end small font-monospace">
                              {Number(inv.vatAmount || 0).toLocaleString(undefined, { maximumFractionDigits: 10 })}
                            </td>
                            <td className="text-end fw-bold font-monospace small">
                              {Number(inv.totalAmount || 0).toLocaleString(undefined, { maximumFractionDigits: 10 })}
                            </td>
                            <td>
                              <span
                                className={`badge ${
                                  inv.paymentStatus === 'Paid'
                                    ? 'bg-success'
                                    : inv.paymentStatus === 'Rejected'
                                    ? 'bg-danger'
                                    : inv.paymentStatus === 'Approved'
                                    ? 'bg-primary'
                                    : 'bg-warning text-dark'
                                }`}
                              >
                                {inv.paymentStatus}
                              </span>
                            </td>
                            {role !== 'Viewer' && (
                              <td className="text-center">
                                {inv.paymentStatus !== 'Paid' && inv.paymentStatus !== 'Rejected' ? (
                                  <button
                                    type="button"
                                    className="btn btn-outline-success btn-sm py-0 px-2 extra-small"
                                    onClick={() => handleMarkInvoicePaid(inv)}
                                  >
                                    Mark Paid
                                  </button>
                                ) : (
                                  <span className="text-muted extra-small">—</span>
                                )}
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="modal-footer py-2 px-3 bg-light">
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setInspectProjectId(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Form */}
      {showModal && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content shadow-lg border-0">
              <div className="modal-header bg-dark text-white py-2.5 px-3">
                <h5 className="modal-title fw-bold fs-6">{editingProj ? 'Edit Project' : 'Create New Project'}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowModal(false)}></button>
              </div>

              <form onSubmit={handleSave}>
                <div className="modal-body p-3">
                  <div className="row g-3">
                    <div className="col-md-4">
                      <label className="form-label fw-semibold fs-7">Project Code *</label>
                      <input type="text" className="form-control fs-7" value={code} onChange={(e) => setCode(e.target.value)} required />
                    </div>

                    <div className="col-md-8">
                      <label className="form-label fw-semibold fs-7">Project Name *</label>
                      <input type="text" className="form-control fs-7" value={name} onChange={(e) => setName(e.target.value)} required />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label fw-semibold fs-7">Department *</label>
                      <select className="form-select fs-7" value={deptId} onChange={(e) => setDeptId(e.target.value)} required>
                        {depts.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-md-4">
                      <label className="form-label fw-semibold fs-7">Funding Type *</label>
                      <select className="form-select fs-7" value={projectType} onChange={(e) => setProjectType(e.target.value as ProjectType)}>
                        <option value="Shared Project">Shared Project (PACL & PGIL)</option>
                        <option value="PACL Standalone">PACL Standalone</option>
                        <option value="PGIL Standalone">PGIL Standalone</option>
                      </select>
                    </div>

                    <div className="col-md-4">
                      <label className="form-label fw-semibold fs-7">Project Manager *</label>
                      <input type="text" className="form-control fs-7" value={pm} onChange={(e) => setPm(e.target.value)} required />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label fw-semibold fs-7">Budget Cap ({settings.currencySymbol}) *</label>
                      <input
                        type="number"
                        className="form-control fs-7"
                        value={budget}
                        onChange={(e) => setBudget(Number(e.target.value))}
                        required
                      />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label fw-semibold fs-7">Start Date *</label>
                      <input type="date" className="form-control fs-7" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label fw-semibold fs-7">End Date *</label>
                      <input type="date" className="form-control fs-7" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label fw-semibold fs-7">Status *</label>
                      <select className="form-select fs-7" value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
                        <option value="In Progress">In Progress</option>
                        <option value="Planning">Planning</option>
                        <option value="Completed">Completed</option>
                        <option value="Delayed">Delayed</option>
                        <option value="On Hold">On Hold</option>
                      </select>
                    </div>

                    <div className="col-12">
                      <label className="form-label fw-semibold fs-7">Description</label>
                      <textarea
                        className="form-control fs-7"
                        rows={2}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                      ></textarea>
                    </div>
                  </div>
                </div>

                <div className="modal-footer py-2 px-3">
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-corporate btn-sm">
                    {editingProj ? 'Save Changes' : 'Create Project'}
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
