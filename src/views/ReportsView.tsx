import React, { useState, useEffect } from 'react';
import { DatabaseService } from '../services/db';
import { ExcelService } from '../services/excelService';
import { PDFService } from '../services/pdfService';
import { RoleType } from '../types';
import { ManagementReportView } from './ManagementReportView';
import { MonthlyReportView } from './MonthlyReportView';

interface ReportsViewProps {
  role: RoleType;
  onRefresh?: () => void;
  initialSubTab?: 'executive' | 'monthly' | 'standard';
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  role,
  onRefresh,
  initialSubTab = 'standard',
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'executive' | 'monthly' | 'standard'>(initialSubTab);

  useEffect(() => {
    setActiveSubTab(initialSubTab);
  }, [initialSubTab]);
  const depts = DatabaseService.getDepartments();
  const projs = DatabaseService.getProjects();
  const sups = DatabaseService.getSuppliers();
  const bdgs = DatabaseService.getBudgets();
  const exps = DatabaseService.getExpenditures();
  const settings = DatabaseService.getSettings();

  const reportTypes = [
    'Budget vs Actual',
    'PACL vs PGIL Entity Comparison',
    'Department Report',
    'Project Report',
    'Supplier Report',
    'Monthly Spending',
    'Quarterly Spending',
    'Annual Spending',
    'Variance Report',
    'Remaining Budget Report',
    'Expense Category Report',
    'Top Expenses',
    'Project Performance',
    'Budget Utilization Report',
    'Cash Flow Report',
  ];

  const [selectedReport, setSelectedReport] = useState('Budget vs Actual');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedEntity, setSelectedEntity] = useState('');

  // Filter datasets
  const filteredBdgs = bdgs.filter(
    (b) => (!selectedEntity || b.legalEntity === selectedEntity) && (!selectedDept || b.departmentId === selectedDept)
  );
  const filteredExps = exps.filter(
    (e) => (!selectedEntity || e.legalEntity === selectedEntity) && (!selectedDept || e.departmentId === selectedDept)
  );

  // Generate Report Data dynamically
  const generateReportData = () => {
    switch (selectedReport) {
      case 'PACL vs PGIL Entity Comparison':
        return projs.map((p) => {
          const paclB = bdgs.filter((b) => b.projectId === p.id && b.legalEntity === 'PACL').reduce((s, b) => s + Number(b.allocatedAmount || 0), 0);
          const paclE = exps.filter((e) => e.projectId === p.id && e.legalEntity === 'PACL').reduce((s, e) => s + Number(e.totalAmount || 0), 0);
          const pgilB = bdgs.filter((b) => b.projectId === p.id && b.legalEntity === 'PGIL').reduce((s, b) => s + Number(b.allocatedAmount || 0), 0);
          const pgilE = exps.filter((e) => e.projectId === p.id && e.legalEntity === 'PGIL').reduce((s, e) => s + Number(e.totalAmount || 0), 0);
          const combinedB = paclB + pgilB;
          const combinedE = paclE + pgilE;

          return {
            'Project / Initiative': p.name,
            'PACL Budget (KES)': paclB,
            'PACL Spend (KES)': paclE,
            'PACL Balance (KES)': paclB - paclE,
            'PGIL Budget (KES)': pgilB,
            'PGIL Spend (KES)': pgilE,
            'PGIL Balance (KES)': pgilB - pgilE,
            'Combined Budget (KES)': combinedB,
            'Combined Spend (KES)': combinedE,
            'Combined Balance (KES)': combinedB - combinedE,
          };
        });

      case 'Department Report':
      case 'Budget Utilization Report':
        return depts
          .filter((d) => !selectedDept || d.id === selectedDept)
          .map((d) => {
            const deptB = filteredBdgs.filter((b) => b.departmentId === d.id).reduce((s, b) => s + Number(b.allocatedAmount || 0), 0);
            const deptE = filteredExps.filter((e) => e.departmentId === d.id).reduce((s, e) => s + Number(e.totalAmount || 0), 0);
            const alloc = deptB > 0 ? deptB : Number(d.allocatedBudget || 0);
            const spent = deptE > 0 ? deptE : Number(d.totalSpent || 0);
            return {
              'Department Code': d.code,
              'Department Name': d.name,
              'Head of Dept': d.headOfDepartment,
              'Allocated Budget (KES)': alloc,
              'Total Spent (KES)': spent,
              'Balance (KES)': alloc - spent,
              'Utilization %': alloc > 0 ? ((spent / alloc) * 100).toFixed(1) + '%' : '0%',
            };
          });

      case 'Project Report':
      case 'Project Performance':
        return projs
          .filter((p) => !selectedDept || p.departmentId === selectedDept)
          .map((p) => {
            const projExps = filteredExps.filter((e) => e.projectId === p.id);
            const spent = projExps.length > 0 ? projExps.reduce((s, e) => s + Number(e.totalAmount || 0), 0) : Number(p.spent ?? p.actualSpend ?? 0);
            const budget = Number(p.totalBudget ?? p.approvedBudget ?? p.budget ?? 0);
            const remaining = budget - spent;
            const progressPercent = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : Number(p.progressPercent || 0);
            return {
              'Project Code': p.code,
              'Project Name': p.name,
              Department: p.departmentName,
              'Budget (KES)': budget,
              'Spent (KES)': spent,
              'Remaining (KES)': remaining,
              'Progress %': progressPercent + '%',
              Status: p.status,
              'Project Manager': p.projectManager,
            };
          });

      case 'Supplier Report':
        return sups.map((s) => {
          const sExps = filteredExps.filter(
            (e) =>
              (e.supplierId && e.supplierId === s.id) ||
              (e.supplierName && s.name && e.supplierName.trim().toLowerCase() === s.name.trim().toLowerCase())
          );
          const totalDisbursed = sExps.reduce((sum, e) => sum + Number(e.totalAmount || 0), 0);
          const paclSpend = sExps.filter((e) => e.legalEntity === 'PACL').reduce((sum, e) => sum + Number(e.totalAmount || 0), 0);
          const pgilSpend = sExps.filter((e) => e.legalEntity === 'PGIL').reduce((sum, e) => sum + Number(e.totalAmount || 0), 0);
          const paidSpend = sExps.filter((e) => e.paymentStatus === 'Paid').reduce((sum, e) => sum + Number(e.totalAmount || 0), 0);
          const pendingSpend = sExps.filter((e) => e.paymentStatus !== 'Paid').reduce((sum, e) => sum + Number(e.totalAmount || 0), 0);

          // Fallback if no filter is applied and supplier has pre-stored totalPaid
          const finalTotal = totalDisbursed > 0 ? totalDisbursed : (!selectedEntity && !selectedDept ? Number(s.totalPaid || 0) : 0);
          const finalPacl =
            paclSpend > 0
              ? paclSpend
              : finalTotal > 0 && (!selectedEntity || selectedEntity === 'PACL')
              ? Math.round(finalTotal * 0.6)
              : 0;
          const finalPgil =
            pgilSpend > 0
              ? pgilSpend
              : finalTotal > 0 && (!selectedEntity || selectedEntity === 'PGIL')
              ? Math.round(finalTotal * 0.4)
              : 0;

          return {
            'Supplier Name': s.name,
            'Tax PIN': s.pin,
            'Contact Person': s.contactPerson,
            Phone: s.phone,
            Email: s.email,
            'Services Offered': Array.isArray(s.servicesOffered) ? s.servicesOffered.join(', ') : '',
            'Invoices Logged': sExps.length || (finalTotal > 0 ? 1 : 0),
            'PACL Spend (KES)': finalPacl,
            'PGIL Spend (KES)': finalPgil,
            'Paid Amount (KES)': paidSpend || finalTotal,
            'Pending (KES)': pendingSpend,
            'Total Disbursement (KES)': finalTotal,
            Status: s.status,
          };
        });

      case 'Variance Report':
      case 'Remaining Budget Report':
        return filteredBdgs.map((b) => {
          const deptExps = filteredExps.filter(
            (e) =>
              e.departmentId === b.departmentId &&
              e.legalEntity === b.legalEntity &&
              (!b.projectId || e.projectId === b.projectId)
          );
          const spent = deptExps.reduce((sum, e) => sum + Number(e.totalAmount || 0), 0);
          const variance = Number(b.allocatedAmount || 0) - spent;
          return {
            'Budget Code': b.code,
            'Legal Entity': b.legalEntity || 'PACL',
            'Financial Year': b.financialYear,
            Department: b.departmentName,
            Category: b.category,
            'Allocated (KES)': Number(b.allocatedAmount || 0),
            'Actual Spent (KES)': spent,
            'Variance (KES)': variance,
            Status: variance < 0 ? 'Deficit' : 'Surplus',
          };
        });

      case 'Expense Category Report': {
        const categories = Array.from(
          new Set([...settings.expenseCategories, ...filteredBdgs.map((b) => b.category), ...filteredExps.map((e) => e.category)])
        ).filter(Boolean);

        return categories.map((cat) => {
          const catBdgs = filteredBdgs.filter((b) => b.category === cat);
          const catExps = filteredExps.filter((e) => e.category === cat);
          const allocated = catBdgs.reduce((sum, b) => sum + Number(b.allocatedAmount || 0), 0);
          const spent = catExps.reduce((sum, e) => sum + Number(e.totalAmount || 0), 0);
          const paclSpent = catExps.filter((e) => e.legalEntity === 'PACL').reduce((sum, e) => sum + Number(e.totalAmount || 0), 0);
          const pgilSpent = catExps.filter((e) => e.legalEntity === 'PGIL').reduce((sum, e) => sum + Number(e.totalAmount || 0), 0);

          return {
            Category: cat,
            'PACL Spend (KES)': paclSpent,
            'PGIL Spend (KES)': pgilSpent,
            'Allocated Budget (KES)': allocated,
            'Total Spent (KES)': spent,
            'Variance (KES)': allocated - spent,
            'Utilization %': allocated > 0 ? ((spent / allocated) * 100).toFixed(1) + '%' : spent > 0 ? '100.0%' : '0%',
          };
        });
      }

      case 'Monthly Spending': {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        return monthNames.map((mName, mIdx) => {
          const mExps = filteredExps.filter((e) => {
            const dt = e.date || e.expenseDate;
            if (!dt) return false;
            return new Date(dt).getMonth() === mIdx;
          });
          const paclSpend = mExps.filter((e) => e.legalEntity === 'PACL').reduce((sum, e) => sum + Number(e.totalAmount || 0), 0);
          const pgilSpend = mExps.filter((e) => e.legalEntity === 'PGIL').reduce((sum, e) => sum + Number(e.totalAmount || 0), 0);
          const total = mExps.reduce((sum, e) => sum + Number(e.totalAmount || 0), 0);

          return {
            Month: mName,
            'Transactions Count': mExps.length,
            'PACL Spend (KES)': paclSpend,
            'PGIL Spend (KES)': pgilSpend,
            'Total Spend (KES)': total,
          };
        });
      }

      case 'Quarterly Spending': {
        const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
        return quarters.map((q) => {
          const qBdgs = filteredBdgs.filter((b) => b.quarter === q);
          const qExps = filteredExps.filter((e) => e.quarter === q);
          const alloc = qBdgs.reduce((sum, b) => sum + Number(b.allocatedAmount || 0), 0);
          const paclSpend = qExps.filter((e) => e.legalEntity === 'PACL').reduce((sum, e) => sum + Number(e.totalAmount || 0), 0);
          const pgilSpend = qExps.filter((e) => e.legalEntity === 'PGIL').reduce((sum, e) => sum + Number(e.totalAmount || 0), 0);
          const totalSpend = qExps.reduce((sum, e) => sum + Number(e.totalAmount || 0), 0);

          return {
            Quarter: q,
            'Allocated Budget (KES)': alloc,
            'PACL Spend (KES)': paclSpend,
            'PGIL Spend (KES)': pgilSpend,
            'Total Spend (KES)': totalSpend,
            'Remaining Balance (KES)': alloc - totalSpend,
            'Utilization %': alloc > 0 ? ((totalSpend / alloc) * 100).toFixed(1) + '%' : '0%',
          };
        });
      }

      case 'Annual Spending': {
        return filteredExps.map((e) => ({
          'Expense ID': e.expenseId,
          'Legal Entity': e.legalEntity || 'PACL',
          Date: e.date || e.expenseDate || '',
          Quarter: e.quarter || 'Q1',
          Department: e.departmentName,
          Supplier: e.supplierName,
          Category: e.category,
          'Base Amount (KES)': Number(e.amount || 0),
          'VAT (16%)': Number(e.vatAmount || 0),
          'Total Amount (KES)': Number(e.totalAmount || 0),
          Status: e.paymentStatus,
        }));
      }

      case 'Cash Flow Report': {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        let cumulativeOutflow = 0;
        return monthNames.map((mName, mIdx) => {
          const mExps = filteredExps.filter((e) => {
            const dt = e.date || e.expenseDate;
            if (!dt) return false;
            return new Date(dt).getMonth() === mIdx;
          });
          const paidOutflow = mExps.filter((e) => e.paymentStatus === 'Paid').reduce((sum, e) => sum + Number(e.totalAmount || 0), 0);
          const pendingCommitments = mExps.filter((e) => e.paymentStatus !== 'Paid').reduce((sum, e) => sum + Number(e.totalAmount || 0), 0);
          const totalMonthOutflow = paidOutflow + pendingCommitments;
          cumulativeOutflow += totalMonthOutflow;

          return {
            Month: mName,
            'Invoices Count': mExps.length,
            'Paid Cash Outflow (KES)': paidOutflow,
            'Pending Payables (KES)': pendingCommitments,
            'Total Monthly Cash Outflow (KES)': totalMonthOutflow,
            'Cumulative Outflow (KES)': cumulativeOutflow,
          };
        });
      }

      case 'Top Expenses':
        return [...filteredExps]
          .sort((a, b) => Number(b.totalAmount || 0) - Number(a.totalAmount || 0))
          .slice(0, 10)
          .map((e) => ({
            'Expense ID': e.expenseId,
            'Legal Entity': e.legalEntity || 'PACL',
            Date: e.date || e.expenseDate || '',
            Department: e.departmentName,
            Supplier: e.supplierName,
            Category: e.category,
            'Invoice No': e.invoiceNumber,
            'PO Number': e.purchaseOrder,
            'Total Amount (KES)': Number(e.totalAmount || 0),
            Status: e.paymentStatus,
          }));

      default: // Budget vs Actual
        return filteredExps.map((e) => ({
          'Expense ID': e.expenseId,
          'Legal Entity': e.legalEntity || 'PACL',
          Date: e.date || e.expenseDate || '',
          Department: e.departmentName,
          Project: e.projectName || 'N/A',
          Supplier: e.supplierName,
          Category: e.category,
          Description: e.description,
          'Invoice No': e.invoiceNumber,
          'PO No': e.purchaseOrder,
          'Base Amount (KES)': Number(e.amount || 0),
          'VAT (16%)': Number(e.vatAmount || 0),
          'Total (KES)': Number(e.totalAmount || 0),
          Status: e.paymentStatus,
        }));
    }
  };

  const reportData = generateReportData();
  const headers = reportData.length > 0 ? Object.keys(reportData[0]) : [];

  const handleExportExcel = () => {
    ExcelService.exportReportToExcel(selectedReport, reportData, `${selectedReport.replace(/\s+/g, '_')}.xlsx`);
  };

  const handleExportPDF = () => {
    const rows = reportData.map((row) => Object.values(row).map((v) => (typeof v === 'number' ? v.toLocaleString() : String(v))));
    PDFService.generateReportPDF(selectedReport.toUpperCase(), 'Official Financial Statement', headers, rows, settings);
  };

  return (
    <div className="d-flex flex-column gap-4">
      {/* Unified Header & Sub-Tabs */}
      <div className="d-flex flex-column gap-3">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2 pb-2 border-bottom">
          <div>
            <div className="d-flex align-items-center gap-2">
              <h3 className="fw-bold mb-0 text-dark" style={{ fontFamily: 'Tahoma, sans-serif' }}>
                Reports &amp; Executive Statements
              </h3>
              <span className="badge bg-dark text-white px-2 py-1">ExCo • Trends • 15 Statements</span>
            </div>
            <p className="text-muted small mb-0 mt-1">
              Board-ready executive summaries, 12-month burn trajectories, and 15 filterable standard financial statements.
            </p>
          </div>
        </div>

        <ul className="nav nav-pills gap-2 bg-white p-2 rounded-3 shadow-xs border">
          <li className="nav-item">
            <button
              type="button"
              className={`nav-link btn-sm py-1.5 px-3 fw-semibold d-flex align-items-center gap-2 ${
                activeSubTab === 'executive' ? 'active bg-danger text-white shadow-xs' : 'text-dark'
              }`}
              onClick={() => setActiveSubTab('executive')}
            >
              <i className="bi bi-file-earmark-bar-graph-fill"></i> Executive Management Report
            </button>
          </li>
          <li className="nav-item">
            <button
              type="button"
              className={`nav-link btn-sm py-1.5 px-3 fw-semibold d-flex align-items-center gap-2 ${
                activeSubTab === 'monthly' ? 'active bg-danger text-white shadow-xs' : 'text-dark'
              }`}
              onClick={() => setActiveSubTab('monthly')}
            >
              <i className="bi bi-graph-up"></i> Monthly Burn Rate &amp; Trends
            </button>
          </li>
          <li className="nav-item">
            <button
              type="button"
              className={`nav-link btn-sm py-1.5 px-3 fw-semibold d-flex align-items-center gap-2 ${
                activeSubTab === 'standard' ? 'active bg-danger text-white shadow-xs' : 'text-dark'
              }`}
              onClick={() => setActiveSubTab('standard')}
            >
              <i className="bi bi-folder2-open"></i> Standard Financial Statements (15 Reports)
            </button>
          </li>
        </ul>
      </div>

      {activeSubTab === 'executive' && (
        <ManagementReportView role={role} onRefresh={onRefresh || (() => {})} embedded />
      )}

      {activeSubTab === 'monthly' && (
        <MonthlyReportView role={role} onRefresh={onRefresh || (() => {})} embedded />
      )}

      {activeSubTab === 'standard' && (
        <>
      {/* Report Selector Header */}
      <div className="card card-erp p-3">
        <div className="row g-3 align-items-center">
          <div className="col-12 col-md-3">
            <label className="form-label fs-7 fw-semibold mb-1">Select Report Type (15 Available)</label>
            <select
              className="form-select form-select-sm fw-bold text-corporate-primary"
              value={selectedReport}
              onChange={(e) => setSelectedReport(e.target.value)}
            >
              {reportTypes.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="col-6 col-md-3">
            <label className="form-label fs-7 fw-semibold mb-1">Legal Entity Scope</label>
            <select className="form-select form-select-sm fw-semibold" value={selectedEntity} onChange={(e) => setSelectedEntity(e.target.value)}>
              <option value="">Combined (PACL + PGIL)</option>
              <option value="PACL">PACL – Pioneer Assurance</option>
              <option value="PGIL">PGIL – Pioneer General Insurance</option>
            </select>
          </div>

          <div className="col-6 col-md-2">
            <label className="form-label fs-7 fw-semibold mb-1">Department Filter</label>
            <select className="form-select form-select-sm" value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)}>
              <option value="">All Departments</option>
              {depts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="col-6 col-md-2">
            <label className="form-label fs-7 fw-semibold mb-1">Financial Year</label>
            <select className="form-select form-select-sm" value={settings.financialYear || '2026'} disabled>
              <option value={settings.financialYear || '2026'}>FY {settings.financialYear || '2026'}</option>
            </select>
          </div>

          <div className="col-12 col-md-2 d-flex align-items-end justify-content-end gap-2">
            <button type="button" onClick={handleExportExcel} className="btn btn-sm btn-outline-success d-flex align-items-center gap-1">
              <i className="bi bi-file-earmark-excel"></i> Excel
            </button>
            <button type="button" onClick={handleExportPDF} className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1">
              <i className="bi bi-file-pdf"></i> PDF
            </button>
          </div>
        </div>
      </div>

      {/* Generated Report Output Table */}
      <div className="card card-erp p-0 overflow-hidden">
        <div className="card-header bg-dark text-white d-flex align-items-center justify-content-between py-2.5 px-3">
          <span className="fw-bold fs-7 text-uppercase d-flex align-items-center gap-2">
            <i className="bi bi-file-earmark-bar-graph-fill text-corporate-primary"></i> {selectedReport} Statement ({reportData.length} Rows)
          </span>
          <button type="button" onClick={() => window.print()} className="btn btn-sm btn-outline-light py-0.5 px-2">
            <i className="bi bi-printer me-1"></i> Print Statement
          </button>
        </div>

        <div className="table-responsive">
          <table className="table table-hover table-erp align-middle mb-0" style={{ fontSize: '0.82rem' }}>
            <thead>
              <tr>
                {headers.map((h, idx) => (
                  <th key={idx}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reportData.length === 0 ? (
                <tr>
                  <td colSpan={headers.length || 1} className="text-center py-4 text-muted">
                    No data available for selected report.
                  </td>
                </tr>
              ) : (
                reportData.map((row, rIdx) => (
                  <tr key={rIdx}>
                    {Object.values(row).map((val: any, cIdx) => (
                      <td key={cIdx} className={typeof val === 'number' ? 'fw-bold text-dark' : ''}>
                        {typeof val === 'number' ? val.toLocaleString() : String(val)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}
    </div>
  );
};
