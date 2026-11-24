import React, { useState, useMemo } from 'react';
import { DatabaseService } from '../services/db';
import { ExcelService } from '../services/excelService';
import { PDFService } from '../services/pdfService';
import { RoleType } from '../types';
import { Line } from 'react-chartjs-2';

interface MonthlyReportViewProps {
  role: RoleType;
  onRefresh: () => void;
  embedded?: boolean;
}

export const MonthlyReportView: React.FC<MonthlyReportViewProps> = ({ role: _role, onRefresh: _onRefresh, embedded = false }) => {
  const exps = DatabaseService.getExpenditures();
  const bdgs = DatabaseService.getBudgets();
  const settings = DatabaseService.getSettings();

  const [selectedFY, setSelectedFY] = useState(settings.financialYear || '2026');
  const [selectedEntity, setSelectedEntity] = useState('All');

  const months = [
    { num: '01', name: 'January' },
    { num: '02', name: 'February' },
    { num: '03', name: 'March' },
    { num: '04', name: 'April' },
    { num: '05', name: 'May' },
    { num: '06', name: 'June' },
    { num: '07', name: 'July' },
    { num: '08', name: 'August' },
    { num: '09', name: 'September' },
    { num: '10', name: 'October' },
    { num: '11', name: 'November' },
    { num: '12', name: 'December' },
  ];

  // Calculate monthly metrics
  const monthlyMetrics = useMemo(() => {
    // Total approved budget
    const targetBudgets = bdgs.filter((b) => {
      if (b.financialYear !== selectedFY) return false;
      if (selectedEntity !== 'All' && b.legalEntity !== selectedEntity) return false;
      return true;
    });
    const totalAnnualBudget = targetBudgets.reduce((s, b) => s + Number(b.allocatedAmount || 0), 0);
    const monthlyBudgetBenchmark = totalAnnualBudget > 0 ? totalAnnualBudget / 12 : 0;

    let cumulativeSpend = 0;

    const yearPrefix = (selectedFY || '2026').split('/')[0];

    return months.map((m) => {
      const targetPrefix = `${yearPrefix}-${m.num}`;
      const monthlyExps = exps.filter((e) => {
        const expDate = e.expenseDate || e.date || '';
        if (!expDate.startsWith(targetPrefix)) return false;
        if (selectedEntity !== 'All' && e.legalEntity !== selectedEntity) return false;
        return true;
      });

      const actualSpend = monthlyExps.reduce((s, e) => s + Number(e.totalAmount || 0), 0);
      cumulativeSpend += actualSpend;
      const remainingAnnual = totalAnnualBudget - cumulativeSpend;
      const monthlyUtil = monthlyBudgetBenchmark > 0 ? (actualSpend / monthlyBudgetBenchmark) * 100 : 0;
      const cumulativeUtil = totalAnnualBudget > 0 ? (cumulativeSpend / totalAnnualBudget) * 100 : 0;

      return {
        monthNum: m.num,
        monthName: m.name,
        benchmark: Math.round(monthlyBudgetBenchmark),
        actualSpend,
        cumulativeSpend,
        remainingAnnual,
        monthlyUtil,
        cumulativeUtil,
        transactionCount: monthlyExps.length,
      };
    });
  }, [exps, bdgs, selectedFY, selectedEntity]);

  const totalYearSpend = monthlyMetrics.reduce((s, m) => s + m.actualSpend, 0);
  const avgMonthlySpend = totalYearSpend / 12;

  // Chart Data
  const chartData = useMemo(() => {
    return {
      labels: months.map((m) => m.name.substring(0, 3)),
      datasets: [
        {
          type: 'line' as const,
          label: 'Cumulative Spend (KES)',
          data: monthlyMetrics.map((m) => m.cumulativeSpend),
          borderColor: '#DC2626',
          backgroundColor: 'rgba(220, 38, 38, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.3,
          yAxisID: 'y',
        },
        {
          type: 'bar' as const,
          label: 'Monthly Actual Spend (KES)',
          data: monthlyMetrics.map((m) => m.actualSpend),
          backgroundColor: '#000000',
          yAxisID: 'y',
        },
      ],
    };
  }, [monthlyMetrics]);

  const handleExportExcel = () => {
    const data = monthlyMetrics.map((m) => ({
      'Month': m.monthName,
      'Monthly Benchmark (KES)': m.benchmark,
      'Actual Spend (KES)': m.actualSpend,
      'Cumulative Spend (KES)': m.cumulativeSpend,
      'Remaining Annual Budget (KES)': m.remainingAnnual,
      'Monthly Utilization %': `${m.monthlyUtil.toFixed(1)}%`,
      'Cumulative Utilization %': `${m.cumulativeUtil.toFixed(1)}%`,
      'Transactions': m.transactionCount,
    }));
    ExcelService.exportCustomDataset(data, 'Monthly_Expenditure_Report');
  };

  const handleExportPDF = () => {
    const cols = ['Month', 'Monthly Benchmark', 'Actual Spend', 'Cumulative Spend', 'Remaining Budget', 'Cumulative Util %'];
    const rows = monthlyMetrics.map((m) => [
      m.monthName,
      `${m.benchmark.toLocaleString()} ${settings.currencySymbol}`,
      `${m.actualSpend.toLocaleString()} ${settings.currencySymbol}`,
      `${m.cumulativeSpend.toLocaleString()} ${settings.currencySymbol}`,
      `${m.remainingAnnual.toLocaleString()} ${settings.currencySymbol}`,
      `${m.cumulativeUtil.toFixed(1)}%`,
    ]);
    PDFService.generateReportPDF('MONTHLY EXPENDITURE & BURN RATE REPORT', `Financial Year ${selectedFY} | Entity: ${selectedEntity}`, cols, rows, settings);
  };

  return (
    <div className="d-flex flex-column gap-4">
      {/* Header */}
      {embedded ? (
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div className="d-flex align-items-center gap-2">
            <span className="badge bg-danger text-white px-2 py-1">Trend Analysis</span>
            <span className="text-muted small">
              Month-by-month spending trajectories, cumulative burn curves, and seasonal campaign spikes.
            </span>
          </div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <button id="btn-export-excel-monthly" onClick={handleExportExcel} className="btn btn-outline-success btn-sm d-flex align-items-center gap-1 shadow-sm">
              <i className="bi bi-file-earmark-excel"></i> Export Excel
            </button>
            <button id="btn-export-pdf-monthly" onClick={handleExportPDF} className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1 shadow-sm">
              <i className="bi bi-file-earmark-pdf"></i> Export PDF
            </button>
          </div>
        </div>
      ) : (
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 pb-2 border-bottom">
          <div>
            <div className="d-flex align-items-center gap-2">
              <h3 className="fw-bold mb-0 text-dark" style={{ fontFamily: 'Tahoma, sans-serif' }}>
                Monthly Expenditure &amp; Burn Rate Tracking
              </h3>
              <span className="badge bg-danger text-white px-2 py-1">Trend Analysis</span>
            </div>
            <p className="text-muted small mb-0 mt-1">
              Month-by-month spending trajectories, cumulative burn curves, and seasonal campaign spikes.
            </p>
          </div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <button id="btn-export-excel-monthly" onClick={handleExportExcel} className="btn btn-outline-success btn-sm d-flex align-items-center gap-1 shadow-sm">
              <i className="bi bi-file-earmark-excel"></i> Export Excel
            </button>
            <button id="btn-export-pdf-monthly" onClick={handleExportPDF} className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1 shadow-sm">
              <i className="bi bi-file-earmark-pdf"></i> Export PDF
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
              <option value="2026/2027">Financial Year 2026/2027</option>
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
              <option value="All">All Entities (PACL & PGIL)</option>
              <option value="PACL">PACL</option>
              <option value="PGIL">PGIL</option>
            </select>
          </div>
        </div>
      </div>

      {/* Monthly Trend Chart */}
      <div className="card card-erp p-4 shadow-sm">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h6 className="fw-bold mb-0 text-dark">
            <i className="bi bi-graph-up me-2 text-danger"></i>
            Monthly Spend & Cumulative Burn Rate (FY {selectedFY})
          </h6>
          <div className="extra-small text-muted">
            Average Monthly Spend: <strong className="text-dark">{Math.round(avgMonthlySpend).toLocaleString()} {settings.currencySymbol}</strong>
          </div>
        </div>
        <div style={{ height: '280px' }}>
          <Line
            data={chartData as any}
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

      {/* Month-by-Month Table */}
      <div className="card card-erp shadow-sm overflow-hidden">
        <div className="card-header bg-white py-3 px-4">
          <h6 className="mb-0 fw-bold text-dark">Monthly Expenditure Breakdown Table</h6>
        </div>
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0 erp-table">
            <thead className="table-light">
              <tr className="small text-uppercase text-muted">
                <th>Month</th>
                <th className="text-end">Benchmark</th>
                <th className="text-end">Actual Spend</th>
                <th className="text-end">Cumulative Spend</th>
                <th className="text-end">Remaining Annual</th>
                <th className="text-end">Monthly Util %</th>
                <th className="text-end">Cumulative Util %</th>
                <th className="text-center">Entries</th>
              </tr>
            </thead>
            <tbody>
              {monthlyMetrics.map((m) => (
                <tr key={m.monthNum}>
                  <td className="fw-bold text-dark">{m.monthName}</td>
                  <td className="text-end text-muted small">{m.benchmark.toLocaleString()}</td>
                  <td className="text-end fw-bold text-danger">
                    {m.actualSpend.toLocaleString()} <span className="extra-small text-muted">{settings.currencySymbol}</span>
                  </td>
                  <td className="text-end fw-semibold text-dark">
                    {m.cumulativeSpend.toLocaleString()} <span className="extra-small text-muted">{settings.currencySymbol}</span>
                  </td>
                  <td className={`text-end fw-bold ${m.remainingAnnual < 0 ? 'text-danger' : 'text-success'}`}>
                    {m.remainingAnnual.toLocaleString()}
                  </td>
                  <td className="text-end">
                    <span className={`badge ${m.monthlyUtil > 100 ? 'bg-danger text-white' : 'bg-light text-dark border'}`}>
                      {m.monthlyUtil.toFixed(1)}%
                    </span>
                  </td>
                  <td className="text-end fw-bold text-primary">
                    {m.cumulativeUtil.toFixed(1)}%
                  </td>
                  <td className="text-center small text-muted">
                    {m.transactionCount}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="table-light fw-bold">
              <tr>
                <td>Total FY Spend</td>
                <td colSpan={1}></td>
                <td className="text-end text-danger">{totalYearSpend.toLocaleString()} {settings.currencySymbol}</td>
                <td colSpan={5}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
