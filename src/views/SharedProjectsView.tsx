import React, { useState, useMemo } from 'react';
import { DatabaseService } from '../services/db';
import { ExcelService } from '../services/excelService';
import { PDFService } from '../services/pdfService';
import { Project, RoleType } from '../types';
import { confirmDialog, showToast } from '../services/uiFeedback';

interface SharedProjectsViewProps {
  role: RoleType;
  onNavigateToTab?: (tab: string) => void;
  onRefresh: () => void;
  embedded?: boolean;
}

export const SharedProjectsView: React.FC<SharedProjectsViewProps> = ({ role, onRefresh, embedded = false }) => {
  const projs = DatabaseService.getProjects();
  const exps = DatabaseService.getExpenditures();
  const invoices = DatabaseService.getInvoices();
  const settings = DatabaseService.getSettings();

  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedInitiative, setSelectedInitiative] = useState('');
  const [inspectProjectId, setInspectProjectId] = useState<string | null>(null);

  // Allocation Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // Form states for allocation modal
  const [totalBudget, setTotalBudget] = useState<number>(0);
  const [paclAmount, setPaclAmount] = useState<number>(0);
  const [pgilAmount, setPgilAmount] = useState<number>(0);
  const [splitMethod, setSplitMethod] = useState<'ratio' | 'custom'>('ratio');
  const [paclRatio, setPaclRatio] = useState<number>(60);
  const [pgilRatio, setPgilRatio] = useState<number>(40);

  // Filter only Shared Projects
  const sharedProjectsList = useMemo(() => {
    return projs.filter((p) => p.projectType === 'Shared Project' || p.entity === 'Shared' || (p.paclApplicable && p.pgilApplicable));
  }, [projs]);

  // Compute calculated metrics for each shared project
  const sharedProjectCalculations = useMemo(() => {
    const norm = (v?: string) => (v || '').trim().toLowerCase();
    const cleanRef = (v?: string) => (v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const isForProj = (p: Project, r: { projectId?: string; projectName?: string }) =>
      Boolean(
        (r.projectId && (r.projectId === p.id || norm(r.projectId) === norm(p.code))) ||
          (r.projectName && p.name && norm(r.projectName) === norm(p.name))
      );

    return sharedProjectsList.map((p) => {
      const budget = Number(p.totalBudget || p.approvedBudget || p.budget || 0);
      const paclAlloc = Number(p.paclAllocation ?? budget * 0.6);
      const pgilAlloc = Number(p.pgilAllocation ?? budget * 0.4);
      const paclShareRatio = budget > 0 ? paclAlloc / budget : 0.6;

      const relatedExps = exps.filter((e) => isForProj(p, e));
      const matchedExpInvoiceNums = new Set(
        relatedExps.map((e) => cleanRef(e.invoiceNumber)).filter(Boolean)
      );

      const relatedInvoices = invoices.filter((inv) => isForProj(p, inv) && inv.paymentStatus !== 'Rejected');
      const paidInvoices = relatedInvoices.filter((inv) => inv.paymentStatus === 'Paid');
      const pendingInvoices = relatedInvoices.filter((inv) => inv.paymentStatus !== 'Paid');

      const unrecordedPaidInvs = paidInvoices.filter((inv) => {
        const invRef = cleanRef(inv.invoiceNumber);
        return !invRef || !matchedExpInvoiceNums.has(invRef);
      });

      const paclExps = relatedExps.filter((e) => e.legalEntity === 'PACL');
      const pgilExps = relatedExps.filter((e) => e.legalEntity === 'PGIL');

      const paclUnrecPaid = unrecordedPaidInvs.reduce((sum, inv) => {
        const amt = Number(inv.totalAmount || 0);
        if (inv.legalEntity === 'PACL') return sum + amt;
        if (inv.legalEntity === 'PGIL') return sum;
        return sum + amt * paclShareRatio;
      }, 0);

      const pgilUnrecPaid = unrecordedPaidInvs.reduce((sum, inv) => {
        const amt = Number(inv.totalAmount || 0);
        if (inv.legalEntity === 'PGIL') return sum + amt;
        if (inv.legalEntity === 'PACL') return sum;
        return sum + amt * (1 - paclShareRatio);
      }, 0);

      const paclActual =
        p.paclActual !== undefined && p.paclActual > 0
          ? p.paclActual
          : paclExps.reduce((sum, e) => sum + Number(e.totalAmount || 0), 0) + paclUnrecPaid;

      const pgilActual =
        p.pgilActual !== undefined && p.pgilActual > 0
          ? p.pgilActual
          : pgilExps.reduce((sum, e) => sum + Number(e.totalAmount || 0), 0) + pgilUnrecPaid;

      const totalActual = paclActual + pgilActual;
      const pendingInvoicesVal = pendingInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);
      const committedLpoVal = Number(p.committedSpend ?? 0);
      const remaining = budget - totalActual - pendingInvoicesVal - committedLpoVal;
      const obligated = totalActual + pendingInvoicesVal + committedLpoVal;
      const utilization = budget > 0 ? (obligated / budget) * 100 : 0;
      const paclUtil = paclAlloc > 0 ? (paclActual / paclAlloc) * 100 : 0;
      const pgilUtil = pgilAlloc > 0 ? (pgilActual / pgilAlloc) * 100 : 0;

      const isBalanced = Math.abs(paclAlloc + pgilAlloc - budget) <= 1;
      const isOverBudget = budget > 0 && obligated > budget;

      return {
        ...p,
        totalBudgetVal: budget,
        paclAllocVal: paclAlloc,
        pgilAllocVal: pgilAlloc,
        paclActualVal: paclActual,
        pgilActualVal: pgilActual,
        totalActualVal: totalActual,
        pendingInvoicesVal,
        pendingInvoicesCountVal: pendingInvoices.length,
        totalInvoicesCountVal: relatedInvoices.length,
        committedLpoVal,
        remainingVal: remaining,
        utilizationVal: utilization,
        paclUtilVal: paclUtil,
        pgilUtilVal: pgilUtil,
        isBalanced,
        isOverBudget,
      };
    });
  }, [sharedProjectsList, exps, invoices]);

  // Filtered List
  const filteredSharedProjects = useMemo(() => {
    return sharedProjectCalculations.filter((p) => {
      if (selectedStatus && p.status !== selectedStatus) return false;
      if (selectedInitiative && p.strategicInitiative !== selectedInitiative) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchCode = (p.code || '').toLowerCase().includes(q);
        const matchName = (p.name || '').toLowerCase().includes(q);
        const matchCat = (p.campaignType || p.budgetCategory || '').toLowerCase().includes(q);
        if (!matchCode && !matchName && !matchCat) return false;
      }
      return true;
    });
  }, [sharedProjectCalculations, selectedStatus, selectedInitiative, search]);

  // Summary Metrics
  const summary = useMemo(() => {
    const totalSharedBudget = filteredSharedProjects.reduce((sum, p) => sum + p.totalBudgetVal, 0);
    const totalPaclAlloc = filteredSharedProjects.reduce((sum, p) => sum + p.paclAllocVal, 0);
    const totalPgilAlloc = filteredSharedProjects.reduce((sum, p) => sum + p.pgilAllocVal, 0);
    const totalActual = filteredSharedProjects.reduce((sum, p) => sum + p.totalActualVal, 0);
    const totalPendingInvoices = filteredSharedProjects.reduce((sum, p) => sum + p.pendingInvoicesVal, 0);
    const totalCommittedLpos = filteredSharedProjects.reduce((sum, p) => sum + p.committedLpoVal, 0);
    const totalPaclActual = filteredSharedProjects.reduce((sum, p) => sum + p.paclActualVal, 0);
    const totalPgilActual = filteredSharedProjects.reduce((sum, p) => sum + p.pgilActualVal, 0);
    const totalRemaining = filteredSharedProjects.reduce((sum, p) => sum + p.remainingVal, 0);
    const overallUtil = totalSharedBudget > 0 ? ((totalActual + totalPendingInvoices + totalCommittedLpos) / totalSharedBudget) * 100 : 0;
    const unbalancedCount = filteredSharedProjects.filter((p) => !p.isBalanced).length;

    return {
      totalSharedBudget,
      totalPaclAlloc,
      totalPgilAlloc,
      totalActual,
      totalPendingInvoices,
      totalPaclActual,
      totalPgilActual,
      totalRemaining,
      overallUtil,
      unbalancedCount,
      count: filteredSharedProjects.length,
    };
  }, [filteredSharedProjects]);

  const handleOpenAllocationModal = (p: Project) => {
    setSelectedProject(p);
    const b = Number(p.totalBudget || p.approvedBudget || p.budget || 0);
    setTotalBudget(b);
    const pa = Number(p.paclAllocation ?? b * 0.6);
    const pg = Number(p.pgilAllocation ?? b * 0.4);
    setPaclAmount(pa);
    setPgilAmount(pg);
    if (b > 0) {
      setPaclRatio(Math.round((pa / b) * 100));
      setPgilRatio(Math.round((pg / b) * 100));
    }
    setShowModal(true);
  };

  const handleRatioChange = (paclPct: number) => {
    const clampedPacl = Math.max(0, Math.min(100, paclPct));
    const clampedPgil = 100 - clampedPacl;
    setPaclRatio(clampedPacl);
    setPgilRatio(clampedPgil);
    setPaclAmount(Math.round((totalBudget * clampedPacl) / 100));
    setPgilAmount(Math.round((totalBudget * clampedPgil) / 100));
  };

  const handleSaveAllocations = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;

    if (Math.abs(paclAmount + pgilAmount - totalBudget) > 1) {
      const proceed = await confirmDialog({
        title: 'Allocation Sum Mismatch',
        message: 'PACL Allocation + PGIL Allocation does not equal Total Budget. Do you still want to save?',
        confirmLabel: 'Save Anyway',
        variant: 'warning',
      });
      if (!proceed) {
        return;
      }
    }

    const updatedProject: Project = {
      ...selectedProject,
      totalBudget,
      approvedBudget: totalBudget,
      budget: totalBudget,
      paclAllocation: paclAmount,
      pgilAllocation: pgilAmount,
      notes: `${selectedProject.notes || ''} | Allocation updated: PACL ${paclAmount.toLocaleString()} KES, PGIL ${pgilAmount.toLocaleString()} KES.`,
    };

    DatabaseService.saveProject(updatedProject, `${role} User`, role);
    showToast('Shared project co-funding allocations updated.', 'success');
    onRefresh();
    setShowModal(false);
  };

  const handleExportExcel = () => {
    const exportData = filteredSharedProjects.map((p) => ({
      'Project Code': p.code,
      'Project Name': p.name,
      'Category': p.campaignType || p.budgetCategory || 'Marketing & CX',
      'Total Budget (KES)': p.totalBudgetVal,
      'PACL Allocation (KES)': p.paclAllocVal,
      'PGIL Allocation (KES)': p.pgilAllocVal,
      'PACL Actual (KES)': p.paclActualVal,
      'PGIL Actual (KES)': p.pgilActualVal,
      'Total Actual Spend (KES)': p.totalActualVal,
      'Remaining Balance (KES)': p.remainingVal,
      'Utilization %': `${p.utilizationVal.toFixed(1)}%`,
      'Status': p.status,
      'Allocation Balanced': p.isBalanced ? 'YES' : 'NO - MISMATCH',
    }));
    ExcelService.exportCustomDataset(exportData, 'Shared_Projects_Allocation_Report');
  };

  const handleExportPDF = () => {
    const cols = ['Project Code', 'Project Name', 'Total Budget', 'PACL Share', 'PGIL Share', 'Total Spend', 'Remaining', 'Utilization', 'Status'];
    const rows = filteredSharedProjects.map((p) => [
      p.code,
      p.name,
      `${p.totalBudgetVal.toLocaleString()} ${settings.currencySymbol}`,
      `${p.paclAllocVal.toLocaleString()} ${settings.currencySymbol}`,
      `${p.pgilAllocVal.toLocaleString()} ${settings.currencySymbol}`,
      `${p.totalActualVal.toLocaleString()} ${settings.currencySymbol}`,
      `${p.remainingVal.toLocaleString()} ${settings.currencySymbol}`,
      `${p.utilizationVal.toFixed(1)}%`,
      p.status,
    ]);
    PDFService.generateReportPDF('SHARED PROJECTS CO-FUNDING & ALLOCATION REPORT', 'PACL & PGIL Co-Funded Marketing & CX Initiatives', cols, rows, settings);
  };

  return (
    <div className="d-flex flex-column gap-4">
      {/* Header */}
      {!embedded ? (
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 pb-2 border-bottom">
          <div>
            <div className="d-flex align-items-center gap-2">
              <h3 className="fw-bold mb-0 text-dark" style={{ fontFamily: 'Tahoma, sans-serif' }}>
                Shared Projects Workspace
              </h3>
              <span className="badge bg-primary text-white px-2 py-1">PACL & PGIL Co-Funded</span>
            </div>
            <p className="text-muted small mb-0 mt-1">
              Manage projects funded jointly by Pioneer Assurance Company Limited (PACL) and Pioneer General Insurance Limited (PGIL).
            </p>
          </div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <button id="btn-export-excel-shared" onClick={handleExportExcel} className="btn btn-outline-success btn-sm d-flex align-items-center gap-1 shadow-sm">
              <i className="bi bi-file-earmark-excel"></i> Export Excel
            </button>
            <button id="btn-export-pdf-shared" onClick={handleExportPDF} className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1 shadow-sm">
              <i className="bi bi-file-earmark-pdf"></i> Export PDF
            </button>
          </div>
        </div>
      ) : (
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
          <span className="badge bg-primary text-white px-2.5 py-1.5">
            <i className="bi bi-diagram-3-fill me-1"></i> PACL &amp; PGIL Co-Funding Split Engine ({summary.count} Shared)
          </span>
          <div className="d-flex align-items-center gap-2">
            <button id="btn-export-excel-shared" onClick={handleExportExcel} className="btn btn-outline-success btn-sm d-flex align-items-center gap-1 shadow-sm">
              <i className="bi bi-file-earmark-excel"></i> Export Excel
            </button>
            <button id="btn-export-pdf-shared" onClick={handleExportPDF} className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1 shadow-sm">
              <i className="bi bi-file-earmark-pdf"></i> Export PDF
            </button>
          </div>
        </div>
      )}

      {/* Validation Rule Alert */}
      <div className="alert alert-info d-flex align-items-center justify-content-between py-2 px-3 mb-0 shadow-sm border-start border-4 border-info">
        <div className="d-flex align-items-center gap-2 small">
          <i className="bi bi-shield-check fs-5 text-info"></i>
          <div>
            <strong>Financial Integrity Rule:</strong> Every shared project enforces{' '}
            <code className="text-dark bg-white px-1 rounded">PACL Allocation + PGIL Allocation = Total Shared Project Budget</code>.
          </div>
        </div>
        {summary.unbalancedCount > 0 && (
          <span className="badge bg-danger text-white px-2 py-1">
            <i className="bi bi-exclamation-triangle-fill me-1"></i>
            {summary.unbalancedCount} Project{summary.unbalancedCount > 1 ? 's' : ''} Out of Balance!
          </span>
        )}
      </div>

      {/* KPI Cards */}
      <div className="row g-3">
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card card-erp p-3 border-start border-4 border-primary h-100 shadow-sm">
            <span className="text-muted small text-uppercase fw-semibold">Total Shared Budget</span>
            <div className="fs-5 fw-bold text-dark mt-1">
              {summary.totalSharedBudget.toLocaleString()} <span className="small text-muted">{settings.currencySymbol}</span>
            </div>
            <span className="text-muted extra-small mt-1">{summary.count} Shared Initiatives</span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card card-erp p-3 border-start border-4 border-dark h-100 shadow-sm">
            <div className="d-flex justify-content-between align-items-center">
              <span className="text-muted small text-uppercase fw-semibold">PACL Share</span>
              <span className="badge bg-dark text-white extra-small">PACL</span>
            </div>
            <div className="fs-5 fw-bold text-dark mt-1">
              {summary.totalPaclAlloc.toLocaleString()} <span className="small text-muted">{settings.currencySymbol}</span>
            </div>
            <span className="text-danger extra-small mt-1">Spent: {summary.totalPaclActual.toLocaleString()} {settings.currencySymbol}</span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card card-erp p-3 border-start border-4 border-danger h-100 shadow-sm">
            <div className="d-flex justify-content-between align-items-center">
              <span className="text-muted small text-uppercase fw-semibold">PGIL Share</span>
              <span className="badge bg-danger text-white extra-small">PGIL</span>
            </div>
            <div className="fs-5 fw-bold text-danger mt-1">
              {summary.totalPgilAlloc.toLocaleString()} <span className="small text-muted">{settings.currencySymbol}</span>
            </div>
            <span className="text-danger extra-small mt-1">Spent: {summary.totalPgilActual.toLocaleString()} {settings.currencySymbol}</span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card card-erp p-3 border-start border-4 border-success h-100 shadow-sm">
            <span className="text-muted small text-uppercase fw-semibold">Total Actual Spend</span>
            <div className="fs-5 fw-bold text-danger mt-1">
              {summary.totalActual.toLocaleString()} <span className="small text-muted">{settings.currencySymbol}</span>
            </div>
            <div className="d-flex justify-content-between align-items-center extra-small mt-1">
              <span className="text-muted">Remaining: {summary.totalRemaining.toLocaleString()}</span>
              <span className="fw-bold text-primary">{summary.overallUtil.toFixed(1)}% Utilized</span>
            </div>
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
                id="input-search-shared-projects"
                type="text"
                className="form-control form-control-sm border-start-0"
                placeholder="Search shared project name, code, category..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="col-6 col-md-3">
            <select
              id="select-shared-status"
              className="form-select form-select-sm"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="">All Project Statuses</option>
              <option value="Planning">Planning / Draft</option>
              <option value="In Progress">In Progress</option>
              <option value="On Hold">On Hold</option>
              <option value="Completed">Completed</option>
            </select>
          </div>

          <div className="col-6 col-md-3">
            <select
              id="select-shared-initiative"
              className="form-select form-select-sm"
              value={selectedInitiative}
              onChange={(e) => setSelectedInitiative(e.target.value)}
            >
              <option value="">All Strategic Initiatives</option>
              {settings.strategicInitiatives.map((si) => (
                <option key={si} value={si}>
                  {si}
                </option>
              ))}
            </select>
          </div>

          <div className="col-12 col-md-1 text-end">
            <button
              id="btn-reset-shared-filters"
              onClick={() => {
                setSearch('');
                setSelectedStatus('');
                setSelectedInitiative('');
              }}
              className="btn btn-outline-secondary btn-sm w-100"
              title="Reset Filters"
            >
              <i className="bi bi-arrow-counterclockwise"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Main Shared Projects Table */}
      <div className="card card-erp shadow-sm overflow-hidden">
        <div className="card-header bg-white py-3 px-4 d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-2">
            <h6 className="mb-0 fw-bold text-dark">Shared Project Portfolio & Co-Funding Split</h6>
            <span className="badge bg-light text-dark border">
              {filteredSharedProjects.length} Initiatives
            </span>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0 erp-table">
            <thead className="table-light">
              <tr className="small text-uppercase text-muted">
                <th style={{ width: '130px' }}>Project Code</th>
                <th>Project Name & Focus</th>
                <th className="text-end">Total Budget</th>
                <th className="text-end bg-dark-subtle bg-opacity-25">PACL Allocation</th>
                <th className="text-end bg-danger-subtle bg-opacity-25">PGIL Allocation</th>
                <th className="text-end">PACL Spent</th>
                <th className="text-end">PGIL Spent</th>
                <th className="text-end">Total Spent</th>
                <th className="text-end">Pending Invoices</th>
                <th className="text-end">Pending Balance</th>
                <th style={{ width: '120px' }}>Utilization</th>
                <th>Balance Check</th>
                <th className="text-center" style={{ width: '100px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSharedProjects.length === 0 ? (
                <tr>
                  <td colSpan={13} className="text-center py-5 text-muted">
                    <i className="bi bi-diagram-3 fs-2 d-block mb-2 text-secondary opacity-50"></i>
                    No shared projects found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredSharedProjects.map((p) => {
                  const utilColor = p.utilizationVal > 100 ? 'bg-danger' : p.utilizationVal > 85 ? 'bg-warning' : 'bg-success';
                  return (
                    <tr key={p.id} className={!p.isBalanced ? 'table-warning' : p.isOverBudget ? 'table-danger bg-opacity-25' : ''}>
                      <td>
                        <span className="fw-semibold text-dark">{p.code}</span>
                        <div className="extra-small text-muted">{p.status}</div>
                      </td>
                      <td>
                        <div className="fw-bold text-dark">{p.name}</div>
                        <div className="extra-small text-muted">{p.strategicInitiative || p.campaignType || 'Marketing Initiative'}</div>
                      </td>
                      <td className="text-end fw-bold text-dark">
                        {p.totalBudgetVal.toLocaleString()} <span className="extra-small text-muted">{settings.currencySymbol}</span>
                      </td>
                      <td className="text-end bg-dark-subtle bg-opacity-10 fw-semibold">
                        {p.paclAllocVal.toLocaleString()}
                        <div className="extra-small text-muted">
                          {p.totalBudgetVal > 0 ? `${((p.paclAllocVal / p.totalBudgetVal) * 100).toFixed(0)}%` : ''}
                        </div>
                      </td>
                      <td className="text-end bg-danger-subtle bg-opacity-10 fw-semibold text-danger">
                        {p.pgilAllocVal.toLocaleString()}
                        <div className="extra-small text-muted">
                          {p.totalBudgetVal > 0 ? `${((p.pgilAllocVal / p.totalBudgetVal) * 100).toFixed(0)}%` : ''}
                        </div>
                      </td>
                      <td className="text-end text-muted small">
                        {p.paclActualVal.toLocaleString()}
                      </td>
                      <td className="text-end text-muted small">
                        {p.pgilActualVal.toLocaleString()}
                      </td>
                      <td className="text-end text-danger fw-bold">
                        {p.totalActualVal.toLocaleString()} <span className="extra-small text-muted">{settings.currencySymbol}</span>
                      </td>
                      <td className="text-end">
                        <button
                          type="button"
                          className="btn btn-link p-0 text-decoration-none fw-bold text-warning-emphasis"
                          title="Inspect all project invoices"
                          onClick={() => setInspectProjectId(p.id)}
                        >
                          {p.pendingInvoicesVal.toLocaleString()}
                        </button>
                        <div className="extra-small text-muted">
                          {p.pendingInvoicesCountVal} pending / {p.totalInvoicesCountVal} total
                        </div>
                      </td>
                      <td className={`text-end fw-bold ${p.remainingVal < 0 ? 'text-danger' : 'text-success'}`}>
                        {p.remainingVal.toLocaleString()}
                      </td>
                      <td>
                        <div className="d-flex justify-content-between extra-small mb-1">
                          <span className="fw-bold">{p.utilizationVal.toFixed(1)}%</span>
                        </div>
                        <div className="progress" style={{ height: '5px' }}>
                          <div
                            className={`progress-bar ${utilColor}`}
                            role="progressbar"
                            style={{ width: `${Math.min(p.utilizationVal, 100)}%` }}
                          ></div>
                        </div>
                      </td>
                      <td>
                        {p.isBalanced ? (
                          <span className="badge bg-success-subtle text-success border border-success extra-small">
                            <i className="bi bi-check2 me-1"></i>Balanced
                          </span>
                        ) : (
                          <span className="badge bg-danger text-white extra-small" title="PACL + PGIL != Total">
                            <i className="bi bi-exclamation-triangle me-1"></i>Mismatch
                          </span>
                        )}
                      </td>
                      <td className="text-center">
                        <div className="btn-group btn-group-sm">
                          <button
                            type="button"
                            onClick={() => setInspectProjectId(p.id)}
                            className="btn btn-outline-secondary btn-sm p-1"
                            title="View Project Invoices & Pending Balance"
                          >
                            <i className="bi bi-receipt"></i>
                          </button>
                          {role !== 'Viewer' && (
                            <button
                              id={`btn-split-project-${p.id}`}
                              onClick={() => handleOpenAllocationModal(p)}
                              className="btn btn-outline-primary btn-sm p-1"
                              title="Adjust PACL / PGIL Allocation Split"
                            >
                              <i className="bi bi-sliders"></i>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredSharedProjects.length > 0 && (
              <tfoot className="table-light fw-bold">
                <tr>
                  <td colSpan={2} className="text-uppercase small">Total Shared Portfolios</td>
                  <td className="text-end">{summary.totalSharedBudget.toLocaleString()} {settings.currencySymbol}</td>
                  <td className="text-end bg-dark-subtle bg-opacity-25">{summary.totalPaclAlloc.toLocaleString()}</td>
                  <td className="text-end bg-danger-subtle bg-opacity-25 text-danger">{summary.totalPgilAlloc.toLocaleString()}</td>
                  <td className="text-end">{summary.totalPaclActual.toLocaleString()}</td>
                  <td className="text-end">{summary.totalPgilActual.toLocaleString()}</td>
                  <td className="text-end text-danger">{summary.totalActual.toLocaleString()}</td>
                  <td className="text-end text-warning-emphasis">{summary.totalPendingInvoices.toLocaleString()}</td>
                  <td className={`text-end ${summary.totalRemaining < 0 ? 'text-danger' : 'text-success'}`}>
                    {summary.totalRemaining.toLocaleString()}
                  </td>
                  <td className="text-center">{summary.overallUtil.toFixed(1)}%</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Allocation Split Modal */}
      {showModal && selectedProject && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content shadow-lg border-0">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title fw-bold">
                  <i className="bi bi-sliders me-2"></i>Adjust Shared Co-Funding Split: {selectedProject.name}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowModal(false)}></button>
              </div>
              <form onSubmit={handleSaveAllocations}>
                <div className="modal-body p-4">
                  <div className="alert alert-light border d-flex justify-content-between align-items-center mb-4">
                    <div>
                      <div className="text-muted small">Project Code:</div>
                      <div className="fw-bold">{selectedProject.code}</div>
                    </div>
                    <div>
                      <div className="text-muted small">Strategic Focus:</div>
                      <div className="fw-bold">{selectedProject.strategicInitiative || selectedProject.campaignType}</div>
                    </div>
                    <div>
                      <div className="text-muted small">Total Project Budget:</div>
                      <div className="fw-bold fs-5 text-primary">
                        {totalBudget.toLocaleString()} {settings.currencySymbol}
                      </div>
                    </div>
                  </div>

                  <div className="row g-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-semibold">Total Approved Project Budget ({settings.currencySymbol})</label>
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        className="form-control"
                        required
                        value={totalBudget}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setTotalBudget(val);
                          setPaclAmount(Math.round((val * paclRatio) / 100));
                          setPgilAmount(Math.round((val * pgilRatio) / 100));
                        }}
                      />
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-semibold">Split Method</label>
                      <div className="btn-group w-100" role="group">
                        <button
                          type="button"
                          className={`btn btn-sm ${splitMethod === 'ratio' ? 'btn-primary' : 'btn-outline-secondary'}`}
                          onClick={() => setSplitMethod('ratio')}
                        >
                          Percentage Ratio (e.g. 60/40)
                        </button>
                        <button
                          type="button"
                          className={`btn btn-sm ${splitMethod === 'custom' ? 'btn-primary' : 'btn-outline-secondary'}`}
                          onClick={() => setSplitMethod('custom')}
                        >
                          Fixed KES Amounts
                        </button>
                      </div>
                    </div>

                    {splitMethod === 'ratio' && (
                      <div className="col-12">
                        <label className="form-label small fw-semibold d-flex justify-content-between">
                          <span>PACL Share: <strong>{paclRatio}%</strong></span>
                          <span>PGIL Share: <strong>{pgilRatio}%</strong></span>
                        </label>
                        <input
                          type="range"
                          className="form-range"
                          min="0"
                          max="100"
                          value={paclRatio}
                          onChange={(e) => handleRatioChange(Number(e.target.value))}
                        />
                        <div className="d-flex justify-content-between extra-small text-muted">
                          <span>100% PACL</span>
                          <span>70/30</span>
                          <span>60/40</span>
                          <span>50/50</span>
                          <span>30/70</span>
                          <span>100% PGIL</span>
                        </div>
                      </div>
                    )}

                    <div className="col-12 col-md-6">
                      <div className="card card-erp p-3 border-start border-4 border-dark">
                        <label className="form-label small fw-semibold text-dark">
                          PACL Allocation Amount ({settings.currencySymbol}) *
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="100"
                          className="form-control"
                          required
                          value={paclAmount}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setPaclAmount(val);
                            if (splitMethod === 'custom') {
                              setPgilAmount(Math.max(0, totalBudget - val));
                            }
                          }}
                        />
                        <div className="extra-small text-muted mt-1">
                          {totalBudget > 0 ? `${((paclAmount / totalBudget) * 100).toFixed(1)}% of total` : ''}
                        </div>
                      </div>
                    </div>

                    <div className="col-12 col-md-6">
                      <div className="card card-erp p-3 border-start border-4 border-danger">
                        <label className="form-label small fw-semibold text-danger">
                          PGIL Allocation Amount ({settings.currencySymbol}) *
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="100"
                          className="form-control"
                          required
                          value={pgilAmount}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setPgilAmount(val);
                            if (splitMethod === 'custom') {
                              setPaclAmount(Math.max(0, totalBudget - val));
                            }
                          }}
                        />
                        <div className="extra-small text-muted mt-1">
                          {totalBudget > 0 ? `${((pgilAmount / totalBudget) * 100).toFixed(1)}% of total` : ''}
                        </div>
                      </div>
                    </div>

                    {/* Balance Check Feedback */}
                    <div className="col-12">
                      <div
                        className={`p-3 rounded d-flex justify-content-between align-items-center ${
                          Math.abs(paclAmount + pgilAmount - totalBudget) <= 1
                            ? 'bg-success-subtle text-success border border-success'
                            : 'bg-danger-subtle text-danger border border-danger'
                        }`}
                      >
                        <div className="d-flex align-items-center gap-2">
                          <i
                            className={`bi ${
                              Math.abs(paclAmount + pgilAmount - totalBudget) <= 1
                                ? 'bi-check-circle-fill fs-5'
                                : 'bi-exclamation-octagon-fill fs-5'
                            }`}
                          ></i>
                          <div>
                            <strong>
                              {Math.abs(paclAmount + pgilAmount - totalBudget) <= 1
                                ? 'Allocations are perfectly balanced!'
                                : 'Allocation Sum Mismatch!'}
                            </strong>
                            <div className="extra-small">
                              PACL ({paclAmount.toLocaleString()}) + PGIL ({pgilAmount.toLocaleString()}) = {(paclAmount + pgilAmount).toLocaleString()} KES.
                            </div>
                          </div>
                        </div>
                        <div className="fw-bold">
                          Variance: {Math.abs(paclAmount + pgilAmount - totalBudget).toLocaleString()} KES
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary px-4">
                    Save Co-Funding Allocations
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Project Invoices & Pending Balance Modal */}
      {inspectProjectId && (() => {
        const target = sharedProjectCalculations.find((p) => p.id === inspectProjectId);
        if (!target) return null;
        const norm = (v?: string) => (v || '').trim().toLowerCase();
        const targetInvs = invoices.filter(
          (inv) =>
            (inv.projectId && (inv.projectId === target.id || norm(inv.projectId) === norm(target.code))) ||
            (inv.projectName && target.name && norm(inv.projectName) === norm(target.name))
        );
        return (
          <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
              <div className="modal-content shadow-lg border-0">
                <div className="modal-header bg-dark text-white py-2.5 px-3">
                  <div>
                    <h5 className="modal-title fw-bold fs-6 mb-0">
                      <i className="bi bi-receipt me-2 text-warning"></i>
                      Invoices & Pending Balance — {target.name}
                    </h5>
                    <small className="text-white-50 font-mono">{target.code}</small>
                  </div>
                  <button type="button" className="btn-close btn-close-white" onClick={() => setInspectProjectId(null)}></button>
                </div>
                <div className="modal-body p-3">
                  <div className="row g-2 mb-3 text-center">
                    <div className="col-6 col-md-3">
                      <div className="p-2 rounded bg-light border">
                        <div className="extra-small text-muted">Budget</div>
                        <div className="fw-bold">{target.totalBudgetVal.toLocaleString()} {settings.currencySymbol}</div>
                      </div>
                    </div>
                    <div className="col-6 col-md-3">
                      <div className="p-2 rounded bg-light border">
                        <div className="extra-small text-muted">Paid / Spent</div>
                        <div className="fw-bold text-danger">{target.totalActualVal.toLocaleString()} {settings.currencySymbol}</div>
                      </div>
                    </div>
                    <div className="col-6 col-md-3">
                      <div className="p-2 rounded bg-warning-subtle border">
                        <div className="extra-small text-muted">Pending Invoices</div>
                        <div className="fw-bold text-warning-emphasis">{target.pendingInvoicesVal.toLocaleString()} {settings.currencySymbol}</div>
                      </div>
                    </div>
                    <div className="col-6 col-md-3">
                      <div className={`p-2 rounded border ${target.remainingVal < 0 ? 'bg-danger-subtle' : 'bg-success-subtle'}`}>
                        <div className="extra-small text-muted">Pending Balance</div>
                        <div className={`fw-bold ${target.remainingVal < 0 ? 'text-danger' : 'text-success'}`}>
                          {target.remainingVal.toLocaleString()} {settings.currencySymbol}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="table-responsive border rounded">
                    <table className="table table-sm table-hover align-middle mb-0">
                      <thead className="table-light">
                        <tr className="extra-small text-uppercase text-muted">
                          <th>Invoice No.</th>
                          <th>Date</th>
                          <th>Vendor</th>
                          <th>Entity</th>
                          <th className="text-end">Total ({settings.currencySymbol})</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {targetInvs.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center py-4 text-muted small">
                              No invoices linked to this shared project yet.
                            </td>
                          </tr>
                        ) : (
                          targetInvs.map((inv) => (
                            <tr key={inv.id}>
                              <td className="fw-bold font-monospace text-danger small">{inv.invoiceNumber}</td>
                              <td className="small text-muted">{inv.invoiceDate}</td>
                              <td className="small">{inv.supplierName || inv.vendorName}</td>
                              <td><span className="badge bg-secondary">{inv.legalEntity}</span></td>
                              <td className="text-end fw-bold font-monospace small">{Number(inv.totalAmount || 0).toLocaleString()}</td>
                              <td>
                                <span className={`badge ${inv.paymentStatus === 'Paid' ? 'bg-success' : inv.paymentStatus === 'Rejected' ? 'bg-danger' : 'bg-warning text-dark'}`}>
                                  {inv.paymentStatus}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="modal-footer bg-light py-2">
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setInspectProjectId(null)}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
