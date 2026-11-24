import React, { useState } from 'react';
import { DatabaseService } from '../services/db';
import { RoleType } from '../types';

interface DataValidationViewProps {
  role: RoleType;
  onRefresh: () => void;
  onNavigateToTab?: (tab: string) => void;
}

export const DataValidationView: React.FC<DataValidationViewProps> = ({ role, onRefresh, onNavigateToTab }) => {
  const [diagnostics, setDiagnostics] = useState(() => DatabaseService.runSystemDiagnostics());
  const [isScanning, setIsScanning] = useState(false);

  const handleRunScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      setDiagnostics(DatabaseService.runSystemDiagnostics());
      setIsScanning(false);
      onRefresh();
    }, 400);
  };

  const getStatusBadge = (status: 'PASSED' | 'WARNING' | 'FAILED') => {
    switch (status) {
      case 'PASSED':
        return (
          <span className="badge bg-success-subtle text-success border border-success px-2 py-1">
            <i className="bi bi-check-circle-fill me-1"></i> PASSED
          </span>
        );
      case 'WARNING':
        return (
          <span className="badge bg-warning-subtle text-warning border border-warning px-2 py-1">
            <i className="bi bi-exclamation-triangle-fill me-1"></i> WARNING
          </span>
        );
      case 'FAILED':
        return (
          <span className="badge bg-danger text-white px-2 py-1">
            <i className="bi bi-x-circle-fill me-1"></i> FAILED
          </span>
        );
    }
  };

  return (
    <div className="d-flex flex-column gap-4">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 pb-2 border-bottom">
        <div>
          <div className="d-flex align-items-center gap-2">
            <h3 className="fw-bold mb-0 text-dark" style={{ fontFamily: 'Tahoma, sans-serif' }}>
              Data Integrity & System Diagnostics Center
            </h3>
            <span className="badge bg-dark text-white px-2 py-1">Auditing Engine</span>
          </div>
          <p className="text-muted small mb-0 mt-1">
            Continuous automated validation of financial co-funding balance, duplicate procurement numbers, and budget ceilings.
          </p>
        </div>
        <button
          id="btn-rerun-diagnostics"
          onClick={handleRunScan}
          disabled={isScanning}
          className="btn btn-danger btn-sm d-flex align-items-center gap-2 shadow-sm"
        >
          <i className={`bi bi-arrow-clockwise ${isScanning ? 'spin' : ''}`}></i>
          {isScanning ? 'Running Scan...' : 'Re-Run System Diagnostics'}
        </button>
      </div>

      {/* Overall Health Card */}
      <div className="card card-erp p-4 shadow-sm border-start border-4 border-primary">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <h5 className="fw-bold mb-0 text-dark">Pioneer Budget System Health Score</h5>
              <span className="badge bg-success text-white">HEALTHY</span>
            </div>
            <p className="text-muted small mb-0">
              Evaluated {diagnostics.totalChecksRun} automated rules on {new Date(diagnostics.lastRun).toLocaleTimeString()}
            </p>
          </div>
          <div className="d-flex gap-3 text-center">
            <div className="bg-light p-2 rounded border px-3">
              <div className="fs-5 fw-bold text-success">{diagnostics.passedCount}</div>
              <div className="extra-small text-muted text-uppercase">Passed Checks</div>
            </div>
            <div className="bg-light p-2 rounded border px-3">
              <div className="fs-5 fw-bold text-warning">{diagnostics.warningCount}</div>
              <div className="extra-small text-muted text-uppercase">Warnings</div>
            </div>
            <div className="bg-light p-2 rounded border px-3">
              <div className="fs-5 fw-bold text-danger">{diagnostics.failedCount}</div>
              <div className="extra-small text-muted text-uppercase">Critical Errors</div>
            </div>
          </div>
        </div>
      </div>

      {/* Diagnostic Results Grid */}
      <div className="row g-3">
        {diagnostics.checks.map((check) => (
          <div key={check.id} className="col-12 col-lg-6">
            <div className={`card card-erp p-4 h-100 shadow-sm border-start border-4 ${
              check.status === 'PASSED' ? 'border-success' : check.status === 'WARNING' ? 'border-warning' : 'border-danger'
            }`}>
              <div className="d-flex justify-content-between align-items-start mb-2">
                <h6 className="fw-bold text-dark mb-0">{check.name}</h6>
                {getStatusBadge(check.status)}
              </div>
              <p className="text-muted small mb-3">{check.description}</p>

              {check.details && check.details.length > 0 && (
                <div className="bg-light p-2 rounded border mb-3">
                  <div className="extra-small fw-bold text-dark mb-1">Diagnostic Findings:</div>
                  <ul className="list-unstyled mb-0 extra-small text-muted">
                    {check.details.map((d, i) => (
                      <li key={i} className="mb-1 d-flex align-items-start gap-1">
                        <i className="bi bi-arrow-right-short text-danger"></i>
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {onNavigateToTab && (
                <div className="mt-2 mb-2">
                  {check.id === 'shared_project_ratio' && (
                    <button
                      type="button"
                      onClick={() => onNavigateToTab('shared_projects')}
                      className="btn btn-outline-primary btn-xs py-1 px-2 d-inline-flex align-items-center gap-1"
                      style={{ fontSize: '0.75rem' }}
                    >
                      <i className="bi bi-diagram-3-fill"></i> Manage Shared Projects
                    </button>
                  )}
                  {check.id === 'unbalanced_splits' && (
                    <button
                      type="button"
                      onClick={() => onNavigateToTab('annual_budget')}
                      className="btn btn-outline-dark btn-xs py-1 px-2 d-inline-flex align-items-center gap-1"
                      style={{ fontSize: '0.75rem' }}
                    >
                      <i className="bi bi-calculator-fill"></i> Open Annual Budget Workspace
                    </button>
                  )}
                  {check.id === 'duplicate_lpo_numbers' && (
                    <button
                      type="button"
                      onClick={() => onNavigateToTab('lpos')}
                      className="btn btn-outline-info btn-xs py-1 px-2 d-inline-flex align-items-center gap-1"
                      style={{ fontSize: '0.75rem' }}
                    >
                      <i className="bi bi-file-earmark-spreadsheet-fill"></i> View LPO Register
                    </button>
                  )}
                  {check.id === 'duplicate_invoice_numbers' && (
                    <button
                      type="button"
                      onClick={() => onNavigateToTab('invoices')}
                      className="btn btn-outline-danger btn-xs py-1 px-2 d-inline-flex align-items-center gap-1"
                      style={{ fontSize: '0.75rem' }}
                    >
                      <i className="bi bi-receipt"></i> Inspect Invoices
                    </button>
                  )}
                  {check.id === 'negative_balances' && (
                    <button
                      type="button"
                      onClick={() => onNavigateToTab('budgets')}
                      className="btn btn-outline-warning btn-xs py-1 px-2 d-inline-flex align-items-center gap-1 text-dark"
                      style={{ fontSize: '0.75rem' }}
                    >
                      <i className="bi bi-wallet2"></i> Check Budget Balances
                    </button>
                  )}
                  {(check.id === 'overbudget_expenditures' || check.id === 'orphaned_expenditures') && (
                    <button
                      type="button"
                      onClick={() => onNavigateToTab('expenditure')}
                      className="btn btn-outline-danger btn-xs py-1 px-2 d-inline-flex align-items-center gap-1"
                      style={{ fontSize: '0.75rem' }}
                    >
                      <i className="bi bi-receipt-cutoff"></i> Open Expenditure Tracker
                    </button>
                  )}
                </div>
              )}

              <div className="d-flex justify-content-between align-items-center extra-small pt-2 border-top mt-auto text-muted">
                <span>Rule Code: <code>{check.id}</code></span>
                <span>Enforced on All Writes</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
