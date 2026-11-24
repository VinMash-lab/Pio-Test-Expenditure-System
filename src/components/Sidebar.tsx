import React from 'react';

export type ActiveTab =
  | 'dashboard'
  | 'annual_budget'
  | 'shared_projects'
  | 'budgets'
  | 'departments'
  | 'projects'
  | 'expenditure'
  | 'lpos'
  | 'invoices'
  | 'quotations'
  | 'payment_requests'
  | 'suppliers'
  | 'budget_vs_actual'
  | 'budget_utilization'
  | 'monthly_report'
  | 'mgmt_report'
  | 'reports'
  | 'analytics'
  | 'documents'
  | 'excel_wizard'
  | 'export_centre'
  | 'data_validation'
  | 'archive'
  | 'users_roles'
  | 'settings'
  | 'audit_trail'
  | 'help_api'
  | 'gemini_advisor';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

interface NavSection {
  title: string;
  items: { id: ActiveTab; label: string; icon: string; badge?: string; badgeColor?: string }[];
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, collapsed, setCollapsed }) => {
  const sections: NavSection[] = [
    {
      title: 'Planning & Budgets',
      items: [
        { id: 'dashboard', label: 'Executive Dashboard', icon: 'bi-grid-1x2-fill' },
        { id: 'budgets', label: 'Budget Planning & Allocations', icon: 'bi-calculator-fill', badge: 'PACL/PGIL' },
        { id: 'projects', label: 'Projects & Co-Funding', icon: 'bi-kanban-fill', badge: 'Split', badgeColor: 'bg-primary' },
        { id: 'departments', label: 'Departments & Units', icon: 'bi-building' },
      ],
    },
    {
      title: 'Spend & Procurement',
      items: [
        { id: 'expenditure', label: 'Expenditure Tracker', icon: 'bi-receipt-cutoff' },
        { id: 'lpos', label: 'LPO Management & Commitments', icon: 'bi-file-earmark-spreadsheet-fill', badge: '16% VAT' },
        { id: 'invoices', label: 'Invoices & Payables', icon: 'bi-receipt' },
        { id: 'quotations', label: 'Quotations & Proposals', icon: 'bi-tag-fill' },
        { id: 'payment_requests', label: 'Payment Requests', icon: 'bi-credit-card-2-front-fill' },
        { id: 'suppliers', label: 'Agencies & Suppliers', icon: 'bi-people-fill' },
      ],
    },
    {
      title: 'Analytics & Reports',
      items: [
        { id: 'budget_vs_actual', label: 'Budget Performance & Variance', icon: 'bi-bar-chart-line-fill' },
        { id: 'reports', label: 'Reports & Executive Statements', icon: 'bi-file-earmark-bar-graph-fill', badge: 'ExCo' },
        { id: 'analytics', label: 'Predictive Analytics', icon: 'bi-graph-up-arrow' },
      ],
    },
    {
      title: 'Governance & Operations',
      items: [
        { id: 'documents', label: 'Document Vault', icon: 'bi-folder-fill' },
        { id: 'excel_wizard', label: 'Excel Import Wizard', icon: 'bi-file-earmark-excel-fill' },
        { id: 'export_centre', label: 'Export & Download Hub', icon: 'bi-cloud-arrow-down-fill' },
        { id: 'data_validation', label: 'System Diagnostics & Health', icon: 'bi-shield-check', badge: 'Audit' },
        { id: 'archive', label: 'Archive & Data Recovery', icon: 'bi-archive-fill' },
        { id: 'users_roles', label: 'Users & Permissions', icon: 'bi-person-badge-fill' },
        { id: 'audit_trail', label: 'Activity Logs', icon: 'bi-clock-history' },
        { id: 'settings', label: 'Configuration & Settings', icon: 'bi-gear-fill' },
        { id: 'help_api', label: 'User Manual & Process Guide', icon: 'bi-book-half', badge: 'Manual', badgeColor: 'bg-danger' },
      ],
    },
  ];

  return (
    <aside className={`sidebar-erp d-flex flex-column justify-content-between ${collapsed ? 'collapsed' : ''}`}>
      <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 60px)' }}>
        {/* Sidebar Toggle & Header */}
        <div className="d-flex align-items-center justify-content-between px-3 py-3 border-bottom border-secondary border-opacity-25 sticky-top bg-dark">
          {!collapsed && (
            <span className="fw-bold fs-7 text-uppercase tracking-wider text-white-50">
              Pioneer Workspaces
            </span>
          )}
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="btn btn-sm text-white-50 p-1 ms-auto border-0"
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            <i className={`bi ${collapsed ? 'bi-chevron-double-right' : 'bi-chevron-double-left'} fs-5`}></i>
          </button>
        </div>

        {/* Menu Navigation Sections */}
        <nav className="py-2">
          {sections.map((sec, sIdx) => (
            <div key={sIdx} className="mb-2">
              {!collapsed && (
                <div className="px-3 py-1 text-uppercase text-white-50 extra-small fw-bold border-bottom border-secondary border-opacity-10">
                  {sec.title}
                </div>
              )}
              {sec.items.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`sidebar-nav-item w-100 border-0 bg-transparent text-start py-2 px-3 d-flex align-items-center gap-2 ${isActive ? 'active' : ''}`}
                    title={collapsed ? item.label : undefined}
                  >
                    <i className={`bi ${item.icon} fs-5 ${isActive ? 'text-white' : 'text-corporate-primary'}`}></i>
                    {!collapsed && (
                      <div className="d-flex align-items-center justify-content-between w-100">
                        <span className="text-truncate" style={{ fontSize: '0.82rem' }}>{item.label}</span>
                        {item.badge && (
                          <span className={`badge ${item.badgeColor || 'bg-danger'} text-white rounded-pill px-1.5 py-0.5 ms-1`} style={{ fontSize: '0.62rem' }}>
                            {item.badge}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* Footer inside sidebar */}
      {!collapsed && (
        <div className="p-3 border-top border-secondary border-opacity-25 fs-7 text-white-50 bg-dark mt-auto">
          <div className="fw-bold text-white mb-1" style={{ fontSize: '0.78rem' }}>
            Marketing & CX Platform
          </div>
          <div style={{ fontSize: '0.7rem' }}>Pioneer Assurance & General</div>
        </div>
      )}
    </aside>
  );
};
