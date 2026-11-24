import React, { useState, useRef, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler,
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { DatabaseService } from '../services/db';
import { GlobalFilterState, QuarterType, DrillDownTarget, AmountTraceContext } from '../types';
import { TraceAmountButton } from '../components/TraceAmountButton';
import { BudgetTimeline } from '../components/BudgetTimeline';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
);

interface DashboardViewProps {
  onNavigate: (tab: string) => void;
  onDrillDown?: (target: DrillDownTarget) => void;
  onTraceAmount?: (context: AmountTraceContext) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate, onDrillDown, onTraceAmount }) => {
  const bdgs = DatabaseService.getBudgets();
  const exps = DatabaseService.getExpenditures();
  const projs = DatabaseService.getProjects();
  const sups = DatabaseService.getSuppliers();
  const settings = DatabaseService.getSettings();

  const lpos = DatabaseService.getLPOs();
  const docs = DatabaseService.getDocuments();

  // Dropdown menu state (React-controlled for iFrame safety)
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const importMenuRef = useRef<HTMLDivElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (importMenuRef.current && !importMenuRef.current.contains(e.target as Node)) {
        setShowImportMenu(false);
      }
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Filter State
  const [filters, setFilters] = useState<GlobalFilterState>({
    financialYear: settings.financialYear || '2026',
    legalEntity: 'All',
    quarter: '',
    departmentId: '',
    projectId: '',
    campaign: '',
    month: '',
    category: '',
    costCentre: '',
    supplierId: '',
    status: '',
    searchQuery: '',
    dateFrom: '',
    dateTo: '',
  });

  const matchesFY = (dateStr?: string, fyVal?: string) => {
    if (!fyVal) return true;
    if (!dateStr) return true;
    const years = fyVal.split('/').map((y) => y.trim()).filter(Boolean);
    return years.some((yr) => dateStr.includes(yr));
  };

  // Filtered lists
  const filteredBdgs = bdgs.filter((b) => {
    if (filters.financialYear && b.financialYear && b.financialYear !== filters.financialYear) return false;
    if (filters.legalEntity && filters.legalEntity !== 'All' && b.legalEntity !== filters.legalEntity && b.legalEntity !== 'Shared') return false;
    if (filters.quarter && b.quarter && b.quarter !== filters.quarter) return false;
    if (filters.departmentId && b.departmentId !== filters.departmentId) return false;
    if (filters.category && b.category !== filters.category) return false;
    if (filters.costCentre && b.costCentre !== filters.costCentre) return false;
    return true;
  });

  const filteredExps = exps.filter((e) => {
    if (filters.financialYear && !matchesFY(e.date || e.expenseDate, filters.financialYear)) return false;
    if (filters.legalEntity && filters.legalEntity !== 'All' && e.legalEntity !== filters.legalEntity) return false;
    if (filters.quarter && e.quarter && e.quarter !== filters.quarter) return false;
    if (filters.departmentId && e.departmentId !== filters.departmentId) return false;
    if (filters.category && e.category !== filters.category) return false;
    if (filters.costCentre && e.costCentre !== filters.costCentre) return false;
    if (filters.supplierId && e.supplierId !== filters.supplierId) return false;
    return true;
  });

  const filteredLpos = lpos.filter((l) => {
    if (filters.financialYear && !matchesFY(l.lpoDate, filters.financialYear)) return false;
    if (filters.legalEntity && filters.legalEntity !== 'All' && l.legalEntity !== filters.legalEntity) return false;
    if (filters.departmentId && l.departmentId && l.departmentId !== filters.departmentId) return false;
    if (filters.category && l.budgetCategory && l.budgetCategory !== filters.category) return false;
    if (filters.supplierId && l.supplierId !== filters.supplierId) return false;
    return true;
  });

  const filteredProjs = projs.filter((p) => {
    if (filters.legalEntity && filters.legalEntity !== 'All') {
      const entityMatch =
        p.entity === filters.legalEntity ||
        p.entity === 'Shared' ||
        (filters.legalEntity === 'PACL' && p.paclApplicable) ||
        (filters.legalEntity === 'PGIL' && p.pgilApplicable);
      if (!entityMatch) return false;
    }
    if (filters.departmentId && p.departmentId !== filters.departmentId) return false;
    if (filters.category && p.budgetCategory && p.budgetCategory !== filters.category) return false;
    return true;
  });

  // Core Financial Aggregates
  const annualDepartmentBudget = filteredBdgs.reduce((sum, b) => sum + Number(b.revisedBudget ?? b.allocatedAmount ?? 0), 0);
  const totalDepartmentSpend = filteredExps.reduce((sum, e) => sum + Number(e.totalAmount || 0), 0);
  const committedBudget = filteredLpos
    .filter((l) => {
      const st = l.lpoStatus || l.status || '';
      const pay = l.paymentStatus || '';
      return st !== 'Cancelled' && pay !== 'Fully Paid' && pay !== 'Paid';
    })
    .reduce((sum, l) => sum + Number(l.totalLpoValue ?? l.totalLpoAmount ?? 0), 0);
  const remainingBudget = annualDepartmentBudget - totalDepartmentSpend - committedBudget;
  const utilizationPercent = annualDepartmentBudget > 0 ? (totalDepartmentSpend / annualDepartmentBudget) * 100 : 0;
  const activeProjectsCount = filteredProjs.filter((p) => p.status === 'In Progress' || p.status === 'Planning').length;
  const lposCount = filteredLpos.length;
  const suppliersCount = sups.length;
  const transactionsCount = filteredExps.length;
  const documentsCount = docs.length;

  // Helper function to sum spend by categories matching keywords
  const getCategorySpend = (keywords: string[]) => {
    return filteredExps
      .filter((e) => keywords.some((kw) => (e.category || '').toLowerCase().includes(kw.toLowerCase())))
      .reduce((sum, e) => sum + Number(e.totalAmount || 0), 0);
  };

  // Specialized Marketing & CX Metrics
  const campaignSpend = getCategorySpend(['campaign', 'media buying', 'brand', 'public relations']);
  const cxSpend = getCategorySpend(['customer experience', 'satisfaction', 'nps', 'staff training']);
  const digitalSpend = getCategorySpend(['digital', 'social media']);
  const eventsSpend = getCategorySpend(['events', 'sponsorship']);
  const csrSpend = getCategorySpend(['csr']);
  const merchandiseSpend = getCategorySpend(['merchandise', 'branding', 'signage', 'printing', 'renovations']);
  const websiteSpend = getCategorySpend(['website']);
  const researchSpend = getCategorySpend(['research', 'market', 'product launches', 'innovation']);

  // Quarterly Breakdown Data
  const quarters: QuarterType[] = ['Q1', 'Q2', 'Q3', 'Q4'];
  const quarterlyAllocated = quarters.map((q) =>
    filteredBdgs.filter((b) => b.quarter === q).reduce((sum, b) => sum + Number(b.revisedBudget ?? b.allocatedAmount ?? 0), 0)
  );
  const quarterlySpent = quarters.map((q) =>
    filteredExps.filter((e) => e.quarter === q).reduce((sum, e) => sum + Number(e.totalAmount || 0), 0)
  );

  const quarterlyChartData = {
    labels: ['Quarter 1 (Q1)', 'Quarter 2 (Q2)', 'Quarter 3 (Q3)', 'Quarter 4 (Q4)'],
    datasets: [
      {
        label: 'Allocated Budget (KES)',
        data: quarterlyAllocated,
        backgroundColor: '#1E293B',
        borderRadius: 4,
      },
      {
        label: 'Actual Spend (KES)',
        data: quarterlySpent,
        backgroundColor: '#DC2626',
        borderRadius: 4,
      },
    ],
  };

  // Category Spend Breakdown
  const categoryMap: Record<string, number> = {};
  filteredExps.forEach((e) => {
    categoryMap[e.category] = (categoryMap[e.category] || 0) + e.totalAmount;
  });

  const catLabels = Object.keys(categoryMap);
  const catValues = Object.values(categoryMap);

  const categoryChartData = {
    labels: catLabels.length > 0 ? catLabels : ['No Spend Data'],
    datasets: [
      {
        data: catValues.length > 0 ? catValues : [1],
        backgroundColor:
          catValues.length > 0
            ? ['#DC2626', '#2563EB', '#059669', '#D97706', '#7C3AED', '#0891B2', '#4B5563', '#E11D48', '#0284C7', '#16A34A']
            : ['#E2E8F0'],
      },
    ],
  };

  // Monthly Spending Trend
  const monthlyLabels = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const monthlySpendMap: Record<number, number> = {};
  filteredExps.forEach((e) => {
    if (e.date) {
      const monthIdx = new Date(e.date).getMonth(); // 0 to 11
      // Map July (6) to index 0, etc.
      const academicIdx = (monthIdx + 6) % 12;
      monthlySpendMap[academicIdx] = (monthlySpendMap[academicIdx] || 0) + e.totalAmount;
    }
  });

  const monthlyValues = monthlyLabels.map((_, idx) => monthlySpendMap[idx] || 0);

  const monthlyChartData = {
    labels: monthlyLabels,
    datasets: [
      {
        fill: true,
        label: 'Monthly Spend Trend (KES)',
        data: monthlyValues,
        borderColor: '#DC2626',
        backgroundColor: 'rgba(220, 38, 38, 0.1)',
        tension: 0.35,
        pointBackgroundColor: '#DC2626',
        pointRadius: 4,
      },
    ],
  };

  // Pending Commitments / Pending Approvals
  const pendingCommitments = filteredExps.filter((e) => e.paymentStatus === 'Pending Approval' || e.paymentStatus === 'Approved');

  const isEmpty = bdgs.length === 0 && exps.length === 0;

  return (
    <div className="d-flex flex-column gap-4">
      {/* Header Banner */}
      <div className="card card-erp p-3.5 bg-white border-top border-4 border-danger shadow-sm">
        <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <span className="badge bg-danger text-white text-uppercase px-2 py-1 fs-7">
                Departmental Portal
              </span>
              <span className="text-muted fs-7">Lead: Market Research & Insights Lead</span>
            </div>
            <h2 className="h4 fw-bold text-dark mb-1">
              Marketing & Customer Experience (Marketing & CX) Dashboard
            </h2>
            <p className="text-secondary fs-7 mb-0">
              Real-time monitoring, budget tracking, campaign spend analytics, and financial performance management.
            </p>
          </div>

          <div className="d-flex align-items-center gap-2 flex-wrap">
            <div className="dropdown position-relative" ref={importMenuRef}>
              <button
                className="btn btn-corporate btn-sm dropdown-toggle fw-bold shadow-sm d-flex align-items-center gap-1.5"
                type="button"
                onClick={() => {
                  setShowImportMenu((prev) => !prev);
                  setShowAddMenu(false);
                }}
                aria-expanded={showImportMenu}
              >
                <i className="bi bi-file-earmark-arrow-up-fill fs-6"></i>
                <span>+ Import Data</span>
              </button>
              {showImportMenu && (
                <ul className="dropdown-menu dropdown-menu-end show shadow border-0 fs-7" style={{ position: 'absolute', right: 0, top: '100%' }}>
                  <li>
                    <button type="button" className="dropdown-item d-flex align-items-center gap-2" onClick={() => { setShowImportMenu(false); onNavigate('excel_wizard'); }}>
                      <i className="bi bi-wallet2 text-primary"></i> Import Budget
                    </button>
                  </li>
                  <li>
                    <button type="button" className="dropdown-item d-flex align-items-center gap-2" onClick={() => { setShowImportMenu(false); onNavigate('excel_wizard'); }}>
                      <i className="bi bi-receipt text-danger"></i> Import Expenditure
                    </button>
                  </li>
                  <li>
                    <button type="button" className="dropdown-item d-flex align-items-center gap-2" onClick={() => { setShowImportMenu(false); onNavigate('excel_wizard'); }}>
                      <i className="bi bi-kanban text-success"></i> Import Projects
                    </button>
                  </li>
                  <li>
                    <button type="button" className="dropdown-item d-flex align-items-center gap-2" onClick={() => { setShowImportMenu(false); onNavigate('excel_wizard'); }}>
                      <i className="bi bi-building text-warning"></i> Import Suppliers
                    </button>
                  </li>
                  <li>
                    <button type="button" className="dropdown-item d-flex align-items-center gap-2" onClick={() => { setShowImportMenu(false); onNavigate('excel_wizard'); }}>
                      <i className="bi bi-file-earmark-text text-info"></i> Import LPOs
                    </button>
                  </li>
                  <li>
                    <button type="button" className="dropdown-item d-flex align-items-center gap-2" onClick={() => { setShowImportMenu(false); onNavigate('excel_wizard'); }}>
                      <i className="bi bi-file-earmark-pdf text-secondary"></i> Import Documents
                    </button>
                  </li>
                </ul>
              )}
            </div>

            <div className="dropdown position-relative" ref={addMenuRef}>
              <button
                className="btn btn-outline-dark btn-sm dropdown-toggle fw-semibold shadow-xs d-flex align-items-center gap-1.5"
                type="button"
                onClick={() => {
                  setShowAddMenu((prev) => !prev);
                  setShowImportMenu(false);
                }}
                aria-expanded={showAddMenu}
              >
                <i className="bi bi-plus-circle"></i>
                <span>+ Add Manually</span>
              </button>
              {showAddMenu && (
                <ul className="dropdown-menu dropdown-menu-end show shadow border-0 fs-7" style={{ position: 'absolute', right: 0, top: '100%' }}>
                  <li>
                    <button type="button" className="dropdown-item d-flex align-items-center gap-2" onClick={() => { setShowAddMenu(false); onNavigate('budgets'); }}>
                      <i className="bi bi-plus-lg text-primary"></i> Add Budget
                    </button>
                  </li>
                  <li>
                    <button type="button" className="dropdown-item d-flex align-items-center gap-2" onClick={() => { setShowAddMenu(false); onNavigate('expenditure'); }}>
                      <i className="bi bi-plus-lg text-danger"></i> Add Expenditure
                    </button>
                  </li>
                  <li>
                    <button type="button" className="dropdown-item d-flex align-items-center gap-2" onClick={() => { setShowAddMenu(false); onNavigate('projects'); }}>
                      <i className="bi bi-plus-lg text-success"></i> Add Project
                    </button>
                  </li>
                  <li>
                    <button type="button" className="dropdown-item d-flex align-items-center gap-2" onClick={() => { setShowAddMenu(false); onNavigate('suppliers'); }}>
                      <i className="bi bi-plus-lg text-warning"></i> Add Supplier
                    </button>
                  </li>
                  <li>
                    <button type="button" className="dropdown-item d-flex align-items-center gap-2" onClick={() => { setShowAddMenu(false); onNavigate('lpos'); }}>
                      <i className="bi bi-plus-lg text-info"></i> Create LPO
                    </button>
                  </li>
                  <li>
                    <button type="button" className="dropdown-item d-flex align-items-center gap-2" onClick={() => { setShowAddMenu(false); onNavigate('documents'); }}>
                      <i className="bi bi-folder-plus text-secondary"></i> Upload Document
                    </button>
                  </li>
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Clean Launch Empty State Banner */}
      {isEmpty && (
        <div className="card border-0 bg-light p-4 text-center rounded-3 shadow-xs">
          <div className="max-w-2xl mx-auto py-2">
            <div className="p-3 bg-white rounded-circle d-inline-flex mb-3 shadow-sm border">
              <i className="bi bi-database-exclamation text-corporate-primary display-6"></i>
            </div>
            <h3 className="h5 fw-bold text-dark mb-2">Clean Initial State – System Ready for Data Import</h3>
            <p className="text-muted fs-7 mb-4">
              All demo and test records have been cleared. No financial, project, expenditure, LPO, or document data exists. Import your Excel files or create records manually to populate system dashboards, analytics, and reports.
            </p>
            <div className="d-flex align-items-center justify-content-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => onNavigate('excel_wizard')}
                className="btn btn-corporate px-4 shadow-sm fw-bold"
              >
                <i className="bi bi-file-earmark-excel-fill me-2 text-success"></i> + Import Data
              </button>
              <button
                type="button"
                onClick={() => onNavigate('budgets')}
                className="btn btn-outline-dark px-4"
              >
                <i className="bi bi-plus-lg me-1"></i> + Add Manually
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Filter Bar */}
      <div className="card card-erp p-3 bg-white">
        <div className="d-flex align-items-center justify-content-between mb-2">
          <span className="fw-bold fs-7 text-uppercase text-muted d-flex align-items-center gap-1">
            <i className="bi bi-funnel-fill text-corporate-primary"></i> Departmental Filter Panel
          </span>
          <button
            type="button"
            className="btn btn-link btn-sm text-decoration-none p-0 text-corporate-primary fs-7"
            onClick={() =>
              setFilters({
                financialYear: settings.financialYear || '2026',
                legalEntity: 'All',
                quarter: '',
                departmentId: '',
                projectId: '',
                campaign: '',
                month: '',
                category: '',
                costCentre: '',
                supplierId: '',
                status: '',
                searchQuery: '',
                dateFrom: '',
                dateTo: '',
              })
            }
          >
            Reset Filters
          </button>
        </div>

        <div className="row g-2">
          {/* Legal Entity Filter - MANDATORY corporate dimension */}
          <div className="col-12 col-md-3">
            <label className="form-label fs-7 fw-semibold mb-1 text-danger d-flex align-items-center gap-1">
              <i className="bi bi-building-fill"></i> Legal Entity View
            </label>
            <select
              className="form-select form-select-sm fs-7 fw-bold border-danger text-dark"
              value={filters.legalEntity || 'All'}
              onChange={(e) => setFilters({ ...filters, legalEntity: e.target.value as any })}
            >
              <option value="All">Combined (PACL + PGIL Group Total)</option>
              <option value="PACL">PACL – Pioneer Assurance Company Limited</option>
              <option value="PGIL">PGIL – Pioneer General Insurance Limited</option>
            </select>
          </div>

          <div className="col-6 col-md-2">
            <label className="form-label fs-7 fw-semibold mb-1">Financial Year</label>
            <select
              className="form-select form-select-sm fs-7"
              value={filters.financialYear}
              onChange={(e) => setFilters({ ...filters, financialYear: e.target.value })}
            >
              <option value="">All Financial Years</option>
              <option value="2026">FY 2026</option>
              <option value="2026/2027">FY 2026/2027</option>
              <option value="2025/2026">FY 2025/2026</option>
              <option value="2024/2025">FY 2024/2025</option>
            </select>
          </div>

          <div className="col-6 col-md-2">
            <label className="form-label fs-7 fw-semibold mb-1">Quarter</label>
            <select
              className="form-select form-select-sm fs-7"
              value={filters.quarter}
              onChange={(e) => setFilters({ ...filters, quarter: e.target.value })}
            >
              <option value="">All Quarters</option>
              <option value="Q1">Quarter 1 (Q1)</option>
              <option value="Q2">Quarter 2 (Q2)</option>
              <option value="Q3">Quarter 3 (Q3)</option>
              <option value="Q4">Quarter 4 (Q4)</option>
            </select>
          </div>

          <div className="col-6 col-md-3">
            <label className="form-label fs-7 fw-semibold mb-1">Cost Centre</label>
            <select
              className="form-select form-select-sm fs-7"
              value={filters.costCentre}
              onChange={(e) => setFilters({ ...filters, costCentre: e.target.value })}
            >
              <option value="">All Cost Centres</option>
              {settings.costCentres.map((cc) => (
                <option key={cc} value={cc}>
                  {cc}
                </option>
              ))}
            </select>
          </div>

          <div className="col-6 col-md-3">
            <label className="form-label fs-7 fw-semibold mb-1">Expense Category</label>
            <select
              className="form-select form-select-sm fs-7"
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            >
              <option value="">All Categories ({settings.expenseCategories.length})</option>
              {settings.expenseCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="col-12 col-md-2 d-flex align-items-end">
            <div className="badge bg-light text-dark border w-100 py-2 text-center fs-7 fw-semibold">
              <i className="bi bi-tag-fill me-1 text-danger"></i> Marketing & CX
            </div>
          </div>
        </div>
      </div>

      {/* Row 1: Core Financial KPI Cards */}
      <div className="row row-cols-1 row-cols-sm-2 row-cols-lg-3 row-cols-xl-5 g-3">
        {/* Annual Department Budget */}
        <div className="col">
          <div className="card card-erp card-erp-stat p-3 h-100">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="fs-7 text-muted fw-bold text-uppercase">Annual Budget</span>
              <i className="bi bi-wallet2 text-corporate-primary fs-4"></i>
            </div>
            <h3 className="h5 fw-bold mb-1 text-dark">
              {annualDepartmentBudget.toLocaleString()} <small className="fs-7 text-muted">{settings.currencySymbol}</small>
            </h3>
            <div className="d-flex align-items-center justify-content-between mt-1">
              <span className="fs-8 text-muted">Allocated funds</span>
              {onTraceAmount && (
                <TraceAmountButton
                  amount={annualDepartmentBudget}
                  metricName="Annual Department Budget"
                  contextType="budget"
                  onTraceAmount={onTraceAmount}
                />
              )}
            </div>
          </div>
        </div>

        {/* Total Department Spend */}
        <div className="col">
          <div className="card card-erp card-erp-stat p-3 h-100">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="fs-7 text-muted fw-bold text-uppercase">Total Spend</span>
              <i className="bi bi-currency-dollar text-danger fs-4"></i>
            </div>
            <h3 className="h5 fw-bold mb-1 text-danger">
              {totalDepartmentSpend.toLocaleString()} <small className="fs-7 text-muted">{settings.currencySymbol}</small>
            </h3>
            <div className="d-flex align-items-center justify-content-between mt-1">
              <span className="fs-8 text-muted">{transactionsCount} posted transactions</span>
              {onTraceAmount && (
                <TraceAmountButton
                  amount={totalDepartmentSpend}
                  metricName="Total Department Spend (Actuals)"
                  contextType="expenditure"
                  onTraceAmount={onTraceAmount}
                />
              )}
            </div>
          </div>
        </div>

        {/* Committed Budget */}
        <div className="col">
          <div className="card card-erp card-erp-stat p-3 h-100">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="fs-7 text-muted fw-bold text-uppercase">Committed Budget</span>
              <i className="bi bi-file-earmark-check text-warning fs-4"></i>
            </div>
            <h3 className="h5 fw-bold mb-1 text-warning">
              {committedBudget.toLocaleString()} <small className="fs-7 text-muted">{settings.currencySymbol}</small>
            </h3>
            <div className="d-flex align-items-center justify-content-between mt-1">
              <span className="fs-8 text-muted">Open LPOs & commitments</span>
              {onTraceAmount && (
                <TraceAmountButton
                  amount={committedBudget}
                  metricName="Committed Budget (Open LPOs)"
                  contextType="commitment"
                  onTraceAmount={onTraceAmount}
                />
              )}
            </div>
          </div>
        </div>

        {/* Remaining Budget */}
        <div className="col">
          <div className="card card-erp card-erp-stat p-3 h-100">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="fs-7 text-muted fw-bold text-uppercase">Remaining Budget</span>
              <i className={`bi ${remainingBudget >= 0 ? 'bi-shield-check text-success' : 'bi-shield-exclamation text-danger'} fs-4`}></i>
            </div>
            <h3 className={`h5 fw-bold mb-1 ${remainingBudget >= 0 ? 'text-success' : 'text-danger'}`}>
              {remainingBudget.toLocaleString()} <small className="fs-7 text-muted">{settings.currencySymbol}</small>
            </h3>
            <div className="d-flex align-items-center justify-content-between mt-1">
              <span className="fs-8 text-muted">Uncommitted balance</span>
              {onTraceAmount && (
                <TraceAmountButton
                  amount={remainingBudget}
                  metricName="Remaining Department Budget"
                  contextType="variance"
                  onTraceAmount={onTraceAmount}
                />
              )}
            </div>
          </div>
        </div>

        {/* Budget Utilization (%) */}
        <div className="col">
          <div className="card card-erp card-erp-stat p-3 h-100">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="fs-7 text-muted fw-bold text-uppercase">Budget Utilization</span>
              <i className="bi bi-speedometer2 text-corporate-primary fs-4"></i>
            </div>
            <h3 className="h5 fw-bold mb-1 text-dark">
              {utilizationPercent.toFixed(1)}%
            </h3>
            <div className="progress mt-2" style={{ height: '5px' }}>
              <div
                className={`progress-bar ${
                  utilizationPercent >= 90 ? 'bg-danger' : utilizationPercent >= 75 ? 'bg-warning' : 'bg-success'
                }`}
                style={{ width: `${Math.min(100, utilizationPercent)}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Operations Counts Grid */}
      <div className="row row-cols-2 row-cols-md-5 g-2">
        <div className="col">
          <div className="p-2.5 bg-white rounded border d-flex align-items-center justify-content-between">
            <div>
              <div className="fs-8 text-muted fw-bold text-uppercase">Active Projects</div>
              <div className="fw-bold fs-6 text-dark">{activeProjectsCount}</div>
            </div>
            <i className="bi bi-kanban text-primary fs-5"></i>
          </div>
        </div>
        <div className="col">
          <div className="p-2.5 bg-white rounded border d-flex align-items-center justify-content-between">
            <div>
              <div className="fs-8 text-muted fw-bold text-uppercase">LPOs</div>
              <div className="fw-bold fs-6 text-dark">{lposCount}</div>
            </div>
            <i className="bi bi-file-earmark-text text-warning fs-5"></i>
          </div>
        </div>
        <div className="col">
          <div className="p-2.5 bg-white rounded border d-flex align-items-center justify-content-between">
            <div>
              <div className="fs-8 text-muted fw-bold text-uppercase">Suppliers</div>
              <div className="fw-bold fs-6 text-dark">{suppliersCount}</div>
            </div>
            <i className="bi bi-building text-success fs-5"></i>
          </div>
        </div>
        <div className="col">
          <div className="p-2.5 bg-white rounded border d-flex align-items-center justify-content-between">
            <div>
              <div className="fs-8 text-muted fw-bold text-uppercase">Transactions</div>
              <div className="fw-bold fs-6 text-dark">{transactionsCount}</div>
            </div>
            <i className="bi bi-receipt text-danger fs-5"></i>
          </div>
        </div>
        <div className="col">
          <div className="p-2.5 bg-white rounded border d-flex align-items-center justify-content-between">
            <div>
              <div className="fs-8 text-muted fw-bold text-uppercase">Documents</div>
              <div className="fw-bold fs-6 text-dark">{documentsCount}</div>
            </div>
            <i className="bi bi-file-earmark-pdf text-info fs-5"></i>
          </div>
        </div>
      </div>

      {/* Row 2: Specialized Marketing & CX Category KPI Grid */}
      <div className="card card-erp p-3 bg-white">
        <h6 className="fw-bold text-uppercase fs-7 text-muted mb-3 d-flex align-items-center gap-1">
          <i className="bi bi-pie-chart-fill text-corporate-primary"></i> Marketing & CX Specialized Spend Breakdown
        </h6>

        <div className="row g-2">
          <div className="col-6 col-md-3">
            <div className="p-2.5 bg-light rounded border">
              <div className="fs-7 text-muted fw-semibold mb-1">Marketing Campaigns</div>
              <div className="fw-bold text-dark fs-6">{campaignSpend.toLocaleString()} {settings.currencySymbol}</div>
            </div>
          </div>

          <div className="col-6 col-md-3">
            <div className="p-2.5 bg-light rounded border">
              <div className="fs-7 text-muted fw-semibold mb-1">Customer Experience (CX)</div>
              <div className="fw-bold text-dark fs-6">{cxSpend.toLocaleString()} {settings.currencySymbol}</div>
            </div>
          </div>

          <div className="col-6 col-md-3">
            <div className="p-2.5 bg-light rounded border">
              <div className="fs-7 text-muted fw-semibold mb-1">Digital Marketing & Web</div>
              <div className="fw-bold text-dark fs-6">{(digitalSpend + websiteSpend).toLocaleString()} {settings.currencySymbol}</div>
            </div>
          </div>

          <div className="col-6 col-md-3">
            <div className="p-2.5 bg-light rounded border">
              <div className="fs-7 text-muted fw-semibold mb-1">Events & Sponsorships</div>
              <div className="fw-bold text-dark fs-6">{eventsSpend.toLocaleString()} {settings.currencySymbol}</div>
            </div>
          </div>

          <div className="col-6 col-md-3">
            <div className="p-2.5 bg-light rounded border">
              <div className="fs-7 text-muted fw-semibold mb-1">CSR Activities</div>
              <div className="fw-bold text-dark fs-6">{csrSpend.toLocaleString()} {settings.currencySymbol}</div>
            </div>
          </div>

          <div className="col-6 col-md-3">
            <div className="p-2.5 bg-light rounded border">
              <div className="fs-7 text-muted fw-semibold mb-1">Merchandise & Branding</div>
              <div className="fw-bold text-dark fs-6">{merchandiseSpend.toLocaleString()} {settings.currencySymbol}</div>
            </div>
          </div>

          <div className="col-6 col-md-3">
            <div className="p-2.5 bg-light rounded border">
              <div className="fs-7 text-muted fw-semibold mb-1">Research & Insights</div>
              <div className="fw-bold text-dark fs-6">{researchSpend.toLocaleString()} {settings.currencySymbol}</div>
            </div>
          </div>

          <div className="col-6 col-md-3">
            <div className="p-2.5 bg-light rounded border">
              <div className="fs-7 text-muted fw-semibold mb-1">Active Campaigns</div>
              <div className="fw-bold text-dark fs-6">{filteredProjs.filter((p) => p.status === 'In Progress').length} Active</div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2.5: D3.js Fiscal Year Budget Timeline (Expenditure Flow & Planned Budget Releases) */}
      <BudgetTimeline
        budgets={filteredBdgs}
        expenditures={filteredExps}
        lpos={filteredLpos}
        financialYear={filters.financialYear || settings.financialYear || '2026'}
        legalEntity={filters.legalEntity || 'All'}
        currencySymbol={settings.currencySymbol || 'KES'}
        onNavigate={onNavigate}
        onDrillDown={onDrillDown}
      />

      {/* Row 3: Charts & Visualizations */}
      <div className="row g-3">
        {/* Monthly Spending Trend */}
        <div className="col-12 col-lg-8">
          <div className="card card-erp p-3.5 h-100 bg-white">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h6 className="fw-bold text-dark mb-0 fs-7 text-uppercase">
                <i className="bi bi-graph-up me-1 text-danger"></i> Monthly Departmental Spend Trend
              </h6>
              <div className="d-flex align-items-center gap-2">
                <button
                  type="button"
                  onClick={() => onNavigate('monthly_report')}
                  className="btn btn-outline-danger btn-xs py-0.5 px-2 d-flex align-items-center gap-1"
                  style={{ fontSize: '0.72rem' }}
                  title="Open full Monthly Trend & Burn Rate Analysis"
                >
                  <span>Burn Rate Tracker</span>
                  <i className="bi bi-arrow-right"></i>
                </button>
                <span className="badge bg-light text-dark border fs-7">FY {filters.financialYear || 'All'}</span>
              </div>
            </div>

            <div style={{ minHeight: '260px' }} className="d-flex align-items-center justify-content-center">
              {isEmpty ? (
                <div className="text-center text-muted p-4">
                  <i className="bi bi-bar-chart-line fs-1 text-secondary opacity-50 d-block mb-2"></i>
                  <span>No Data Available — Import Excel or Add Transactions</span>
                </div>
              ) : (
                <Line
                  data={monthlyChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                  }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Top Spending Categories Doughnut */}
        <div className="col-12 col-lg-4">
          <div className="card card-erp p-3.5 h-100 bg-white">
            <h6 className="fw-bold text-dark mb-3 fs-7 text-uppercase">
              <i className="bi bi-pie-chart me-1 text-danger"></i> Spending by Category
            </h6>

            <div style={{ minHeight: '240px' }} className="d-flex align-items-center justify-content-center">
              {isEmpty ? (
                <div className="text-center text-muted p-4">
                  <i className="bi bi-pie-chart-fill fs-1 text-secondary opacity-50 d-block mb-2"></i>
                  <span>No Data Available</span>
                </div>
              ) : (
                <Doughnut
                  data={categoryChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } },
                  }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Quarterly Budget Performance */}
        <div className="col-12 col-lg-6">
          <div className="card card-erp p-3.5 h-100 bg-white">
            <h6 className="fw-bold text-dark mb-3 fs-7 text-uppercase">
              <i className="bi bi-bar-chart-steps me-1 text-danger"></i> Quarterly Budget Performance (Q1 - Q4)
            </h6>

            <div style={{ minHeight: '250px' }} className="d-flex align-items-center justify-content-center">
              {isEmpty ? (
                <div className="text-center text-muted p-4">
                  <i className="bi bi-bar-chart-fill fs-1 text-secondary opacity-50 d-block mb-2"></i>
                  <span>No Data Available</span>
                </div>
              ) : (
                <Bar
                  data={quarterlyChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'top', labels: { boxWidth: 12 } } },
                  }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Top Campaigns by Budget Utilization */}
        <div className="col-12 col-lg-6">
          <div className="card card-erp p-3.5 h-100 bg-white">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h6 className="fw-bold text-dark mb-0 fs-7 text-uppercase">
                <i className="bi bi-kanban me-1 text-danger"></i> Top Campaigns by Utilization
              </h6>
              <button
                type="button"
                onClick={() => onNavigate('projects')}
                className="btn btn-link btn-sm text-decoration-none p-0 text-corporate-primary fs-7"
              >
                View All
              </button>
            </div>

            {filteredProjs.length === 0 ? (
              <div className="text-center text-muted p-4">
                <i className="bi bi-card-checklist fs-1 text-secondary opacity-50 d-block mb-2"></i>
                <span>No Campaigns or Projects Found</span>
              </div>
            ) : (
              <div className="d-flex flex-column gap-3" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                {filteredProjs.map((p) => {
                  const pct = Number(p.progressPercent ?? p.utilizationPercent ?? 0);
                  const pSpent = Number(p.spent ?? p.actualSpend ?? 0);
                  const pBudget = Number(p.budget ?? p.totalBudget ?? p.approvedBudget ?? 0);
                  return (
                    <div key={p.id} className="p-2 border rounded">
                      <div className="d-flex align-items-center justify-content-between mb-1">
                        <span className="fw-bold text-dark fs-7">{p.name}</span>
                        <span className="badge bg-light text-dark border fs-7">{pct}% Utilized</span>
                      </div>
                      <div className="progress mb-1" style={{ height: '6px' }}>
                        <div
                          className={`progress-bar ${
                            pct >= 90 ? 'bg-danger' : pct >= 75 ? 'bg-warning' : 'bg-success'
                          }`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        ></div>
                      </div>
                      <div className="d-flex justify-content-between text-muted" style={{ fontSize: '0.7rem' }}>
                        <span>Spent: {pSpent.toLocaleString()} {settings.currencySymbol}</span>
                        <span>Budget: {pBudget.toLocaleString()} {settings.currencySymbol}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 4: Upcoming Commitments & Recent Expenditures Table */}
      <div className="card card-erp p-3.5 bg-white">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <h6 className="fw-bold text-dark mb-0 fs-7 text-uppercase">
            <i className="bi bi-list-stars me-1 text-danger"></i> Recent Departmental Expenditures & Commitments
          </h6>
          <button
            type="button"
            onClick={() => onNavigate('expenditure')}
            className="btn btn-sm btn-outline-secondary fs-7"
          >
            Manage Expenditures
          </button>
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle fs-7 mb-0">
            <thead className="table-dark">
              <tr>
                <th>Expense ID</th>
                <th>Date</th>
                <th>Quarter</th>
                <th>Category</th>
                <th>Campaign / Description</th>
                <th>Supplier</th>
                <th className="text-end">Amount ({settings.currencySymbol})</th>
                <th>Status</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredExps.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-4 text-muted">
                    No expenditure records found. Import Excel or add an expenditure to populate table.
                  </td>
                </tr>
              ) : (
                filteredExps.slice(0, 5).map((exp) => (
                  <tr key={exp.id}>
                    <td>
                      <button
                        type="button"
                        className="btn btn-link p-0 text-decoration-none fw-bold text-danger font-monospace text-start"
                        title="Click to drill down into transaction trace"
                        onClick={() =>
                          onDrillDown &&
                          onDrillDown({
                            type: 'transaction',
                            id: exp.expenseId,
                            recordType: 'Expenditure',
                          })
                        }
                      >
                        {exp.expenseId}
                      </button>
                    </td>
                    <td>{exp.date}</td>
                    <td><span className="badge bg-light text-dark border">{exp.quarter || 'Q1'}</span></td>
                    <td><span className="badge bg-secondary-subtle text-dark border">{exp.category}</span></td>
                    <td className="max-w-xs text-truncate">{exp.description}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-link p-0 text-decoration-none text-dark text-start"
                        title="View Supplier 360"
                        onClick={() =>
                          onDrillDown &&
                          onDrillDown({
                            type: 'supplier',
                            id: exp.supplierId || exp.supplierName,
                          })
                        }
                      >
                        {exp.supplierName}
                      </button>
                    </td>
                    <td className="text-end fw-bold text-dark font-monospace">{exp.totalAmount.toLocaleString()}</td>
                    <td>
                      <span
                        className={`badge ${
                          exp.paymentStatus === 'Paid'
                            ? 'bg-success-subtle text-success border border-success'
                            : exp.paymentStatus === 'Pending Approval'
                            ? 'bg-warning-subtle text-warning border border-warning'
                            : 'bg-primary-subtle text-primary border border-primary'
                        }`}
                      >
                        {exp.paymentStatus}
                      </span>
                    </td>
                    <td className="text-center">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger py-0 px-2 fs-8 fw-semibold"
                        title="Investigate transaction lifecycle"
                        onClick={() =>
                          onDrillDown &&
                          onDrillDown({
                            type: 'transaction',
                            id: exp.expenseId,
                            recordType: 'Expenditure',
                          })
                        }
                      >
                        <i className="bi bi-search me-1"></i>Trace
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
