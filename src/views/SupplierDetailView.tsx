import React, { useState, useMemo } from 'react';
import { DatabaseService } from '../services/db';
import { PDFService } from '../services/pdfService';
import { Supplier, DrillDownTarget, RoleType } from '../types';

interface SupplierDetailViewProps {
  supplierId: string;
  role: RoleType;
  onBack: () => void;
  onDrillDown: (target: DrillDownTarget) => void;
}

export const SupplierDetailView: React.FC<SupplierDetailViewProps> = ({
  supplierId,
  role,
  onBack,
  onDrillDown,
}) => {
  const settings = DatabaseService.getSettings();
  const [activeTab, setActiveTab] = useState<'expenditures' | 'lpos' | 'invoices' | 'payments' | 'quotations'>('expenditures');
  const [search, setSearch] = useState('');

  const supplier = useMemo(() => {
    const list = DatabaseService.getSuppliers();
    const target = (supplierId || '').toLowerCase();
    return list.find((s) => s.id === supplierId || (s.name || '').toLowerCase() === target);
  }, [supplierId]);

  const supplierName = supplier ? (supplier.name || '').toLowerCase() : (supplierId || '').toLowerCase();

  const expenditures = useMemo(() => {
    return DatabaseService.getExpenditures().filter(
      (e) => (supplier && e.supplierId === supplier.id) || (e.supplierName && e.supplierName.toLowerCase() === supplierName)
    );
  }, [supplier, supplierName]);

  const lpos = useMemo(() => {
    return DatabaseService.getLPOs().filter(
      (l) => (supplier && l.supplierId === supplier.id) || (l.supplierName && l.supplierName.toLowerCase() === supplierName)
    );
  }, [supplier, supplierName]);

  const invoices = useMemo(() => {
    return DatabaseService.getInvoices().filter(
      (i) => (supplier && (i.supplierId === supplier.id || i.vendorId === supplier.id)) ||
        (i.supplierName && i.supplierName.toLowerCase() === supplierName) ||
        (i.vendorName && i.vendorName.toLowerCase() === supplierName)
    );
  }, [supplier, supplierName]);

  const payments = useMemo(() => {
    return DatabaseService.getPaymentRequests().filter(
      (p) => (supplier && (p.supplierId === supplier.id || p.vendorId === supplier.id)) ||
        (p.supplierName && p.supplierName.toLowerCase() === supplierName) ||
        (p.vendorName && p.vendorName.toLowerCase() === supplierName)
    );
  }, [supplier, supplierName]);

  const quotations = useMemo(() => {
    return DatabaseService.getQuotations().filter(
      (q) => (supplier && (q.supplierId === supplier.id || q.vendorId === supplier.id)) ||
        (q.supplierName && q.supplierName.toLowerCase() === supplierName) ||
        (q.vendorName && q.vendorName.toLowerCase() === supplierName)
    );
  }, [supplier, supplierName]);

  const qSearch = search.trim().toLowerCase();
  const filteredExpenditures = useMemo(() => {
    if (!qSearch) return expenditures;
    return expenditures.filter((e) =>
      (e.expenseId || '').toLowerCase().includes(qSearch) ||
      (e.description || '').toLowerCase().includes(qSearch) ||
      (e.departmentName || '').toLowerCase().includes(qSearch) ||
      (e.invoiceNumber || '').toLowerCase().includes(qSearch) ||
      (e.purchaseOrder || '').toLowerCase().includes(qSearch)
    );
  }, [expenditures, qSearch]);

  const filteredLpos = useMemo(() => {
    if (!qSearch) return lpos;
    return lpos.filter((l) =>
      (l.lpoNumber || '').toLowerCase().includes(qSearch) ||
      (l.description || '').toLowerCase().includes(qSearch) ||
      (l.departmentName || '').toLowerCase().includes(qSearch)
    );
  }, [lpos, qSearch]);

  const filteredInvoices = useMemo(() => {
    if (!qSearch) return invoices;
    return invoices.filter((i) =>
      (i.invoiceNumber || '').toLowerCase().includes(qSearch) ||
      (i.lpoNumber || '').toLowerCase().includes(qSearch) ||
      (i.description || '').toLowerCase().includes(qSearch)
    );
  }, [invoices, qSearch]);

  const filteredPayments = useMemo(() => {
    if (!qSearch) return payments;
    return payments.filter((p) =>
      (p.requestNumber || '').toLowerCase().includes(qSearch) ||
      (p.purpose || '').toLowerCase().includes(qSearch) ||
      (p.invoiceNumber || '').toLowerCase().includes(qSearch)
    );
  }, [payments, qSearch]);

  const filteredQuotations = useMemo(() => {
    if (!qSearch) return quotations;
    return quotations.filter((q) =>
      (q.quotationNumber || '').toLowerCase().includes(qSearch) ||
      (q.description || '').toLowerCase().includes(qSearch)
    );
  }, [quotations, qSearch]);

  // Aggregate Metrics
  const totalPaid = expenditures.filter((e) => e.paymentStatus === 'Paid').reduce((sum, e) => sum + Number(e.totalAmount || 0), 0);
  const totalCommitted = lpos
    .filter((l) => !['Cancelled'].includes(l.lpoStatus || l.status || ''))
    .reduce((sum, l) => sum + Number(l.totalLpoValue ?? l.totalLpoAmount ?? 0), 0);
  const totalInvoiced = invoices.reduce((sum, i) => sum + Number(i.totalAmount || 0), 0);
  const outstandingBalance = Math.max(0, totalInvoiced - totalPaid);

  if (!supplier) {
    return (
      <div className="card card-erp p-5 text-center my-4">
        <i className="bi bi-building-x fs-1 text-muted mb-3"></i>
        <h4 className="fw-bold text-dark">Supplier Profile Not Found</h4>
        <p className="text-muted fs-6 mb-4">No supplier record could be found matching ID "{supplierId}".</p>
        <div>
          <button type="button" className="btn btn-secondary px-4" onClick={onBack}>
            <i className="bi bi-arrow-left me-2"></i> Return to Suppliers
          </button>
        </div>
      </div>
    );
  }

  const handleExportPDF = () => {
    const tableRows = expenditures.map((e) => [
      e.date || e.expenseDate || '',
      e.expenseId,
      e.description || '',
      e.departmentName || '',
      `${Number(e.totalAmount || 0).toLocaleString()} KES`,
      e.paymentStatus || 'N/A',
    ]);

    PDFService.generateReportPDF(
      `SUPPLIER 360 DOSSIER: ${supplier.name}`,
      `KRA PIN: ${supplier.pin || 'N/A'} | Status: ${supplier.status} | Total Paid: ${totalPaid.toLocaleString()} KES`,
      ['Date', 'Reference', 'Description', 'Department', 'Amount', 'Status'],
      tableRows,
      settings,
      [
        { label: 'Total Committed', value: `${totalCommitted.toLocaleString()} KES` },
        { label: 'Total Invoiced', value: `${totalInvoiced.toLocaleString()} KES` },
        { label: 'Total Paid', value: `${totalPaid.toLocaleString()} KES` },
        { label: 'Outstanding Balance', value: `${outstandingBalance.toLocaleString()} KES` },
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
                <span className="badge bg-danger text-white fs-7 py-1 px-2 fw-bold">SUPPLIER 360</span>
                <h1 className="h5 fw-bold text-dark mb-0">{supplier.name}</h1>
                <span className={`badge ${supplier.status === 'Active' || supplier.status === 'Preferred' ? 'bg-success' : 'bg-secondary'} fs-8`}>
                  {supplier.status}
                </span>
              </div>
              <p className="text-muted fs-8 mb-0 mt-0.5">
                KRA PIN: <strong>{supplier.pin || 'A009876543K'}</strong> | Contact: <strong>{supplier.contactPerson}</strong> ({supplier.phone}) &bull; {supplier.email}
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
              <span>PDF Dossier</span>
            </button>
          </div>
        </div>
      </div>

      {/* Financial Metrics Cards */}
      <div className="row g-2">
        <div className="col-6 col-md-3">
          <div className="card card-erp p-2.5 bg-white h-100">
            <span className="text-muted fs-8 text-uppercase fw-semibold">Total Committed</span>
            <div className="fs-5 fw-bold text-primary">{totalCommitted.toLocaleString()} <span className="fs-8 text-muted">KES</span></div>
            <span className="fs-9 text-muted">{lpos.length} Issued LPOs</span>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card card-erp p-2.5 bg-white h-100">
            <span className="text-muted fs-8 text-uppercase fw-semibold">Total Invoiced</span>
            <div className="fs-5 fw-bold text-dark">{totalInvoiced.toLocaleString()} <span className="fs-8 text-muted">KES</span></div>
            <span className="fs-9 text-muted">{invoices.length} Supplier Invoices</span>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card card-erp p-2.5 bg-white h-100">
            <span className="text-muted fs-8 text-uppercase fw-semibold">Total Paid</span>
            <div className="fs-5 fw-bold text-success">{totalPaid.toLocaleString()} <span className="fs-8 text-muted">KES</span></div>
            <span className="fs-9 text-muted">{expenditures.length} Disbursed Payments</span>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card card-erp p-2.5 bg-white h-100">
            <span className="text-muted fs-8 text-uppercase fw-semibold">Outstanding Balance</span>
            <div className={`fs-5 fw-bold ${outstandingBalance > 0 ? 'text-danger' : 'text-muted'}`}>
              {outstandingBalance.toLocaleString()} <span className="fs-8 text-muted">KES</span>
            </div>
            <span className="fs-9 text-muted">Pending Invoiced Liability</span>
          </div>
        </div>
      </div>

      {/* Tabbed Records Table */}
      <div className="card card-erp p-0 overflow-hidden">
        <div className="bg-light border-bottom p-2 px-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
          <ul className="nav nav-pills gap-1">
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link py-1 px-3 fs-7 fw-semibold ${activeTab === 'expenditures' ? 'active bg-danger text-white' : 'text-dark'}`}
                onClick={() => setActiveTab('expenditures')}
              >
                Expenditures ({expenditures.length})
              </button>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link py-1 px-3 fs-7 fw-semibold ${activeTab === 'lpos' ? 'active bg-danger text-white' : 'text-dark'}`}
                onClick={() => setActiveTab('lpos')}
              >
                LPOs ({lpos.length})
              </button>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link py-1 px-3 fs-7 fw-semibold ${activeTab === 'invoices' ? 'active bg-danger text-white' : 'text-dark'}`}
                onClick={() => setActiveTab('invoices')}
              >
                Invoices ({invoices.length})
              </button>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link py-1 px-3 fs-7 fw-semibold ${activeTab === 'payments' ? 'active bg-danger text-white' : 'text-dark'}`}
                onClick={() => setActiveTab('payments')}
              >
                Payment Requests ({payments.length})
              </button>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link py-1 px-3 fs-7 fw-semibold ${activeTab === 'quotations' ? 'active bg-danger text-white' : 'text-dark'}`}
                onClick={() => setActiveTab('quotations')}
              >
                Quotations ({quotations.length})
              </button>
            </li>
          </ul>

          <div style={{ maxWidth: '240px' }}>
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="Search table..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="p-3">
          {activeTab === 'expenditures' && (
            <div className="table-responsive">
              <table className="table table-sm table-hover align-middle fs-7 mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Date</th>
                    <th>Expense ID</th>
                    <th>Description</th>
                    <th>Department</th>
                    <th>Invoice No</th>
                    <th>PO No</th>
                    <th className="text-end">Amount</th>
                    <th>Status</th>
                    <th className="text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenditures.length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-4 text-muted">No expenditures recorded for this supplier.</td></tr>
                  ) : (
                    filteredExpenditures.map((e) => (
                      <tr key={e.id}>
                        <td>{e.date || e.expenseDate}</td>
                        <td className="font-monospace fw-bold text-danger">{e.expenseId}</td>
                        <td>{e.description}</td>
                        <td>{e.departmentName}</td>
                        <td className="font-monospace">{e.invoiceNumber || 'N/A'}</td>
                        <td className="font-monospace">{e.purchaseOrder || 'N/A'}</td>
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
          )}

          {activeTab === 'lpos' && (
            <div className="table-responsive">
              <table className="table table-sm table-hover align-middle fs-7 mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Date</th>
                    <th>LPO Number</th>
                    <th>Description</th>
                    <th>Department</th>
                    <th className="text-end">LPO Value</th>
                    <th>Status</th>
                    <th>Payment Status</th>
                    <th className="text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLpos.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-4 text-muted">No LPOs found for this supplier.</td></tr>
                  ) : (
                    filteredLpos.map((l) => (
                      <tr key={l.id}>
                        <td>{l.lpoDate}</td>
                        <td className="font-monospace fw-bold text-primary">{l.lpoNumber}</td>
                        <td>{l.description}</td>
                        <td>{l.departmentName}</td>
                        <td className="text-end fw-bold font-monospace">{Number(l.totalLpoValue ?? l.totalLpoAmount ?? 0).toLocaleString()} KES</td>
                        <td><span className="badge bg-info text-dark fs-9">{l.lpoStatus || l.status || 'Issued'}</span></td>
                        <td><span className="badge bg-light text-dark border fs-9">{l.paymentStatus || 'Pending'}</span></td>
                        <td className="text-center">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger py-0 px-2 fs-8"
                            onClick={() => onDrillDown({ type: 'transaction', id: l.lpoNumber, recordType: 'LPO' })}
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
          )}

          {activeTab === 'invoices' && (
            <div className="table-responsive">
              <table className="table table-sm table-hover align-middle fs-7 mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Invoice Date</th>
                    <th>Invoice Number</th>
                    <th>LPO Ref</th>
                    <th>Description</th>
                    <th className="text-end">Total Amount</th>
                    <th>Payment Status</th>
                    <th className="text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-4 text-muted">No invoices found for this supplier.</td></tr>
                  ) : (
                    filteredInvoices.map((i) => (
                      <tr key={i.id}>
                        <td>{i.invoiceDate}</td>
                        <td className="font-monospace fw-bold text-dark">{i.invoiceNumber}</td>
                        <td className="font-monospace">{i.lpoNumber || 'N/A'}</td>
                        <td>{i.description}</td>
                        <td className="text-end fw-bold font-monospace">{Number(i.totalAmount || 0).toLocaleString()} KES</td>
                        <td><span className="badge bg-secondary fs-9">{i.paymentStatus}</span></td>
                        <td className="text-center">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger py-0 px-2 fs-8"
                            onClick={() => onDrillDown({ type: 'transaction', id: i.invoiceNumber, recordType: 'Invoice' })}
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
          )}

          {activeTab === 'payments' && (
            <div className="table-responsive">
              <table className="table table-sm table-hover align-middle fs-7 mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Request Date</th>
                    <th>Request Number</th>
                    <th>Purpose</th>
                    <th>Invoice Ref</th>
                    <th className="text-end">Amount</th>
                    <th>Status</th>
                    <th className="text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-4 text-muted">No payment requests found for this supplier.</td></tr>
                  ) : (
                    filteredPayments.map((p) => (
                      <tr key={p.id}>
                        <td>{p.requestDate || (p.createdAt ? p.createdAt.split('T')[0] : '')}</td>
                        <td className="font-monospace fw-bold text-dark">{p.requestNumber}</td>
                        <td>{p.purpose}</td>
                        <td className="font-monospace">{p.invoiceNumber || 'N/A'}</td>
                        <td className="text-end fw-bold font-monospace">{Number(p.totalAmount || p.requestedAmount || 0).toLocaleString()} KES</td>
                        <td><span className="badge bg-success fs-9">{p.status}</span></td>
                        <td className="text-center">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger py-0 px-2 fs-8"
                            onClick={() => onDrillDown({ type: 'transaction', id: p.requestNumber, recordType: 'Payment Request' })}
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
          )}

          {activeTab === 'quotations' && (
            <div className="table-responsive">
              <table className="table table-sm table-hover align-middle fs-7 mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Quotation Date</th>
                    <th>Quotation Number</th>
                    <th>Description</th>
                    <th className="text-end">Total Amount</th>
                    <th>Status</th>
                    <th className="text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQuotations.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-4 text-muted">No quotations found for this supplier.</td></tr>
                  ) : (
                    filteredQuotations.map((q) => (
                      <tr key={q.id}>
                        <td>{q.quotationDate}</td>
                        <td className="font-monospace fw-bold text-dark">{q.quotationNumber}</td>
                        <td>{q.description}</td>
                        <td className="text-end fw-bold font-monospace">{Number(q.totalAmount || 0).toLocaleString()} KES</td>
                        <td><span className="badge bg-light text-dark border fs-9">{q.status}</span></td>
                        <td className="text-center">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger py-0 px-2 fs-8"
                            onClick={() => onDrillDown({ type: 'transaction', id: q.quotationNumber, recordType: 'Quotation' })}
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
          )}
        </div>
      </div>
    </div>
  );
};
