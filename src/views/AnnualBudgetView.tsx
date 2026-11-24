import React, { useState, useMemo } from 'react';
import { DatabaseService } from '../services/db';
import { ExcelService } from '../services/excelService';
import { PDFService } from '../services/pdfService';
import { Budget, RoleType, DrillDownTarget, AmountTraceContext } from '../types';
import { confirmDialog, showToast } from '../services/uiFeedback';

interface AnnualBudgetViewProps {
  role: RoleType;
  onNavigateToTab?: (tab: string) => void;
  onNavigateToExcelWizard?: () => void;
  onRefresh: () => void;
  onDrillDown?: (target: DrillDownTarget) => void;
  onTraceAmount?: (context: AmountTraceContext) => void;
}

export const AnnualBudgetView: React.FC<AnnualBudgetViewProps> = ({
  role,
  onNavigateToTab,
  onNavigateToExcelWizard,
  onRefresh,
  onDrillDown,
  onTraceAmount,
}) => {
  const bdgs = DatabaseService.getBudgets();
  const depts = DatabaseService.getDepartments();
  const projs = DatabaseService.getProjects();
  const exps = DatabaseService.getExpenditures();
  const lpos = DatabaseService.getLPOs();
  const settings = DatabaseService.getSettings();

  const [search, setSearch] = useState('');
  const [selectedFY, setSelectedFY] = useState(settings.financialYear || '2026');
  const [selectedEntity, setSelectedEntity] = useState<string>('All');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);

  // Form Fields
  const [code, setCode] = useState('');
  const [fy, setFy] = useState(settings.financialYear || '2026');
  const [legalEntity, setLegalEntity] = useState<'PACL' | 'PGIL' | 'Shared'>('PACL');
  const [deptId, setDeptId] = useState(depts[0]?.id || '');
  const [projId, setProjId] = useState('');
  const [category, setCategory] = useState(settings.expenseCategories[0] || 'Marketing Campaigns');
  const [allocated, setAllocated] = useState<number>(1000000);
  const [revised, setRevised] = useState<number>(0);
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<Budget['status']>('Approved');

  // Compute calculated metrics per budget item
  const budgetCalculations = useMemo(() => {
    return bdgs.map((b) => {
      // Find matching expenses specifically linked to this budget line or project
      const relatedExps = exps.filter((e) => {
        const matchesBudgetRef =
          e.budgetId === b.id ||
          e.budgetId === b.code ||
          (b.projectId && e.projectId === b.projectId);
        if (!matchesBudgetRef) return false;
        if (b.legalEntity && b.legalEntity !== 'Shared' && e.legalEntity !== b.legalEntity) return false;
        return true;
      });

      // Find committed spend from active unpaid LPOs linked to this budget line or project
      const relatedLpos = lpos.filter((l) => {
        const matchesBudgetRef =
          l.budgetId === b.id ||
          l.budgetCode === b.code ||
          (b.projectId && l.projectId === b.projectId);
        if (!matchesBudgetRef) return false;
        const status = l.lpoStatus || l.status || '';
        const isActive = ['Approved', 'Issued', 'Partially Fulfilled'].includes(status);
        const isUnpaid = l.paymentStatus !== 'Fully Paid' && l.paymentStatus !== 'Paid';
        return isActive && isUnpaid;
      });

      const actualSpent = b.actualExpenditure !== undefined && b.actualExpenditure > 0
        ? b.actualExpenditure
        : relatedExps.reduce((sum, e) => sum + Number(e.totalAmount || 0), 0);

      const committed = b.committedSpend !== undefined && b.committedSpend > 0
        ? b.committedSpend
        : relatedLpos.reduce((sum, l) => sum + Number(l.totalLpoValue ?? l.totalLpoAmount ?? 0), 0);

      const effectiveBudget = Number(b.revisedBudget || b.allocatedAmount || 0);
      const remaining = effectiveBudget - actualSpent - committed;
      const utilization = effectiveBudget > 0 ? (actualSpent / effectiveBudget) * 100 : 0;
      const isOverBudget = effectiveBudget > 0 && actualSpent > effectiveBudget;

      return {
        ...b,
        computedActual: actualSpent,
        computedCommitted: committed,
        effectiveBudget,
        computedRemaining: remaining,
        computedUtilization: utilization,
        isOverBudget,
      };
    });
  }, [bdgs, exps, lpos]);

  // Filtered Budgets
  const filteredBudgets = useMemo(() => {
    return budgetCalculations.filter((b) => {
      if (selectedFY && b.financialYear !== selectedFY) return false;
      if (selectedEntity !== 'All' && b.legalEntity !== selectedEntity) return false;
      if (selectedDept && b.departmentId !== selectedDept) return false;
      if (selectedCategory && b.category !== selectedCategory) return false;
      if (selectedStatus && b.status !== selectedStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchCode = b.code.toLowerCase().includes(q);
        const matchDesc = (b.description || '').toLowerCase().includes(q);
        const matchProj = (b.projectName || '').toLowerCase().includes(q);
        const matchDept = (b.departmentName || '').toLowerCase().includes(q);
        if (!matchCode && !matchDesc && !matchProj && !matchDept) return false;
      }
      return true;
    });
  }, [budgetCalculations, selectedFY, selectedEntity, selectedDept, selectedCategory, selectedStatus, search]);

  // Summary Metrics
  const summary = useMemo(() => {
    const totalApproved = filteredBudgets.reduce((sum, b) => sum + Number(b.allocatedAmount || 0), 0);
    const totalRevised = filteredBudgets.reduce((sum, b) => sum + Number(b.revisedBudget || b.allocatedAmount || 0), 0);
    const totalActual = filteredBudgets.reduce((sum, b) => sum + b.computedActual, 0);
    const totalCommitted = filteredBudgets.reduce((sum, b) => sum + b.computedCommitted, 0);
    const totalRemaining = totalRevised - totalActual - totalCommitted;
    const overallUtilization = totalRevised > 0 ? (totalActual / totalRevised) * 100 : 0;
    const overspentCount = filteredBudgets.filter((b) => b.isOverBudget).length;
    const totalCount = filteredBudgets.length;

    return {
      totalApproved,
      totalRevised,
      totalActual,
      totalCommitted,
      totalRemaining,
      overallUtilization,
      overspentCount,
      totalCount,
    };
  }, [filteredBudgets]);

  const handleOpenCreate = () => {
    setEditingBudget(null);
    const deptObj = depts.find((d) => d.id === deptId) || depts[0];
    setCode(DatabaseService.generateBudgetCode(deptObj?.code || 'MCX', legalEntity === 'Shared' ? 'PACL' : legalEntity));
    setFy(selectedFY || '2026');
    setLegalEntity('PACL');
    setDeptId(depts[0]?.id || '');
    setProjId('');
    setCategory(settings.expenseCategories[0] || 'Marketing Campaigns');
    setAllocated(1000000);
    setRevised(1000000);
    setDescription('');
    setNotes('');
    setStatus('Approved');
    setShowModal(true);
  };

  const handleOpenEdit = (b: Budget) => {
    setEditingBudget(b);
    setCode(b.code);
    setFy(b.financialYear);
    setLegalEntity((b.legalEntity as any) || 'PACL');
    setDeptId(b.departmentId);
    setProjId(b.projectId || '');
    setCategory(b.category);
    setAllocated(b.allocatedAmount);
    setRevised(b.revisedBudget || b.allocatedAmount);
    setDescription(b.description || '');
    setNotes(b.notes || '');
    setStatus(b.status);
    setShowModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const deptObj = depts.find((d) => d.id === deptId);
    const projObj = projs.find((p) => p.id === projId);

    const budgetToSave: Budget = {
      id: editingBudget ? editingBudget.id : 'bdg-' + Date.now(),
      code: code || `BDG-${Date.now()}`,
      financialYear: fy,
      legalEntity: legalEntity as any,
      departmentId: deptId,
      departmentName: deptObj?.name || 'Marketing & Customer Experience',
      projectId: projId || undefined,
      projectName: projObj?.name || undefined,
      category,
      allocatedAmount: Number(allocated),
      revisedBudget: Number(revised) || Number(allocated),
      description,
      notes,
      status,
      createdBy: editingBudget ? editingBudget.createdBy : `${role} User`,
      createdDate: editingBudget ? editingBudget.createdDate : new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString(),
    };

    DatabaseService.saveBudget(budgetToSave, `${role} User`, role);
    showToast(editingBudget ? 'Budget line updated.' : 'Budget allocation created.', 'success');
    onRefresh();
    setShowModal(false);
  };

  const handleDuplicate = (id: string) => {
    const dup = DatabaseService.duplicateBudget(id, `${role} User`, role);
    if (dup) {
      showToast(`Budget line duplicated as ${dup.code}.`, 'success');
      onRefresh();
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirmDialog({
      title: 'Delete Budget Line',
      message: 'Are you sure you want to delete / archive this budget record?',
      confirmLabel: 'Delete Budget',
      variant: 'danger',
    });
    if (confirmed) {
      DatabaseService.deleteBudget(id, `${role} User`, role);
      showToast('Budget line removed.', 'info');
      onRefresh();
    }
  };

  const handleExportExcel = () => {
    ExcelService.exportBudgetsToExcel(filteredBudgets as any);
  };

  const handleExportPDF = () => {
    const cols = ['Budget Code', 'FY', 'Entity', 'Department', 'Category', 'Approved Budget', 'Actual Spend', 'Remaining', 'Utilization %', 'Status'];
    const rows = filteredBudgets.map((b) => [
      b.code,
      b.financialYear,
      b.legalEntity,
      b.departmentName,
      b.category,
      `${Number(b.allocatedAmount).toLocaleString()} ${settings.currencySymbol}`,
      `${Number(b.computedActual).toLocaleString()} ${settings.currencySymbol}`,
      `${Number(b.computedRemaining).toLocaleString()} ${settings.currencySymbol}`,
      `${b.computedUtilization.toFixed(1)}%`,
      b.status,
    ]);
    PDFService.generateReportPDF('ANNUAL BUDGET PLANNING & PERFORMANCE REPORT', `Financial Year ${selectedFY} | Entity: ${selectedEntity}`, cols, rows, settings);
  };

  return (
    <div className="d-flex flex-column gap-4">
      {/* Header Banner */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 pb-2 border-bottom">
        <div>
          <div className="d-flex align-items-center gap-2">
            <h3 className="fw-bold mb-0 text-dark" style={{ fontFamily: 'Tahoma, sans-serif' }}>
              Annual Budget Planning &amp; Allocations
            </h3>
            <span className="badge bg-danger text-white px-2 py-1">FY {selectedFY || 'All'}</span>
          </div>
          <p className="text-muted small mb-0 mt-1">
            Unified annual budget planning, line-item allocations, revisions, LPO commitments, and 360-degree utilization tracking.
          </p>
        </div>
        <div className="d-flex align-items-center gap-2 flex-wrap">
          {(onNavigateToExcelWizard || onNavigateToTab) && (
            <button
              id="btn-import-excel-budget"
              type="button"
              onClick={() => (onNavigateToExcelWizard ? onNavigateToExcelWizard() : onNavigateToTab?.('excel_wizard'))}
              className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1 shadow-sm"
            >
              <i className="bi bi-file-earmark-arrow-up"></i> Import Excel
            </button>
          )}
          <button id="btn-export-excel-budget" onClick={handleExportExcel} className="btn btn-outline-success btn-sm d-flex align-items-center gap-1 shadow-sm">
            <i className="bi bi-file-earmark-excel"></i> Export Excel
          </button>
          <button id="btn-export-pdf-budget" onClick={handleExportPDF} className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1 shadow-sm">
            <i className="bi bi-file-earmark-pdf"></i> Export PDF
          </button>
          <button type="button" onClick={() => window.print()} className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1 shadow-sm">
            <i className="bi bi-printer"></i> Print
          </button>
          {role !== 'Viewer' && (
            <button id="btn-create-annual-budget" onClick={handleOpenCreate} className="btn btn-danger btn-sm d-flex align-items-center gap-1 shadow-sm">
              <i className="bi bi-plus-circle"></i> New Budget Line
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="row g-3">
        <div className="col-12 col-sm-6 col-xl-2">
          <div
            className="card card-erp p-3 border-start border-4 border-dark h-100 shadow-sm"
            style={{ cursor: onTraceAmount ? 'pointer' : 'default' }}
            onClick={() =>
              onTraceAmount &&
              onTraceAmount({
                metricId: 'total_allocated_budget',
                metricName: 'Total Approved Budget',
                reportedAmount: summary.totalApproved,
                filtersSnapshot: { financialYear: selectedFY, legalEntity: selectedEntity },
              })
            }
          >
            <span className="text-muted small text-uppercase fw-semibold">Total Approved</span>
            <div className="fs-5 fw-bold text-dark mt-1">
              {summary.totalApproved.toLocaleString()} <span className="small text-muted">{settings.currencySymbol}</span>
            </div>
            <span className="text-muted extra-small mt-1">{summary.totalCount} budget lines</span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-2">
          <div className="card card-erp p-3 border-start border-4 border-primary h-100 shadow-sm">
            <span className="text-muted small text-uppercase fw-semibold">Revised Budget</span>
            <div className="fs-5 fw-bold text-primary mt-1">
              {summary.totalRevised.toLocaleString()} <span className="small text-muted">{settings.currencySymbol}</span>
            </div>
            <span className="text-muted extra-small mt-1">Active ceiling</span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-2">
          <div className="card card-erp p-3 border-start border-4 border-danger h-100 shadow-sm">
            <span className="text-muted small text-uppercase fw-semibold">Actual Spend</span>
            <div className="fs-5 fw-bold text-danger mt-1">
              {summary.totalActual.toLocaleString()} <span className="small text-muted">{settings.currencySymbol}</span>
            </div>
            <span className="text-muted extra-small mt-1">Total posted expenses</span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-2">
          <div className="card card-erp p-3 border-start border-4 border-warning h-100 shadow-sm">
            <span className="text-muted small text-uppercase fw-semibold">Committed (LPOs)</span>
            <div className="fs-5 fw-bold text-dark mt-1">
              {summary.totalCommitted.toLocaleString()} <span className="small text-muted">{settings.currencySymbol}</span>
            </div>
            <span className="text-muted extra-small mt-1">Outstanding purchase orders</span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-2">
          <div className="card card-erp p-3 border-start border-4 border-success h-100 shadow-sm">
            <span className="text-muted small text-uppercase fw-semibold">Remaining Balance</span>
            <div className={`fs-5 fw-bold mt-1 ${summary.totalRemaining < 0 ? 'text-danger' : 'text-success'}`}>
              {summary.totalRemaining.toLocaleString()} <span className="small text-muted">{settings.currencySymbol}</span>
            </div>
            <span className="text-muted extra-small mt-1">Available to spend</span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-2">
          <div className="card card-erp p-3 border-start border-4 border-info h-100 shadow-sm">
            <span className="text-muted small text-uppercase fw-semibold">Utilization Rate</span>
            <div className={`fs-5 fw-bold mt-1 ${summary.overallUtilization > 100 ? 'text-danger' : summary.overallUtilization > 85 ? 'text-warning' : 'text-info'}`}>
              {summary.overallUtilization.toFixed(1)}%
            </div>
            <div className="progress mt-2" style={{ height: '6px' }}>
              <div
                className={`progress-bar ${summary.overallUtilization > 100 ? 'bg-danger' : summary.overallUtilization > 85 ? 'bg-warning' : 'bg-success'}`}
                role="progressbar"
                style={{ width: `${Math.min(summary.overallUtilization, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card card-erp p-3 shadow-sm">
        <div className="row g-2 align-items-center">
          <div className="col-12 col-md-2">
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-light text-muted border-end-0">
                <i className="bi bi-search"></i>
              </span>
              <input
                id="input-search-annual-budget"
                type="text"
                className="form-control form-control-sm border-start-0"
                placeholder="Search code, project..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="col-6 col-md-2">
            <select
              id="select-annual-fy"
              className="form-select form-select-sm"
              value={selectedFY}
              onChange={(e) => setSelectedFY(e.target.value)}
            >
              <option value="">All Financial Years</option>
              <option value="2026">FY 2026</option>
              <option value="2026/2027">FY 2026/2027</option>
              <option value="2025">FY 2025</option>
              <option value="2024">FY 2024</option>
            </select>
          </div>

          <div className="col-6 col-md-2">
            <select
              id="select-annual-dept"
              className="form-select form-select-sm"
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
            >
              <option value="">All Departments</option>
              {depts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="col-6 col-md-2">
            <select
              id="select-annual-entity"
              className="form-select form-select-sm"
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
            >
              <option value="All">All Entities (PACL & PGIL)</option>
              <option value="PACL">PACL (Pioneer Assurance)</option>
              <option value="PGIL">PGIL (Pioneer General)</option>
              <option value="Shared">Shared Projects</option>
            </select>
          </div>

          <div className="col-6 col-md-2">
            <select
              id="select-annual-category"
              className="form-select form-select-sm"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="">All Categories</option>
              {settings.expenseCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="col-6 col-md-1">
            <select
              id="select-annual-status"
              className="form-select form-select-sm"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="">Status</option>
              <option value="Approved">Approved</option>
              <option value="Pending">Pending</option>
              <option value="Draft">Draft</option>
              <option value="Closed">Closed</option>
            </select>
          </div>

          <div className="col-6 col-md-1 text-end">
            <button
              id="btn-reset-annual-filters"
              onClick={() => {
                setSearch('');
                setSelectedDept('');
                setSelectedEntity('All');
                setSelectedCategory('');
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

      {/* Main Budget Grid */}
      <div className="card card-erp shadow-sm overflow-hidden">
        <div className="card-header bg-white py-3 px-4 d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-2">
            <h6 className="mb-0 fw-bold text-dark">Approved Budget Line Items</h6>
            <span className="badge bg-light text-dark border">
              {filteredBudgets.length} Records
            </span>
          </div>
          {summary.overspentCount > 0 && (
            <span className="badge bg-danger-subtle text-danger border border-danger px-2 py-1">
              <i className="bi bi-exclamation-triangle-fill me-1"></i>
              {summary.overspentCount} Over Budget Alert{summary.overspentCount > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0 erp-table">
            <thead className="table-light">
              <tr className="small text-uppercase text-muted">
                <th style={{ width: '130px' }}>Budget Code</th>
                <th>Entity</th>
                <th>Category & Description</th>
                <th>Linked Project</th>
                <th className="text-end">Approved Budget</th>
                <th className="text-end">Revised Budget</th>
                <th className="text-end">Actual Spend</th>
                <th className="text-end">Committed</th>
                <th className="text-end">Remaining</th>
                <th style={{ width: '130px' }}>Utilization</th>
                <th>Status</th>
                <th className="text-center" style={{ width: '90px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBudgets.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-5 text-muted">
                    <i className="bi bi-wallet2 fs-2 d-block mb-2 text-secondary opacity-50"></i>
                    No budget allocations found for the selected criteria.
                    {role !== 'Viewer' && (
                      <div className="mt-2">
                        <button onClick={handleOpenCreate} className="btn btn-sm btn-danger">
                          Create New Budget Line
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filteredBudgets.map((b) => {
                  const utilColor = b.computedUtilization > 100 ? 'bg-danger' : b.computedUtilization > 85 ? 'bg-warning' : b.computedUtilization > 60 ? 'bg-primary' : 'bg-success';
                  return (
                    <tr key={b.id} className={b.isOverBudget ? 'table-danger bg-opacity-25' : ''}>
                      <td>
                        <button
                          type="button"
                          className="btn btn-link p-0 text-decoration-none fw-bold text-dark font-monospace text-start"
                          title="Open Budget Line 360 Dossier"
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
                        <div className="extra-small text-muted">FY {b.financialYear}</div>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            b.legalEntity === 'PACL'
                              ? 'bg-dark text-white'
                              : b.legalEntity === 'PGIL'
                              ? 'bg-danger text-white'
                              : 'bg-primary text-white'
                          }`}
                        >
                          {b.legalEntity}
                        </span>
                      </td>
                      <td>
                        <div className="fw-semibold text-dark">{b.category}</div>
                        {b.description && <div className="small text-muted text-truncate" style={{ maxWidth: '240px' }}>{b.description}</div>}
                      </td>
                      <td>
                        {b.projectName ? (
                          <span className="badge bg-light text-dark border">{b.projectName}</span>
                        ) : (
                          <span className="text-muted small italic">General Line Item</span>
                        )}
                      </td>
                      <td className="text-end fw-semibold">
                        {Number(b.allocatedAmount).toLocaleString()} <span className="extra-small text-muted">{settings.currencySymbol}</span>
                      </td>
                      <td className="text-end text-primary fw-semibold">
                        {(b.revisedBudget || b.allocatedAmount).toLocaleString()} <span className="extra-small text-muted">{settings.currencySymbol}</span>
                      </td>
                      <td className="text-end text-danger fw-bold">
                        {b.computedActual.toLocaleString()} <span className="extra-small text-muted">{settings.currencySymbol}</span>
                      </td>
                      <td className="text-end text-muted small">
                        {b.computedCommitted > 0 ? `${b.computedCommitted.toLocaleString()} ${settings.currencySymbol}` : '-'}
                      </td>
                      <td className={`text-end fw-bold ${b.computedRemaining < 0 ? 'text-danger' : 'text-success'}`}>
                        {b.computedRemaining.toLocaleString()} <span className="extra-small text-muted">{settings.currencySymbol}</span>
                      </td>
                      <td>
                        <div className="d-flex align-items-center justify-content-between extra-small mb-1">
                          <span className="fw-bold">{b.computedUtilization.toFixed(1)}%</span>
                          {b.isOverBudget && <span className="badge bg-danger text-white extra-small px-1">OVER</span>}
                        </div>
                        <div className="progress" style={{ height: '5px' }}>
                          <div
                            className={`progress-bar ${utilColor}`}
                            role="progressbar"
                            style={{ width: `${Math.min(b.computedUtilization, 100)}%` }}
                          ></div>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            b.status === 'Approved'
                              ? 'bg-success-subtle text-success border border-success'
                              : b.status === 'Pending'
                              ? 'bg-warning-subtle text-warning border border-warning'
                              : 'bg-secondary-subtle text-secondary border'
                          }`}
                        >
                          {b.status}
                        </span>
                      </td>
                      <td className="text-center">
                        <div className="btn-group btn-group-sm">
                          {onDrillDown && (
                            <button
                              type="button"
                              className="btn btn-outline-danger btn-sm p-1 px-1.5"
                              title="Budget Line 360 Dossier"
                              onClick={() =>
                                onDrillDown({
                                  type: 'budget_line',
                                  id: b.code,
                                })
                              }
                            >
                              <i className="bi bi-eye"></i>
                            </button>
                          )}
                          {role !== 'Viewer' && (
                            <>
                              <button
                                id={`btn-edit-budget-${b.id}`}
                                onClick={() => handleOpenEdit(b)}
                                className="btn btn-outline-secondary btn-sm p-1"
                                title="Edit Budget"
                              >
                                <i className="bi bi-pencil"></i>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDuplicate(b.id)}
                                className="btn btn-outline-primary btn-sm p-1"
                                title="Duplicate Budget Line"
                              >
                                <i className="bi bi-copy"></i>
                              </button>
                            </>
                          )}
                          {role === 'Administrator' && (
                            <button
                              id={`btn-delete-budget-${b.id}`}
                              onClick={() => handleDelete(b.id)}
                              className="btn btn-outline-danger btn-sm p-1"
                              title="Delete Budget"
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredBudgets.length > 0 && (
              <tfoot className="table-light fw-bold">
                <tr>
                  <td colSpan={4} className="text-uppercase small">Total Filtered Allocations</td>
                  <td className="text-end">{summary.totalApproved.toLocaleString()} {settings.currencySymbol}</td>
                  <td className="text-end text-primary">{summary.totalRevised.toLocaleString()} {settings.currencySymbol}</td>
                  <td className="text-end text-danger">{summary.totalActual.toLocaleString()} {settings.currencySymbol}</td>
                  <td className="text-end text-muted">{summary.totalCommitted.toLocaleString()} {settings.currencySymbol}</td>
                  <td className={`text-end ${summary.totalRemaining < 0 ? 'text-danger' : 'text-success'}`}>
                    {summary.totalRemaining.toLocaleString()} {settings.currencySymbol}
                  </td>
                  <td className="text-center">{summary.overallUtilization.toFixed(1)}%</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content shadow-lg border-0">
              <div className="modal-header bg-danger text-white">
                <h5 className="modal-title fw-bold">
                  {editingBudget ? 'Edit Annual Budget Line' : 'Create New Annual Budget Line'}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowModal(false)}></button>
              </div>
              <form onSubmit={handleSave}>
                <div className="modal-body p-4">
                  <div className="row g-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-semibold">Budget Code *</label>
                      <input
                        type="text"
                        className="form-control"
                        required
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        placeholder="e.g. BDG-2026-MCX-01"
                      />
                    </div>

                    <div className="col-12 col-md-3">
                      <label className="form-label small fw-semibold">Financial Year *</label>
                      <input
                        type="text"
                        className="form-control"
                        required
                        value={fy}
                        onChange={(e) => setFy(e.target.value)}
                        placeholder="2026"
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
                        <option value="Shared">Shared (Both Entities)</option>
                      </select>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-semibold">Department *</label>
                      <select
                        className="form-select"
                        value={deptId}
                        onChange={(e) => setDeptId(e.target.value)}
                        required
                      >
                        {depts.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-semibold">Expense Category *</label>
                      <select
                        className="form-select"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        required
                      >
                        {settings.expenseCategories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-semibold">Linked Project (Optional)</label>
                      <select
                        className="form-select"
                        value={projId}
                        onChange={(e) => setProjId(e.target.value)}
                      >
                        <option value="">-- No specific project (Departmental line) --</option>
                        {projs.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.code} - {p.name} ({p.projectType})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-12 col-md-3">
                      <label className="form-label small fw-semibold">Approved Budget ({settings.currencySymbol}) *</label>
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        className="form-control"
                        required
                        value={allocated}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setAllocated(val);
                          if (!editingBudget) setRevised(val);
                        }}
                      />
                    </div>

                    <div className="col-12 col-md-3">
                      <label className="form-label small fw-semibold">Revised Budget ({settings.currencySymbol})</label>
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        className="form-control"
                        value={revised}
                        onChange={(e) => setRevised(Number(e.target.value))}
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
                        <option value="Approved">Approved</option>
                        <option value="Pending">Pending</option>
                        <option value="Draft">Draft</option>
                        <option value="Closed">Closed</option>
                      </select>
                    </div>

                    <div className="col-12">
                      <label className="form-label small fw-semibold">Purpose & Description</label>
                      <textarea
                        className="form-control"
                        rows={2}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Detailed justification and planned deliverables..."
                      ></textarea>
                    </div>

                    <div className="col-12">
                      <label className="form-label small fw-semibold">Administrative Notes / Committee Approvals</label>
                      <input
                        type="text"
                        className="form-control"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="e.g. Approved by Board Marketing Committee Minute #4/2026"
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-danger px-4">
                    {editingBudget ? 'Update Budget Line' : 'Save Budget Line'}
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
