import {
  Budget,
  Department,
  Project,
  Expenditure,
  Supplier,
  ERPDocument,
  AuditTrail,
  ERPNotification,
  SystemSettings,
  RoleType,
  LPORecord,
  DocumentActivity,
  DocumentVersion,
  ImportHistoryRecord,
  UserRecord,
  QuotationRecord,
  InvoiceRecord,
  PaymentRequestRecord,
  OfficialManualDoc,
  DataArchiveItem,
  LegalEntityFilter,
} from '../types';
import {
  defaultSettings,
  defaultDepartments,
  defaultUsers,
  defaultOfficialManuals,
  defaultQuotations,
  defaultInvoices,
  defaultPaymentRequests,
} from './sampleData';
import {
  saveToCloud,
  deleteFromCloud,
  deleteUserFromCloud,
  saveCollectionToCloud,
  clearCollectionInCloud,
  fetchCollectionFromCloud,
  saveUserRecordToCloud,
  isCloudSyncReady,
} from './firestoreSync';

const KEYS = {
  SETTINGS: 'erp_budget_settings',
  DEPARTMENTS: 'erp_budget_departments',
  PROJECTS: 'erp_budget_projects',
  SUPPLIERS: 'erp_budget_suppliers',
  BUDGETS: 'erp_budget_budgets',
  EXPENDITURES: 'erp_budget_expenditures',
  DOCUMENTS: 'erp_budget_documents',
  LPOS: 'erp_budget_lpos',
  QUOTATIONS: 'erp_budget_quotations',
  INVOICES: 'erp_budget_invoices',
  PAYMENT_REQUESTS: 'erp_budget_payment_requests',
  USERS: 'erp_budget_users',
  ARCHIVE: 'erp_budget_archive',
  OFFICIAL_MANUALS: 'erp_budget_official_manuals',
  AUDIT_TRAIL: 'erp_budget_audit_trail',
  NOTIFICATIONS: 'erp_budget_notifications',
  CURRENT_ROLE: 'erp_budget_current_role',
  IMPORT_HISTORY: 'erp_budget_import_history',
  DATA_RESET_VERSION: 'erp_budget_data_version_v4',
};

// Helper for local storage read/write
function getItem<T>(key: string, defaultValue: T): T {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch (e) {
    console.error('LocalStorage error reading ' + key, e);
    return defaultValue;
  }
}

function setItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('LocalStorage error writing ' + key, e);
  }
}

export class DatabaseService {
  // Initialize defaults safely without overwriting or clearing cloud data
  static initializeDefaults(): void {
    if (!localStorage.getItem(KEYS.SETTINGS)) {
      setItem(KEYS.SETTINGS, defaultSettings);
    } else {
      // Ensure financial year is updated to 2026 if still on 2025/2026
      const existingSettings = getItem<SystemSettings>(KEYS.SETTINGS, defaultSettings);
      if (existingSettings && (existingSettings.financialYear === '2025/2026' || !existingSettings.financialYear)) {
        existingSettings.financialYear = '2026';
        setItem(KEYS.SETTINGS, existingSettings);
      }
    }
    if (!localStorage.getItem(KEYS.DEPARTMENTS)) {
      setItem(KEYS.DEPARTMENTS, defaultDepartments);
    }
    if (!localStorage.getItem(KEYS.PROJECTS)) {
      setItem(KEYS.PROJECTS, []);
    }
    if (!localStorage.getItem(KEYS.SUPPLIERS)) {
      setItem(KEYS.SUPPLIERS, []);
    }
    if (!localStorage.getItem(KEYS.BUDGETS)) {
      setItem(KEYS.BUDGETS, []);
    }
    if (!localStorage.getItem(KEYS.EXPENDITURES)) {
      setItem(KEYS.EXPENDITURES, []);
    }
    if (!localStorage.getItem(KEYS.DOCUMENTS)) {
      setItem(KEYS.DOCUMENTS, []);
    }
    if (!localStorage.getItem(KEYS.LPOS)) {
      setItem(KEYS.LPOS, []);
    }
    if (!localStorage.getItem(KEYS.QUOTATIONS) || JSON.parse(localStorage.getItem(KEYS.QUOTATIONS) || '[]').length === 0) {
      setItem(KEYS.QUOTATIONS, defaultQuotations);
    }
    if (!localStorage.getItem(KEYS.INVOICES) || JSON.parse(localStorage.getItem(KEYS.INVOICES) || '[]').length === 0) {
      setItem(KEYS.INVOICES, defaultInvoices);
    }
    if (!localStorage.getItem(KEYS.PAYMENT_REQUESTS) || JSON.parse(localStorage.getItem(KEYS.PAYMENT_REQUESTS) || '[]').length === 0) {
      setItem(KEYS.PAYMENT_REQUESTS, defaultPaymentRequests);
    }
    if (!localStorage.getItem(KEYS.USERS)) {
      setItem(KEYS.USERS, defaultUsers);
    }
    if (!localStorage.getItem(KEYS.ARCHIVE)) {
      setItem(KEYS.ARCHIVE, []);
    }
    if (!localStorage.getItem(KEYS.OFFICIAL_MANUALS)) {
      setItem(KEYS.OFFICIAL_MANUALS, defaultOfficialManuals);
    }
    if (!localStorage.getItem(KEYS.AUDIT_TRAIL)) {
      setItem(KEYS.AUDIT_TRAIL, []);
    }
    if (!localStorage.getItem(KEYS.NOTIFICATIONS)) {
      setItem(KEYS.NOTIFICATIONS, []);
    }
    if (!localStorage.getItem(KEYS.IMPORT_HISTORY)) {
      setItem(KEYS.IMPORT_HISTORY, []);
    }
    if (!localStorage.getItem(KEYS.CURRENT_ROLE)) {
      setItem(KEYS.CURRENT_ROLE, 'Administrator');
    }
  }

  // Sync with Firestore Cloud Database (auth-gated)
  static async syncWithCloud(): Promise<void> {
    if (!isCloudSyncReady()) {
      return;
    }

    try {
      const [
        budgets,
        expenditures,
        projects,
        suppliers,
        lpos,
        documents,
        quotations,
        invoices,
        paymentRequests,
        history,
        auditTrail,
        notifications,
        departments,
        archive,
        officialManuals,
      ] = await Promise.all([
        fetchCollectionFromCloud<Budget>('budgets'),
        fetchCollectionFromCloud<Expenditure>('expenditures'),
        fetchCollectionFromCloud<Project>('projects'),
        fetchCollectionFromCloud<Supplier>('suppliers'),
        fetchCollectionFromCloud<LPORecord>('lpos'),
        fetchCollectionFromCloud<ERPDocument>('documents'),
        fetchCollectionFromCloud<QuotationRecord>('quotations'),
        fetchCollectionFromCloud<InvoiceRecord>('invoices'),
        fetchCollectionFromCloud<PaymentRequestRecord>('paymentRequests'),
        fetchCollectionFromCloud<ImportHistoryRecord>('importHistory'),
        fetchCollectionFromCloud<AuditTrail>('auditTrail'),
        fetchCollectionFromCloud<ERPNotification>('notifications'),
        fetchCollectionFromCloud<Department>('departments'),
        fetchCollectionFromCloud<DataArchiveItem>('archive'),
        fetchCollectionFromCloud<OfficialManualDoc>('officialManuals'),
      ]);

      const localBudgets = getItem<Budget[]>(KEYS.BUDGETS, []);
      if (budgets && budgets.length > 0) {
        setItem(KEYS.BUDGETS, budgets);
      } else if (localBudgets.length > 0) {
        await saveCollectionToCloud('budgets', localBudgets);
      }

      const localExps = getItem<Expenditure[]>(KEYS.EXPENDITURES, []);
      if (expenditures && expenditures.length > 0) {
        setItem(KEYS.EXPENDITURES, expenditures);
      } else if (localExps.length > 0) {
        await saveCollectionToCloud('expenditures', localExps);
      }

      const localProjects = getItem<Project[]>(KEYS.PROJECTS, []);
      if (projects && projects.length > 0) {
        setItem(KEYS.PROJECTS, projects);
      } else if (localProjects.length > 0) {
        await saveCollectionToCloud('projects', localProjects);
      }

      const localSuppliers = getItem<Supplier[]>(KEYS.SUPPLIERS, []);
      if (suppliers && suppliers.length > 0) {
        setItem(KEYS.SUPPLIERS, suppliers);
      } else if (localSuppliers.length > 0) {
        await saveCollectionToCloud('suppliers', localSuppliers);
      }

      const localLpos = getItem<LPORecord[]>(KEYS.LPOS, []);
      if (lpos && lpos.length > 0) {
        setItem(KEYS.LPOS, lpos);
      } else if (localLpos.length > 0) {
        await saveCollectionToCloud('lpos', localLpos);
      }

      const localDocs = getItem<ERPDocument[]>(KEYS.DOCUMENTS, []);
      if (documents && documents.length > 0) {
        setItem(KEYS.DOCUMENTS, documents);
      } else if (localDocs.length > 0) {
        await saveCollectionToCloud('documents', localDocs);
      }

      const localQuotations = getItem<QuotationRecord[]>(KEYS.QUOTATIONS, []);
      if (quotations && quotations.length > 0) {
        setItem(KEYS.QUOTATIONS, quotations);
      } else if (localQuotations.length > 0) {
        await saveCollectionToCloud('quotations', localQuotations);
      }

      const localInvoices = getItem<InvoiceRecord[]>(KEYS.INVOICES, []);
      if (invoices && invoices.length > 0) {
        setItem(KEYS.INVOICES, invoices);
      } else if (localInvoices.length > 0) {
        await saveCollectionToCloud('invoices', localInvoices);
      }

      const localPayments = getItem<PaymentRequestRecord[]>(KEYS.PAYMENT_REQUESTS, []);
      if (paymentRequests && paymentRequests.length > 0) {
        setItem(KEYS.PAYMENT_REQUESTS, paymentRequests);
      } else if (localPayments.length > 0) {
        await saveCollectionToCloud('paymentRequests', localPayments);
      }

      const localHistory = getItem<ImportHistoryRecord[]>(KEYS.IMPORT_HISTORY, []);
      if (history && history.length > 0) {
        setItem(KEYS.IMPORT_HISTORY, history);
      } else if (localHistory.length > 0) {
        await saveCollectionToCloud('importHistory', localHistory);
      }

      if (auditTrail && auditTrail.length > 0) {
        setItem(KEYS.AUDIT_TRAIL, auditTrail);
      }

      if (notifications && notifications.length > 0) {
        setItem(KEYS.NOTIFICATIONS, notifications);
      }

      if (departments && departments.length > 0) {
        setItem(KEYS.DEPARTMENTS, departments);
      }

      if (archive && archive.length > 0) {
        setItem(KEYS.ARCHIVE, archive);
      }

      if (officialManuals && officialManuals.length > 0) {
        setItem(KEYS.OFFICIAL_MANUALS, officialManuals);
      }
    } catch (e) {
      console.warn('Cloud sync error on startup:', e);
      throw e;
    }
  }

  static async pushAllLocalToCloud(): Promise<void> {
    if (!isCloudSyncReady()) {
      return;
    }
    const pairs: Array<[string, any[]]> = [
      ['budgets', getItem<any[]>(KEYS.BUDGETS, [])],
      ['expenditures', getItem<any[]>(KEYS.EXPENDITURES, [])],
      ['projects', getItem<any[]>(KEYS.PROJECTS, [])],
      ['suppliers', getItem<any[]>(KEYS.SUPPLIERS, [])],
      ['lpos', getItem<any[]>(KEYS.LPOS, [])],
      ['documents', getItem<any[]>(KEYS.DOCUMENTS, [])],
      ['quotations', getItem<any[]>(KEYS.QUOTATIONS, [])],
      ['invoices', getItem<any[]>(KEYS.INVOICES, [])],
      ['paymentRequests', getItem<any[]>(KEYS.PAYMENT_REQUESTS, [])],
      ['importHistory', getItem<any[]>(KEYS.IMPORT_HISTORY, [])],
      ['departments', getItem<any[]>(KEYS.DEPARTMENTS, [])],
      ['archive', getItem<any[]>(KEYS.ARCHIVE, [])],
      ['officialManuals', getItem<any[]>(KEYS.OFFICIAL_MANUALS, [])],
      ['notifications', getItem<any[]>(KEYS.NOTIFICATIONS, [])],
    ];
    for (const [col, items] of pairs) {
      if (Array.isArray(items) && items.length > 0) {
        await saveCollectionToCloud(col, items).catch((err) => {
          console.warn(`Cloud push skipped/failed for ${col}:`, err);
        });
      }
    }
    const users = getItem<UserRecord[]>(KEYS.USERS, []);
    for (const u of users) {
      if (u && u.id) {
        await saveUserRecordToCloud(u).catch(() => {});
      }
    }
  }

  // Complete system reset: ONLY called on explicit manual user confirmation
  static resetAllData(): void {
    try {
      // Clear Local Storage
      localStorage.clear();
      
      // Clear IndexedDB databases if supported by browser
      if (typeof window !== 'undefined' && window.indexedDB && window.indexedDB.databases) {
        window.indexedDB.databases().then((dbs) => {
          dbs.forEach((db) => {
            if (db.name) {
              try {
                window.indexedDB.deleteDatabase(db.name);
              } catch (err) {
                console.error('Error deleting IndexedDB:', db.name, err);
              }
            }
          });
        }).catch((e) => console.error('IndexedDB query error:', e));
      }
    } catch (e) {
      console.error('Reset error:', e);
    }

    // Set clean initial state
    setItem(KEYS.SETTINGS, defaultSettings);
    setItem(KEYS.DEPARTMENTS, defaultDepartments);
    setItem(KEYS.PROJECTS, []);
    setItem(KEYS.SUPPLIERS, []);
    setItem(KEYS.BUDGETS, []);
    setItem(KEYS.EXPENDITURES, []);
    setItem(KEYS.DOCUMENTS, []);
    setItem(KEYS.LPOS, []);
    setItem(KEYS.AUDIT_TRAIL, []);
    setItem(KEYS.NOTIFICATIONS, []);
    setItem(KEYS.IMPORT_HISTORY, []);
    setItem(KEYS.CURRENT_ROLE, 'Administrator');
    setItem(KEYS.DATA_RESET_VERSION, 'v4_clean_blank_system');

    // Asynchronously clear mutable cloud collections on explicit reset (auditTrail remains immutable)
    const collections = ['budgets', 'expenditures', 'projects', 'suppliers', 'lpos', 'documents', 'quotations', 'invoices', 'paymentRequests', 'notifications', 'importHistory', 'departments', 'archive'];
    collections.forEach((col) => {
      void clearCollectionInCloud(col).catch(() => {});
    });
  }

  // Import History Management
  static getImportHistory(): ImportHistoryRecord[] {
    return getItem<ImportHistoryRecord[]>(KEYS.IMPORT_HISTORY, []);
  }

  static addImportHistory(record: ImportHistoryRecord): void {
    const history = this.getImportHistory();
    setItem(KEYS.IMPORT_HISTORY, [record, ...history]);
    saveToCloud('importHistory', record);
  }

  // Settings
  static getSettings(): SystemSettings {
    const data = getItem<Partial<SystemSettings>>(KEYS.SETTINGS, defaultSettings);
    const merged = { ...defaultSettings, ...(data || {}) };
    if (merged.expenseCategories && !merged.expenseCategories.includes('Miscellaneous & Contingency')) {
      merged.expenseCategories = [...merged.expenseCategories, 'Miscellaneous & Contingency'];
    }
    return merged;
  }

  static updateSettings(settings: SystemSettings, performedBy: string, role: RoleType): SystemSettings {
    setItem(KEYS.SETTINGS, settings);
    this.addAuditLog('UPDATE', 'Settings', undefined, 'Updated system settings & financial configuration', performedBy, role);
    return settings;
  }



  // Expense Category Management
  static addCategory(categoryName: string, performedBy: string, role: RoleType): SystemSettings {
    const settings = this.getSettings();
    const trimmed = categoryName.trim();
    if (!trimmed || settings.expenseCategories.includes(trimmed)) {
      return settings;
    }
    const updated = {
      ...settings,
      expenseCategories: [...settings.expenseCategories, trimmed],
    };
    this.updateSettings(updated, performedBy, role);
    this.addAuditLog('CATEGORY_MANAGE', 'Category', undefined, `Added category: ${trimmed}`, performedBy, role);
    return updated;
  }

  static editCategory(oldName: string, newName: string, performedBy: string, role: RoleType): SystemSettings {
    const settings = this.getSettings();
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return settings;

    const updatedCategories = settings.expenseCategories.map((c) => (c === oldName ? trimmed : c));
    const updated = { ...settings, expenseCategories: updatedCategories };
    this.updateSettings(updated, performedBy, role);

    // Also update existing budgets & expenditures with old category name
    const bdgs = this.getBudgets();
    const updatedBdgs = bdgs.map((b) => (b.category === oldName ? { ...b, category: trimmed } : b));
    setItem(KEYS.BUDGETS, updatedBdgs);

    const exps = this.getExpenditures();
    const updatedExps = exps.map((e) => (e.category === oldName ? { ...e, category: trimmed } : e));
    setItem(KEYS.EXPENDITURES, updatedExps);

    this.addAuditLog('CATEGORY_MANAGE', 'Category', undefined, `Renamed category '${oldName}' to '${trimmed}'`, performedBy, role);
    return updated;
  }

  static deleteCategory(categoryName: string, performedBy: string, role: RoleType): SystemSettings {
    const settings = this.getSettings();
    const updatedCategories = settings.expenseCategories.filter((c) => c !== categoryName);
    const updated = { ...settings, expenseCategories: updatedCategories };
    this.updateSettings(updated, performedBy, role);
    this.addAuditLog('CATEGORY_MANAGE', 'Category', undefined, `Deleted/Archived category: ${categoryName}`, performedBy, role);
    return updated;
  }

  // Role
  static getCurrentRole(): RoleType {
    return getItem(KEYS.CURRENT_ROLE, 'Administrator');
  }

  static setCurrentRole(role: RoleType): void {
    setItem(KEYS.CURRENT_ROLE, role);
  }

  // Departments
  static getDepartments(): Department[] {
    const depts: Department[] = getItem(KEYS.DEPARTMENTS, defaultDepartments);
    const exps = this.getExpenditures();
    const bdgs = this.getBudgets();

    // Dynamically calculate allocatedBudget & totalSpent per department
    return depts.map((dept) => {
      const deptBdgs = bdgs.filter((b) => b.departmentId === dept.id || b.departmentName.toLowerCase() === dept.name.toLowerCase());
      const deptExps = exps.filter((e) => e.departmentId === dept.id || e.departmentName.toLowerCase() === dept.name.toLowerCase());

      const allocatedBudget = deptBdgs.reduce((sum, b) => sum + Number(b.allocatedAmount || 0), 0);
      const totalSpent = deptExps.reduce((sum, e) => sum + Number(e.totalAmount || 0), 0);

      return {
        ...dept,
        allocatedBudget: allocatedBudget > 0 ? allocatedBudget : dept.allocatedBudget,
        totalSpent,
      };
    });
  }

  static saveDepartment(dept: Department, performedBy: string, role: RoleType): Department {
    const depts = getItem<Department[]>(KEYS.DEPARTMENTS, defaultDepartments);
    const index = depts.findIndex((d) => d.id === dept.id);
    let updated: Department[];
    if (index >= 0) {
      depts[index] = dept;
      updated = [...depts];
      this.addAuditLog('UPDATE', 'Department', dept.id, `Updated department ${dept.name}`, performedBy, role);
    } else {
      updated = [dept, ...depts];
      this.addAuditLog('CREATE', 'Department', dept.id, `Created department ${dept.name}`, performedBy, role);
    }
    setItem(KEYS.DEPARTMENTS, updated);
    saveToCloud('departments', dept);
    return dept;
  }

  static deleteDepartment(id: string, performedBy: string, role: RoleType): void {
    const depts = getItem<Department[]>(KEYS.DEPARTMENTS, defaultDepartments);
    const target = depts.find((d) => d.id === id);
    const updated = depts.filter((d) => d.id !== id);
    setItem(KEYS.DEPARTMENTS, updated);
    deleteFromCloud('departments', id);
    if (target) {
      this.addAuditLog('DELETE', 'Department', id, `Deleted department ${target.name}`, performedBy, role);
    }
  }

  // Projects
  static getProjects(): Project[] {
    const projects: Project[] = getItem(KEYS.PROJECTS, []);
    const exps = this.getExpenditures();
    const invoices = this.getInvoices();
    const lpos = this.getLPOs();

    const norm = (v?: string) => (v || '').trim().toLowerCase();
    const cleanRef = (v?: string) => (v || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    const matchesProject = (
      proj: Project,
      rec: { projectId?: string; projectName?: string }
    ): boolean => {
      if (rec.projectId && (rec.projectId === proj.id || norm(rec.projectId) === norm(proj.code))) {
        return true;
      }
      if (rec.projectName && proj.name && norm(rec.projectName) === norm(proj.name)) {
        return true;
      }
      return false;
    };

    return projects.map((proj) => {
      const projExps = exps.filter((e) => matchesProject(proj, e));
      const expsSpend = projExps.reduce((sum, e) => sum + Number(e.totalAmount || 0), 0);
      const matchedExpInvoiceNums = new Set(
        projExps.map((e) => cleanRef(e.invoiceNumber)).filter(Boolean)
      );

      const projInvoices = invoices.filter((inv) => matchesProject(proj, inv));
      const activeInvoices = projInvoices.filter((inv) => inv.paymentStatus !== 'Rejected');
      const paidInvoices = activeInvoices.filter((inv) => inv.paymentStatus === 'Paid');
      const pendingInvoices = activeInvoices.filter((inv) => inv.paymentStatus !== 'Paid');

      const invoicedAmount = activeInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);
      const paidInvoicesAmount = paidInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);
      const pendingInvoicesAmount = pendingInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);

      // Count Paid invoices directly if not already mirrored in Expenditures (prevents double-counting)
      const unrecordedPaidInvoices = paidInvoices
        .filter((inv) => {
          const invRef = cleanRef(inv.invoiceNumber);
          return !invRef || !matchedExpInvoiceNums.has(invRef);
        })
        .reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);

      const spent = expsSpend + unrecordedPaidInvoices;

      // Open LPO commitments not yet converted into expenditures or active invoices
      const activeProjLpos = lpos.filter(
        (l) =>
          matchesProject(proj, l) &&
          !['Cancelled', 'Closed'].includes(l.lpoStatus || l.status || '') &&
          l.paymentStatus !== 'Paid' &&
          l.paymentStatus !== 'Fully Paid'
      );

      const committedSpend = activeProjLpos.reduce((sum, l) => {
        const lpoRef = cleanRef(l.lpoNumber);
        const lpoTotal = Number(l.totalLpoValue ?? l.totalLpoAmount ?? 0);
        if (!lpoRef) return sum + lpoTotal;
        const matchedExpForLpo = projExps
          .filter((e) => cleanRef(e.purchaseOrder) === lpoRef)
          .reduce((s, e) => s + Number(e.totalAmount || 0), 0);
        const matchedInvForLpo = activeInvoices
          .filter((inv) => cleanRef(inv.lpoNumber) === lpoRef)
          .reduce((s, inv) => s + Number(inv.totalAmount || 0), 0);
        const covered = Math.max(matchedExpForLpo, matchedInvForLpo);
        return sum + Math.max(0, lpoTotal - covered);
      }, 0);

      const cap = Number(proj.totalBudget ?? proj.approvedBudget ?? proj.revisedBudget ?? proj.budget ?? 0);
      const remaining = cap - spent - pendingInvoicesAmount - committedSpend;
      const totalObligated = spent + pendingInvoicesAmount + committedSpend;
      const progressPercent = cap > 0 ? Math.min(100, Math.round((totalObligated / cap) * 100)) : 0;

      return {
        ...proj,
        budget: proj.budget ?? cap,
        spent,
        actualSpend: spent,
        committedSpend,
        invoicedAmount,
        pendingInvoicesAmount,
        pendingInvoicesCount: pendingInvoices.length,
        paidInvoicesAmount,
        invoiceCount: activeInvoices.length,
        remaining,
        remainingBudget: remaining,
        progressPercent,
        utilizationPercent: cap > 0 ? Math.round((totalObligated / cap) * 100) : 0,
      };
    });
  }

  static saveProject(project: Project, performedBy: string, role: RoleType): Project {
    const {
      invoicedAmount: _invoicedAmount,
      pendingInvoicesAmount: _pendingInvoicesAmount,
      pendingInvoicesCount: _pendingInvoicesCount,
      paidInvoicesAmount: _paidInvoicesAmount,
      invoiceCount: _invoiceCount,
      ...persistableProject
    } = project;

    const projects = getItem<Project[]>(KEYS.PROJECTS, []);
    const index = projects.findIndex((p) => p.id === persistableProject.id);
    let updated: Project[];
    if (index >= 0) {
      projects[index] = persistableProject;
      updated = [...projects];
      this.addAuditLog('UPDATE', 'Project', persistableProject.id, `Updated project ${persistableProject.name}`, performedBy, role);
    } else {
      updated = [persistableProject, ...projects];
      this.addAuditLog('CREATE', 'Project', persistableProject.id, `Created project ${persistableProject.name}`, performedBy, role);
    }
    setItem(KEYS.PROJECTS, updated);
    saveToCloud('projects', persistableProject);
    return persistableProject;
  }

  static deleteProject(id: string, performedBy: string, role: RoleType): void {
    const projects = getItem<Project[]>(KEYS.PROJECTS, []);
    const target = projects.find((p) => p.id === id);
    const updated = projects.filter((p) => p.id !== id);
    setItem(KEYS.PROJECTS, updated);
    deleteFromCloud('projects', id);
    if (target) {
      this.addAuditLog('DELETE', 'Project', id, `Deleted project ${target.name}`, performedBy, role);
    }
  }

  // Budgets
  static getBudgets(): Budget[] {
    const bdgs = getItem<Budget[]>(KEYS.BUDGETS, []);
    return bdgs.map((b) => ({
      ...b,
      legalEntity: b.legalEntity || 'PACL',
    }));
  }

  static saveBudget(budget: Budget, performedBy: string, role: RoleType): Budget {
    const bdgs = getItem<Budget[]>(KEYS.BUDGETS, []);
    const index = bdgs.findIndex((b) => b.id === budget.id);
    let updated: Budget[];
    if (index >= 0) {
      bdgs[index] = budget;
      updated = [...bdgs];
      this.addAuditLog('UPDATE', 'Budget', budget.id, `Updated budget code ${budget.code}`, performedBy, role);
    } else {
      updated = [budget, ...bdgs];
      this.addAuditLog('CREATE', 'Budget', budget.id, `Created budget code ${budget.code} allocated ${budget.allocatedAmount}`, performedBy, role);
    }
    setItem(KEYS.BUDGETS, updated);
    saveToCloud('budgets', budget);
    this.checkBudgetThresholds(budget.departmentId, budget.projectId);
    return budget;
  }

  static deleteBudget(id: string, performedBy: string, role: RoleType): void {
    const bdgs = getItem<Budget[]>(KEYS.BUDGETS, []);
    const target = bdgs.find((b) => b.id === id);
    const updated = bdgs.filter((b) => b.id !== id);
    setItem(KEYS.BUDGETS, updated);
    deleteFromCloud('budgets', id);
    if (target) {
      this.addAuditLog('DELETE', 'Budget', id, `Deleted budget code ${target.code}`, performedBy, role);
    }
  }

  static duplicateBudget(id: string, performedBy: string, role: RoleType): Budget | null {
    const bdgs = getItem<Budget[]>(KEYS.BUDGETS, []);
    const source = bdgs.find((b) => b.id === id);
    if (!source) return null;

    const copy: Budget = {
      ...source,
      id: `bdg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      code: `${source.code}-COPY`,
      description: `Copy of ${source.description}`,
      createdDate: new Date().toISOString().split('T')[0],
      createdBy: performedBy,
    };
    setItem(KEYS.BUDGETS, [copy, ...bdgs]);
    void saveToCloud('budgets', copy).catch(() => {});
    this.addAuditLog('CREATE', 'Budget', copy.id, `Duplicated budget ${source.code} to ${copy.code}`, performedBy, role);
    return copy;
  }

  // Expenditures & Budget Validation
  static getExpenditures(): Expenditure[] {
    const exps = getItem<Expenditure[]>(KEYS.EXPENDITURES, []);
    return exps.map((e) => {
      const resolvedDate = e.date || e.expenseDate || new Date().toISOString().split('T')[0];
      return {
        ...e,
        date: resolvedDate,
        expenseDate: e.expenseDate || resolvedDate,
        legalEntity: e.legalEntity || 'PACL',
      };
    });
  }

  /**
   * Budget Validation Engine: Checks remaining budget for given department & project before saving expense.
   */
  static validateExpenditureBudget(
    departmentId: string,
    projectId: string | undefined,
    expenseAmount: number,
    editingExpenseId?: string
  ): {
    isValid: boolean;
    allocatedBudget: number;
    currentSpent: number;
    remainingBudget: number;
    projectedSpent: number;
    excessAmount: number;
    warningMessage?: string;
  } {
    const bdgs = this.getBudgets();
    const exps = this.getExpenditures();

    // Filter relevant budgets
    let relevantBdgs = bdgs.filter((b) => b.departmentId === departmentId);
    if (projectId) {
      const projBdgs = relevantBdgs.filter((b) => b.projectId === projectId);
      if (projBdgs.length > 0) relevantBdgs = projBdgs;
    }

    const allocatedBudget = relevantBdgs.reduce((sum, b) => sum + Number(b.allocatedAmount || 0), 0);

    // Sum existing expenses (excluding current editing expense)
    let relevantExps = exps.filter((e) => e.departmentId === departmentId && e.id !== editingExpenseId);
    if (projectId) {
      relevantExps = relevantExps.filter((e) => e.projectId === projectId);
    }

    const currentSpent = relevantExps.reduce((sum, e) => sum + Number(e.totalAmount || 0), 0);
    const remainingBudget = allocatedBudget - currentSpent;
    const projectedSpent = currentSpent + expenseAmount;
    const excessAmount = projectedSpent - allocatedBudget;

    if (allocatedBudget > 0 && projectedSpent > allocatedBudget) {
      return {
        isValid: false,
        allocatedBudget,
        currentSpent,
        remainingBudget,
        projectedSpent,
        excessAmount,
        warningMessage: `Expense amount exceeds available budget by ${excessAmount.toLocaleString()} KES. Total Allocated: ${allocatedBudget.toLocaleString()} KES | Current Spent: ${currentSpent.toLocaleString()} KES. Authorization required!`,
      };
    }

    return {
      isValid: true,
      allocatedBudget,
      currentSpent,
      remainingBudget,
      projectedSpent,
      excessAmount: 0,
    };
  }

  static saveExpenditure(exp: Expenditure, performedBy: string, role: RoleType): Expenditure {
    const resolvedDate = exp.date || exp.expenseDate || new Date().toISOString().split('T')[0];
    const normalizedExp: Expenditure = {
      ...exp,
      date: resolvedDate,
      expenseDate: exp.expenseDate || resolvedDate,
    };
    const exps = getItem<Expenditure[]>(KEYS.EXPENDITURES, []);
    const index = exps.findIndex((e) => e.id === normalizedExp.id);

    let updated: Expenditure[];
    if (index >= 0) {
      exps[index] = normalizedExp;
      updated = [...exps];
      this.addAuditLog('UPDATE', 'Expenditure', normalizedExp.id, `Updated expenditure ${normalizedExp.expenseId} (${normalizedExp.amount} KES)`, performedBy, role);
    } else {
      updated = [normalizedExp, ...exps];
      this.addAuditLog('CREATE', 'Expenditure', normalizedExp.id, `Created expenditure ${normalizedExp.expenseId} (${normalizedExp.amount} KES)`, performedBy, role);
    }

    if (normalizedExp.isBudgetExceeded) {
      this.addAuditLog('EXCEED_BUDGET_OVERRIDE', 'Expenditure', normalizedExp.id, `EXCEEDED BUDGET OVERRIDE for ${normalizedExp.expenseId}. Authorized by: ${normalizedExp.authorizedBy || performedBy}`, performedBy, role);
      this.addNotification({
        id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'budget_exceeded',
        title: 'Budget Exceeded Override Executed',
        message: `Expense ${normalizedExp.expenseId} (${normalizedExp.departmentName}) was recorded with budget override! Amount: ${Number(normalizedExp.totalAmount || 0).toLocaleString()} KES.`,
        timestamp: new Date().toISOString(),
        isRead: false,
        severity: 'danger',
      });
    }

    setItem(KEYS.EXPENDITURES, updated);
    saveToCloud('expenditures', normalizedExp);

    // Update supplier total paid
    this.updateSupplierTotalPaid(normalizedExp.supplierId);

    // Check thresholds for warnings
    this.checkBudgetThresholds(normalizedExp.departmentId, normalizedExp.projectId);

    return normalizedExp;
  }

  static deleteExpenditure(id: string, performedBy: string, role: RoleType): void {
    const exps = getItem<Expenditure[]>(KEYS.EXPENDITURES, []);
    const target = exps.find((e) => e.id === id);
    const updated = exps.filter((e) => e.id !== id);
    setItem(KEYS.EXPENDITURES, updated);
    deleteFromCloud('expenditures', id);
    if (target) {
      this.addAuditLog('DELETE', 'Expenditure', id, `Deleted expenditure ${target.expenseId}`, performedBy, role);
    }
  }

  // Suppliers
  static getSuppliers(): Supplier[] {
    const sups = getItem<Supplier[]>(KEYS.SUPPLIERS, []);
    const exps = this.getExpenditures();

    // Map existing suppliers with dynamically computed live totals
    const enriched = sups.map((sup) => {
      const supExps = exps.filter(
        (e) =>
          (e.supplierId && e.supplierId === sup.id) ||
          (e.supplierName && sup.name && e.supplierName.trim().toLowerCase() === sup.name.trim().toLowerCase())
      );
      const computedTotal = supExps.reduce((sum, e) => sum + Number(e.totalAmount || 0), 0);
      return {
        ...sup,
        totalPaid: computedTotal > 0 ? computedTotal : Number(sup.totalPaid || 0),
      };
    });

    // Also auto-discover any suppliers referenced in expenditures that are not yet in the master suppliers list
    const existingNames = new Set(enriched.map((s) => s.name.trim().toLowerCase()));
    const unlistedVendors: Supplier[] = [];

    exps.forEach((e) => {
      if (e.supplierName && !existingNames.has(e.supplierName.trim().toLowerCase())) {
        existingNames.add(e.supplierName.trim().toLowerCase());
        const vendorExps = exps.filter((x) => x.supplierName && x.supplierName.trim().toLowerCase() === e.supplierName.trim().toLowerCase());
        const total = vendorExps.reduce((sum, x) => sum + Number(x.totalAmount || 0), 0);
        unlistedVendors.push({
          id: e.supplierId || `sup-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          name: e.supplierName,
          contactPerson: 'Vendor Accounts Lead',
          phone: '+254 700 000 000',
          email: `accounts@${e.supplierName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'supplier'}.co.ke`,
          pin: 'P05' + Math.floor(100000 + Math.random() * 900000) + 'Z',
          address: 'Nairobi, Kenya',
          servicesOffered: [e.category || 'General Corporate Services'],
          status: 'Active',
          totalPaid: total,
          rating: 4.8,
        });
      }
    });

    return [...enriched, ...unlistedVendors];
  }

  static saveSupplier(supplier: Supplier, performedBy: string, role: RoleType): Supplier {
    const sups = getItem<Supplier[]>(KEYS.SUPPLIERS, []);
    const index = sups.findIndex((s) => s.id === supplier.id);
    let updated: Supplier[];
    if (index >= 0) {
      sups[index] = supplier;
      updated = [...sups];
      this.addAuditLog('UPDATE', 'Supplier', supplier.id, `Updated supplier ${supplier.name}`, performedBy, role);
    } else {
      updated = [supplier, ...sups];
      this.addAuditLog('CREATE', 'Supplier', supplier.id, `Added new supplier ${supplier.name}`, performedBy, role);
    }
    setItem(KEYS.SUPPLIERS, updated);
    saveToCloud('suppliers', supplier);
    return supplier;
  }

  static deleteSupplier(id: string, performedBy: string, role: RoleType): void {
    const sups = getItem<Supplier[]>(KEYS.SUPPLIERS, []);
    const target = sups.find((s) => s.id === id);
    const updated = sups.filter((s) => s.id !== id);
    setItem(KEYS.SUPPLIERS, updated);
    deleteFromCloud('suppliers', id);
    if (target) {
      this.addAuditLog('DELETE', 'Supplier', id, `Deleted supplier ${target.name}`, performedBy, role);
    }
  }

  private static updateSupplierTotalPaid(supplierId: string) {
    const sups = getItem<Supplier[]>(KEYS.SUPPLIERS, []);
    const exps = getItem<Expenditure[]>(KEYS.EXPENDITURES, []);
    const totalPaid = exps
      .filter((e) => e.supplierId === supplierId && e.paymentStatus === 'Paid')
      .reduce((sum, e) => sum + Number(e.totalAmount || 0), 0);

    const updated = sups.map((s) => (s.id === supplierId ? { ...s, totalPaid } : s));
    setItem(KEYS.SUPPLIERS, updated);
  }

  // LPO Register Management
  static getLPOs(): LPORecord[] {
    const raw = getItem<LPORecord[]>(KEYS.LPOS, []);
    return raw.map((l) => {
      const lpoAmount = Number(l.lpoAmount ?? l.amountBeforeVat ?? 0);
      const vatAmount = Number(l.vatAmount ?? 0);
      const totalLpoValue = Number(l.totalLpoValue ?? l.totalLpoAmount ?? (lpoAmount + vatAmount));
      const lpoStatus = (l.lpoStatus || l.status || 'Issued') as LPORecord['lpoStatus'];
      return {
        ...l,
        lpoAmount,
        amountBeforeVat: Number(l.amountBeforeVat ?? lpoAmount),
        vatAmount,
        totalLpoValue,
        totalLpoAmount: Number(l.totalLpoAmount ?? totalLpoValue),
        lpoStatus,
        status: (l.status || lpoStatus) as LPORecord['status'],
      };
    });
  }

  static saveLPO(lpo: LPORecord, performedBy: string, role: RoleType): LPORecord {
    const lpoAmount = Number(lpo.lpoAmount ?? lpo.amountBeforeVat ?? 0);
    const vatAmount = Number(lpo.vatAmount ?? 0);
    const totalLpoValue = Number(lpo.totalLpoValue ?? lpo.totalLpoAmount ?? (lpoAmount + vatAmount));
    const lpoStatus = (lpo.lpoStatus || lpo.status || 'Issued') as LPORecord['lpoStatus'];

    const lpos = getItem<LPORecord[]>(KEYS.LPOS, []);
    const index = lpos.findIndex((l) => l.id === lpo.id);
    const recordToSave: LPORecord = {
      ...lpo,
      lpoAmount,
      amountBeforeVat: Number(lpo.amountBeforeVat ?? lpoAmount),
      vatAmount,
      totalLpoValue,
      totalLpoAmount: Number(lpo.totalLpoAmount ?? totalLpoValue),
      lpoStatus,
      status: (lpo.status || lpoStatus) as LPORecord['status'],
      ...(index >= 0 ? { updatedAt: new Date().toISOString() } : {}),
    };

    let updated: LPORecord[];
    if (index >= 0) {
      lpos[index] = recordToSave;
      updated = [...lpos];
      this.addAuditLog(
        'UPDATE',
        'Document',
        recordToSave.id,
        `Updated LPO ${recordToSave.lpoNumber} (${recordToSave.legalEntity}) - Total KES ${totalLpoValue.toLocaleString()}`,
        performedBy,
        role
      );
    } else {
      updated = [recordToSave, ...lpos];
      this.addAuditLog(
        'CREATE',
        'Document',
        recordToSave.id,
        `Created new LPO ${recordToSave.lpoNumber} (${recordToSave.legalEntity}) - Total KES ${totalLpoValue.toLocaleString()}`,
        performedBy,
        role
      );
    }
    setItem(KEYS.LPOS, updated);
    saveToCloud('lpos', recordToSave);

    // If budget threshold check needed
    if (recordToSave.departmentId) {
      this.checkBudgetThresholds(recordToSave.departmentId, recordToSave.projectId);
    }

    return recordToSave;
  }

  static deleteLPO(id: string, performedBy: string, role: RoleType): void {
    const lpos = getItem<LPORecord[]>(KEYS.LPOS, []);
    const target = lpos.find((l) => l.id === id);
    const updated = lpos.filter((l) => l.id !== id);
    setItem(KEYS.LPOS, updated);
    deleteFromCloud('lpos', id);
    if (target) {
      this.addAuditLog('DELETE', 'Document', id, `Deleted LPO ${target.lpoNumber}`, performedBy, role);
    }
  }

  // Budget Commitment & Available Budget Calculator
  static getBudgetCommitment(budgetId: string): {
    allocatedBudget: number;
    committedAmount: number;
    actualSpend: number;
    availableBudget: number;
    budgetCode: string;
    legalEntity: string;
  } {
    const bdgs = this.getBudgets();
    const targetBudget = bdgs.find((b) => b.id === budgetId);
    const allocatedBudget = targetBudget ? targetBudget.allocatedAmount : 0;
    const budgetCode = targetBudget ? targetBudget.code : 'N/A';
    const legalEntity = targetBudget ? targetBudget.legalEntity : 'PACL';

    // Get all expenditures for this budget
    const exps = this.getExpenditures().filter((e) => e.budgetId === budgetId);
    const actualSpend = exps.reduce((sum, e) => sum + Number(e.totalAmount || 0), 0);

    // Get active LPOs for this budget that are committed (Approved, Issued, Partially Fulfilled)
    const lpos = this.getLPOs().filter(
      (l) => l.budgetId === budgetId && ['Approved', 'Issued', 'Partially Fulfilled'].includes(l.lpoStatus)
    );

    // Sum up LPO commitment but avoid double counting for matched expenses
    const committedAmount = lpos.reduce((sum, l) => {
      const matchedExps = exps.filter((e) => e.purchaseOrder === l.lpoNumber || (e.description && e.description.includes(l.lpoNumber)));
      const matchedExpTotal = matchedExps.reduce((s, e) => s + Number(e.totalAmount || 0), 0);
      const remainingUnspentLPO = Math.max(0, l.totalLpoValue - matchedExpTotal);
      return sum + remainingUnspentLPO;
    }, 0);

    const availableBudget = Math.max(0, allocatedBudget - committedAmount - actualSpend);

    return {
      allocatedBudget,
      committedAmount,
      actualSpend,
      availableBudget,
      budgetCode,
      legalEntity,
    };
  }

  // ==================== 2026 INDEX GENERATORS ====================
  static getFinancialYear(): string {
    const settings = this.getSettings();
    return settings.financialYear || '2026';
  }

  static generateBudgetCode(deptCode?: string, entity?: string): string {
    const bdgs = this.getBudgets();
    const cleanDept = (deptCode || 'MCX').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const cleanEntity = (entity || 'PACL').toUpperCase();
    const prefix = `BDG-2026-${cleanDept}`;
    const matchingCodes = bdgs
      .map((b) => b.code)
      .filter((c) => c && c.startsWith('BDG-2026'));
    const nextSeq = matchingCodes.length + 1;
    const seqStr = String(nextSeq).padStart(2, '0');
    const suffixLetter = cleanEntity === 'PGIL' ? 'B' : 'A';
    return `${prefix}-${seqStr}${suffixLetter}`;
  }

  static generateExpenseId(deptCode?: string, entity?: string): string {
    const exps = this.getExpenditures();
    const cleanDept = (deptCode || 'MCX').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const cleanEntity = (entity || 'PACL').toUpperCase();
    const matchingExps = exps
      .map((e) => e.expenseId)
      .filter((c) => c && c.startsWith('EXP-2026'));
    const nextSeq = matchingExps.length + 1;
    const seqStr = String(nextSeq).padStart(3, '0');
    const suffixLetter = cleanEntity === 'PGIL' ? 'B' : 'A';
    return `EXP-2026-${cleanDept}-${seqStr}${suffixLetter}`;
  }

  static generatePoNumber(deptCode?: string): string {
    const exps = this.getExpenditures();
    const lpos = this.getLPOs();
    const cleanDept = (deptCode || 'MCX').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const totalCount = exps.length + lpos.length + 1;
    const seqNum = 100 + totalCount;
    return `PO-2026-${cleanDept}-${seqNum}`;
  }

  static generateProjectCode(deptCode?: string): string {
    const projs = this.getProjects();
    const matchingProjs = projs
      .map((p) => p.code)
      .filter((c) => c && (c.startsWith('CAM-2026') || c.startsWith('PRJ-2026')));
    const nextSeq = matchingProjs.length + 1;
    const seqStr = String(nextSeq).padStart(2, '0');
    return `CAM-2026-${seqStr}`;
  }

  static generateLpoNumber(entity: string = 'PACL', deptCode?: string): string {
    const lpos = this.getLPOs();
    const cleanEntity = (entity || 'PACL').toUpperCase();
    const cleanDept = (deptCode || 'MCX').toUpperCase();
    const entityLpos = lpos.filter((l) => l.legalEntity === cleanEntity && (l.lpoNumber || '').includes('2026'));
    const nextSeq = entityLpos.length + 1;
    const seqStr = String(nextSeq).padStart(3, '0');
    return `${cleanEntity}/${cleanDept}/LPO/2026/${seqStr}`;
  }

  static generateDocumentNumber(entity: string = 'PACL', docType?: string): string {
    const docs = this.getDocuments();
    const cleanEntity = (entity || 'PACL').toUpperCase();
    const cleanType = (docType || 'DOC').replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase();
    const entityDocs = docs.filter((d) => (d.docNumber || '').includes('2026') && (d.docNumber || '').includes(cleanEntity));
    const nextSeq = entityDocs.length + 1;
    const seqStr = String(nextSeq).padStart(3, '0');
    return `DOC-${cleanEntity}-2026-${cleanType || 'DOC'}-${seqStr}`;
  }

  // Standardized Filename Generator
  static generateStandardizedFilename(
    entity: string = 'PACL',
    docType: string = 'LPO',
    docNumber: string = '001',
    projectName?: string,
    dateStr?: string
  ): string {
    const cleanEntity = (entity || 'PACL').toUpperCase();
    const cleanDocType = (docType || 'DOC').replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');
    const cleanDocNo = (docNumber || '001').replace(/[^a-zA-Z0-9]/g, '_');
    const cleanProj = (projectName || 'General').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
    const cleanDate = dateStr || new Date().toISOString().split('T')[0];
    return `${cleanEntity}_${cleanDocType}_${cleanDocNo}_${cleanProj}_${cleanDate}.pdf`;
  }

  // Documents
  static getDocuments(): ERPDocument[] {
    return getItem(KEYS.DOCUMENTS, []);
  }

  static saveDocument(doc: ERPDocument, performedBy: string, role: RoleType): ERPDocument {
    const docs = getItem<ERPDocument[]>(KEYS.DOCUMENTS, []);
    const index = docs.findIndex((d) => d.id === doc.id);
    let updated: ERPDocument[];

    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);

    const initialActivity: DocumentActivity = {
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: now,
      user: performedBy,
      action: index >= 0 ? 'Edited' : 'Uploaded',
      details: index >= 0 ? `Updated document metadata` : `Uploaded ${doc.title}`,
    };

    if (index >= 0) {
      const existing = docs[index];
      const newActivity = [initialActivity, ...(existing.activityLog || [])];
      docs[index] = { ...existing, ...doc, activityLog: newActivity };
      updated = [...docs];
      this.addAuditLog('UPDATE', 'Document', doc.id, `Updated document ${doc.title}`, performedBy, role);
    } else {
      const versions: DocumentVersion[] = doc.versions || [
        {
          versionNumber: 1,
          uploadDate: doc.uploadDate || new Date().toISOString().split('T')[0],
          uploadedBy: doc.uploadedBy || performedBy,
          reasonForRevision: 'Initial upload',
          fileName: doc.fileName,
          fileSize: doc.fileSize,
          dataUrl: doc.dataUrl,
        },
      ];
      const newDoc: ERPDocument = {
        ...doc,
        status: doc.status || 'Approved',
        currentVersion: doc.currentVersion || 1,
        versions,
        activityLog: doc.activityLog || [initialActivity],
      };
      updated = [newDoc, ...docs];
      this.addAuditLog('CREATE', 'Document', doc.id, `Uploaded document ${doc.title}`, performedBy, role);
    }
    setItem(KEYS.DOCUMENTS, updated);
    const savedDoc = index >= 0 ? docs[index] : (updated[0] as ERPDocument);
    saveToCloud('documents', savedDoc);
    return doc;
  }

  static addDocumentVersion(
    docId: string,
    newFileName: string,
    newFileSize: string,
    newDataUrl: string | undefined,
    reason: string,
    performedBy: string,
    role: RoleType
  ): ERPDocument | null {
    const docs = getItem<ERPDocument[]>(KEYS.DOCUMENTS, []);
    const index = docs.findIndex((d) => d.id === docId);
    if (index === -1) return null;

    const doc = docs[index];
    const newVerNum = (doc.currentVersion || 1) + 1;
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);

    const newVersion: DocumentVersion = {
      versionNumber: newVerNum,
      uploadDate: new Date().toISOString().split('T')[0],
      uploadedBy: performedBy,
      reasonForRevision: reason || 'Revised version upload',
      fileName: newFileName,
      fileSize: newFileSize,
      dataUrl: newDataUrl,
    };

    const newActivity: DocumentActivity = {
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: now,
      user: performedBy,
      action: 'Replaced',
      details: `Uploaded Version ${newVerNum}: ${reason}`,
    };

    const updatedDoc: ERPDocument = {
      ...doc,
      currentVersion: newVerNum,
      fileName: newFileName,
      fileSize: newFileSize,
      dataUrl: newDataUrl || doc.dataUrl,
      versions: [newVersion, ...(doc.versions || [])],
      activityLog: [newActivity, ...(doc.activityLog || [])],
    };

    docs[index] = updatedDoc;
    setItem(KEYS.DOCUMENTS, docs);
    saveToCloud('documents', updatedDoc);
    this.addAuditLog('UPDATE', 'Document', docId, `Uploaded version ${newVerNum} for ${doc.title}`, performedBy, role);
    return updatedDoc;
  }

  static addDocumentActivity(docId: string, action: DocumentActivity['action'], user: string, details?: string): void {
    const docs = getItem<ERPDocument[]>(KEYS.DOCUMENTS, []);
    const index = docs.findIndex((d) => d.id === docId);
    if (index >= 0) {
      const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
      const newAct: DocumentActivity = {
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: now,
        user,
        action,
        details,
      };
      docs[index].activityLog = [newAct, ...(docs[index].activityLog || [])];
      setItem(KEYS.DOCUMENTS, docs);
      saveToCloud('documents', docs[index]);
    }
  }

  static deleteDocument(id: string, performedBy: string, role: RoleType): void {
    const docs = getItem<ERPDocument[]>(KEYS.DOCUMENTS, []);
    const target = docs.find((d) => d.id === id);
    const updated = docs.filter((d) => d.id !== id);
    setItem(KEYS.DOCUMENTS, updated);
    deleteFromCloud('documents', id);
    if (target) {
      this.addAuditLog('DELETE', 'Document', id, `Deleted document ${target.title}`, performedBy, role);
    }
  }

  // Notifications
  static getNotifications(): ERPNotification[] {
    return getItem(KEYS.NOTIFICATIONS, []);
  }

  static addNotification(notif: ERPNotification): void {
    const notifs = getItem<ERPNotification[]>(KEYS.NOTIFICATIONS, []);
    setItem(KEYS.NOTIFICATIONS, [notif, ...notifs]);
    saveToCloud('notifications', notif);
  }

  static markNotificationRead(id: string): void {
    const notifs = getItem<ERPNotification[]>(KEYS.NOTIFICATIONS, []);
    const updated = notifs.map((n) => (n.id === id ? { ...n, isRead: true } : n));
    setItem(KEYS.NOTIFICATIONS, updated);
    const target = updated.find((n) => n.id === id);
    if (target) saveToCloud('notifications', target);
  }

  static clearAllNotifications(): void {
    setItem(KEYS.NOTIFICATIONS, []);
    clearCollectionInCloud('notifications');
  }

  // Audit Trail
  static getAuditTrail(): AuditTrail[] {
    return getItem(KEYS.AUDIT_TRAIL, []);
  }

  static addAuditLog(
    action: AuditTrail['action'],
    entity: AuditTrail['entity'],
    entityId: string | undefined,
    details: string,
    performedBy: string,
    userRole: RoleType
  ): void {
    const trail = getItem<AuditTrail[]>(KEYS.AUDIT_TRAIL, []);
    const entry: AuditTrail = {
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      action,
      entity,
      entityId,
      details,
      performedBy,
      userRole,
      timestamp: new Date().toISOString(),
      ipAddress: '192.168.1.104', // Corporate subnet
    };
    setItem(KEYS.AUDIT_TRAIL, [entry, ...trail]);
    saveToCloud('auditTrail', entry);
  }

  // Automatic Notification & Threshold Validation
  private static checkBudgetThresholds(departmentId: string, projectId?: string) {
    const depts = this.getDepartments();
    const dept = depts.find((d) => d.id === departmentId);
    if (!dept || dept.allocatedBudget === 0) return;

    const utilization = (dept.totalSpent / dept.allocatedBudget) * 100;

    if (utilization >= 90) {
      this.addNotification({
        id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'threshold_90',
        title: '90% Critical Budget Warning',
        message: `${dept.name} department budget utilization has reached ${utilization.toFixed(1)}% (${dept.totalSpent.toLocaleString()} of ${dept.allocatedBudget.toLocaleString()} KES)!`,
        timestamp: new Date().toISOString(),
        isRead: false,
        severity: 'danger',
      });
    } else if (utilization >= 75) {
      this.addNotification({
        id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'threshold_75',
        title: '75% Budget Warning',
        message: `${dept.name} department budget utilization has reached ${utilization.toFixed(1)}%.`,
        timestamp: new Date().toISOString(),
        isRead: false,
        severity: 'warning',
      });
    }
  }

  // --- QUOTATIONS ---
  static getQuotations(): QuotationRecord[] {
    return getItem<QuotationRecord[]>(KEYS.QUOTATIONS, []);
  }

  static getQuotationById(id: string): QuotationRecord | undefined {
    return this.getQuotations().find((q) => q.id === id);
  }

  static saveQuotation(q: QuotationRecord, performedBy: string, role: RoleType): QuotationRecord {
    const list = this.getQuotations();
    const index = list.findIndex((item) => item.id === q.id);
    const recordToSave: QuotationRecord = index >= 0 ? { ...q, updatedAt: new Date().toISOString() } : q;
    let updated: QuotationRecord[];
    if (index >= 0) {
      list[index] = recordToSave;
      updated = [...list];
      this.addAuditLog('UPDATE', 'Expenditure', recordToSave.id, `Updated quotation ${recordToSave.quotationNumber} (${recordToSave.vendorName})`, performedBy, role);
    } else {
      updated = [recordToSave, ...list];
      this.addAuditLog('CREATE', 'Expenditure', recordToSave.id, `Created quotation ${recordToSave.quotationNumber} (${recordToSave.vendorName})`, performedBy, role);
    }
    setItem(KEYS.QUOTATIONS, updated);
    saveToCloud('quotations', recordToSave);
    return recordToSave;
  }

  static deleteQuotation(id: string, performedBy: string, role: RoleType): void {
    const list = this.getQuotations();
    const target = list.find((q) => q.id === id);
    if (target) {
      this.archiveItem('Quotation', target.id, target.quotationNumber, performedBy, target);
      const updated = list.filter((q) => q.id !== id);
      setItem(KEYS.QUOTATIONS, updated);
      deleteFromCloud('quotations', id);
      this.addAuditLog('DELETE', 'Expenditure', id, `Archived quotation ${target.quotationNumber}`, performedBy, role);
    }
  }

  // --- INVOICES ---
  static getInvoices(): InvoiceRecord[] {
    return getItem<InvoiceRecord[]>(KEYS.INVOICES, []);
  }

  static getInvoiceById(id: string): InvoiceRecord | undefined {
    return this.getInvoices().find((i) => i.id === id);
  }

  static saveInvoice(inv: InvoiceRecord, performedBy: string, role: RoleType): InvoiceRecord {
    const clean = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const norm = (s?: string) => (s || '').trim().toLowerCase();

    // Ensure project linkage is always complete and normalized (inheriting from matching LPO if needed)
    let resolvedProjectId = inv.projectId;
    let resolvedProjectName = inv.projectName;
    let resolvedLpoId = inv.lpoId;

    const lpos = this.getLPOs();
    const matchedLpo = inv.lpoNumber
      ? lpos.find((l) => l.lpoNumber && clean(l.lpoNumber) === clean(inv.lpoNumber))
      : undefined;

    if (matchedLpo) {
      resolvedLpoId = resolvedLpoId || matchedLpo.id;
      if (!resolvedProjectId && matchedLpo.projectId) {
        resolvedProjectId = matchedLpo.projectId;
      }
      if (!resolvedProjectName && matchedLpo.projectName) {
        resolvedProjectName = matchedLpo.projectName;
      }
    }

    const rawProjects = getItem<Project[]>(KEYS.PROJECTS, []);
    if (resolvedProjectId && !resolvedProjectName) {
      const foundProj = rawProjects.find((p) => p.id === resolvedProjectId || norm(p.code) === norm(resolvedProjectId));
      if (foundProj) {
        resolvedProjectId = foundProj.id;
        resolvedProjectName = foundProj.name;
      }
    } else if (!resolvedProjectId && resolvedProjectName) {
      const foundProj = rawProjects.find((p) => norm(p.name) === norm(resolvedProjectName));
      if (foundProj) {
        resolvedProjectId = foundProj.id;
      }
    }

    const list = this.getInvoices();
    const index = list.findIndex((item) => item.id === inv.id);
    const recordToSave: InvoiceRecord = {
      ...inv,
      lpoId: resolvedLpoId,
      projectId: resolvedProjectId,
      projectName: resolvedProjectName,
      ...(index >= 0 ? { updatedAt: new Date().toISOString() } : {}),
    };

    let updated: InvoiceRecord[];
    if (index >= 0) {
      list[index] = recordToSave;
      updated = [...list];
      this.addAuditLog('UPDATE', 'Expenditure', recordToSave.id, `Updated invoice ${recordToSave.invoiceNumber} (${recordToSave.vendorName} - ${recordToSave.totalAmount} KES)`, performedBy, role);
    } else {
      updated = [recordToSave, ...list];
      this.addAuditLog('CREATE', 'Expenditure', recordToSave.id, `Created invoice ${recordToSave.invoiceNumber} (${recordToSave.vendorName} - ${recordToSave.totalAmount} KES)`, performedBy, role);
    }
    setItem(KEYS.INVOICES, updated);
    saveToCloud('invoices', recordToSave);

    // Sync matching LPO invoice status if linked
    if (matchedLpo) {
      try {
        const lpoInvoices = updated.filter(
          (item) =>
            item.paymentStatus !== 'Rejected' &&
            item.lpoNumber &&
            clean(item.lpoNumber) === clean(matchedLpo.lpoNumber)
        );
        const totalInvoicedOnLpo = lpoInvoices.reduce((s, item) => s + Number(item.totalAmount || 0), 0);
        const lpoTotal = Number(matchedLpo.totalLpoValue ?? matchedLpo.totalLpoAmount ?? 0);
        const nextInvoiceStatus: LPORecord['invoiceStatus'] =
          lpoInvoices.length === 0
            ? 'Uninvoiced'
            : lpoTotal > 0 && totalInvoicedOnLpo >= lpoTotal - 1
            ? 'Fully Invoiced'
            : 'Partially Invoiced';

        if (matchedLpo.invoiceStatus !== nextInvoiceStatus || !matchedLpo.relatedInvoice) {
          this.saveLPO(
            {
              ...matchedLpo,
              invoiceStatus: nextInvoiceStatus,
              relatedInvoice: recordToSave.invoiceNumber,
            },
            performedBy,
            role
          );
        }
      } catch (err) {
        console.warn('LPO invoice status sync failed:', err);
      }
    }

    // If invoice is marked Paid, ensure matching expenditure status is synchronized
    if (recordToSave.paymentStatus === 'Paid') {
      try {
        const exps = this.getExpenditures();
        const matched = exps.find((e) => e.invoiceNumber && clean(e.invoiceNumber) === clean(recordToSave.invoiceNumber));
        if (matched && matched.paymentStatus !== 'Paid') {
          this.saveExpenditure({ ...matched, paymentStatus: 'Paid', date: recordToSave.paymentDate || matched.date }, performedBy, role);
        }
      } catch (err) {
        console.warn('Auto expenditure sync for invoice failed:', err);
      }
    }

    return recordToSave;
  }

  static deleteInvoice(id: string, performedBy: string, role: RoleType): void {
    const list = this.getInvoices();
    const target = list.find((i) => i.id === id);
    if (target) {
      this.archiveItem('Invoice', target.id, target.invoiceNumber, performedBy, target);
      const updated = list.filter((i) => i.id !== id);
      setItem(KEYS.INVOICES, updated);
      deleteFromCloud('invoices', id);
      this.addAuditLog('DELETE', 'Expenditure', id, `Archived invoice ${target.invoiceNumber}`, performedBy, role);
    }
  }

  // --- PAYMENT REQUESTS ---
  static getPaymentRequests(): PaymentRequestRecord[] {
    return getItem<PaymentRequestRecord[]>(KEYS.PAYMENT_REQUESTS, []);
  }

  static getPaymentRequestById(id: string): PaymentRequestRecord | undefined {
    return this.getPaymentRequests().find((p) => p.id === id);
  }

  /**
   * Automatically synchronizes payment disbursement with the Expenditure Tracker.
   * Creates or updates an Expenditure record when a payment is marked as 'Paid'.
   */
  static syncPaymentRequestToExpenditure(
    pr: PaymentRequestRecord,
    performedBy: string,
    role: RoleType
  ): Expenditure {
    const exps = this.getExpenditures();
    const clean = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    // Check if an expenditure already exists matching this payment
    let matchedExp = exps.find((e) => {
      if (pr.invoiceNumber && e.invoiceNumber && clean(e.invoiceNumber) === clean(pr.invoiceNumber)) {
        return true;
      }
      if (pr.lpoNumber && e.purchaseOrder && clean(e.purchaseOrder) === clean(pr.lpoNumber)) {
        return true;
      }
      if (e.id === pr.id || (e.description && e.description.includes(pr.requestNumber))) {
        return true;
      }
      return false;
    });

    const paymentDate = pr.paymentDate || pr.requestDate || new Date().toISOString().split('T')[0];
    const paymentMethod = pr.paymentMethod || 'EFT / Direct Bank Transfer';

    if (matchedExp) {
      // Update existing expenditure record
      matchedExp = {
        ...matchedExp,
        paymentStatus: 'Paid',
        paymentMethod: paymentMethod,
        date: paymentDate,
        expenseDate: paymentDate,
      };
      this.saveExpenditure(matchedExp, performedBy, role);
    } else {
      // Create new expenditure entry
      const totalAmt = Number(pr.requestedAmount) || 0;
      const vatRate = (this.getSettings().vatRatePercent ?? 16) / 100;
      const amountBeforeVat = Number((totalAmt / (1 + vatRate)).toFixed(10));
      const vat = Number((totalAmt - amountBeforeVat).toFixed(10));
      const nextExpNum = exps.length + 101;

      matchedExp = {
        id: 'exp-pr-' + pr.id,
        expenseId: `EXP-2026-MCX-${String(nextExpNum).padStart(3, '0')}`,
        date: paymentDate,
        expenseDate: paymentDate,
        legalEntity: (pr.legalEntity === 'Shared' ? 'PACL' : pr.legalEntity as any) || 'PACL',
        quarter: 'Q3',
        departmentId: 'dept-mcx',
        departmentName: 'Marketing & Customer Experience',
        projectId: pr.projectId,
        projectName: pr.projectName,
        supplierId: pr.supplierId || 'sup-mcx-01',
        supplierName: pr.supplierName || pr.vendorName || 'Vendor',
        category: 'Marketing Campaigns',
        description: pr.purpose ? `${pr.purpose} (Payment Ref: ${pr.requestNumber})` : `Disbursement for ${pr.requestNumber}`,
        invoiceNumber: pr.invoiceNumber || '',
        purchaseOrder: pr.lpoNumber || '',
        amount: amountBeforeVat,
        vatAmount: vat,
        totalAmount: totalAmt,
        paymentStatus: 'Paid',
        paymentMethod: paymentMethod,
        createdBy: performedBy,
        createdAt: new Date().toISOString(),
      };

      this.saveExpenditure(matchedExp, performedBy, role);
    }

    // Also update linked Invoice if present
    if (pr.invoiceNumber) {
      const invoices = this.getInvoices();
      const linkedInv = invoices.find(
        (i) => i.id === pr.invoiceId || (i.invoiceNumber && clean(i.invoiceNumber) === clean(pr.invoiceNumber))
      );
      if (linkedInv && linkedInv.paymentStatus !== 'Paid') {
        this.saveInvoice(
          {
            ...linkedInv,
            paymentStatus: 'Paid',
            paymentDate: paymentDate,
          },
          performedBy,
          role
        );
      }
    }

    // Also update linked LPO if present
    if (pr.lpoNumber) {
      const lpos = this.getLPOs();
      const linkedLpo = lpos.find(
        (l) => l.lpoNumber && clean(l.lpoNumber) === clean(pr.lpoNumber)
      );
      if (linkedLpo && linkedLpo.paymentStatus !== 'Fully Paid') {
        this.saveLPO(
          {
            ...linkedLpo,
            paymentStatus: 'Fully Paid',
          },
          performedBy,
          role
        );
      }
    }

    // Add notification
    this.addNotification({
      id: `notif-exp-sync-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'budget_status',
      title: 'Expenditure Tracker Updated',
      message: `Payment ${pr.requestNumber} of KES ${Number(pr.requestedAmount || 0).toLocaleString()} successfully settled and recorded in Expenditure Tracker under ${matchedExp.expenseId}.`,
      timestamp: new Date().toISOString(),
      isRead: false,
      severity: 'info',
    });

    return matchedExp;
  }

  static savePaymentRequest(pr: PaymentRequestRecord, performedBy: string, role: RoleType): PaymentRequestRecord {
    const list = this.getPaymentRequests();
    const index = list.findIndex((item) => item.id === pr.id);
    const recordToSave: PaymentRequestRecord = index >= 0 ? { ...pr, updatedAt: new Date().toISOString() } : pr;
    let updated: PaymentRequestRecord[];
    if (index >= 0) {
      list[index] = recordToSave;
      updated = [...list];
      this.addAuditLog('UPDATE', 'Expenditure', recordToSave.id, `Updated payment request ${recordToSave.requestNumber} (${recordToSave.requestedAmount} KES)`, performedBy, role);
    } else {
      updated = [recordToSave, ...list];
      this.addAuditLog('CREATE', 'Expenditure', recordToSave.id, `Submitted payment request ${recordToSave.requestNumber} (${recordToSave.requestedAmount} KES)`, performedBy, role);
    }
    setItem(KEYS.PAYMENT_REQUESTS, updated);
    saveToCloud('paymentRequests', recordToSave);

    // AUTOMATIC EXPENDITURE TRACKER UPDATE:
    // Once payment status is 'Paid', automatically disburse and update or record in expenditure ledger!
    if (recordToSave.status === 'Paid') {
      try {
        this.syncPaymentRequestToExpenditure(recordToSave, performedBy, role);
      } catch (err) {
        console.warn('Automatic expenditure synchronization failed:', err);
      }
    }

    return recordToSave;
  }

  static deletePaymentRequest(id: string, performedBy: string, role: RoleType): void {
    const list = this.getPaymentRequests();
    const target = list.find((p) => p.id === id);
    if (target) {
      this.archiveItem('PaymentRequest', target.id, target.requestNumber, performedBy, target);
      const updated = list.filter((p) => p.id !== id);
      setItem(KEYS.PAYMENT_REQUESTS, updated);
      deleteFromCloud('paymentRequests', id);
      this.addAuditLog('DELETE', 'Expenditure', id, `Archived payment request ${target.requestNumber}`, performedBy, role);
    }
  }

  // --- USERS & ROLES ---
  static getUsers(): UserRecord[] {
    return getItem<UserRecord[]>(KEYS.USERS, defaultUsers);
  }

  static saveUser(user: UserRecord, performedBy: string, role: RoleType): UserRecord {
    const list = this.getUsers();
    const index = list.findIndex((u) => u.id === user.id);
    let updated: UserRecord[];
    if (index >= 0) {
      list[index] = user;
      updated = [...list];
      this.addAuditLog('UPDATE', 'Department', user.id, `Updated user ${user.name} (${user.role})`, performedBy, role);
    } else {
      updated = [user, ...list];
      this.addAuditLog('CREATE', 'Department', user.id, `Created user ${user.name} (${user.role})`, performedBy, role);
    }
    setItem(KEYS.USERS, updated);
    void saveUserRecordToCloud(user).catch(() => {});
    return user;
  }

  static deleteUser(id: string, performedBy: string, role: RoleType): void {
    const list = this.getUsers();
    const target = list.find((u) => u.id === id);
    const updated = list.filter((u) => u.id !== id);
    setItem(KEYS.USERS, updated);
    void deleteUserFromCloud(id).catch(() => {});
    if (target) {
      this.addAuditLog('DELETE', 'Department', id, `Removed user account ${target.name}`, performedBy, role);
    }
  }

  // --- ARCHIVE & RECOVERY ---
  static getArchiveItems(): DataArchiveItem[] {
    return getItem<DataArchiveItem[]>(KEYS.ARCHIVE, []);
  }

  static archiveItem(
    itemType: DataArchiveItem['itemType'],
    originalId: string,
    itemTitle: string,
    archivedBy: string,
    dataPayload: any,
    reason?: string
  ): void {
    const archives = this.getArchiveItems();
    const newItem: DataArchiveItem = {
      id: `arch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      originalId,
      itemType,
      itemTitle,
      archivedBy,
      archivedAt: new Date().toISOString(),
      reason: reason || 'Archived by user action',
      dataPayload,
    };
    setItem(KEYS.ARCHIVE, [newItem, ...archives]);
    saveToCloud('archive', newItem);
  }

  static restoreArchiveItem(archiveId: string, performedBy: string, role: RoleType): boolean {
    const archives = this.getArchiveItems();
    const item = archives.find((a) => a.id === archiveId);
    if (!item) return false;

    switch (item.itemType) {
      case 'Budget':
        this.saveBudget(item.dataPayload, performedBy, role);
        break;
      case 'Project':
        this.saveProject(item.dataPayload, performedBy, role);
        break;
      case 'LPO':
        this.saveLPO(item.dataPayload, performedBy, role);
        break;
      case 'Invoice':
        this.saveInvoice(item.dataPayload, performedBy, role);
        break;
      case 'Quotation':
        this.saveQuotation(item.dataPayload, performedBy, role);
        break;
      case 'PaymentRequest':
        this.savePaymentRequest(item.dataPayload, performedBy, role);
        break;
      case 'Document':
        this.saveDocument(item.dataPayload, performedBy, role);
        break;
    }

    // Remove from archive
    const updated = archives.filter((a) => a.id !== archiveId);
    setItem(KEYS.ARCHIVE, updated);
    deleteFromCloud('archive', archiveId);
    this.addAuditLog('UPDATE', 'Budget', archiveId, `Restored archived ${item.itemType} "${item.itemTitle}"`, performedBy, role);
    return true;
  }

  static getArchives(): DataArchiveItem[] {
    return this.getArchiveItems().map((a) => ({
      ...a,
      entityType: a.entityType || a.itemType || 'Budget',
      entityId: a.entityId || a.originalId || a.id,
      description: a.description || a.itemTitle || 'Archived record',
      deletedBy: a.deletedBy || a.archivedBy || 'System',
      deletedAt: a.deletedAt || a.archivedAt || new Date().toISOString(),
    }));
  }

  static restoreArchivedItem(archiveId: string, performedBy: string, role: RoleType): boolean {
    return this.restoreArchiveItem(archiveId, performedBy, role);
  }

  static permanentlyPurgeArchive(archiveId: string, performedBy: string, role: RoleType): void {
    this.permanentDeleteArchiveItem(archiveId);
    this.addAuditLog('DELETE', 'Budget', archiveId, `Permanently purged archived record ${archiveId}`, performedBy, role);
  }

  static getAuditLogs(): AuditTrail[] {
    return this.getAuditTrail();
  }

  static permanentDeleteArchiveItem(archiveId: string): void {
    const archives = this.getArchiveItems();
    const updated = archives.filter((a) => a.id !== archiveId);
    setItem(KEYS.ARCHIVE, updated);
    deleteFromCloud('archive', archiveId);
  }

  // --- OFFICIAL USER MANUAL DOCS ---
  static getOfficialManualDocs(): OfficialManualDoc[] {
    return getItem<OfficialManualDoc[]>(KEYS.OFFICIAL_MANUALS, defaultOfficialManuals);
  }

  static saveOfficialManualDoc(doc: OfficialManualDoc, performedBy: string, role: RoleType): void {
    const docs = this.getOfficialManualDocs();
    const index = docs.findIndex((d) => d.id === doc.id);
    let updated: OfficialManualDoc[];
    if (index >= 0) {
      docs[index] = doc;
      updated = [...docs];
    } else {
      updated = [doc, ...docs];
    }
    setItem(KEYS.OFFICIAL_MANUALS, updated);
    saveToCloud('officialManuals', doc);
    this.addAuditLog('UPDATE', 'Document', doc.id, `Uploaded/Updated User Manual document: ${doc.title} (${doc.version})`, performedBy, role);
  }

  static deleteOfficialManualDoc(id: string): void {
    const docs = this.getOfficialManualDocs();
    const updated = docs.filter((d) => d.id !== id);
    setItem(KEYS.OFFICIAL_MANUALS, updated);
    deleteFromCloud('officialManuals', id);
  }

  // --- DATA VALIDATION & SYSTEM INTEGRITY DIAGNOSTICS ---
  static runSystemDiagnostics(): {
    totalChecksRun: number;
    lastRun: string;
    passedCount: number;
    warningCount: number;
    failedCount: number;
    checks: Array<{
      id: string;
      name: string;
      status: 'PASSED' | 'WARNING' | 'FAILED';
      description: string;
      details?: string[];
    }>;
    summary: {
      totalChecks: number;
      passedChecks: number;
      issuesFound: number;
      criticalIssues: number;
      warnings: number;
    };
    issues: Array<{
      id: string;
      category: 'Shared Project' | 'Overspend' | 'Procurement' | 'Entity Integrity' | 'Duplicate';
      severity: 'critical' | 'warning' | 'info';
      title: string;
      details: string;
      recordId?: string;
      recordType?: string;
      actionUrl?: string;
    }>;
  } {
    const budgets = this.getBudgets();
    const projects = this.getProjects();
    const lpos = this.getLPOs();
    const invoices = this.getInvoices();
    const expenditures = this.getExpenditures();
    const departments = this.getDepartments();

    const issues: Array<{
      id: string;
      category: 'Shared Project' | 'Overspend' | 'Procurement' | 'Entity Integrity' | 'Duplicate';
      severity: 'critical' | 'warning' | 'info';
      title: string;
      details: string;
      recordId?: string;
      recordType?: string;
      actionUrl?: string;
    }> = [];

    // 1. Shared Project Ratio (PACL + PGIL percentages == 100%)
    const sharedRatioDetails: string[] = [];
    projects.forEach((proj) => {
      if (proj.projectType === 'Shared Project' || proj.entity === 'Shared') {
        const total = Number(proj.totalBudget ?? proj.budget ?? proj.approvedBudget ?? 0);
        const pacl = Number(proj.paclAllocation || 0);
        const pgil = Number(proj.pgilAllocation || 0);
        if (total > 0 && Math.abs(pacl + pgil - total) > 1) {
          const msg = `Project "${proj.name}": Total (${total.toLocaleString()} KES) != PACL (${pacl.toLocaleString()}) + PGIL (${pgil.toLocaleString()})`;
          sharedRatioDetails.push(msg);
          issues.push({
            id: `diag-shared-${proj.id}`,
            category: 'Shared Project',
            severity: 'critical',
            title: `Shared Allocation Mismatch in Project: ${proj.name}`,
            details: msg,
            recordId: proj.id,
            recordType: 'Project',
          });
        }
      }
    });

    // 2. Unbalanced Splits on Shared Budgets (PACL% + PGIL% == 100)
    const unbalancedSplitDetails: string[] = [];
    budgets.forEach((b) => {
      if (b.legalEntity === 'Shared') {
        const p1 = Number(b.paclSharePercent || 0);
        const p2 = Number(b.pgilSharePercent || 0);
        if ((p1 > 0 || p2 > 0) && Math.abs(p1 + p2 - 100) > 0.5) {
          const msg = `Shared budget ${b.code}: PACL (${p1}%) + PGIL (${p2}%) != 100%`;
          unbalancedSplitDetails.push(msg);
          issues.push({
            id: `diag-split-${b.id}`,
            category: 'Shared Project',
            severity: 'warning',
            title: `Unbalanced Shared Split: ${b.code}`,
            details: msg,
            recordId: b.id,
            recordType: 'Budget',
          });
        }
      }
    });

    // 3. Duplicate LPO Numbers
    const dupLpoDetails: string[] = [];
    const lpoNumbersSeen: Record<string, string> = {};
    lpos.forEach((l) => {
      const key = (l.lpoNumber || '').trim().toUpperCase();
      if (!key) return;
      if (lpoNumbersSeen[key]) {
        const msg = `Duplicate LPO Number "${l.lpoNumber}" detected across procurement entries.`;
        dupLpoDetails.push(msg);
        issues.push({
          id: `diag-dup-lpo-${l.id}`,
          category: 'Duplicate',
          severity: 'critical',
          title: `Duplicate LPO Number Detected: ${l.lpoNumber}`,
          details: msg,
          recordId: l.id,
          recordType: 'LPO',
        });
      } else {
        lpoNumbersSeen[key] = l.id;
      }
    });

    // 4. Duplicate Invoice Numbers per vendor
    const dupInvDetails: string[] = [];
    const invoiceVendorKeys: Record<string, string> = {};
    invoices.forEach((inv) => {
      const key = `${(inv.vendorName || inv.supplierName || '').trim().toLowerCase()}_${(inv.invoiceNumber || '').trim().toUpperCase()}`;
      if (!(inv.invoiceNumber || '').trim()) return;
      if (invoiceVendorKeys[key]) {
        const msg = `Duplicate Invoice "${inv.invoiceNumber}" for vendor ${inv.vendorName || inv.supplierName || 'Unknown'}.`;
        dupInvDetails.push(msg);
        issues.push({
          id: `diag-dup-inv-${inv.id}`,
          category: 'Duplicate',
          severity: 'critical',
          title: `Duplicate Invoice Number: ${inv.invoiceNumber}`,
          details: msg,
          recordId: inv.id,
          recordType: 'Invoice',
        });
      } else {
        invoiceVendorKeys[key] = inv.id;
      }
    });

    // 5. Negative Balances on Budgets or Projects
    const negativeBalDetails: string[] = [];
    budgets.forEach((b) => {
      const allocated = Number(b.revisedBudget ?? b.allocatedAmount ?? 0);
      const bExps = expenditures.filter((e) => e.budgetId === b.id || e.budgetId === b.code);
      const spent = bExps.reduce((s, e) => s + Number(e.totalAmount || 0), 0);
      if (allocated > 0 && spent > allocated) {
        const msg = `Budget line ${b.code} is overspent by ${(spent - allocated).toLocaleString()} KES.`;
        negativeBalDetails.push(msg);
        issues.push({
          id: `diag-overspent-bdg-${b.id}`,
          category: 'Overspend',
          severity: 'critical',
          title: `Negative Budget Balance: ${b.code}`,
          details: msg,
          recordId: b.id,
          recordType: 'Budget',
        });
      }
    });
    projects.forEach((proj) => {
      const budget = Number(proj.totalBudget ?? proj.approvedBudget ?? proj.budget ?? 0);
      const spent = Number(proj.actualSpend ?? proj.spent ?? 0);
      if (budget > 0 && spent > budget) {
        const msg = `Project "${proj.name}" spend (${spent.toLocaleString()} KES) exceeds budget (${budget.toLocaleString()} KES).`;
        negativeBalDetails.push(msg);
        issues.push({
          id: `diag-overspent-proj-${proj.id}`,
          category: 'Overspend',
          severity: 'critical',
          title: `Over Budget Project: ${proj.name}`,
          details: msg,
          recordId: proj.id,
          recordType: 'Project',
        });
      }
    });

    // 6. Over-budget / Unverified LPO-referenced Expenditures
    const overbudgetExpDetails: string[] = [];
    expenditures.forEach((e) => {
      if (e.isBudgetExceeded) {
        overbudgetExpDetails.push(`Expense ${e.expenseId} (${Number(e.totalAmount || 0).toLocaleString()} KES) triggered a budget-exceeded override.`);
      }
    });
    invoices.forEach((inv) => {
      if (inv.lpoNumber) {
        const matchingLpo = lpos.find((l) => (l.lpoNumber || '').trim().toLowerCase() === inv.lpoNumber?.trim().toLowerCase());
        if (!matchingLpo) {
          const msg = `Invoice ${inv.invoiceNumber} references unknown LPO "${inv.lpoNumber}".`;
          overbudgetExpDetails.push(msg);
          issues.push({
            id: `diag-inv-lpo-${inv.id}`,
            category: 'Procurement',
            severity: 'warning',
            title: `Unverified LPO Reference in Invoice ${inv.invoiceNumber}`,
            details: msg,
            recordId: inv.id,
            recordType: 'Invoice',
          });
        }
      }
    });

    // 7. Orphaned Expenditures / Missing Entity or Department links
    const orphanedExpDetails: string[] = [];
    const deptIds = new Set(departments.map((d) => d.id));
    expenditures.forEach((e) => {
      if (!e.legalEntity || (e.legalEntity !== 'PACL' && e.legalEntity !== 'PGIL')) {
        orphanedExpDetails.push(`Expense ${e.expenseId} has invalid legalEntity "${e.legalEntity || 'None'}".`);
      } else if (e.departmentId && deptIds.size > 0 && !deptIds.has(e.departmentId)) {
        orphanedExpDetails.push(`Expense ${e.expenseId} references unmapped department ID "${e.departmentId}".`);
      }
    });
    budgets.forEach((b) => {
      if (!b.legalEntity || (b.legalEntity !== 'PACL' && b.legalEntity !== 'PGIL' && b.legalEntity !== 'Shared')) {
        const msg = `Budget code ${b.code} does not have a valid PACL/PGIL/Shared entity assignment.`;
        orphanedExpDetails.push(msg);
        issues.push({
          id: `diag-entity-bdg-${b.id}`,
          category: 'Entity Integrity',
          severity: 'warning',
          title: `Missing Legal Entity on Budget: ${b.code}`,
          details: msg,
          recordId: b.id,
          recordType: 'Budget',
        });
      }
    });

    const checks: Array<{
      id: string;
      name: string;
      status: 'PASSED' | 'WARNING' | 'FAILED';
      description: string;
      details?: string[];
    }> = [
      {
        id: 'shared_project_ratio',
        name: 'Shared Project Co-Funding Ratio',
        status: sharedRatioDetails.length > 0 ? 'FAILED' : 'PASSED',
        description: 'Verifies PACL + PGIL co-funding allocations reconcile 100% with total shared project budgets.',
        details: sharedRatioDetails.slice(0, 5),
      },
      {
        id: 'unbalanced_splits',
        name: 'Shared Budget Split Equilibrium',
        status: unbalancedSplitDetails.length > 0 ? 'WARNING' : 'PASSED',
        description: 'Ensures all Shared budget lines carry balanced PACL + PGIL split percentages summing to 100%.',
        details: unbalancedSplitDetails.slice(0, 5),
      },
      {
        id: 'duplicate_lpo_numbers',
        name: 'LPO Number Uniqueness Check',
        status: dupLpoDetails.length > 0 ? 'FAILED' : 'PASSED',
        description: 'Scans the LPO register for duplicate purchase order numbers across entities.',
        details: dupLpoDetails.slice(0, 5),
      },
      {
        id: 'duplicate_invoice_numbers',
        name: 'Vendor Invoice Duplicate Guard',
        status: dupInvDetails.length > 0 ? 'FAILED' : 'PASSED',
        description: 'Prevents duplicate supplier billing by validating unique invoice numbers per vendor.',
        details: dupInvDetails.slice(0, 5),
      },
      {
        id: 'negative_balances',
        name: 'Budget & Project Balance Ceiling',
        status: negativeBalDetails.length > 0 ? 'FAILED' : 'PASSED',
        description: 'Identifies budget lines or project envelopes whose cumulative expenditure exceeds approved funding.',
        details: negativeBalDetails.slice(0, 5),
      },
      {
        id: 'overbudget_expenditures',
        name: 'Over-Budget Overrides & 3-Way Match',
        status: overbudgetExpDetails.length > 0 ? 'WARNING' : 'PASSED',
        description: 'Audits expenditure overrides and validates invoice LPO references against active purchase orders.',
        details: overbudgetExpDetails.slice(0, 5),
      },
      {
        id: 'orphaned_expenditures',
        name: 'Entity & Department Ledger Integrity',
        status: orphanedExpDetails.length > 0 ? 'WARNING' : 'PASSED',
        description: 'Confirms every ledger transaction and budget line maps to a valid legal entity and department.',
        details: orphanedExpDetails.slice(0, 5),
      },
    ];

    const passedCount = checks.filter((c) => c.status === 'PASSED').length;
    const warningCount = checks.filter((c) => c.status === 'WARNING').length;
    const failedCount = checks.filter((c) => c.status === 'FAILED').length;
    const criticalCount = issues.filter((i) => i.severity === 'critical').length;
    const issueWarnings = issues.filter((i) => i.severity === 'warning').length;

    return {
      totalChecksRun: checks.length,
      lastRun: new Date().toISOString(),
      passedCount,
      warningCount,
      failedCount,
      checks,
      summary: {
        totalChecks: checks.length,
        passedChecks: passedCount,
        issuesFound: issues.length,
        criticalIssues: criticalCount,
        warnings: issueWarnings,
      },
      issues,
    };
  }

  static getFinancialSummary(entityFilter: LegalEntityFilter = 'All'): {
    totalBudget: number;
    totalSpend: number;
    committedSpend: number;
    remainingBalance: number;
    overallUtilization: number;
    paclBudget: number;
    paclSpend: number;
    pgilBudget: number;
    pgilSpend: number;
  } {
    const budgets = this.getBudgets();
    const expenditures = this.getExpenditures();
    const lpos = this.getLPOs();

    const matchesEntity = (entity?: string) => {
      if (entityFilter === 'All') return true;
      if (entityFilter === 'Shared') return entity === 'Shared';
      return entity === entityFilter;
    };

    const filteredBudgets = budgets.filter((b) =>
      entityFilter === 'All' ? true : b.legalEntity === entityFilter || b.legalEntity === 'Shared'
    );
    const filteredExpenses = expenditures.filter((e) => matchesEntity(e.legalEntity));
    const filteredLpos = lpos.filter((l) => matchesEntity(l.legalEntity));

    const totalBudget = filteredBudgets.reduce((sum, b) => sum + Number(b.revisedBudget ?? b.allocatedAmount ?? 0), 0);
    const totalSpend = filteredExpenses.reduce((sum, e) => sum + Number(e.totalAmount || 0), 0);
    const committedSpend = filteredLpos
      .filter((l) => {
        const pay = l.paymentStatus || '';
        const st = l.lpoStatus || l.status || '';
        return pay !== 'Fully Paid' && pay !== 'Paid' && st !== 'Cancelled';
      })
      .reduce((sum, l) => sum + Number(l.totalLpoValue ?? l.totalLpoAmount ?? 0), 0);
    const remainingBalance = totalBudget - totalSpend - committedSpend;
    const overallUtilization = totalBudget > 0 ? (totalSpend / totalBudget) * 100 : 0;

    const paclBudget = budgets
      .filter((b) => b.legalEntity === 'PACL')
      .reduce((sum, b) => sum + Number(b.revisedBudget ?? b.allocatedAmount ?? 0), 0);
    const paclSpend = expenditures
      .filter((e) => e.legalEntity === 'PACL')
      .reduce((sum, e) => sum + Number(e.totalAmount || 0), 0);

    const pgilBudget = budgets
      .filter((b) => b.legalEntity === 'PGIL')
      .reduce((sum, b) => sum + Number(b.revisedBudget ?? b.allocatedAmount ?? 0), 0);
    const pgilSpend = expenditures
      .filter((e) => e.legalEntity === 'PGIL')
      .reduce((sum, e) => sum + Number(e.totalAmount || 0), 0);

    return {
      totalBudget,
      totalSpend,
      committedSpend,
      remainingBalance,
      overallUtilization,
      paclBudget,
      paclSpend,
      pgilBudget,
      pgilSpend,
    };
  }
}
