import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { Breadcrumb } from './components/Breadcrumb';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { QuickActionModal } from './components/QuickActionModal';

// Existing & Consolidated Views
import { DashboardView } from './views/DashboardView';
import { ExpendituresView } from './views/ExpendituresView';
import { DepartmentsView } from './views/DepartmentsView';
import { ProjectsView } from './views/ProjectsView';
import { SuppliersView } from './views/SuppliersView';
import { ReportsView } from './views/ReportsView';
import { AnalyticsView } from './views/AnalyticsView';
import { DocumentsView } from './views/DocumentsView';
import { ExcelWizardView } from './views/ExcelWizardView';
import { SettingsView } from './views/SettingsView';
import { AuditTrailView } from './views/AuditTrailView';
import { HelpView } from './views/HelpView';

// Integrated Workspaces
import { AnnualBudgetView } from './views/AnnualBudgetView';
import { BudgetVsActualView } from './views/BudgetVsActualView';
import { LPOManagementView } from './views/LPOManagementView';
import { QuotationsView } from './views/QuotationsView';
import { InvoiceManagementView } from './views/InvoiceManagementView';
import { PaymentRequestsView } from './views/PaymentRequestsView';
import { ExportCentreView } from './views/ExportCentreView';
import { DataValidationView } from './views/DataValidationView';
import { ArchiveView } from './views/ArchiveView';
import { UsersRolesView } from './views/UsersRolesView';
import { GeminiChatModal } from './components/GeminiChatModal';
import { GeminiFloatingButton } from './components/GeminiFloatingButton';

// Traceability & Drill-Down Views
import { TransactionTraceView } from './views/TransactionTraceView';
import { AmountTraceView } from './views/AmountTraceView';
import { SupplierDetailView } from './views/SupplierDetailView';
import { BudgetLineDetailView } from './views/BudgetLineDetailView';
import { DepartmentDetailView } from './views/DepartmentDetailView';

import { DatabaseService } from './services/db';
import { RoleType, DrillDownTarget, AmountTraceContext } from './types';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginScreen } from './components/LoginScreen';
import { GlobalFeedbackHost } from './components/GlobalFeedbackHost';

function AppShell({ refreshTrigger, onBumpRefresh }: { refreshTrigger: number; onBumpRefresh: () => void }) {
  const { user, authReady, cloudError, clearCloudError } = useAuth();

  // Initialize local defaults safely without making unauthenticated Firestore calls
  useEffect(() => {
    DatabaseService.initializeDefaults();
  }, []);

  // Theme & Layout state
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('apex_erp_theme') === 'dark';
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [projectsSubTab, setProjectsSubTab] = useState<'portfolio' | 'shared' | 'documents'>('portfolio');
  const [varianceSubTab, setVarianceSubTab] = useState<'variance' | 'utilization'>('variance');
  const [reportsSubTab, setReportsSubTab] = useState<'executive' | 'monthly' | 'standard'>('standard');

  // Role state
  const [role, setRole] = useState<RoleType>('Administrator');

  // Modals state
  const [showSearchModal, setShowSearchModal] = useState<boolean>(false);
  const [showQuickActionModal, setShowQuickActionModal] = useState<boolean>(false);
  const [showGeminiModal, setShowGeminiModal] = useState<boolean>(false);

  // Drill-Down Stack & Amount Trace State
  const [drillDownStack, setDrillDownStack] = useState<DrillDownTarget[]>([]);
  const [activeAmountTrace, setActiveAmountTrace] = useState<AmountTraceContext | null>(null);

  // Refresh Trigger
  const [refreshKey, setRefreshKey] = useState<number>(0);

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
    onBumpRefresh();
  };

  const handleDrillDown = (target: DrillDownTarget) => {
    setActiveAmountTrace(null);
    setDrillDownStack((prev) => [...prev, target]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackDrillDown = () => {
    setDrillDownStack((prev) => prev.slice(0, -1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleResetDrillDown = () => {
    setDrillDownStack([]);
    setActiveAmountTrace(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleJumpToDrillDownIndex = (index: number) => {
    if (index < 0) {
      handleResetDrillDown();
    } else {
      setDrillDownStack((prev) => prev.slice(0, index + 1));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleTraceAmount = (context: AmountTraceContext) => {
    setActiveAmountTrace(context);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCloseAmountTrace = () => {
    setActiveAmountTrace(null);
  };

  const handleTabChange = (tab: ActiveTab | string) => {
    let target = tab as string;

    // Route AI advisor aliases directly to the unified Gemini Financial Advisor modal
    if (
      target === 'gemini_advisor' ||
      target === 'gemini' ||
      target === 'gemini_chat' ||
      target === 'ai_advisor' ||
      target === 'advisor' ||
      target === 'chat'
    ) {
      setShowGeminiModal(true);
      return;
    }

    // Normalize legacy & hyphenated aliases to consolidated workspaces + sub-tabs
    if (target === 'expenditures' || target === 'expenses') target = 'expenditure';
    if (target === 'payment-requests' || target === 'payments' || target === 'payment_request') target = 'payment_requests';
    if (
      target === 'system_diagnostics' ||
      target === 'system-diagnostics' ||
      target === 'diagnostics' ||
      target === 'systems_diagnosis' ||
      target === 'systems-diagnosis' ||
      target === 'system_health' ||
      target === 'validation'
    ) target = 'data_validation';
    if (target === 'help' || target === 'user_manual' || target === 'manual') target = 'help_api';
    if (target === 'export' || target === 'backup' || target === 'exports') target = 'export_centre';

    // 1. Consolidated Budget Planning
    if (target === 'annual_budget' || target === 'annual' || target === 'annual-budget') {
      target = 'budgets';
    }

    // 2. Consolidated Projects & Co-Funding
    if (target === 'shared_projects' || target === 'shared' || target === 'shared-projects') {
      setProjectsSubTab('shared');
      target = 'projects';
    } else if (target === 'projects') {
      setProjectsSubTab('portfolio');
    }

    // 3. Consolidated Budget Performance & Variance
    if (target === 'budget_utilization' || target === 'utilization' || target === 'budget-utilization') {
      setVarianceSubTab('utilization');
      target = 'budget_vs_actual';
    } else if (target === 'budget_vs_actual' || target === 'variance' || target === 'budget-vs-actual') {
      setVarianceSubTab('variance');
      target = 'budget_vs_actual';
    }

    // 4. Consolidated Reports & Executive Statements
    if (
      target === 'mgmt_report' ||
      target === 'management_report' ||
      target === 'management-report' ||
      target === 'executive_report'
    ) {
      setReportsSubTab('executive');
      target = 'reports';
    } else if (
      target === 'monthly_report' ||
      target === 'monthly_trend' ||
      target === 'monthly-trend' ||
      target === 'burn_rate' ||
      target === 'burn-rate' ||
      target === 'monthly' ||
      target === 'trend'
    ) {
      setReportsSubTab('monthly');
      target = 'reports';
    } else if (target === 'reports') {
      setReportsSubTab('standard');
    }

    setActiveTab(target as ActiveTab);
    setDrillDownStack([]);
    setActiveAmountTrace(null);
  };

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode');
      localStorage.setItem('apex_erp_theme', 'dark');
    } else {
      document.body.classList.remove('dark-mode');
      localStorage.setItem('apex_erp_theme', 'light');
    }
  }, [darkMode]);

  const notifications = DatabaseService.getNotifications();
  const settings = DatabaseService.getSettings();

  if (!authReady) {
    return (
      <div className="min-vh-100 d-flex flex-column align-items-center justify-content-center bg-light">
        <div className="spinner-border text-danger mb-3" role="status"></div>
        <div className="text-muted small fw-semibold">Verifying Firebase session &amp; security context...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <div className={`d-flex flex-column min-vh-100 ${darkMode ? 'dark-mode bg-dark text-white' : 'bg-light'}`} key={`${refreshKey}-${refreshTrigger}`}>
      {/* Top Navbar */}
      <Navbar
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        currentRole={role}
        onRoleChange={(newRole) => setRole(newRole)}
        notifications={notifications}
        onOpenGlobalSearch={() => setShowSearchModal(true)}
        onOpenQuickAction={() => setShowQuickActionModal(true)}
        settings={settings}
        onRefreshData={handleRefresh}
        onOpenGeminiChat={() => setShowGeminiModal(true)}
      />

      <div className="d-flex flex-grow-1 overflow-hidden">
        {/* Collapsible Sidebar */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={handleTabChange}
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
        />

        {/* Main Content Area */}
        <main className="flex-grow-1 p-3 p-md-4 overflow-y-auto" style={{ backgroundColor: darkMode ? '#121212' : '#F8F9FA' }}>
          <div className="container-fluid max-w-7xl mx-auto p-0">
            {/* Cloud Sync Error Banner (if any permission/validation error occurred) */}
            {cloudError && (
              <div className="alert alert-warning border-warning shadow-sm d-flex align-items-start justify-content-between gap-2 mb-3 py-2 px-3 small">
                <div>
                  <i className="bi bi-shield-exclamation me-2 text-danger"></i>
                  <strong>Cloud Sync Guard ({cloudError.operationType} on {cloudError.path || 'firestore'}):</strong>{' '}
                  {cloudError.error}
                </div>
                <button type="button" className="btn-close btn-sm" aria-label="Dismiss" onClick={clearCloudError}></button>
              </div>
            )}

            {/* Breadcrumb Header */}
            <Breadcrumb
              activeTab={activeTab}
              onQuickAction={() => setShowQuickActionModal(true)}
              role={role}
              drillDownStack={drillDownStack}
              onPopDrillDown={handleBackDrillDown}
              onResetDrillDown={handleResetDrillDown}
              onDrillDownToStep={handleJumpToDrillDownIndex}
            />

            {/* View Switching: Amount Trace vs DrillDown Stack vs Tab Views */}
            {activeAmountTrace ? (
              <AmountTraceView
                context={activeAmountTrace}
                role={role}
                onBack={handleCloseAmountTrace}
                onDrillDown={handleDrillDown}
              />
            ) : drillDownStack.length > 0 ? (
              (() => {
                const current = drillDownStack[drillDownStack.length - 1];
                switch (current.type) {
                  case 'transaction':
                    return (
                      <TransactionTraceView
                        transactionId={current.id}
                        recordType={current.recordType}
                        role={role}
                        onBack={handleBackDrillDown}
                        onDrillDown={handleDrillDown}
                        onNavigateTab={handleTabChange}
                      />
                    );
                  case 'supplier':
                    return (
                      <SupplierDetailView
                        supplierId={current.id}
                        role={role}
                        onBack={handleBackDrillDown}
                        onDrillDown={handleDrillDown}
                      />
                    );
                  case 'budget_line':
                    return (
                      <BudgetLineDetailView
                        budgetCodeOrId={current.id}
                        role={role}
                        onBack={handleBackDrillDown}
                        onDrillDown={handleDrillDown}
                      />
                    );
                  case 'department':
                    return (
                      <DepartmentDetailView
                        departmentId={current.id}
                        role={role}
                        onBack={handleBackDrillDown}
                        onDrillDown={handleDrillDown}
                      />
                    );
                  default:
                    return null;
                }
              })()
            ) : (
              <>
                {/* 1. Planning */}
                {activeTab === 'dashboard' && (
                  <DashboardView
                    onNavigate={(tab) => handleTabChange(tab as ActiveTab)}
                    onDrillDown={handleDrillDown}
                    onTraceAmount={handleTraceAmount}
                  />
                )}

                {activeTab === 'budgets' && (
                  <AnnualBudgetView
                    role={role}
                    onRefresh={handleRefresh}
                    onNavigateToExcelWizard={() => handleTabChange('excel_wizard')}
                    onDrillDown={handleDrillDown}
                    onTraceAmount={handleTraceAmount}
                  />
                )}

                {activeTab === 'projects' && (
                  <ProjectsView
                    role={role}
                    onRefresh={handleRefresh}
                    initialSubTab={projectsSubTab}
                    onNavigateTab={handleTabChange}
                  />
                )}

                {activeTab === 'departments' && (
                  <DepartmentsView role={role} onRefresh={handleRefresh} />
                )}

                {/* 2. Operations & Procurement */}
                {activeTab === 'expenditure' && (
                  <ExpendituresView
                    role={role}
                    onRefresh={handleRefresh}
                    onDrillDown={handleDrillDown}
                    onTraceAmount={handleTraceAmount}
                  />
                )}

                {activeTab === 'lpos' && (
                  <LPOManagementView
                    role={role}
                    onRefresh={handleRefresh}
                    onDrillDown={handleDrillDown}
                    onTraceAmount={handleTraceAmount}
                    onNavigateTab={handleTabChange}
                  />
                )}

                {activeTab === 'invoices' && (
                  <InvoiceManagementView
                    role={role}
                    onRefresh={handleRefresh}
                    onDrillDown={handleDrillDown}
                    onTraceAmount={handleTraceAmount}
                  />
                )}

                {activeTab === 'quotations' && (
                  <QuotationsView role={role} onRefresh={handleRefresh} />
                )}

                {activeTab === 'payment_requests' && (
                  <PaymentRequestsView role={role} onRefresh={handleRefresh} />
                )}

                {activeTab === 'suppliers' && (
                  <SuppliersView
                    role={role}
                    onRefresh={handleRefresh}
                    onDrillDown={handleDrillDown}
                  />
                )}

                {/* 3. Analytics & Reports */}
                {activeTab === 'budget_vs_actual' && (
                  <BudgetVsActualView
                    role={role}
                    onRefresh={handleRefresh}
                    initialSubTab={varianceSubTab}
                  />
                )}

                {activeTab === 'reports' && (
                  <ReportsView
                    role={role}
                    onRefresh={handleRefresh}
                    initialSubTab={reportsSubTab}
                  />
                )}

                {activeTab === 'analytics' && (
                  <AnalyticsView />
                )}

                {/* 4. Governance & Operations */}
                {activeTab === 'documents' && (
                  <DocumentsView
                    role={role}
                    onRefresh={handleRefresh}
                    onNavigateTab={handleTabChange}
                  />
                )}

                {activeTab === 'excel_wizard' && (
                  <ExcelWizardView role={role} onRefresh={handleRefresh} />
                )}

                {activeTab === 'export_centre' && (
                  <ExportCentreView role={role} onRefresh={handleRefresh} />
                )}

                {activeTab === 'data_validation' && (
                  <DataValidationView role={role} onRefresh={handleRefresh} onNavigateToTab={handleTabChange} />
                )}

                {activeTab === 'archive' && (
                  <ArchiveView role={role} onRefresh={handleRefresh} />
                )}

                {activeTab === 'users_roles' && (
                  <UsersRolesView role={role} onRefresh={handleRefresh} />
                )}

                {activeTab === 'settings' && (
                  <SettingsView role={role} onRefresh={handleRefresh} />
                )}

                {activeTab === 'audit_trail' && (
                  <AuditTrailView />
                )}

                {activeTab === 'help_api' && (
                  <HelpView />
                )}
              </>
            )}

            {/* Footer */}
            <footer className="mt-5 pt-3 border-top text-center text-muted fs-7 d-flex flex-column flex-md-row align-items-center justify-content-between gap-2">
              <div>
                © 2026 {settings.companyName}. All Rights Reserved. Pioneer Marketing & CX Budget Platform.
              </div>
              <div className="d-flex align-items-center gap-3">
                <span>KRA PIN: {settings.kraPin}</span>
                <span>•</span>
                <span>FY {settings.financialYear}</span>
                <span>•</span>
                <span className="text-corporate-primary font-semibold">Role: {role}</span>
              </div>
            </footer>
          </div>
        </main>
      </div>

      {/* Floating Action Button */}
      <button
        type="button"
        onClick={() => setShowQuickActionModal(true)}
        className="fab-btn"
        title="Quick Add Expenditure"
      >
        <i className="bi bi-plus-lg"></i>
      </button>

      {/* Global Search Modal */}
      <GlobalSearchModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onNavigateTab={(tab) => handleTabChange(tab as ActiveTab)}
        onDrillDown={handleDrillDown}
      />

      {/* Quick Action Expenditure Modal */}
      <QuickActionModal
        isOpen={showQuickActionModal}
        role={role}
        onClose={() => setShowQuickActionModal(false)}
        onRefresh={handleRefresh}
        onNavigateTab={handleTabChange}
      />

      {/* Floating Gemini AI Assistant Button */}
      <GeminiFloatingButton
        onClick={() => setShowGeminiModal(true)}
        isOpen={showGeminiModal}
      />

      {/* Interactive Gemini AI Chat Modal */}
      <GeminiChatModal
        isOpen={showGeminiModal}
        onClose={() => setShowGeminiModal(false)}
        activeTab={activeTab}
        legalEntityFilter="All"
        onNavigateToTab={handleTabChange}
      />
    </div>
  );
}

export default function App() {
  const [cloudRefreshTick, setCloudRefreshTick] = useState(0);

  return (
    <ErrorBoundary>
      <AuthProvider onCloudSynced={() => setCloudRefreshTick((n) => n + 1)}>
        <AppShell
          refreshTrigger={cloudRefreshTick}
          onBumpRefresh={() => setCloudRefreshTick((n) => n + 1)}
        />
        <GlobalFeedbackHost />
      </AuthProvider>
    </ErrorBoundary>
  );
}
