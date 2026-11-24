import React, { useState, useMemo, useEffect } from 'react';
import { DatabaseService } from '../services/db';
import { ExcelService } from '../services/excelService';
import { PDFService } from '../services/pdfService';
import { RoleType } from '../types';
import { BudgetUtilizationView } from './BudgetUtilizationView';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
);

interface BudgetVsActualViewProps {
  role: RoleType;
  onRefresh: () => void;
  initialSubTab?: 'variance' | 'utilization';
}

export const BudgetVsActualView: React.FC<BudgetVsActualViewProps> = ({
  role,
  onRefresh,
  initialSubTab = 'variance',
}) => {
  const projs = DatabaseService.getProjects();
  const exps = DatabaseService.getExpenditures();
  const lpos = DatabaseService.getLPOs();
  const settings = DatabaseService.getSettings();

  const [activeSubTab, setActiveSubTab] = useState<'variance' | 'utilization'>(initialSubTab);
  const [selectedEntity, setSelectedEntity] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [search, setSearch] = useState<string>('');

  useEffect(() => {
    setActiveSubTab(initialSubTab);
  }, [initialSubTab]);

  // Compute aggregated project comparison
  const projectComparison = useMemo(() => {
    return projs.map((p) => {
      const relatedExps = exps.filter((e) => e.projectId === p.id);
      const relatedLpos = lpos.filter((l) => {
        const st = l.lpoStatus || l.status || '';
        return (
          l.projectId === p.id &&
          ['Approved', 'Issued', 'Partially Fulfilled'].includes(st) &&
          l.paymentStatus !== 'Paid' &&
          l.paymentStatus !== 'Fully Paid'
        );
      });

      const budget = Number(p.totalBudget || p.approvedBudget || p.budget || 0);
      const actual = p.actualSpend !== undefined && p.actualSpend > 0
        ? p.actualSpend
        : relatedExps.reduce((sum, e) => sum + Number(e.totalAmount || 0), 0);

      const committed = relatedLpos.reduce((sum, l) => sum + Number(l.totalLpoValue ?? l.totalLpoAmount ?? 0), 0);
      const remaining = budget - actual - committed;
      const variance = budget - actual;
      const utilization = budget > 0 ? (actual / budget) * 100 : 0;
      const isOverBudget = budget > 0 && actual > budget;

      return {
        id: p.id,
        code: p.code,
        name: p.name,
        entity: p.entity || (p.projectType === 'Shared Project' ? 'Shared' : p.paclApplicable ? 'PACL' : 'PGIL'),
        category: p.campaignType || p.budgetCategory || 'Marketing & CX',
        budget,
        actual,
        committed,
        remaining,
        variance,
        utilization,
        isOverBudget,
        status: p.status,
      };
    });
  }, [projs, exps, lpos]);

  // Filtered dataset
  const filteredProjects = useMemo(() => {
    return projectComparison.filter((p) => {
      if (selectedEntity !== 'All' && p.entity !== selectedEntity) return false;
      if (selectedCategory && p.category !== selectedCategory) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !(p.name || '').toLowerCase().includes(q) &&
          !(p.code || '').toLowerCase().includes(q) &&
          !(p.category || '').toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [projectComparison, selectedEntity, selectedCategory, search]);

  // Summary Metrics
  const summary = useMemo(() => {
    const totalBudget = filteredProjects.reduce((sum, p) => sum + p.budget, 0);
    const totalActual = filteredProjects.reduce((sum, p) => sum + p.actual, 0);
    const totalCommitted = filteredProjects.reduce((sum, p) => sum + p.committed, 0);
    const totalRemaining = totalBudget - totalActual - totalCommitted;
    const totalVariance = totalBudget - totalActual;
    const overallUtil = totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0;
    const overspentTotal = filteredProjects
      .filter((p) => p.isOverBudget)
      .reduce((sum, p) => sum + (p.actual - p.budget), 0);
    const overspentCount = filteredProjects.filter((p) => p.isOverBudget).length;

    return {
      totalBudget,
      totalActual,
      totalCommitted,
      totalRemaining,
      totalVariance,
      overallUtil,
      overspentTotal,
      overspentCount,
      count: filteredProjects.length,
    };
  }, [filteredProjects]);

  // Entity Breakdown for Doughnut
  const entityBreakdown = useMemo(() => {
    const paclSpend = filteredProjects.filter((p) => p.entity === 'PACL').reduce((sum, p) => sum + p.actual, 0);
    const pgilSpend = filteredProjects.filter((p) => p.entity === 'PGIL').reduce((sum, p) => sum + p.actual, 0);
    const sharedSpend = filteredProjects.filter((p) => p.entity === 'Shared').reduce((sum, p) => sum + p.actual, 0);

    return {
      labels: ['PACL (Pioneer Assurance)', 'PGIL (Pioneer General)', 'Shared Projects'],
      datasets: [
        {
          data: [paclSpend, pgilSpend, sharedSpend],
          backgroundColor: ['#000000', '#DC2626', '#2563EB'],
          borderWidth: 1,
        },
      ],
    };
  }, [filteredProjects]);

  // Top 6 Projects Comparison Bar Chart
  const topProjectsBarData = useMemo(() => {
    const sorted = [...filteredProjects].sort((a, b) => b.budget - a.budget).slice(0, 6);
    return {
      labels: sorted.map((p) => {
        const nm = p.name || 'Unnamed';
        return nm.length > 20 ? nm.substring(0, 18) + '...' : nm;
      }),
      datasets: [
        {
          label: 'Approved Budget',
          data: sorted.map((p) => p.budget),
          backgroundColor: '#4B5563',
        },
        {
          label: 'Actual Spend',
          data: sorted.map((p) => p.actual),
          backgroundColor: '#DC2626',
        },
        {
          label: 'Committed (LPOs)',
          data: sorted.map((p) => p.committed),
          backgroundColor: '#F59E0B',
        },
      ],
    };
  }, [filteredProjects]);

  // Export handlers
  const handleExportExcel = () => {
    const exportData = filteredProjects.map((p) => ({
      'Project Code': p.code,
      'Project Name': p.name,
      'Entity': p.entity,
      'Category': p.category,
      'Approved Budget (KES)': p.budget,
      'Actual Spend (KES)': p.actual,
      'Committed Spend (KES)': p.committed,
      'Remaining Balance (KES)': p.remaining,
      'Variance (KES)': p.variance,
      'Utilization %': `${p.utilization.toFixed(1)}%`,
      'Over Budget Status': p.isOverBudget ? 'OVER BUDGET' : 'Within Budget',
      'Project Status': p.status,
    }));
    ExcelService.exportCustomDataset(exportData, 'Budget_vs_Actual_Variance_Report');
  };

  const handleExportPDF = () => {
    const cols = ['Project Code', 'Project Name', 'Entity', 'Approved Budget', 'Actual Spend', 'Committed', 'Variance', 'Utilization', 'Status'];
    const rows = filteredProjects.map((p) => [
      p.code,
      p.name,
      p.entity,
      `${p.budget.toLocaleString()} ${settings.currencySymbol}`,
      `${p.actual.toLocaleString()} ${settings.currencySymbol}`,
      `${p.committed.toLocaleString()} ${settings.currencySymbol}`,
      `${p.variance.toLocaleString()} ${settings.currencySymbol}`,
      `${p.utilization.toFixed(1)}%`,
      p.isOverBudget ? 'OVER BUDGET' : 'On Track',
    ]);
    PDFService.generateReportPDF('BUDGET VS ACTUAL VARIANCE ANALYSIS', `Entity: ${selectedEntity} | FY ${settings.financialYear}`, cols, rows, settings);
  };

  return (
    <div className="d-flex flex-column gap-4">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 pb-2 border-bottom">
        <div>
          <div className="d-flex align-items-center gap-2">
            <h3 className="fw-bold mb-0 text-dark" style={{ fontFamily: 'Tahoma, sans-serif' }}>
              Budget Performance &amp; Variance
            </h3>
            <span className="badge bg-danger text-white px-2 py-1">Variance &amp; Utilization</span>
          </div>
          <p className="text-muted small mb-0 mt-1">
            Real-time variance calculations, committed purchase orders, utilization thresholds (75%/90%), and over-budget diagnostics.
          </p>
        </div>
        {activeSubTab === 'variance' && (
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <button id="btn-export-excel-bva" onClick={handleExportExcel} className="btn btn-outline-success btn-sm d-flex align-items-center gap-1 shadow-sm">
              <i className="bi bi-file-earmark-excel"></i> Export Excel
            </button>
            <button id="btn-export-pdf-bva" onClick={handleExportPDF} className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1 shadow-sm">
              <i className="bi bi-file-earmark-pdf"></i> Export PDF
            </button>
          </div>
        )}
      </div>

      {/* Sub-Tabs */}
      <ul className="nav nav-pills gap-2 bg-white p-2 rounded-3 shadow-xs border">
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link btn-sm py-1.5 px-3 fw-semibold d-flex align-items-center gap-2 ${
              activeSubTab === 'variance' ? 'active bg-danger text-white shadow-xs' : 'text-dark'
            }`}
            onClick={() => setActiveSubTab('variance')}
          >
            <i className="bi bi-bar-chart-line-fill"></i> Variance Analysis &amp; Charts
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link btn-sm py-1.5 px-3 fw-semibold d-flex align-items-center gap-2 ${
              activeSubTab === 'utilization' ? 'active bg-danger text-white shadow-xs' : 'text-dark'
            }`}
            onClick={() => setActiveSubTab('utilization')}
          >
            <i className="bi bi-speedometer2"></i> Utilization Tiers &amp; Burn Rate Ledger
          </button>
        </li>
      </ul>

      {activeSubTab === 'utilization' ? (
        <BudgetUtilizationView role={role} onRefresh={onRefresh} embedded />
      ) : (
        <>
      {/* KPI Cards */}
      <div className="row g-3">
        <div className="col-12 col-sm-6 col-xl-2">
          <div className="card card-erp p-3 border-start border-4 border-dark h-100 shadow-sm">
            <span className="text-muted small text-uppercase fw-semibold">Approved Budget</span>
            <div className="fs-5 fw-bold text-dark mt-1">
              {summary.totalBudget.toLocaleString()} <span className="small text-muted">{settings.currencySymbol}</span>
            </div>
            <span className="text-muted extra-small mt-1">{summary.count} tracked initiatives</span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-2">
          <div className="card card-erp p-3 border-start border-4 border-danger h-100 shadow-sm">
            <span className="text-muted small text-uppercase fw-semibold">Actual Spend</span>
            <div className="fs-5 fw-bold text-danger mt-1">
              {summary.totalActual.toLocaleString()} <span className="small text-muted">{settings.currencySymbol}</span>
            </div>
            <span className="text-muted extra-small mt-1">Invoiced & paid</span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-2">
          <div className="card card-erp p-3 border-start border-4 border-warning h-100 shadow-sm">
            <span className="text-muted small text-uppercase fw-semibold">Committed (LPOs)</span>
            <div className="fs-5 fw-bold text-dark mt-1">
              {summary.totalCommitted.toLocaleString()} <span className="small text-muted">{settings.currencySymbol}</span>
            </div>
            <span className="text-muted extra-small mt-1">Issued orders</span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-2">
          <div className="card card-erp p-3 border-start border-4 border-primary h-100 shadow-sm">
            <span className="text-muted small text-uppercase fw-semibold">Net Variance</span>
            <div className={`fs-5 fw-bold mt-1 ${summary.totalVariance < 0 ? 'text-danger' : 'text-primary'}`}>
              {summary.totalVariance.toLocaleString()} <span className="small text-muted">{settings.currencySymbol}</span>
            </div>
            <span className="text-muted extra-small mt-1">Budget - Actual</span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-2">
          <div className="card card-erp p-3 border-start border-4 border-success h-100 shadow-sm">
            <span className="text-muted small text-uppercase fw-semibold">Remaining Balance</span>
            <div className={`fs-5 fw-bold mt-1 ${summary.totalRemaining < 0 ? 'text-danger' : 'text-success'}`}>
              {summary.totalRemaining.toLocaleString()} <span className="small text-muted">{settings.currencySymbol}</span>
            </div>
            <span className="text-muted extra-small mt-1">After commitments</span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-2">
          <div className="card card-erp p-3 border-start border-4 border-info h-100 shadow-sm">
            <span className="text-muted small text-uppercase fw-semibold">Overall Utilization</span>
            <div className={`fs-5 fw-bold mt-1 ${summary.overallUtil > 100 ? 'text-danger' : summary.overallUtil > 85 ? 'text-warning' : 'text-info'}`}>
              {summary.overallUtil.toFixed(1)}%
            </div>
            <div className="progress mt-2" style={{ height: '6px' }}>
              <div
                className={`progress-bar ${summary.overallUtil > 100 ? 'bg-danger' : summary.overallUtil > 85 ? 'bg-warning' : 'bg-success'}`}
                role="progressbar"
                style={{ width: `${Math.min(summary.overallUtil, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Analytics Charts */}
      <div className="row g-3">
        <div className="col-12 col-lg-8">
          <div className="card card-erp p-4 h-100 shadow-sm">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="fw-bold mb-0 text-dark">
                <i className="bi bi-bar-chart-fill me-2 text-danger"></i>
                Top Projects: Budget vs Actual vs Committed Spend
              </h6>
              <span className="badge bg-light text-muted border">Top 6 Portfolios</span>
            </div>
            <div style={{ height: '260px' }}>
              <Bar
                data={topProjectsBarData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    x: { grid: { display: false } },
                    y: {
                      ticks: {
                        callback: (v) => `${Number(v) / 1000000}M`,
                      },
                    },
                  },
                }}
              />
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-4">
          <div className="card card-erp p-4 h-100 shadow-sm">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="fw-bold mb-0 text-dark">
                <i className="bi bi-pie-chart-fill me-2 text-primary"></i>
                Spend Distribution by Entity
              </h6>
            </div>
            <div style={{ height: '220px' }} className="d-flex justify-content-center">
              <Doughnut
                data={entityBreakdown}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: 'bottom' },
                  },
                }}
              />
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
                id="input-search-bva"
                type="text"
                className="form-control form-control-sm border-start-0"
                placeholder="Search project name, code, category..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="col-6 col-md-3">
            <select
              id="select-bva-entity"
              className="form-select form-select-sm"
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
            >
              <option value="All">All Entities (PACL, PGIL & Shared)</option>
              <option value="PACL">PACL (Pioneer Assurance)</option>
              <option value="PGIL">PGIL (Pioneer General)</option>
              <option value="Shared">Shared Projects</option>
            </select>
          </div>

          <div className="col-6 col-md-3">
            <select
              id="select-bva-category"
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

          <div className="col-12 col-md-1 text-end">
            <button
              id="btn-reset-bva-filters"
              onClick={() => {
                setSearch('');
                setSelectedEntity('All');
                setSelectedCategory('');
              }}
              className="btn btn-outline-secondary btn-sm w-100"
              title="Reset Filters"
            >
              <i className="bi bi-arrow-counterclockwise"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Variance Analysis Table */}
      <div className="card card-erp shadow-sm overflow-hidden">
        <div className="card-header bg-white py-3 px-4 d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-2">
            <h6 className="mb-0 fw-bold text-dark">Comprehensive Project Variance Ledger</h6>
            <span className="badge bg-light text-dark border">
              {filteredProjects.length} Initiatives
            </span>
          </div>
          {summary.overspentCount > 0 && (
            <span className="badge bg-danger text-white px-2 py-1">
              <i className="bi bi-exclamation-triangle-fill me-1"></i>
              {summary.overspentCount} Projects Exceeding Budget
            </span>
          )}
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0 erp-table">
            <thead className="table-light">
              <tr className="small text-uppercase text-muted">
                <th style={{ width: '130px' }}>Project Code</th>
                <th>Project Name & Category</th>
                <th>Entity</th>
                <th className="text-end">Approved Budget</th>
                <th className="text-end">Actual Spend</th>
                <th className="text-end">Committed (LPOs)</th>
                <th className="text-end">Variance (Budget - Spend)</th>
                <th className="text-end">Remaining Balance</th>
                <th style={{ width: '130px' }}>Utilization Rate</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-5 text-muted">
                    <i className="bi bi-clipboard2-data fs-2 d-block mb-2 text-secondary opacity-50"></i>
                    No projects found for variance comparison.
                  </td>
                </tr>
              ) : (
                filteredProjects.map((p) => {
                  const utilColor = p.utilization > 100 ? 'bg-danger' : p.utilization > 85 ? 'bg-warning' : 'bg-success';
                  return (
                    <tr key={p.id} className={p.isOverBudget ? 'table-danger bg-opacity-25' : ''}>
                      <td>
                        <span className="fw-semibold text-dark">{p.code}</span>
                      </td>
                      <td>
                        <div className="fw-bold text-dark">{p.name}</div>
                        <div className="extra-small text-muted">{p.category}</div>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            p.entity === 'PACL'
                              ? 'bg-dark text-white'
                              : p.entity === 'PGIL'
                              ? 'bg-danger text-white'
                              : 'bg-primary text-white'
                          }`}
                        >
                          {p.entity}
                        </span>
                      </td>
                      <td className="text-end fw-semibold">
                        {p.budget.toLocaleString()} <span className="extra-small text-muted">{settings.currencySymbol}</span>
                      </td>
                      <td className="text-end text-danger fw-bold">
                        {p.actual.toLocaleString()} <span className="extra-small text-muted">{settings.currencySymbol}</span>
                      </td>
                      <td className="text-end text-muted small">
                        {p.committed > 0 ? `${p.committed.toLocaleString()} ${settings.currencySymbol}` : '-'}
                      </td>
                      <td className={`text-end fw-bold ${p.variance < 0 ? 'text-danger' : 'text-primary'}`}>
                        {p.variance.toLocaleString()} <span className="extra-small text-muted">{settings.currencySymbol}</span>
                      </td>
                      <td className={`text-end fw-bold ${p.remaining < 0 ? 'text-danger' : 'text-success'}`}>
                        {p.remaining.toLocaleString()} <span className="extra-small text-muted">{settings.currencySymbol}</span>
                      </td>
                      <td>
                        <div className="d-flex justify-content-between extra-small mb-1">
                          <span className="fw-bold">{p.utilization.toFixed(1)}%</span>
                          {p.isOverBudget && <span className="badge bg-danger text-white extra-small px-1">OVER</span>}
                        </div>
                        <div className="progress" style={{ height: '5px' }}>
                          <div
                            className={`progress-bar ${utilColor}`}
                            role="progressbar"
                            style={{ width: `${Math.min(p.utilization, 100)}%` }}
                          ></div>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            p.isOverBudget
                              ? 'bg-danger text-white'
                              : p.status === 'Completed'
                              ? 'bg-success-subtle text-success border border-success'
                              : 'bg-light text-dark border'
                          }`}
                        >
                          {p.isOverBudget ? 'OVER BUDGET' : p.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredProjects.length > 0 && (
              <tfoot className="table-light fw-bold">
                <tr>
                  <td colSpan={3} className="text-uppercase small">Total Portfolio Variance</td>
                  <td className="text-end">{summary.totalBudget.toLocaleString()} {settings.currencySymbol}</td>
                  <td className="text-end text-danger">{summary.totalActual.toLocaleString()} {settings.currencySymbol}</td>
                  <td className="text-end text-muted">{summary.totalCommitted.toLocaleString()} {settings.currencySymbol}</td>
                  <td className={`text-end ${summary.totalVariance < 0 ? 'text-danger' : 'text-primary'}`}>
                    {summary.totalVariance.toLocaleString()} {settings.currencySymbol}
                  </td>
                  <td className={`text-end ${summary.totalRemaining < 0 ? 'text-danger' : 'text-success'}`}>
                    {summary.totalRemaining.toLocaleString()} {settings.currencySymbol}
                  </td>
                  <td className="text-center">{summary.overallUtil.toFixed(1)}%</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
        </>
      )}
    </div>
  );
};
