import { DatabaseService } from './db';
import { ExcelService } from './excelService';

export interface BackupMetadata {
  companyName: string;
  kraPin: string;
  financialYear: string;
  currency: string;
  backupTimestamp: string;
  version: string;
  recordCounts: {
    budgets: number;
    projects: number;
    expenditures: number;
    lpos: number;
    invoices: number;
    quotations: number;
    paymentRequests: number;
    suppliers: number;
    departments: number;
    documents: number;
    users: number;
    auditTrail: number;
  };
  totalRecords: number;
}

export class BackupService {
  /**
   * Generates metadata about the current database state for backup verification
   */
  static getBackupMetadata(): BackupMetadata {
    const settings = DatabaseService.getSettings();
    const bdgs = DatabaseService.getBudgets();
    const projs = DatabaseService.getProjects();
    const exps = DatabaseService.getExpenditures();
    const lpos = DatabaseService.getLPOs();
    const invoices = DatabaseService.getInvoices();
    const quotations = DatabaseService.getQuotations();
    const payReqs = DatabaseService.getPaymentRequests();
    const suppliers = DatabaseService.getSuppliers();
    const departments = DatabaseService.getDepartments();
    const documents = DatabaseService.getDocuments();
    const users = DatabaseService.getUsers();
    const audit = DatabaseService.getAuditLogs();

    const counts = {
      budgets: bdgs.length,
      projects: projs.length,
      expenditures: exps.length,
      lpos: lpos.length,
      invoices: invoices.length,
      quotations: quotations.length,
      paymentRequests: payReqs.length,
      suppliers: suppliers.length,
      departments: departments.length,
      documents: documents.length,
      users: users.length,
      auditTrail: audit.length,
    };

    const totalRecords = Object.values(counts).reduce((a, b) => a + b, 0);

    return {
      companyName: settings.companyName,
      kraPin: settings.kraPin,
      financialYear: settings.financialYear,
      currency: settings.currencySymbol,
      backupTimestamp: new Date().toISOString(),
      version: '2.0.0-enterprise',
      recordCounts: counts,
      totalRecords,
    };
  }

  /**
   * Draws a physical JSON backup file directly onto the user's PC filesystem.
   * This includes all business entities, audit trails, and configuration settings.
   */
  static downloadLocalPCBackupFile(): { filename: string; sizeKB: number; totalRecords: number } {
    const metadata = this.getBackupMetadata();
    const fullBackupPayload = {
      _meta: metadata,
      settings: DatabaseService.getSettings(),
      budgets: DatabaseService.getBudgets(),
      projects: DatabaseService.getProjects(),
      expenditures: DatabaseService.getExpenditures(),
      lpos: DatabaseService.getLPOs(),
      invoices: DatabaseService.getInvoices(),
      quotations: DatabaseService.getQuotations(),
      paymentRequests: DatabaseService.getPaymentRequests(),
      suppliers: DatabaseService.getSuppliers(),
      departments: DatabaseService.getDepartments(),
      documents: DatabaseService.getDocuments(),
      users: DatabaseService.getUsers(),
      auditTrail: DatabaseService.getAuditLogs(),
      notifications: DatabaseService.getNotifications(),
    };

    const jsonString = JSON.stringify(fullBackupPayload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const sizeKB = Math.round((blob.size / 1024) * 10) / 10;

    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `PIONEER_ERP_LOCAL_BACKUP_${dateStr}.json`;

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);

    // Record in audit log
    DatabaseService.addAuditLog(
      'EXPORT',
      'Settings',
      'backup-local-pc',
      `Manual physical backup file drawn to local PC (${sizeKB} KB, ${metadata.totalRecords} records). Filename: ${filename}`,
      'System User',
      'Administrator'
    );

    return { filename, sizeKB, totalRecords: metadata.totalRecords };
  }

  /**
   * Draws a complete multi-sheet Excel spreadsheet backup workbook onto the user's PC.
   */
  static downloadExcelMasterBackupFile(): void {
    const budgets = DatabaseService.getBudgets();
    const expenditures = DatabaseService.getExpenditures();
    const lpos = DatabaseService.getLPOs();
    const invoices = DatabaseService.getInvoices();
    const paymentRequests = DatabaseService.getPaymentRequests();
    const projects = DatabaseService.getProjects();
    const suppliers = DatabaseService.getSuppliers();

    ExcelService.exportMasterBackupWorkbook({
      budgets,
      expenditures,
      lpos,
      invoices,
      paymentRequests,
      projects,
      suppliers,
    });
  }

  /**
   * Restores database state from a local PC backup file (.json) uploaded by the user.
   */
  static async restoreFromLocalPCFile(
    file: File,
    performedBy: string,
    role: any
  ): Promise<{ success: boolean; message: string; recordsRestored: number }> {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid file format: Backup payload is not a valid JSON object.');
      }

      let count = 0;

      // Restore each collection if present using the canonical erp_budget_* storage keys
      if (Array.isArray(parsed.budgets)) {
        localStorage.setItem('erp_budget_budgets', JSON.stringify(parsed.budgets));
        count += parsed.budgets.length;
      }
      if (Array.isArray(parsed.projects)) {
        localStorage.setItem('erp_budget_projects', JSON.stringify(parsed.projects));
        count += parsed.projects.length;
      }
      if (Array.isArray(parsed.expenditures)) {
        localStorage.setItem('erp_budget_expenditures', JSON.stringify(parsed.expenditures));
        count += parsed.expenditures.length;
      }
      if (Array.isArray(parsed.lpos)) {
        localStorage.setItem('erp_budget_lpos', JSON.stringify(parsed.lpos));
        count += parsed.lpos.length;
      }
      if (Array.isArray(parsed.invoices)) {
        localStorage.setItem('erp_budget_invoices', JSON.stringify(parsed.invoices));
        count += parsed.invoices.length;
      }
      if (Array.isArray(parsed.quotations)) {
        localStorage.setItem('erp_budget_quotations', JSON.stringify(parsed.quotations));
        count += parsed.quotations.length;
      }
      if (Array.isArray(parsed.paymentRequests)) {
        localStorage.setItem('erp_budget_payment_requests', JSON.stringify(parsed.paymentRequests));
        count += parsed.paymentRequests.length;
      }
      if (Array.isArray(parsed.suppliers)) {
        localStorage.setItem('erp_budget_suppliers', JSON.stringify(parsed.suppliers));
        count += parsed.suppliers.length;
      }
      if (Array.isArray(parsed.departments)) {
        localStorage.setItem('erp_budget_departments', JSON.stringify(parsed.departments));
        count += parsed.departments.length;
      }
      if (Array.isArray(parsed.documents)) {
        localStorage.setItem('erp_budget_documents', JSON.stringify(parsed.documents));
        count += parsed.documents.length;
      }
      if (Array.isArray(parsed.users)) {
        localStorage.setItem('erp_budget_users', JSON.stringify(parsed.users));
        count += parsed.users.length;
      }
      if (Array.isArray(parsed.auditTrail)) {
        localStorage.setItem('erp_budget_audit_trail', JSON.stringify(parsed.auditTrail));
        count += parsed.auditTrail.length;
      }
      if (Array.isArray(parsed.notifications)) {
        localStorage.setItem('erp_budget_notifications', JSON.stringify(parsed.notifications));
        count += parsed.notifications.length;
      }
      if (Array.isArray(parsed.archive)) {
        localStorage.setItem('erp_budget_archive', JSON.stringify(parsed.archive));
        count += parsed.archive.length;
      }
      if (Array.isArray(parsed.importHistory)) {
        localStorage.setItem('erp_budget_import_history', JSON.stringify(parsed.importHistory));
        count += parsed.importHistory.length;
      }
      if (Array.isArray(parsed.officialManuals)) {
        localStorage.setItem('erp_budget_official_manuals', JSON.stringify(parsed.officialManuals));
        count += parsed.officialManuals.length;
      }
      if (parsed.settings && typeof parsed.settings === 'object') {
        localStorage.setItem('erp_budget_settings', JSON.stringify(parsed.settings));
      }

      // Push restored local data up to Firestore if signed in & verified (do NOT pull old cloud data over restored backup!)
      await DatabaseService.pushAllLocalToCloud();

      DatabaseService.addAuditLog(
        'CREATE',
        'Settings',
        'restore-local-pc',
        `Successfully restored ${count} records from local backup file: ${file.name}`,
        performedBy,
        role
      );

      return {
        success: true,
        message: `Successfully restored ${count} financial & procurement records from local PC backup file!`,
        recordsRestored: count,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Backup restoration failed: ${err.message || 'Unknown error parsing backup file.'}`,
        recordsRestored: 0,
      };
    }
  }
}
