import * as XLSX from 'xlsx';
import { Budget, Expenditure, Project, ExcelImportRow } from '../types';

export class ExcelService {
  /**
   * Reads an uploaded Excel/CSV File and returns list of sheet names & raw JSON data per sheet.
   */
  static parseWorkbook(file: File): Promise<{ sheetNames: string[]; sheetsData: Record<string, any[]> }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetNames = workbook.SheetNames;
          const sheetsData: Record<string, any[]> = {};

          sheetNames.forEach((sheetName) => {
            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
            sheetsData[sheetName] = json;
          });

          resolve({ sheetNames, sheetsData });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Maps raw JSON records into strongly typed ExcelImportRow objects with data validation
   */
  static processBudgetImportSheet(
    rawRows: any[],
    mapping: {
      budgetCodeKey: string;
      financialYearKey: string;
      departmentKey: string;
      projectKey: string;
      categoryKey: string;
      allocatedAmountKey: string;
      descriptionKey: string;
    },
    existingBudgets: Budget[]
  ): ExcelImportRow[] {
    const existingCodes = new Set(existingBudgets.map((b) => b.code.toUpperCase()));
    const seenImportCodes = new Set<string>();

    return rawRows.map((row, idx) => {
      const code = String(row[mapping.budgetCodeKey] || '').trim();
      const fy = String(row[mapping.financialYearKey] || '2026').trim();
      const dept = String(row[mapping.departmentKey] || '').trim();
      const proj = String(row[mapping.projectKey] || '').trim();
      const cat = String(row[mapping.categoryKey] || 'General').trim();
      const amountRaw = row[mapping.allocatedAmountKey];
      const amount = Number(String(amountRaw).replace(/[^0-9.-]+/g, '')) || 0;
      const desc = String(row[mapping.descriptionKey] || '').trim();

      const errors: string[] = [];

      if (!code) errors.push('Missing Budget Code');
      if (!dept) errors.push('Missing Department Name');
      if (amount <= 0) errors.push('Allocated Amount must be greater than 0');

      if (code && existingCodes.has(code.toUpperCase())) {
        errors.push(`Budget Code '${code}' already exists in system`);
      }

      if (code && seenImportCodes.has(code.toUpperCase())) {
        errors.push(`Duplicate Budget Code '${code}' in import file`);
      } else if (code) {
        seenImportCodes.add(code.toUpperCase());
      }

      return {
        budgetCode: code || `AUTO-BDG-${idx + 1}`,
        financialYear: fy,
        department: dept,
        project: proj,
        category: cat,
        allocatedAmount: amount,
        description: desc,
        isValid: errors.length === 0,
        errorMessages: errors,
      };
    });
  }

  /**
   * Export Budgets array to downloadable Excel workbook
   */
  static exportBudgetsToExcel(budgets: Budget[], filename = 'Corporate_Budgets_Export.xlsx'): void {
    const data = budgets.map((b) => ({
      'Budget Code': b.code,
      'Financial Year': b.financialYear,
      'Legal Entity': b.legalEntity,
      Department: b.departmentName,
      Project: b.projectName || 'N/A',
      Category: b.category,
      'Allocated Amount (KES)': b.allocatedAmount,
      'Revised Amount (KES)': b.revisedBudget || b.allocatedAmount,
      Status: b.status,
      Description: b.description,
      'Created By': b.createdBy,
      'Created Date': b.createdDate,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Budgets');
    XLSX.writeFile(workbook, filename);
  }

  /**
   * Export Projects array to downloadable Excel workbook
   */
  static exportProjectsToExcel(projects: Project[], filename = 'Corporate_Projects_Export.xlsx'): void {
    const data = projects.map((p) => ({
      'Project Code': p.code,
      'Project Name': p.name,
      'Project Type': p.projectType,
      'Legal Entity': p.entity || (p.projectType === 'Shared Project' ? 'Shared' : p.paclApplicable ? 'PACL' : 'PGIL'),
      'Department': p.departmentName,
      'Approved Budget (KES)': p.approvedBudget || p.budget || p.totalBudget || 0,
      'PACL Allocation (KES)': p.paclAllocation || 0,
      'PGIL Allocation (KES)': p.pgilAllocation || 0,
      'Actual Spend (KES)': p.actualSpend || p.spent || 0,
      'Status': p.status,
      'Start Date': p.startDate,
      'End Date': p.endDate,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Projects');
    XLSX.writeFile(workbook, filename);
  }

  /**
   * Export Expenditures array to downloadable Excel workbook
   */
  static exportExpendituresToExcel(expenditures: Expenditure[], filename = 'Corporate_Expenditures_Export.xlsx'): void {
    const data = expenditures.map((e) => ({
      'Expense ID': e.expenseId,
      Date: e.date || e.expenseDate,
      'Legal Entity': e.legalEntity,
      Department: e.departmentName,
      Project: e.projectName || 'N/A',
      Supplier: e.supplierName,
      Category: e.category,
      Description: e.description,
      'Invoice No': e.invoiceNumber,
      'PO Number': e.purchaseOrder,
      'Base Amount (KES)': e.amount,
      'VAT Amount (16%)': e.vatAmount,
      'Total Amount (KES)': e.totalAmount,
      'Payment Status': e.paymentStatus,
      'Budget Exceeded Override': e.isBudgetExceeded ? 'YES' : 'NO',
      'Authorized By': e.authorizedBy || 'N/A',
      Remarks: e.remarks || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Expenditures');
    XLSX.writeFile(workbook, filename);
  }

  /**
   * Export Custom Dataset to Excel workbook
   */
  static exportCustomDataset(data: any[], filename = 'Data_Export.xlsx'): void {
    const name = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Export');
    XLSX.writeFile(workbook, name);
  }

  /**
   * Export Custom Report Data to Excel workbook
   */
  static exportReportToExcel(reportTitle: string, reportData: any[], filename = 'Financial_Report.xlsx'): void {
    const worksheet = XLSX.utils.json_to_sheet(reportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, reportTitle.substring(0, 31));
    XLSX.writeFile(workbook, filename);
  }

  /**
   * Export complete 7-sheet master backup workbook to Excel
   */
  static exportMasterBackupWorkbook(datasets: {
    budgets: any[];
    expenditures: any[];
    lpos: any[];
    invoices: any[];
    paymentRequests: any[];
    projects: any[];
    suppliers: any[];
  }): void {
    const workbook = XLSX.utils.book_new();
    const safeRows = (rows: any[], emptyNote: string) =>
      rows && rows.length > 0 ? rows : [{ Status: emptyNote }];

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(
        safeRows(
          datasets.budgets.map((b) => ({
            Code: b.code,
            'Financial Year': b.financialYear,
            Entity: b.legalEntity,
            Department: b.departmentName,
            Category: b.category,
            'Allocated (KES)': Number(b.allocatedAmount || 0),
            'Revised (KES)': Number(b.revisedBudget ?? b.allocatedAmount ?? 0),
            Status: b.status,
            Description: b.description || '',
          })),
          'No budget records'
        )
      ),
      'Budgets'
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(
        safeRows(
          datasets.expenditures.map((e) => ({
            'Expense ID': e.expenseId,
            Date: e.date || e.expenseDate || '',
            Entity: e.legalEntity,
            Department: e.departmentName,
            Supplier: e.supplierName,
            Category: e.category,
            'Invoice No': e.invoiceNumber || '',
            'PO No': e.purchaseOrder || '',
            'Base Amount (KES)': Number(e.amount || 0),
            'VAT (KES)': Number(e.vatAmount || 0),
            'Total (KES)': Number(e.totalAmount || 0),
            Status: e.paymentStatus,
            Description: e.description || '',
          })),
          'No expenditure records'
        )
      ),
      'Expenditures'
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(
        safeRows(
          datasets.lpos.map((l) => ({
            'LPO Number': l.lpoNumber,
            Date: l.lpoDate,
            Entity: l.legalEntity,
            Supplier: l.supplierName,
            'Net Amount (KES)': Number(l.lpoAmount ?? l.amountBeforeVat ?? 0),
            'VAT (KES)': Number(l.vatAmount || 0),
            'Total Value (KES)': Number(l.totalLpoValue ?? l.totalLpoAmount ?? 0),
            'LPO Status': l.lpoStatus || l.status || '',
            'Payment Status': l.paymentStatus || '',
            Description: l.description || '',
          })),
          'No LPO records'
        )
      ),
      'LPOs'
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(
        safeRows(
          datasets.invoices.map((i) => ({
            'Invoice No': i.invoiceNumber,
            Date: i.invoiceDate,
            Vendor: i.vendorName || i.supplierName || '',
            Entity: i.legalEntity,
            'LPO Ref': i.lpoNumber || '',
            'Total (KES)': Number(i.totalAmount || 0),
            'Payment Status': i.paymentStatus || '',
            Description: i.description || '',
          })),
          'No invoice records'
        )
      ),
      'Invoices'
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(
        safeRows(
          datasets.paymentRequests.map((p) => ({
            'Request No': p.requestNumber,
            Date: p.requestDate || '',
            Payee: p.vendorName || p.supplierName || p.requesterName || '',
            Entity: p.legalEntity,
            'Requested Amount (KES)': Number(p.requestedAmount || 0),
            Status: p.status,
            Purpose: p.purpose || '',
          })),
          'No payment request records'
        )
      ),
      'Payment Requests'
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(
        safeRows(
          datasets.projects.map((p) => ({
            Code: p.code,
            Name: p.name,
            Type: p.projectType,
            Department: p.departmentName,
            'Budget (KES)': Number(p.totalBudget ?? p.approvedBudget ?? p.budget ?? 0),
            'Actual Spend (KES)': Number(p.actualSpend ?? p.spent ?? 0),
            Status: p.status,
          })),
          'No project records'
        )
      ),
      'Projects'
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(
        safeRows(
          datasets.suppliers.map((s) => ({
            Name: s.name,
            'Contact Person': s.contactPerson,
            Phone: s.phone,
            Email: s.email,
            'KRA PIN': s.pin,
            Status: s.status,
            'Total Paid (KES)': Number(s.totalPaid || 0),
          })),
          'No supplier records'
        )
      ),
      'Suppliers'
    );

    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `PIONEER_ERP_MASTER_BACKUP_${dateStr}.xlsx`);
  }

  /**
   * Download Excel Import Template file tailored for Marketing & Customer Experience
   */
  static downloadBudgetImportTemplate(): void {
    const templateData = [
      {
        'Budget Code': 'BDG-2026-MCX-01',
        'Financial Year': '2026',
        'Legal Entity': 'PACL',
        Quarter: 'Q1',
        Department: 'Marketing & Customer Experience',
        Campaign: 'Q1 Brand Awareness & Rebranding',
        'Strategic Initiative': 'Brand Leadership & Market Share Expansion',
        Category: 'Media Buying',
        'Cost Centre': 'CC-101 Marketing & Campaigns',
        'Funding Source': 'Main Departmental Budget',
        Activity: 'TV & Radio Broadcast Advertising',
        'Allocated Amount (KES)': 12000000,
        Description: 'Prime time commercial slots on top national stations.',
      },
      {
        'Budget Code': 'BDG-2026-MCX-02',
        'Financial Year': '2026',
        'Legal Entity': 'PGIL',
        Quarter: 'Q2',
        Department: 'Marketing & Customer Experience',
        Campaign: 'Omnichannel NPS Survey Platform',
        'Strategic Initiative': 'Customer Centricity & NPS Acceleration',
        Category: 'Customer Satisfaction Surveys',
        'Cost Centre': 'CC-102 Customer Experience & CSAT',
        'Funding Source': 'CX Special Innovation Fund',
        Activity: 'CSAT Voice & SMS Survey Engine',
        'Allocated Amount (KES)': 8500000,
        Description: 'Real-time customer sentiment tracking portal.',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Marketing Budget Template');
    XLSX.writeFile(workbook, 'Marketing_CX_Budget_Import_Template.xlsx');
  }

  /**
   * Download Expense Import Template file
   */
  static downloadExpenditureImportTemplate(): void {
    const templateData = [
      {
        'Expense ID': 'EXP-2026-MCX-001',
        Date: '2026-07-15',
        'Legal Entity': 'PACL',
        Quarter: 'Q1',
        Department: 'Marketing & Customer Experience',
        Campaign: 'Q1 Brand Awareness & Rebranding',
        Supplier: 'Ogilvy Africa Media Ltd',
        Category: 'Media Buying',
        'Cost Centre': 'CC-101 Marketing & Campaigns',
        Activity: 'TV Broadcast Running',
        'Invoice Number': 'INV-OGL-9021',
        'PO Number': 'PO-2026-101',
        Amount: 6500000,
        Description: 'July TV Commercial spot purchases',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Expense Import Template');
    XLSX.writeFile(workbook, 'Marketing_CX_Expense_Import_Template.xlsx');
  }

  /**
   * Export Transaction Traceability Dossier to Excel
   */
  static exportTransactionTrace(record: any, related: any[], chain: any[]): void {
    const summaryData = [
      { Parameter: 'Transaction Reference', Value: record.reference },
      { Parameter: 'Transaction Date', Value: record.date },
      { Parameter: 'Transaction Type', Value: record.type },
      { Parameter: 'Description', Value: record.description },
      { Parameter: 'Total Amount', Value: record.amount },
      { Parameter: 'Currency', Value: record.currency || 'KES' },
      { Parameter: 'Legal Entity', Value: record.legalEntity },
      { Parameter: 'Department', Value: record.departmentName },
      { Parameter: 'Cost Centre', Value: record.costCentre },
      { Parameter: 'Budget Line', Value: record.budgetCode },
      { Parameter: 'Supplier / Payee', Value: record.supplierName },
      { Parameter: 'Current Status', Value: record.currentStatus },
      { Parameter: 'Approval Status', Value: record.approvalStatus },
      { Parameter: 'Payment Status', Value: record.paymentStatus },
      { Parameter: 'Initiator', Value: record.initiator },
      { Parameter: 'Created At', Value: record.createdAt },
    ];

    const chainData = chain.map((c: any) => ({
      Stage: c.stage,
      Reference: c.reference,
      'Title / Description': c.title,
      'Amount (KES)': c.amount,
      Date: c.date,
      Status: c.status,
      'Counterparty / Dept': c.party,
    }));

    const relatedData = related.map((r: any) => ({
      Date: r.date,
      Type: r.transactionType,
      Reference: r.reference,
      Description: r.description,
      'Supplier / Beneficiary': r.supplierName || 'N/A',
      Department: r.departmentName || 'N/A',
      'Cost Centre': r.costCentre || 'N/A',
      'Budget Line': r.budgetCode || 'N/A',
      'Amount (KES)': r.amount,
      Status: r.status,
      'Payment Status': r.paymentStatus || 'N/A',
      'Relationship Type': r.relationshipType,
      Direction: r.relationshipDirection,
    }));

    const workbook = XLSX.utils.book_new();
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    const wsChain = XLSX.utils.json_to_sheet(chainData);
    const wsRelated = XLSX.utils.json_to_sheet(relatedData);

    XLSX.utils.book_append_sheet(workbook, wsSummary, 'Transaction Summary');
    XLSX.utils.book_append_sheet(workbook, wsChain, 'Lifecycle Chain');
    XLSX.utils.book_append_sheet(workbook, wsRelated, 'Related Transactions');

    const cleanRef = record.reference.replace(/[^a-zA-Z0-9_-]/g, '_');
    XLSX.writeFile(workbook, `Pioneer_Trace_${cleanRef}_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  /**
   * Export Amount Traceability / Reconciliation to Excel
   */
  static exportAmountTrace(context: any, records: any[], reconciledAmount: number, variance: number): void {
    const contextData = [
      { Metric: context.metricName, 'Reported Amount': context.totalAmount, Currency: context.currency || 'KES' },
      { Metric: 'Reconciled Sum of Records', 'Reported Amount': reconciledAmount, Currency: context.currency || 'KES' },
      { Metric: 'Variance', 'Reported Amount': variance, Currency: context.currency || 'KES' },
      { Metric: 'Reconciliation Status', 'Reported Amount': variance < 1 ? '100% RECONCILED' : 'DISCREPANCY DETECTED', Currency: '' },
      { Metric: 'Financial Year', 'Reported Amount': context.financialYear || '2026', Currency: '' },
      { Metric: 'Calculation Formula', 'Reported Amount': context.formula || 'Reported = Σ(Ledger Records)', Currency: '' },
    ];

    const recordsData = records.map((r: any) => ({
      Date: r.date,
      'Transaction ID': r.transactionId,
      Reference: r.reference,
      Type: r.transactionType,
      Description: r.description,
      'Supplier / Beneficiary': r.supplierName,
      Department: r.departmentName,
      'Cost Centre': r.costCentre,
      'Budget Line': r.budgetLine,
      Project: r.project,
      'Amount (KES)': r.amount,
      Status: r.status,
      'Payment Status': r.paymentStatus,
    }));

    const workbook = XLSX.utils.book_new();
    const wsContext = XLSX.utils.json_to_sheet(contextData);
    const wsRecords = XLSX.utils.json_to_sheet(recordsData);

    XLSX.utils.book_append_sheet(workbook, wsContext, 'Amount Reconciliation');
    XLSX.utils.book_append_sheet(workbook, wsRecords, 'Underlying Transactions');

    const cleanMetric = (context.metricName || 'Amount').replace(/[^a-zA-Z0-9_-]/g, '_');
    XLSX.writeFile(workbook, `Pioneer_Reconciliation_${cleanMetric}_${new Date().toISOString().split('T')[0]}.xlsx`);
  }
}
