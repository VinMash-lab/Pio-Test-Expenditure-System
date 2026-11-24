import React, { useMemo } from 'react';
import { DatabaseService } from '../services/db';
import { PDFService } from '../services/pdfService';
import { Department, DrillDownTarget, RoleType } from '../types';

interface DepartmentDetailViewProps {
  departmentId: string;
  role: RoleType;
  onBack: () => void;
  onDrillDown: (target: DrillDownTarget) => void;
}

export const DepartmentDetailView: React.FC<DepartmentDetailViewProps> = ({
  departmentId,
  role,
  onBack,
  onDrillDown,
}) => {
  const settings = DatabaseService.getSettings();
  const department = useMemo(() => {
    const list = DatabaseService.getDepartments();
    const clean = (departmentId || '').toLowerCase();
    return list.find((d) => (d.id || '').toLowerCase() === clean || (d.name || '').toLowerCase() === clean);
  }, [departmentId]);

  const deptName = department ? (department.name || '').toLowerCase() : (departmentId || '').toLowerCase();

  const expenditures = useMemo(() => {
    return DatabaseService.getExpenditures().filter(
      (e) => (department && e.departmentId === department.id) ||
        (e.departmentName && e.departmentName.toLowerCase().includes(deptName))
    );
  }, [department, deptName]);

  const lpos = useMemo(() => {
    return DatabaseService.getLPOs().filter(
      (l) => (department && l.departmentId === department.id) ||
        (l.departmentName && l.departmentName.toLowerCase().includes(deptName))
    );
  }, [department, deptName]);

  if (!department) {
    return (
      <div className="card card-erp p-5 text-center my-4">
        <i className="bi bi-diagram-2 fs-1 text-muted mb-3"></i>
        <h4 className="fw-bold text-dark">Department Not Found</h4>
        <p className="text-muted fs-6 mb-4">No department found matching ID "{departmentId}".</p>
        <div>
          <button type="button" className="btn btn-secondary px-4" onClick={onBack}>
            <i className="bi bi-arrow-left me-2"></i> Return to Departments
          </button>
        </div>
      </div>
    );
  }

  const allocated = Number(department.allocatedBudget || 0);
  const actualSpend = expenditures.reduce((sum, e) => sum + Number(e.totalAmount || 0), 0);
  const committed = lpos
    .filter((l) => !['Cancelled'].includes(l.lpoStatus || l.status || '') && l.paymentStatus !== 'Fully Paid' && l.paymentStatus !== 'Paid')
    .reduce((sum, l) => sum + Number(l.totalLpoValue ?? l.totalLpoAmount ?? 0), 0);
  const available = Math.max(0, allocated - actualSpend - committed);

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
      `DEPARTMENT FINANCIAL 360: ${department.name}`,
      `Code: ${department.code} | HOD: ${department.headOfDepartment} | Headcount: ${department.headcount}`,
      ['Date', 'Reference', 'Description', 'Supplier', 'Amount', 'Status'],
      tableRows,
      settings,
      [
        { label: 'Allocated Budget', value: `${allocated.toLocaleString()} KES` },
        { label: 'Total Spent', value: `${actualSpend.toLocaleString()} KES` },
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
                <span className="badge bg-danger text-white fs-7 py-1 px-2 fw-bold">DEPARTMENT 360</span>
                <h1 className="h5 fw-bold text-dark mb-0">{department.name}</h1>
                <span className="badge bg-light text-dark border fs-8 font-monospace">{department.code}</span>
              </div>
              <p className="text-muted fs-8 mb-0 mt-0.5">
                Head of Department: <strong>{department.headOfDepartment}</strong> | Headcount: <strong>{department.headcount} Staff</strong>
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
            <span className="fs-9 text-muted">Corporate Allocation</span>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card card-erp p-2.5 bg-white h-100">
            <span className="text-muted fs-8 text-uppercase fw-semibold">Actual Spend</span>
            <div className="fs-5 fw-bold text-danger">{actualSpend.toLocaleString()} <span className="fs-8 text-muted">KES</span></div>
            <span className="fs-9 text-muted">{expenditures.length} Ledger Expenses</span>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card card-erp p-2.5 bg-white h-100">
            <span className="text-muted fs-8 text-uppercase fw-semibold">Committed LPOs</span>
            <div className="fs-5 fw-bold text-primary">{committed.toLocaleString()} <span className="fs-8 text-muted">KES</span></div>
            <span className="fs-9 text-muted">{lpos.length} Issued LPOs</span>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card card-erp p-2.5 bg-white h-100">
            <span className="text-muted fs-8 text-uppercase fw-semibold">Available Headroom</span>
            <div className="fs-5 fw-bold text-success">{available.toLocaleString()} <span className="fs-8 text-muted">KES</span></div>
            <span className="fs-9 text-muted">Allocated - Spent - Committed</span>
          </div>
        </div>
      </div>

      {/* Department Incurred Transactions */}
      <div className="card card-erp p-0 overflow-hidden">
        <div className="p-3 bg-light border-bottom d-flex align-items-center justify-content-between">
          <h5 className="fs-6 fw-bold text-dark mb-0">Departmental Incurred Expenditures ({expenditures.length})</h5>
          <span className="badge bg-dark text-white fs-8">Ledger Entries</span>
        </div>

        <div className="p-3">
          <div className="table-responsive">
            <table className="table table-sm table-hover align-middle fs-7 mb-0">
              <thead className="table-light">
                <tr>
                  <th>Date</th>
                  <th>Reference</th>
                  <th>Description</th>
                  <th>Supplier</th>
                  <th>Cost Centre</th>
                  <th className="text-end">Amount</th>
                  <th>Status</th>
                  <th className="text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {expenditures.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-4 text-muted">No expenditures recorded for this department.</td></tr>
                ) : (
                  expenditures.map((e) => (
                    <tr key={e.id}>
                      <td>{e.date}</td>
                      <td className="font-monospace fw-bold text-danger">{e.expenseId}</td>
                      <td>{e.description}</td>
                      <td>{e.supplierName}</td>
                      <td>{e.costCentre || 'CC-101'}</td>
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
        </div>
      </div>
    </div>
  );
};
