import React, { useState, useMemo } from 'react';
import { DatabaseService } from '../services/db';
import { PDFService } from '../services/pdfService';
import { Budget, DrillDownTarget, RoleType } from '../types';

interface BudgetLineDetailViewProps {
  budgetCodeOrId: string;
  role: RoleType;
  onBack: () => void;
  onDrillDown: (target: DrillDownTarget) => void;
}

export const BudgetLineDetailView: React.FC<BudgetLineDetailViewProps> = ({
  budgetCodeOrId,
  role,
  onBack,
  onDrillDown,
}) => {
  const settings = DatabaseService.getSettings();
  const [activeTab, setActiveTab] = useState<'expenditures' | 'lpos'>('expenditures');

  const budget = useMemo(() => {
    const list = DatabaseService.getBudgets();
    const clean = (budgetCodeOrId || '').toLowerCase();
    return list.find((b) => (b.id || '').toLowerCase() === clean || (b.code || '').toLowerCase() === clean);
  }, [budgetCodeOrId]);

  const expenditures = useMemo(() => {
    if (!budget) return [];
    const code = (budget.code || '').toLowerCase();
    const id = (budget.id || '').toLowerCase();
    return DatabaseService.getExpenditures().filter(
      (e) => (e.budgetId && e.budgetId.toLowerCase() === code) ||
        (e.budgetId && e.budgetId.toLowerCase() === id) ||
        (!e.budgetId && e.category && budget.category && e.category.toLowerCase() === budget.category.toLowerCase())
    );
  }, [budget]);

  const lpos = useMemo(() => {
    if (!budget) return [];
    const code = (budget.code || '').toLowerCase();
    const id = (budget.id || '').toLowerCase();
    return DatabaseService.getLPOs().filter(
      (l) => (l.budgetCode && l.budgetCode.toLowerCase() === code) ||
        (l.budgetId && l.budgetId.toLowerCase() === id)
    );
  }, [budget]);

  if (!budget) {
    return (
      <div className="card card-erp p-5 text-center my-4">
        <i className="bi bi-wallet2 fs-1 text-muted mb-3"></i>
        <h4 className="fw-bold text-dark">Budget Line Not Found</h4>
        <p className="text-muted fs-6 mb-4">No budget record matching code or ID "{budgetCodeOrId}".</p>
        <div>
          <button type="button" className="btn btn-secondary px-4" onClick={onBack}>
            <i className="bi bi-arrow-left me-2"></i> Return to Budgets
          </button>
        </div>
      </div>
    );
  }

  const allocated = Number(budget.allocatedAmount || 0);
  const actualSpend = expenditures.reduce((sum, e) => sum + Number(e.totalAmount || 0), 0);
  const committed = lpos
    .filter((l) => !['Cancelled'].includes(l.lpoStatus || l.status || '') && l.paymentStatus !== 'Fully Paid' && l.paymentStatus !== 'Paid')
    .reduce((sum, l) => sum + Number(l.totalLpoValue ?? l.totalLpoAmount ?? 0), 0);
  const available = Math.max(0, allocated - actualSpend - committed);
  const utilization = allocated > 0 ? (actualSpend / allocated) * 100 : 0;

  const handleExportPDF = () => {
    const tableRows = expenditures.map((e) => [
      e.date || e.expenseDate || '',
      e.expenseId,
      e.description || '',
      e.supplierName || 'N/A',
      `${Number(e.totalAmount || 0).toLocaleString()} KES`,
      e.paymentStatus || 'N/A',
    ]);

    PDFService.generateReportPDF(
      `BUDGET LINE 360: ${budget.code}`,
      `Category: ${budget.category} | Dept: ${budget.departmentName} | Entity: ${budget.legalEntity}`,
      ['Date', 'Reference', 'Description', 'Supplier', 'Amount', 'Status'],
      tableRows,
      settings,
      [
        { label: 'Allocated Budget', value: `${allocated.toLocaleString()} KES` },
        { label: 'Actual Spend', value: `${actualSpend.toLocaleString()} KES` },
        { label: 'Committed LPOs', value: `${committed.toLocaleString()} KES` },
        { label: 'Available Balance', value: `${available.toLocaleString()} KES` },
      ]
    );
  };

  return (
    <div className="d-flex flex-column gap-3 pb-5">
      {/* Top Header */}
      <div className="card card-erp p-3">
        <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1.5"
              onClick={onBack}
            >
              <i className="bi bi-arrow-left"></i>
              <span className="fw-semibold">Back</span>
            </button>
            <div className="vr my-1"></div>
            <div>
              <div className="d-flex align-items-center gap-2">
                <span className="badge bg-danger text-white fs-7 py-1 px-2 fw-bold">BUDGET LINE 360</span>
                <h1 className="h5 fw-bold text-dark mb-0 font-monospace">{budget.code}</h1>
                <span className="badge bg-light text-dark border fs-8">{budget.legalEntity}</span>
              </div>
              <p className="text-muted fs-8 mb-0 mt-0.5">
                Category: <strong>{budget.category}</strong> | Department: <strong>{budget.departmentName}</strong> &bull; FY {budget.financialYear}
              </p>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1"
              onClick={handleExportPDF}
            >
              <i className="bi bi-file-earmark-pdf"></i>
              <span>PDF Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="row g-2">
        <div className="col-6 col-md-3">
          <div className="card card-erp p-2.5 bg-white h-100">
            <span className="text-muted fs-8 text-uppercase fw-semibold">Allocated Budget</span>
            <div className="fs-5 fw-bold text-dark">{allocated.toLocaleString()} <span className="fs-8 text-muted">KES</span></div>
            <span className="fs-9 text-muted">Approved Baseline</span>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card card-erp p-2.5 bg-white h-100">
            <span className="text-muted fs-8 text-uppercase fw-semibold">Actual Spend</span>
            <div className="fs-5 fw-bold text-danger">{actualSpend.toLocaleString()} <span className="fs-8 text-muted">KES</span></div>
            <span className="fs-9 text-muted">{expenditures.length} Incurred Expenses</span>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card card-erp p-2.5 bg-white h-100">
            <span className="text-muted fs-8 text-uppercase fw-semibold">Committed (Open LPOs)</span>
            <div className="fs-5 fw-bold text-primary">{committed.toLocaleString()} <span className="fs-8 text-muted">KES</span></div>
            <span className="fs-9 text-muted">{lpos.length} Issued LPOs</span>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card card-erp p-2.5 bg-white h-100">
            <span className="text-muted fs-8 text-uppercase fw-semibold">Available Balance</span>
            <div className="fs-5 fw-bold text-success">{available.toLocaleString()} <span className="fs-8 text-muted">KES</span></div>
            <span className="fs-9 text-muted">{utilization.toFixed(1)}% Utilized</span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="card card-erp p-3 bg-white">
        <div className="d-flex justify-content-between fs-7 mb-1">
          <span className="fw-semibold text-dark">Budget Utilization Cap</span>
          <span className="fw-bold">{utilization.toFixed(1)}%</span>
        </div>
        <div className="progress" style={{ height: '12px' }}>
          <div
            className={`progress-bar ${utilization > 90 ? 'bg-danger' : utilization > 70 ? 'bg-warning text-dark' : 'bg-success'}`}
            style={{ width: `${Math.min(100, utilization)}%` }}
          ></div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="card card-erp p-0 overflow-hidden">
        <div className="bg-light border-bottom p-2 px-3 d-flex align-items-center justify-content-between">
          <ul className="nav nav-pills gap-1">
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link py-1 px-3 fs-7 fw-semibold ${activeTab === 'expenditures' ? 'active bg-danger text-white' : 'text-dark'}`}
                onClick={() => setActiveTab('expenditures')}
              >
                Incurred Expenditures ({expenditures.length})
              </button>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link py-1 px-3 fs-7 fw-semibold ${activeTab === 'lpos' ? 'active bg-danger text-white' : 'text-dark'}`}
                onClick={() => setActiveTab('lpos')}
              >
                Committed LPOs ({lpos.length})
              </button>
            </li>
          </ul>
        </div>

        <div className="p-3">
          {activeTab === 'expenditures' ? (
            <div className="table-responsive">
              <table className="table table-sm table-hover align-middle fs-7 mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Date</th>
                    <th>Reference</th>
                    <th>Description</th>
                    <th>Supplier</th>
                    <th className="text-end">Amount</th>
                    <th>Status</th>
                    <th className="text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {expenditures.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-4 text-muted">No expenditures recorded against this budget line.</td></tr>
                  ) : (
                    expenditures.map((e) => (
                      <tr key={e.id}>
                        <td>{e.date}</td>
                        <td className="font-monospace fw-bold text-danger">{e.expenseId}</td>
                        <td>{e.description}</td>
                        <td>{e.supplierName}</td>
                        <td className="text-end fw-bold font-monospace">{Number(e.totalAmount || 0).toLocaleString()} KES</td>
                        <td><span className="badge bg-success fs-9">{e.paymentStatus}</span></td>
                        <td className="text-center">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger py-0 px-2 fs-8"
                            onClick={() => onDrillDown({ type: 'transaction', id: e.expenseId, recordType: 'Expenditure' })}
                          >
                            Trace
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm table-hover align-middle fs-7 mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Date</th>
                    <th>LPO Number</th>
                    <th>Description</th>
                    <th>Supplier</th>
                    <th className="text-end">Amount</th>
                    <th>Status</th>
                    <th className="text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {lpos.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-4 text-muted">No LPOs committed against this budget line.</td></tr>
                  ) : (
                    lpos.map((l) => (
                      <tr key={l.id}>
                        <td>{l.lpoDate}</td>
                        <td className="font-monospace fw-bold text-primary">{l.lpoNumber}</td>
                        <td>{l.description}</td>
                        <td>{l.supplierName}</td>
                        <td className="text-end fw-bold font-monospace">{Number(l.totalLpoValue ?? l.totalLpoAmount ?? 0).toLocaleString()} KES</td>
                        <td><span className="badge bg-info text-dark fs-9">{l.lpoStatus || l.status || 'Issued'}</span></td>
                        <td className="text-center">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger py-0 px-2 fs-8"
                            onClick={() => onDrillDown({ type: 'transaction', id: l.lpoNumber, recordType: 'LPO' })}
                          >
                            Trace
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
