import React, { useState, useRef } from 'react';
import { DatabaseService } from '../services/db';
import { ExcelService } from '../services/excelService';
import { PDFService } from '../services/pdfService';
import { BackupService, BackupMetadata } from '../services/backupService';
import { RoleType } from '../types';
import { confirmDialog } from '../services/uiFeedback';

interface ExportCentreViewProps {
  role: RoleType;
  onRefresh: () => void;
}

export const ExportCentreView: React.FC<ExportCentreViewProps> = ({ role, onRefresh }) => {
  const bdgs = DatabaseService.getBudgets();
  const projs = DatabaseService.getProjects();
  const exps = DatabaseService.getExpenditures();
  const lpos = DatabaseService.getLPOs();
  const invoices = DatabaseService.getInvoices();
  const quotations = DatabaseService.getQuotations();
  const payReqs = DatabaseService.getPaymentRequests();
  const audit = DatabaseService.getAuditLogs();
  const settings = DatabaseService.getSettings();

  const [backupNotice, setBackupNotice] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
    details?: string;
  } | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadPCBackup = () => {
    try {
      const result = BackupService.downloadLocalPCBackupFile();
      setBackupNotice({
        type: 'success',
        message: `Physical backup file successfully drawn to PC!`,
        details: `Saved as "${result.filename}" (${result.sizeKB} KB, ${result.totalRecords} enterprise records). Keep this physical file in a secure local or offline drive.`,
      });
      onRefresh();
    } catch (err: any) {
      setBackupNotice({
        type: 'error',
        message: `Backup failed: ${err.message || 'Unknown error'}`,
      });
    }
  };

  const handleDownloadExcelMaster = () => {
    try {
      BackupService.downloadExcelMasterBackupFile();
      setBackupNotice({
        type: 'success',
        message: 'Master Enterprise Excel workbook exported!',
        details: 'Multi-sheet workbook with Budgets, Expenditures, LPOs, Invoices, Payment Requests, Projects, and Suppliers.',
      });
    } catch (err: any) {
      setBackupNotice({
        type: 'error',
        message: `Excel export failed: ${err.message || 'Unknown error'}`,
      });
    }
  };

  const handleRestoreFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const confirmed = await confirmDialog({
      title: 'Restore Backup File',
      message: `Are you sure you want to restore database from "${file.name}"? This will update local enterprise records.`,
      confirmLabel: 'Restore Backup',
      variant: 'warning',
    });
    if (!confirmed) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsRestoring(true);
    try {
      const result = await BackupService.restoreFromLocalPCFile(file, 'Current User', role);
      if (result.success) {
        setBackupNotice({
          type: 'success',
          message: result.message,
          details: `Restored ${result.recordsRestored} records. Refreshing system state...`,
        });
        onRefresh();
      } else {
        setBackupNotice({
          type: 'error',
          message: 'Restore Failed',
          details: result.message,
        });
      }
    } catch (err: any) {
      setBackupNotice({
        type: 'error',
        message: 'Restore Error',
        details: err.message,
      });
    } finally {
      setIsRestoring(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const exportAllJSON = () => {
    handleDownloadPCBackup();
  };

  return (
    <div className="d-flex flex-column gap-4">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 pb-2 border-bottom">
        <div>
          <div className="d-flex align-items-center gap-2">
            <h3 className="fw-bold mb-0 text-dark" style={{ fontFamily: 'Tahoma, sans-serif' }}>
              Export & Reporting Centre
            </h3>
            <span className="badge bg-danger text-white px-2 py-1">Data Exports</span>
          </div>
          <p className="text-muted small mb-0 mt-1">
            Download production-ready spreadsheets, formatted PDF executive briefs, and physical local enterprise backup files for PC storage.
          </p>
        </div>
        <div className="d-flex gap-2">
          <button id="btn-export-full-backup" onClick={handleDownloadPCBackup} className="btn btn-dark btn-sm d-flex align-items-center gap-1 shadow-sm">
            <i className="bi bi-hdd-fill text-warning"></i> Draw Physical Backup to PC (.json)
          </button>
        </div>
      </div>

      {/* Backup Notification Banner */}
      {backupNotice && (
        <div className={`alert ${backupNotice.type === 'success' ? 'alert-success border-success' : backupNotice.type === 'error' ? 'alert-danger border-danger' : 'alert-info border-info'} shadow-sm d-flex justify-content-between align-items-start`}>
          <div className="d-flex gap-2">
            <i className={`bi ${backupNotice.type === 'success' ? 'bi-check-circle-fill text-success' : backupNotice.type === 'error' ? 'bi-exclamation-triangle-fill text-danger' : 'bi-info-circle-fill text-info'} fs-5`}></i>
            <div>
              <strong className="d-block">{backupNotice.message}</strong>
              {backupNotice.details && <span className="small text-muted">{backupNotice.details}</span>}
            </div>
          </div>
          <button type="button" className="btn-close" onClick={() => setBackupNotice(null)}></button>
        </div>
      )}

      {/* Manual Local PC Physical Backup & Disaster Recovery Section */}
      <div className="card card-erp shadow-sm border-2 border-dark bg-white overflow-hidden">
        <div className="card-header bg-dark text-white d-flex justify-content-between align-items-center py-2 px-3">
          <div className="d-flex align-items-center gap-2">
            <i className="bi bi-pc-display-horizontal text-warning fs-5"></i>
            <span className="fw-bold">Manual Physical Backup & Local PC Storage</span>
            <span className="badge bg-warning text-dark text-uppercase ms-2" style={{ fontSize: '0.65rem' }}>Enterprise Disaster Recovery</span>
          </div>
          <span className="badge bg-secondary text-white">Local Drive Safe</span>
        </div>
        <div className="card-body p-4">
          <div className="row g-4 align-items-center">
            <div className="col-12 col-lg-8">
              <h5 className="fw-bold text-dark mb-2">Draw Physical Backup File Directly to PC</h5>
              <p className="text-secondary small mb-3">
                Downloads an encrypted-ready, physical snapshot file (<code>.json</code>) containing all 12 operational modules:
                Budgets, Expenditures, Invoices, LPOs, Quotations, Payment Requests, Audit Trails, and System Settings directly onto your local computer.
                Store this physical file on your PC hard drive, USB storage, or company NAS for full offline air-gapped security.
              </p>
              <div className="d-flex flex-wrap gap-3 align-items-center">
                <button
                  id="btn-draw-pc-backup"
                  onClick={handleDownloadPCBackup}
                  className="btn btn-dark d-flex align-items-center gap-2 px-3 py-2 shadow-sm"
                >
                  <i className="bi bi-download text-warning fs-5"></i>
                  <span className="text-start">
                    <span className="d-block fw-bold" style={{ fontSize: '0.9rem' }}>Download Physical Backup to PC</span>
                    <span className="d-block text-white-50" style={{ fontSize: '0.72rem' }}>Draws .JSON data file to your Downloads folder</span>
                  </span>
                </button>

                <button
                  id="btn-draw-excel-backup"
                  onClick={handleDownloadExcelMaster}
                  className="btn btn-outline-success d-flex align-items-center gap-2 px-3 py-2"
                >
                  <i className="bi bi-file-earmark-excel fs-5 text-success"></i>
                  <span className="text-start">
                    <span className="d-block fw-bold" style={{ fontSize: '0.9rem' }}>Master Excel Workbook</span>
                    <span className="d-block text-muted" style={{ fontSize: '0.72rem' }}>Multi-sheet spreadsheet format (.xlsx)</span>
                  </span>
                </button>

                <div className="d-inline-block">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleRestoreFileSelected}
                    accept=".json"
                    style={{ display: 'none' }}
                  />
                  <button
                    id="btn-restore-pc-backup"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isRestoring}
                    className="btn btn-outline-secondary d-flex align-items-center gap-2 px-3 py-2"
                  >
                    <i className="bi bi-cloud-arrow-up fs-5"></i>
                    <span className="text-start">
                      <span className="d-block fw-bold" style={{ fontSize: '0.9rem' }}>Restore from PC Backup</span>
                      <span className="d-block text-muted" style={{ fontSize: '0.72rem' }}>Upload previously drawn .JSON file</span>
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <div className="col-12 col-lg-4">
              <div className="p-3 bg-light rounded border">
                <div className="d-flex justify-content-between align-items-center mb-2 pb-1 border-bottom">
                  <span className="text-muted small fw-semibold">Live Snapshot Summary</span>
                  <span className="badge bg-success">Ready</span>
                </div>
                <div className="row g-2 text-center">
                  <div className="col-4">
                    <div className="bg-white p-2 rounded border">
                      <div className="fw-bold fs-6 text-dark">{bdgs.length}</div>
                      <div className="text-muted" style={{ fontSize: '0.65rem' }}>Budgets</div>
                    </div>
                  </div>
                  <div className="col-4">
                    <div className="bg-white p-2 rounded border">
                      <div className="fw-bold fs-6 text-dark">{exps.length}</div>
                      <div className="text-muted" style={{ fontSize: '0.65rem' }}>Expenses</div>
                    </div>
                  </div>
                  <div className="col-4">
                    <div className="bg-white p-2 rounded border">
                      <div className="fw-bold fs-6 text-dark">{lpos.length}</div>
                      <div className="text-muted" style={{ fontSize: '0.65rem' }}>LPOs</div>
                    </div>
                  </div>
                  <div className="col-4">
                    <div className="bg-white p-2 rounded border">
                      <div className="fw-bold fs-6 text-dark">{invoices.length}</div>
                      <div className="text-muted" style={{ fontSize: '0.65rem' }}>Invoices</div>
                    </div>
                  </div>
                  <div className="col-4">
                    <div className="bg-white p-2 rounded border">
                      <div className="fw-bold fs-6 text-dark">{payReqs.length}</div>
                      <div className="text-muted" style={{ fontSize: '0.65rem' }}>Pay Reqs</div>
                    </div>
                  </div>
                  <div className="col-4">
                    <div className="bg-white p-2 rounded border">
                      <div className="fw-bold fs-6 text-dark">{audit.length}</div>
                      <div className="text-muted" style={{ fontSize: '0.65rem' }}>Audit Logs</div>
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-center text-muted" style={{ fontSize: '0.7rem' }}>
                  <i className="bi bi-shield-check text-success me-1"></i>
                  Guaranteed air-gapped restore support
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of export cards */}
      <div className="row g-3">
        {/* Budgets */}
        <div className="col-12 col-md-6 col-xl-4">
          <div className="card card-erp p-4 h-100 shadow-sm border-start border-4 border-dark">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h6 className="fw-bold mb-0 text-dark">Annual Budgets Register</h6>
              <span className="badge bg-light text-dark border">{bdgs.length} Lines</span>
            </div>
            <p className="text-muted small mb-3">
              Approved and revised budget lines for PACL and PGIL with department codes.
            </p>
            <div className="d-flex gap-2 mt-auto">
              <button
                id="btn-exp-bdg-excel"
                onClick={() => ExcelService.exportBudgetsToExcel(bdgs as any)}
                className="btn btn-outline-success btn-sm w-50"
              >
                <i className="bi bi-file-earmark-excel me-1"></i> Excel (.xlsx)
              </button>
              <button
                id="btn-exp-bdg-pdf"
                onClick={() => {
                  const cols = ['Code', 'FY', 'Entity', 'Department', 'Category', 'Approved Budget'];
                  const rows = bdgs.map((b) => [b.code, b.financialYear, b.legalEntity, b.departmentName, b.category, `${Number(b.allocatedAmount || 0).toLocaleString()} KES`]);
                  PDFService.generateReportPDF('ANNUAL BUDGETS LEDGER', 'Pioneer Assurance & General', cols, rows, settings);
                }}
                className="btn btn-outline-danger btn-sm w-50"
              >
                <i className="bi bi-file-earmark-pdf me-1"></i> PDF Document
              </button>
            </div>
          </div>
        </div>

        {/* Projects */}
        <div className="col-12 col-md-6 col-xl-4">
          <div className="card card-erp p-4 h-100 shadow-sm border-start border-4 border-danger">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h6 className="fw-bold mb-0 text-dark">Projects & Campaigns</h6>
              <span className="badge bg-light text-dark border">{projs.length} Initiatives</span>
            </div>
            <p className="text-muted small mb-3">
              Strategic projects, timeline deliverables, status, and campaign allocations.
            </p>
            <div className="d-flex gap-2 mt-auto">
              <button
                id="btn-exp-proj-excel"
                onClick={() => ExcelService.exportProjectsToExcel(projs)}
                className="btn btn-outline-success btn-sm w-50"
              >
                <i className="bi bi-file-earmark-excel me-1"></i> Excel (.xlsx)
              </button>
              <button
                id="btn-exp-proj-pdf"
                onClick={() => {
                  const cols = ['Code', 'Project Name', 'Entity', 'Budget', 'Actual', 'Status'];
                  const rows = projs.map((p) => [p.code, p.name, p.entity || 'PACL', `${Number(p.totalBudget || p.approvedBudget || p.budget || 0).toLocaleString()} KES`, `${Number(p.actualSpend || p.spent || 0).toLocaleString()} KES`, p.status]);
                  PDFService.generateReportPDF('PROJECTS PORTFOLIO REPORT', 'Marketing & CX Initiatives', cols, rows, settings);
                }}
                className="btn btn-outline-danger btn-sm w-50"
              >
                <i className="bi bi-file-earmark-pdf me-1"></i> PDF Document
              </button>
            </div>
          </div>
        </div>

        {/* Shared Projects */}
        <div className="col-12 col-md-6 col-xl-4">
          <div className="card card-erp p-4 h-100 shadow-sm border-start border-4 border-primary">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h6 className="fw-bold mb-0 text-dark">Shared Projects Split</h6>
              <span className="badge bg-light text-dark border">
                {projs.filter((p) => p.projectType === 'Shared Project' || p.entity === 'Shared').length} Shared
              </span>
            </div>
            <p className="text-muted small mb-3">
              PACL vs PGIL co-funding splits, verification balance, and spend per entity.
            </p>
            <div className="d-flex gap-2 mt-auto">
              <button
                id="btn-exp-shared-excel"
                onClick={() => {
                  const shared = projs.filter((p) => p.projectType === 'Shared Project' || p.entity === 'Shared').map((p) => ({
                    'Code': p.code,
                    'Name': p.name,
                    'Total Budget': p.totalBudget || p.approvedBudget || 0,
                    'PACL Share': p.paclAllocation || 0,
                    'PGIL Share': p.pgilAllocation || 0,
                    'Status': p.status,
                  }));
                  ExcelService.exportCustomDataset(shared, 'Shared_Projects_Allocation');
                }}
                className="btn btn-outline-success btn-sm w-50"
              >
                <i className="bi bi-file-earmark-excel me-1"></i> Excel (.xlsx)
              </button>
              <button
                id="btn-exp-shared-pdf"
                onClick={() => {
                  const shared = projs.filter((p) => p.projectType === 'Shared Project' || p.entity === 'Shared');
                  const cols = ['Code', 'Name', 'Total Budget', 'PACL Share', 'PGIL Share', 'Status'];
                  const rows = shared.map((p) => [p.code, p.name, `${Number(p.totalBudget || p.approvedBudget || p.budget || 0).toLocaleString()} KES`, `${Number(p.paclAllocation || 0).toLocaleString()} KES`, `${Number(p.pgilAllocation || 0).toLocaleString()} KES`, p.status]);
                  PDFService.generateReportPDF('SHARED PROJECTS ALLOCATION', 'PACL & PGIL Co-Funded', cols, rows, settings);
                }}
                className="btn btn-outline-danger btn-sm w-50"
              >
                <i className="bi bi-file-earmark-pdf me-1"></i> PDF Document
              </button>
            </div>
          </div>
        </div>

        {/* LPOs */}
        <div className="col-12 col-md-6 col-xl-4">
          <div className="card card-erp p-4 h-100 shadow-sm border-start border-4 border-warning">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h6 className="fw-bold mb-0 text-dark">Local Purchase Orders (LPOs)</h6>
              <span className="badge bg-light text-dark border">{lpos.length} LPOs</span>
            </div>
            <p className="text-muted small mb-3">
              Purchase orders, vendor information, committed amounts, and delivery terms.
            </p>
            <div className="d-flex gap-2 mt-auto">
              <button
                id="btn-exp-lpo-excel"
                onClick={() => {
                  const data = lpos.map((l) => ({
                    'LPO No': l.lpoNumber,
                    'Date': l.lpoDate,
                    'Entity': l.legalEntity,
                    'Vendor': l.supplierName,
                    'Total (KES)': Number(l.totalLpoValue ?? l.totalLpoAmount ?? 0),
                    'Status': l.lpoStatus || l.status || 'Issued',
                  }));
                  ExcelService.exportCustomDataset(data, 'LPO_Registry');
                }}
                className="btn btn-outline-success btn-sm w-50"
              >
                <i className="bi bi-file-earmark-excel me-1"></i> Excel (.xlsx)
              </button>
              <button
                id="btn-exp-lpo-pdf"
                onClick={() => {
                  const cols = ['LPO No', 'Date', 'Entity', 'Vendor', 'Total Amount', 'Status'];
                  const rows = lpos.map((l) => [l.lpoNumber, l.lpoDate, l.legalEntity, l.supplierName, `${Number(l.totalLpoValue ?? l.totalLpoAmount ?? 0).toLocaleString()} KES`, l.lpoStatus || l.status || 'Issued']);
                  PDFService.generateReportPDF('LOCAL PURCHASE ORDERS', 'Procurement Registry', cols, rows, settings);
                }}
                className="btn btn-outline-danger btn-sm w-50"
              >
                <i className="bi bi-file-earmark-pdf me-1"></i> PDF Document
              </button>
            </div>
          </div>
        </div>

        {/* Invoices */}
        <div className="col-12 col-md-6 col-xl-4">
          <div className="card card-erp p-4 h-100 shadow-sm border-start border-4 border-info">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h6 className="fw-bold mb-0 text-dark">Invoices & Accounts Payable</h6>
              <span className="badge bg-light text-dark border">{invoices.length} Invoices</span>
            </div>
            <p className="text-muted small mb-3">
              Vendor tax invoices, VAT amounts, payment settlements, and LPO links.
            </p>
            <div className="d-flex gap-2 mt-auto">
              <button
                id="btn-exp-inv-excel"
                onClick={() => {
                  const data = invoices.map((i) => ({
                    'Invoice No': i.invoiceNumber,
                    'Vendor': i.supplierName,
                    'LPO': i.lpoNumber || 'N/A',
                    'Entity': i.legalEntity,
                    'Amount': i.totalAmount,
                    'Status': i.paymentStatus,
                  }));
                  ExcelService.exportCustomDataset(data, 'Invoices_Register');
                }}
                className="btn btn-outline-success btn-sm w-50"
              >
                <i className="bi bi-file-earmark-excel me-1"></i> Excel (.xlsx)
              </button>
              <button
                id="btn-exp-inv-pdf"
                onClick={() => {
                  const cols = ['Invoice No', 'Vendor', 'LPO No', 'Entity', 'Total Amount', 'Status'];
                  const rows = invoices.map((i) => [i.invoiceNumber, i.supplierName, i.lpoNumber || 'N/A', i.legalEntity, `${Number(i.totalAmount || 0).toLocaleString()} KES`, i.paymentStatus]);
                  PDFService.generateReportPDF('INVOICES & ACCOUNTS PAYABLE', 'Finance Registry', cols, rows, settings);
                }}
                className="btn btn-outline-danger btn-sm w-50"
              >
                <i className="bi bi-file-earmark-pdf me-1"></i> PDF Document
              </button>
            </div>
          </div>
        </div>

        {/* Expenditures */}
        <div className="col-12 col-md-6 col-xl-4">
          <div className="card card-erp p-4 h-100 shadow-sm border-start border-4 border-success">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h6 className="fw-bold mb-0 text-dark">General Expense Ledger</h6>
              <span className="badge bg-light text-dark border">{exps.length} Entries</span>
            </div>
            <p className="text-muted small mb-3">
              Complete transaction-level expense postings, payment dates, and categories.
            </p>
            <div className="d-flex gap-2 mt-auto">
              <button
                id="btn-exp-exp-excel"
                onClick={() => ExcelService.exportExpendituresToExcel(exps)}
                className="btn btn-outline-success btn-sm w-50"
              >
                <i className="bi bi-file-earmark-excel me-1"></i> Excel (.xlsx)
              </button>
              <button
                id="btn-exp-exp-pdf"
                onClick={() => {
                  const cols = ['Date', 'Entity', 'Supplier', 'Project', 'Amount', 'Payment Method'];
                  const rows = exps.map((e) => [e.date || e.expenseDate || '', e.legalEntity, e.supplierName, e.projectName || 'General', `${Number(e.totalAmount || 0).toLocaleString()} KES`, e.paymentMethod || 'EFT']);
                  PDFService.generateReportPDF('EXPENDITURE TRANSACTION LEDGER', 'Pioneer Assurance & General', cols, rows, settings);
                }}
                className="btn btn-outline-danger btn-sm w-50"
              >
                <i className="bi bi-file-earmark-pdf me-1"></i> PDF Document
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
