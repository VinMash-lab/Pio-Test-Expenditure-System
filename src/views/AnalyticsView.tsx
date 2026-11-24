import React, { useState } from 'react';
import { Bar, Line, Radar } from 'react-chartjs-2';
import { DatabaseService } from '../services/db';

export const AnalyticsView: React.FC = () => {
  const bdgs = DatabaseService.getBudgets();
  const exps = DatabaseService.getExpenditures();
  const projs = DatabaseService.getProjects();
  const settings = DatabaseService.getSettings();

  const [entityFilter, setEntityFilter] = useState<'All' | 'PACL' | 'PGIL'>('All');
  const [metric, setMetric] = useState<'monthly' | 'category' | 'entity' | 'burn'>('monthly');

  // Filtered dataset according to selected entity
  const filteredBdgs = bdgs.filter((b) => entityFilter === 'All' || b.legalEntity === entityFilter);
  const filteredExps = exps.filter((e) => entityFilter === 'All' || e.legalEntity === entityFilter);

  // Aggregates
  const totalBudget = filteredBdgs.reduce((s, b) => s + Number(b.allocatedAmount || 0), 0);
  const totalSpent = filteredExps.reduce((s, e) => s + Number(e.totalAmount || 0), 0);
  const avgMonthlySpend = totalSpent / 12;
  const burnRate = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  const forecastYearEnd = totalSpent * 1.12;

  // Entity Specific Aggregates for comparison
  const paclBudget = bdgs.filter((b) => b.legalEntity === 'PACL').reduce((s, b) => s + Number(b.allocatedAmount || 0), 0);
  const paclSpent = exps.filter((e) => e.legalEntity === 'PACL').reduce((s, e) => s + Number(e.totalAmount || 0), 0);
  const pgilBudget = bdgs.filter((b) => b.legalEntity === 'PGIL').reduce((s, b) => s + Number(b.allocatedAmount || 0), 0);
  const pgilSpent = exps.filter((e) => e.legalEntity === 'PGIL').reduce((s, e) => s + Number(e.totalAmount || 0), 0);

  const entityCompareData = {
    labels: ['Pioneer Assurance (PACL)', 'Pioneer General Insurance (PGIL)', 'Combined Total'],
    datasets: [
      {
        label: 'Allocated Budget (KES)',
        data: [paclBudget, pgilBudget, paclBudget + pgilBudget],
        backgroundColor: '#1E293B',
      },
      {
        label: 'Actual Spend (KES)',
        data: [paclSpent, pgilSpent, paclSpent + pgilSpent],
        backgroundColor: '#DC2626',
      },
    ],
  };

  // Dynamic monthly calculate
  const months = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const monthlyValues = months.map((_, idx) => {
    return filteredExps
      .filter((e) => {
        const dt = e.date || e.expenseDate;
        if (!dt) return false;
        const m = new Date(dt).getMonth();
        const academicIdx = (m + 6) % 12;
        return academicIdx === idx;
      })
      .reduce((s, e) => s + Number(e.totalAmount || 0), 0);
  });

  // Chart 1: Monthly Spending & Baseline
  const monthlyTrendData = {
    labels: months,
    datasets: [
      {
        label: 'Actual Spend (KES)',
        data: monthlyValues,
        borderColor: '#DC2626',
        backgroundColor: 'rgba(220, 38, 38, 0.1)',
        tension: 0.3,
      },
      {
        label: 'Monthly Budget Baseline',
        data: Array(12).fill(Math.round(totalBudget / 12)),
        borderColor: '#1E293B',
        borderDash: [6, 6],
        tension: 0,
      },
    ],
  };

  // Chart 2: Category Comparison
  const catMap: Record<string, { budget: number; spent: number }> = {};
  filteredBdgs.forEach((b) => {
    if (!catMap[b.category]) catMap[b.category] = { budget: 0, spent: 0 };
    catMap[b.category].budget += Number(b.allocatedAmount || 0);
  });
  filteredExps.forEach((e) => {
    if (!catMap[e.category]) catMap[e.category] = { budget: 0, spent: 0 };
    catMap[e.category].spent += Number(e.totalAmount || 0);
  });

  const categoryLabels = Object.keys(catMap);
  const catCompareData = {
    labels: categoryLabels.length > 0 ? categoryLabels : ['No Categories'],
    datasets: [
      {
        label: 'Allocated Budget',
        data: categoryLabels.map((c) => catMap[c].budget),
        backgroundColor: '#1E293B',
      },
      {
        label: 'Actual Spend',
        data: categoryLabels.map((c) => catMap[c].spent),
        backgroundColor: '#DC2626',
      },
    ],
  };

  // Chart 3: Campaign Utilization Radar
  const projRadarData = {
    labels: projs.length > 0 ? projs.map((p) => (p.name || 'Campaign').substring(0, 16) + '...') : ['No Campaigns'],
    datasets: [
      {
        label: 'Progress %',
        data: projs.length > 0 ? projs.map((p) => Number(p.progressPercent || 0)) : [0],
        borderColor: '#DC2626',
        backgroundColor: 'rgba(220, 38, 38, 0.2)',
      },
      {
        label: 'Budget Utilization %',
        data:
          projs.length > 0
            ? projs.map((p) => {
                const cap = Number(p.budget ?? p.totalBudget ?? p.approvedBudget ?? 0);
                const spent = Number(p.spent ?? p.actualSpend ?? 0);
                return cap > 0 ? Math.round((spent / cap) * 100) : 0;
              })
            : [0],
        borderColor: '#1E293B',
        backgroundColor: 'rgba(30, 41, 59, 0.2)',
      },
    ],
  };

  const isEmpty = bdgs.length === 0 && exps.length === 0;

  return (
    <div className="d-flex flex-column gap-4">
      {/* Header */}
      <div className="card card-erp p-3 bg-white border-top border-4 border-danger shadow-sm">
        <h2 className="h4 fw-bold text-dark mb-1">
          Marketing & Customer Experience Analytics & Intelligence
        </h2>
        <p className="text-muted fs-7 mb-0">
          In-depth financial burn rates, category spending distribution, monthly velocity, and campaign return tracking.
        </p>
      </div>

      {/* Analytics KPI Row */}
      <div className="row g-3">
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card card-erp p-3 bg-white">
            <span className="text-muted fs-7 font-semibold">Average Monthly Spend</span>
            <h3 className="h5 fw-bold mb-0 text-dark">
              {Math.round(avgMonthlySpend).toLocaleString()} <small className="fs-7 text-muted">{settings.currencySymbol}</small>
            </h3>
            <span className="fs-7 text-muted">12-Month Average Run Rate</span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card card-erp p-3 bg-white">
            <span className="text-muted fs-7 font-semibold">Budget Burn Rate</span>
            <h3 className="h5 fw-bold mb-0 text-danger">{burnRate.toFixed(1)}%</h3>
            <span className="fs-7 text-muted">Total Budget Consumed</span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card card-erp p-3 bg-white">
            <span className="text-muted fs-7 font-semibold">Forecast Year-End Spend</span>
            <h3 className="h5 fw-bold mb-0 text-dark">
              {Math.round(forecastYearEnd).toLocaleString()} <small className="fs-7 text-muted">{settings.currencySymbol}</small>
            </h3>
            <span className="fs-7 text-success font-semibold">Projected Annual Outlay</span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card card-erp p-3 bg-white">
            <span className="text-muted fs-7 font-semibold">Posted Transactions</span>
            <h3 className="h5 fw-bold mb-0 text-dark">{filteredExps.length} Expenditures</h3>
            <span className="fs-7 text-muted">Recorded & Paid Items</span>
          </div>
        </div>
      </div>

      {/* Analytics Selector Buttons */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2 mb-2">
        {/* Legal Entity Scope Filter */}
        <div className="d-flex align-items-center gap-2">
          <span className="fs-7 fw-bold text-muted text-uppercase">Legal Entity Scope:</span>
          <div className="btn-group btn-group-sm">
            <button
              type="button"
              className={`btn ${entityFilter === 'All' ? 'btn-dark' : 'btn-outline-dark'}`}
              onClick={() => setEntityFilter('All')}
            >
              Combined Total
            </button>
            <button
              type="button"
              className={`btn ${entityFilter === 'PACL' ? 'btn-danger' : 'btn-outline-danger'}`}
              onClick={() => setEntityFilter('PACL')}
            >
              PACL Only
            </button>
            <button
              type="button"
              className={`btn ${entityFilter === 'PGIL' ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setEntityFilter('PGIL')}
            >
              PGIL Only
            </button>
          </div>
        </div>

        {/* View Mode Buttons */}
        <div className="btn-group btn-group-sm">
          <button
            type="button"
            className={`btn ${metric === 'monthly' ? 'btn-danger fw-bold' : 'btn-outline-secondary'}`}
            onClick={() => setMetric('monthly')}
          >
            <i className="bi bi-graph-up me-1"></i> Monthly Trend
          </button>
          <button
            type="button"
            className={`btn ${metric === 'entity' ? 'btn-danger fw-bold' : 'btn-outline-secondary'}`}
            onClick={() => setMetric('entity')}
          >
            <i className="bi bi-building me-1"></i> PACL vs PGIL Comparison
          </button>
          <button
            type="button"
            className={`btn ${metric === 'category' ? 'btn-danger fw-bold' : 'btn-outline-secondary'}`}
            onClick={() => setMetric('category')}
          >
            <i className="bi bi-pie-chart me-1"></i> Categories
          </button>
          <button
            type="button"
            className={`btn ${metric === 'burn' ? 'btn-danger fw-bold' : 'btn-outline-secondary'}`}
            onClick={() => setMetric('burn')}
          >
            <i className="bi bi-speedometer2 me-1"></i> Campaigns Radar
          </button>
        </div>
      </div>

      {/* Main Analytics Charts Display */}
      {metric === 'entity' && (
        <div className="card card-erp p-3 bg-white">
          <h5 className="h6 fw-bold mb-3 d-flex align-items-center gap-2">
            <i className="bi bi-building-fill text-corporate-primary"></i> Legal Entity Comparative Analysis (PACL vs. PGIL)
          </h5>
          <div style={{ minHeight: '340px' }} className="d-flex align-items-center justify-content-center">
            <Bar data={entityCompareData} options={{ responsive: true, maintainAspectRatio: false }} />
          </div>
        </div>
      )}

      {/* Main Analytics Charts Display */}
      {metric === 'monthly' && (
        <div className="card card-erp p-3 bg-white">
          <h5 className="h6 fw-bold mb-3 d-flex align-items-center gap-2">
            <i className="bi bi-graph-up-arrow text-corporate-primary"></i> 12-Month Trajectory vs Monthly Budget Baseline
          </h5>
          <div style={{ minHeight: '340px' }} className="d-flex align-items-center justify-content-center">
            {isEmpty ? (
              <div className="text-center text-muted p-4">
                <i className="bi bi-bar-chart-line fs-1 text-secondary opacity-50 d-block mb-2"></i>
                <span>No Data Available — Import Excel or Add Transactions</span>
              </div>
            ) : (
              <Line data={monthlyTrendData} options={{ responsive: true, maintainAspectRatio: false }} />
            )}
          </div>
        </div>
      )}

      {metric === 'category' && (
        <div className="card card-erp p-3 bg-white">
          <h5 className="h6 fw-bold mb-3 d-flex align-items-center gap-2">
            <i className="bi bi-bar-chart-line text-corporate-primary"></i> Budget vs. Actual Spend by Expense Category
          </h5>
          <div style={{ minHeight: '340px' }} className="d-flex align-items-center justify-content-center">
            {isEmpty ? (
              <div className="text-center text-muted p-4">
                <i className="bi bi-bar-chart-fill fs-1 text-secondary opacity-50 d-block mb-2"></i>
                <span>No Data Available</span>
              </div>
            ) : (
              <Bar data={catCompareData} options={{ responsive: true, maintainAspectRatio: false }} />
            )}
          </div>
        </div>
      )}

      {metric === 'burn' && (
        <div className="card card-erp p-3 bg-white">
          <h5 className="h6 fw-bold mb-3 d-flex align-items-center gap-2">
            <i className="bi bi-radar text-corporate-primary"></i> Campaign Progress vs. Budget Utilization
          </h5>
          <div style={{ minHeight: '340px' }} className="d-flex align-items-center justify-content-center">
            {projs.length === 0 ? (
              <div className="text-center text-muted p-4">
                <i className="bi bi-radar fs-1 text-secondary opacity-50 d-block mb-2"></i>
                <span>No Campaign Data Available</span>
              </div>
            ) : (
              <Radar data={projRadarData} options={{ responsive: true, maintainAspectRatio: false }} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
