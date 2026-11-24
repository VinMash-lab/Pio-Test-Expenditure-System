import React, { useState, useMemo } from 'react';
import { DatabaseService } from '../services/db';
import { ExcelService } from '../services/excelService';
import { PDFService } from '../services/pdfService';
import { RoleType } from '../types';

interface ManagementReportViewProps {
  role: RoleType;
  onRefresh: () => void;
  embedded?: boolean;
}

export const ManagementReportView: React.FC<ManagementReportViewProps> = ({ role: _role, onRefresh: _onRefresh, embedded = false }) => {
  const projs = DatabaseService.getProjects();
  const exps = DatabaseService.getExpenditures();
  const lpos = DatabaseService.getLPOs();
  const settings = DatabaseService.getSettings();

  const [selectedFY, setSelectedFY] = useState(settings.financialYear || '2026');
  const [selectedEntity, setSelectedEntity] = useState('All');

  // Aggregated data
  const reportData = useMemo(() => {
    // Filter projects
    const filteredProjs = projs.filter((p) => {
      if (selectedEntity !== 'All') {
        const ent = p.entity || (p.projectType === 'Shared Project' ? 'Shared' : p.paclApplicable ? 'PACL' : 'PGIL');
        if (ent !== selectedEntity) return false;
      }
      return true;
    });

    const projectMetrics = filteredProjs.map((p) => {
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
      const utilization = budget > 0 ? (actual / budget) * 100 : 0;

      return {
        ...p,
        budgetVal: budget,
        actualVal: actual,
        committedVal: committed,
        remainingVal: remaining,
        utilizationVal: utilization,
      };
    });

    const totalBudget = projectMetrics.reduce((sum, p) => sum + p.budgetVal, 0);
    const totalActual = projectMetrics.reduce((sum, p) => sum + p.actualVal, 0);
    const totalCommitted = projectMetrics.reduce((sum, p) => sum + p.committedVal, 0);
    const totalRemaining = totalBudget - totalActual - totalCommitted;
    const overallUtil = totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0;

    // PACL breakdown
    const paclBudget = projs.filter((p) => p.paclApplicable && p.projectType !== 'Shared Project').reduce((s, p) => s + Number(p.totalBudget || p.approvedBudget || p.budget || 0), 0);
    const paclActual = exps.filter((e) => e.legalEntity === 'PACL').reduce((s, e) => s + Number(e.totalAmount || 0), 0);

    // PGIL breakdown
    const pgilBudget = projs.filter((p) => p.pgilApplicable && p.projectType !== 'Shared Project').reduce((s, p) => s + Number(p.totalBudget || p.approvedBudget || p.budget || 0), 0);
    const pgilActual = exps.filter((e) => e.legalEntity === 'PGIL').reduce((s, e) => s + Number(e.totalAmount || 0), 0);

    // Shared breakdown
    const sharedBudget = projs.filter((p) => p.projectType === 'Shared Project').reduce((s, p) => s + Number(p.totalBudget || p.approvedBudget || p.budget || 0), 0);
    const sharedActual = exps.filter((e) => {
      const p = projs.find((pr) => pr.id === e.projectId);
      return p?.projectType === 'Shared Project';
    }).reduce((s, e) => s + Number(e.totalAmount || 0), 0);

    // Top 5 Projects by Spend
    const topBySpend = [...projectMetrics].sort((a, b) => b.actualVal - a.actualVal).slice(0, 5);

    // Top 5 Projects by Utilization
    const topByUtil = [...projectMetrics].sort((a, b) => b.utilizationVal - a.utilizationVal).slice(0, 5);

    return {
      projectMetrics,
      totalBudget,
      totalActual,
      totalCommitted,
      totalRemaining,
      overallUtil,
      paclBudget,
      paclActual,
      pgilBudget,
      pgilActual,
      sharedBudget,
      sharedActual,
      topBySpend,
      topByUtil,
    };
  }, [projs, exps, lpos, selectedEntity]);

  const handleExportExcel = () => {
    const data = reportData.projectMetrics.map((p) => ({
      'Project Code': p.code,
      'Project Name': p.name,
      'Category': p.campaignType || p.budgetCategory || 'Marketing & CX',
      'Approved Budget (KES)': p.budgetVal,
      'Actual Spend (KES)': p.actualVal,
      'Committed (KES)': p.committedVal,
      'Remaining Balance (KES)': p.remainingVal,
      'Utilization Rate': `${p.utilizationVal.toFixed(1)}%`,
      'Status': p.status,
    }));
    ExcelService.exportCustomDataset(data, 'Executive_Management_Budget_Report');
  };

  const handleExportPDF = () => {
    const cols = ['Project Code', 'Project Name', 'Budget', 'Actual Spend', 'Committed', 'Remaining', 'Utilization %'];
    const rows = reportData.projectMetrics.map((p) => [
      p.code,
      p.name,
      `${p.budgetVal.toLocaleString()} ${settings.currencySymbol}`,
      `${p.actualVal.toLocaleString()} ${settings.currencySymbol}`,
      `${p.committedVal.toLocaleString()} ${settings.currencySymbol}`,
      `${p.remainingVal.toLocaleString()} ${settings.currencySymbol}`,
      `${p.utilizationVal.toFixed(1)}%`,
    ]);
    PDFService.generateReportPDF('EXECUTIVE MANAGEMENT BUDGET PERFORMANCE REPORT', `Financial Year ${selectedFY} | Entity: ${selectedEntity}`, cols, rows, settings);
  };

  return (
    <div className="d-flex flex-column gap-4">
      {/* Header */}
      {embedded ? (
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div className="d-flex align-items-center gap-2">
            <span className="badge bg-danger text-white px-2 py-1">Board &amp; ExCo Ready</span>
            <span className="text-muted small">
              Consolidated financial summary, legal entity performance comparison, and top strategic marketing initiatives.
            </span>
          </div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <button id="btn-export-excel-mgmt" onClick={handleExportExcel} className="btn btn-outline-success btn-sm d-flex align-items-center gap-1 shadow-sm">
              <i className="bi bi-file-earmark-excel"></i> Export Excel
            </button>
            <button id="btn-export-pdf-mgmt" onClick={handleExportPDF} className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1 shadow-sm">
              <i className="bi bi-file-earmark-pdf"></i> Export Executive PDF
            </button>
          </div>
        </div>
      ) : (
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 pb-2 border-bottom">
          <div>
            <div className="d-flex align-items-center gap-2">
              <h3 className="fw-bold mb-0 text-dark" style={{ fontFamily: 'Tahoma, sans-serif' }}>
                Executive Management Report
              </h3>
              <span className="badge bg-danger text-white px-2 py-1">Board &amp; ExCo Ready</span>
            </div>
            <p className="text-muted small mb-0 mt-1">
              Consolidated financial summary, legal entity performance comparison, and top strategic marketing initiatives.
            </p>
          </div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <button id="btn-export-excel-mgmt" onClick={handleExportExcel} className="btn btn-outline-success btn-sm d-flex align-items-center gap-1 shadow-sm">
              <i className="bi bi-file-earmark-excel"></i> Export Excel
            </button>
            <button id="btn-export-pdf-mgmt" onClick={handleExportPDF} className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1 shadow-sm">
              <i className="bi bi-file-earmark-pdf"></i> Export Executive PDF
            </button>
          </div>
        </div>
      )}

      {/* Control Bar */}
      <div className="card card-erp p-3 shadow-sm">
        <div className="row g-2 align-items-center">
          <div className="col-6 col-md-3">
            <label className="form-label extra-small text-muted mb-1 fw-semibold">Reporting Year</label>
            <select
              className="form-select form-select-sm"
              value={selectedFY}
              onChange={(e) => setSelectedFY(e.target.value)}
            >
              <option value="2026">Financial Year 2026</option>
              <option value="2025">Financial Year 2025</option>
            </select>
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label extra-small text-muted mb-1 fw-semibold">Entity Filter</label>
            <select
              className="form-select form-select-sm"
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
            >
              <option value="All">Consolidated (PACL & PGIL)</option>
              <option value="PACL">Pioneer Assurance Company Ltd (PACL)</option>
              <option value="PGIL">Pioneer General Insurance Ltd (PGIL)</option>
              <option value="Shared">Shared Co-Funded Projects</option>
            </select>
          </div>
        </div>
      </div>

      {/* High-Level Overview Cards */}
      <div className="row g-3">
        <div className="col-12 col-md-3">
          <div className="card card-erp p-3 border-start border-4 border-dark shadow-sm">
            <span className="text-muted small text-uppercase fw-semibold">Consolidated Budget</span>
            <div className="fs-5 fw-bold text-dark mt-1">
              {reportData.totalBudget.toLocaleString()} <span className="small text-muted">{settings.currencySymbol}</span>
            </div>
            <span className="text-muted extra-small mt-1">Approved Marketing & CX Ceiling</span>
          </div>
        </div>

        <div className="col-12 col-md-3">
          <div className="card card-erp p-3 border-start border-4 border-danger shadow-sm">
            <span className="text-muted small text-uppercase fw-semibold">Total Expenditure</span>
            <div className="fs-5 fw-bold text-danger mt-1">
              {reportData.totalActual.toLocaleString()} <span className="small text-muted">{settings.currencySymbol}</span>
            </div>
            <span className="text-muted extra-small mt-1">Total posted invoices & claims</span>
          </div>
        </div>

        <div className="col-12 col-md-3">
          <div className="card card-erp p-3 border-start border-4 border-warning shadow-sm">
            <span className="text-muted small text-uppercase fw-semibold">Committed (LPOs)</span>
            <div className="fs-5 fw-bold text-dark mt-1">
              {reportData.totalCommitted.toLocaleString()} <span className="small text-muted">{settings.currencySymbol}</span>
            </div>
            <span className="text-muted extra-small mt-1">Active purchase orders</span>
          </div>
        </div>

        <div className="col-12 col-md-3">
          <div className="card card-erp p-3 border-start border-4 border-success shadow-sm">
            <span className="text-muted small text-uppercase fw-semibold">Net Available Balance</span>
            <div className="fs-5 fw-bold text-success mt-1">
              {reportData.totalRemaining.toLocaleString()} <span className="small text-muted">{settings.currencySymbol}</span>
            </div>
            <span className="text-muted extra-small mt-1">{reportData.overallUtil.toFixed(1)}% Overall Utilization</span>
          </div>
        </div>
      </div>

      {/* Entity Comparison Matrix */}
      <div className="card card-erp shadow-sm overflow-hidden">
        <div className="card-header bg-white py-3 px-4">
          <h6 className="mb-0 fw-bold text-dark">Legal Entity Performance Breakdown</h6>
        </div>
        <div className="table-responsive">
          <table className="table table-bordered align-middle mb-0 text-center">
            <thead className="table-light">
              <tr className="small text-uppercase text-muted">
                <th className="text-start">Entity</th>
                <th>Approved Budget</th>
                <th>Actual Expenditure</th>
                <th>Remaining Balance</th>
                <th>Utilization %</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="text-start fw-bold">
                  <span className="badge bg-dark text-white me-2">PACL</span>
                  Pioneer Assurance Company Limited (Life & Health)
                </td>
                <td className="fw-semibold">{reportData.paclBudget.toLocaleString()} {settings.currencySymbol}</td>
                <td className="text-danger fw-bold">{reportData.paclActual.toLocaleString()} {settings.currencySymbol}</td>
                <td className="text-success fw-semibold">{(reportData.paclBudget - reportData.paclActual).toLocaleString()} {settings.currencySymbol}</td>
                <td>
                  {reportData.paclBudget > 0 ? ((reportData.paclActual / reportData.paclBudget) * 100).toFixed(1) : 0}%
                </td>
                <td>
                  <span className="badge bg-success-subtle text-success border border-success">On Budget</span>
                </td>
              </tr>
              <tr>
                <td className="text-start fw-bold">
                  <span className="badge bg-danger text-white me-2">PGIL</span>
                  Pioneer General Insurance Limited (General Lines)
                </td>
                <td className="fw-semibold">{reportData.pgilBudget.toLocaleString()} {settings.currencySymbol}</td>
                <td className="text-danger fw-bold">{reportData.pgilActual.toLocaleString()} {settings.currencySymbol}</td>
                <td className="text-success fw-semibold">{(reportData.pgilBudget - reportData.pgilActual).toLocaleString()} {settings.currencySymbol}</td>
                <td>
                  {reportData.pgilBudget > 0 ? ((reportData.pgilActual / reportData.pgilBudget) * 100).toFixed(1) : 0}%
                </td>
                <td>
                  <span className="badge bg-success-subtle text-success border border-success">On Budget</span>
                </td>
              </tr>
              <tr>
                <td className="text-start fw-bold">
                  <span className="badge bg-primary text-white me-2">Shared</span>
                  Shared Co-Funded Projects (Brand & Digital)
                </td>
                <td className="fw-semibold">{reportData.sharedBudget.toLocaleString()} {settings.currencySymbol}</td>
                <td className="text-danger fw-bold">{reportData.sharedActual.toLocaleString()} {settings.currencySymbol}</td>
                <td className="text-success fw-semibold">{(reportData.sharedBudget - reportData.sharedActual).toLocaleString()} {settings.currencySymbol}</td>
                <td>
                  {reportData.sharedBudget > 0 ? ((reportData.sharedActual / reportData.sharedBudget) * 100).toFixed(1) : 0}%
                </td>
                <td>
                  <span className="badge bg-success-subtle text-success border border-success">On Budget</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Top 5 Portfolios by Spend & Utilization */}
      <div className="row g-3">
        <div className="col-12 col-md-6">
          <div className="card card-erp p-4 h-100 shadow-sm">
            <h6 className="fw-bold mb-3 text-dark">
              <i className="bi bi-fire me-2 text-danger"></i>Top 5 Projects by Spend
            </h6>
            <div className="d-flex flex-column gap-3">
              {reportData.topBySpend.map((p, idx) => (
                <div key={p.id} className="d-flex justify-content-between align-items-center pb-2 border-bottom">
                  <div>
                    <div className="fw-semibold text-dark small">{idx + 1}. {p.name}</div>
                    <div className="extra-small text-muted">{p.code} | Budget: {p.budgetVal.toLocaleString()} {settings.currencySymbol}</div>
                  </div>
                  <div className="text-end">
                    <div className="fw-bold text-danger small">{p.actualVal.toLocaleString()} {settings.currencySymbol}</div>
                    <div className="extra-small text-muted">{p.utilizationVal.toFixed(1)}% util</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-12 col-md-6">
          <div className="card card-erp p-4 h-100 shadow-sm">
            <h6 className="fw-bold mb-3 text-dark">
              <i className="bi bi-speedometer2 me-2 text-primary"></i>Top 5 Projects by Utilization Rate
            </h6>
            <div className="d-flex flex-column gap-3">
              {reportData.topByUtil.map((p, idx) => (
                <div key={p.id} className="d-flex justify-content-between align-items-center pb-2 border-bottom">
                  <div>
                    <div className="fw-semibold text-dark small">{idx + 1}. {p.name}</div>
                    <div className="extra-small text-muted">{p.code} | Spend: {p.actualVal.toLocaleString()} {settings.currencySymbol}</div>
                  </div>
                  <div className="text-end">
                    <div className={`fw-bold small ${p.utilizationVal > 100 ? 'text-danger' : 'text-primary'}`}>
                      {p.utilizationVal.toFixed(1)}%
                    </div>
                    <div className="extra-small text-muted">of {p.budgetVal.toLocaleString()} {settings.currencySymbol}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
