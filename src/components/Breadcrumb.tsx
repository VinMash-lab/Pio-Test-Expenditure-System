import React from 'react';
import { ActiveTab } from './Sidebar';
import { DrillDownTarget } from '../types';

interface BreadcrumbProps {
  activeTab: ActiveTab;
  onQuickAction?: () => void;
  role: string;
  drillDownStack?: DrillDownTarget[];
  onPopDrillDown?: () => void;
  onDrillDownToStep?: (index: number) => void;
  onResetDrillDown?: () => void;
}

const TAB_NAMES: Record<ActiveTab, { title: string; subtitle: string; icon: string }> = {
  dashboard: { title: 'Executive Dashboard', subtitle: 'Real-time KPIs, Budget Utilization & Spending Overview', icon: 'bi-grid-1x2-fill' },
  annual_budget: { title: 'Annual Budget Workspace', subtitle: 'Master PACL, PGIL and Department Planning with Revisions', icon: 'bi-calculator-fill' },
  shared_projects: { title: 'Shared Projects Co-Funding', subtitle: 'PACL & PGIL Split Engine with Real-Time Rebalancing', icon: 'bi-diagram-3-fill' },
  budgets: { title: 'Budget Planning & Allocations', subtitle: 'Master PACL, PGIL & Department Budget Allocations with Revisions & 360 Traceability', icon: 'bi-calculator-fill' },
  departments: { title: 'Departments & Cost Centres', subtitle: 'Department Budget Caps, Headcount & Spend Distribution', icon: 'bi-building' },
  projects: { title: 'Projects & Co-Funding Portfolio', subtitle: 'Campaigns, Multi-Invoice Tracking, PACL/PGIL Split Engine & Project Documents', icon: 'bi-kanban-fill' },
  expenditure: { title: 'Expenditure Tracker', subtitle: 'Record Expenditures, PO Validation & Payment Verification', icon: 'bi-receipt-cutoff' },
  lpos: { title: 'LPO Management & Commitments', subtitle: 'Purchase Orders, 16% VAT, Budget Commitments & Auto-Filed Vault Logs', icon: 'bi-file-earmark-spreadsheet-fill' },
  invoices: { title: 'Invoices & Accounts Payable', subtitle: 'Vendor Tax Invoices, VAT Breakdown & Payment Status', icon: 'bi-receipt' },
  quotations: { title: 'Quotations & Vendor Proposals', subtitle: 'Multiple Quotation Comparison & Bid Evaluation', icon: 'bi-tag-fill' },
  payment_requests: { title: 'Payment Requests & Authorizations', subtitle: 'Requisitions, Sign-off Approval & Disbursement Vouchers', icon: 'bi-credit-card-2-front-fill' },
  suppliers: { title: 'Agencies & Suppliers Directory', subtitle: 'Vendor Contacts, KRA Tax PINs & Total Disbursement Ledger', icon: 'bi-people-fill' },
  budget_vs_actual: { title: 'Budget Performance & Variance', subtitle: 'Variance Analysis Charts, Utilization Tiers & Burn Rate Thresholds', icon: 'bi-bar-chart-line-fill' },
  budget_utilization: { title: 'Budget Utilization Ledger', subtitle: 'Burn Rates, Threshold Status & Available Balances', icon: 'bi-speedometer2' },
  monthly_report: { title: 'Monthly Trend & Burn Rate Tracker', subtitle: '12-Month Spending Curve, Trajectories & Seasonality', icon: 'bi-graph-up' },
  mgmt_report: { title: 'Executive Management Report', subtitle: 'ExCo & Board Summary, PACL vs PGIL Entity Comparison', icon: 'bi-file-earmark-bar-graph-fill' },
  reports: { title: 'Reports & Executive Statements', subtitle: 'Executive Management Summary, Monthly Burn Trends & 15 Financial Statements', icon: 'bi-file-earmark-bar-graph-fill' },
  analytics: { title: 'Predictive Analytics', subtitle: 'Trend Models, Burn Rates & Category Comparisons', icon: 'bi-graph-up-arrow' },
  documents: { title: 'Enterprise Document Vault', subtitle: 'Invoices, Quotations, LPOs, Contracts & Approval Letters', icon: 'bi-folder-fill' },
  excel_wizard: { title: 'Excel Import Wizard', subtitle: 'Multi-Sheet Mapping, Error Validation & Data Integrity', icon: 'bi-file-earmark-excel-fill' },
  export_centre: { title: 'Export & Download Hub', subtitle: 'Production Spreadsheets, Executive PDFs & Full JSON Backups', icon: 'bi-cloud-arrow-down-fill' },
  data_validation: { title: 'System Diagnostics & Health', subtitle: '7-Point Integrity Check, Shared Balance & Duplicate Audits', icon: 'bi-shield-check' },
  archive: { title: 'Archive & Data Recovery', subtitle: 'Soft-Deleted Storage, Audit History & One-Click Restore', icon: 'bi-archive-fill' },
  users_roles: { title: 'Users, Access & Permissions', subtitle: 'Role-Based Access Control (RBAC) & Segregation of Duties', icon: 'bi-person-badge-fill' },
  settings: { title: 'System Configuration', subtitle: 'Financial Year, Categories, Approval Limits & Branding', icon: 'bi-gear-fill' },
  audit_trail: { title: 'Audit Trail & Activity Logs', subtitle: 'User Action Logs, IP Tracking & Security History', icon: 'bi-clock-history' },
  help_api: { title: 'User Manual & Process Guide', subtitle: 'End-to-End Operating Procedures, Roles & Governance Policies', icon: 'bi-book-half' },
  gemini_advisor: { title: 'Gemini AI Financial Advisor', subtitle: 'Context-Aware Enterprise Financial & Procurement Intelligence', icon: 'bi-stars' },
};

export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  activeTab,
  onQuickAction,
  role,
  drillDownStack = [],
  onPopDrillDown,
  onDrillDownToStep,
  onResetDrillDown,
}) => {
  const current = TAB_NAMES[activeTab] || TAB_NAMES.dashboard;
  const isDrillDownActive = drillDownStack.length > 0;
  const currentDrill = isDrillDownActive ? drillDownStack[drillDownStack.length - 1] : null;

  return (
    <div className="d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between pb-3 mb-3 border-bottom">
      <div>
        <nav aria-label="breadcrumb">
          <ol className="breadcrumb mb-1 fs-7">
            <li className="breadcrumb-item">
              <span className="text-muted">Pioneer Marketing & CX Workspace</span>
            </li>
            <li className={`breadcrumb-item ${isDrillDownActive ? '' : 'active fw-bold text-corporate-primary'}`}>
              {isDrillDownActive ? (
                <button
                  type="button"
                  className="btn btn-link p-0 text-decoration-none text-muted"
                  onClick={onResetDrillDown}
                >
                  {current.title}
                </button>
              ) : (
                current.title
              )}
            </li>
            {drillDownStack.map((step, idx) => {
              const isLast = idx === drillDownStack.length - 1;
              const label =
                step.type === 'transaction'
                  ? `Trace (${step.id})`
                  : step.type === 'amount'
                  ? `Amount (${step.context.metricName})`
                  : step.type === 'supplier'
                  ? `Supplier (${step.id})`
                  : step.type === 'budget_line'
                  ? `Budget Line (${step.id})`
                  : `Dept (${step.id})`;

              return (
                <li
                  key={idx}
                  className={`breadcrumb-item ${isLast ? 'active fw-bold text-danger' : ''}`}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {isLast ? (
                    label
                  ) : (
                    <button
                      type="button"
                      className="btn btn-link p-0 text-decoration-none text-muted"
                      onClick={() => onDrillDownToStep && onDrillDownToStep(idx)}
                    >
                      {label}
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        <h2 className="h4 mb-0 fw-bold d-flex align-items-center gap-2" style={{ fontFamily: 'Tahoma, sans-serif' }}>
          {isDrillDownActive ? (
            <>
              <i className="bi bi-search-heart text-danger fs-4"></i>
              <span>
                {currentDrill?.type === 'transaction'
                  ? `Transaction Trace: ${currentDrill.id}`
                  : currentDrill?.type === 'amount'
                  ? `Amount Reconciliation: ${currentDrill.context.metricName}`
                  : currentDrill?.type === 'supplier'
                  ? `Supplier 360: ${currentDrill.id}`
                  : currentDrill?.type === 'budget_line'
                  ? `Budget Line 360: ${currentDrill.id}`
                  : `Department 360: ${currentDrill?.id}`}
              </span>
            </>
          ) : (
            <>
              <i className={`bi ${current.icon} text-corporate-primary fs-4`}></i>
              {current.title}
            </>
          )}
        </h2>
        <p className="text-muted mb-0 fs-7">
          {isDrillDownActive
            ? 'Interactive relational drill-down & cross-module investigation engine'
            : current.subtitle}
        </p>
      </div>

      <div className="mt-2 mt-md-0 d-flex align-items-center gap-2">
        {isDrillDownActive && (
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1 shadow-sm"
            onClick={onPopDrillDown}
            title="Go back to previous level"
          >
            <i className="bi bi-arrow-left"></i>
            <span>Back</span>
          </button>
        )}
        <span className="badge bg-dark-subtle text-dark border px-2.5 py-1.5 fs-7 d-none d-lg-inline">
          <i className="bi bi-shield-lock me-1 text-corporate-primary"></i>
          Role: {role}
        </span>
        {onQuickAction && (
          <button
            type="button"
            onClick={onQuickAction}
            className="btn btn-corporate btn-sm d-flex align-items-center gap-1 shadow-sm"
          >
            <i className="bi bi-plus-circle-fill"></i>
            <span>Quick Entry</span>
          </button>
        )}
      </div>
    </div>
  );
};
