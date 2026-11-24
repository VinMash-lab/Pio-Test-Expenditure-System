import React, { useState, useEffect } from 'react';
import { DatabaseService } from '../services/db';
import { ActiveTab } from './Sidebar';
import { DrillDownTarget } from '../types';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: ActiveTab) => void;
  onDrillDown?: (target: DrillDownTarget) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  onDrillDown,
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const budgets = DatabaseService.getBudgets();
  const departments = DatabaseService.getDepartments();
  const projects = DatabaseService.getProjects();
  const expenditures = DatabaseService.getExpenditures();
  const suppliers = DatabaseService.getSuppliers();
  const documents = DatabaseService.getDocuments();
  const lpos = DatabaseService.getLPOs();

  const q = query.trim().toLowerCase();

  const matchedBudgets = q
    ? budgets.filter(
        (b) =>
          (b.code || '').toLowerCase().includes(q) ||
          (b.departmentName || '').toLowerCase().includes(q) ||
          (b.category || '').toLowerCase().includes(q)
      )
    : [];

  const matchedDepts = q
    ? departments.filter(
        (d) =>
          (d.name || '').toLowerCase().includes(q) ||
          (d.code || '').toLowerCase().includes(q) ||
          (d.headOfDepartment || '').toLowerCase().includes(q)
      )
    : [];

  const matchedProjects = q
    ? projects.filter(
        (p) =>
          (p.name || '').toLowerCase().includes(q) ||
          (p.code || '').toLowerCase().includes(q) ||
          (p.projectManager || '').toLowerCase().includes(q)
      )
    : [];

  const matchedExpenses = q
    ? expenditures.filter(
        (e) =>
          (e.expenseId || '').toLowerCase().includes(q) ||
          (e.invoiceNumber || '').toLowerCase().includes(q) ||
          (e.purchaseOrder || '').toLowerCase().includes(q) ||
          (e.description || '').toLowerCase().includes(q) ||
          (e.supplierName || '').toLowerCase().includes(q)
      )
    : [];

  const matchedLpos = q
    ? lpos.filter(
        (l) =>
          (l.lpoNumber || '').toLowerCase().includes(q) ||
          (l.supplierName || '').toLowerCase().includes(q) ||
          (l.description || '').toLowerCase().includes(q)
      )
    : [];

  const matchedSuppliers = q
    ? suppliers.filter(
        (s) =>
          (s.name || '').toLowerCase().includes(q) ||
          (s.pin || '').toLowerCase().includes(q) ||
          (s.contactPerson || '').toLowerCase().includes(q)
      )
    : [];

  const matchedDocs = q
    ? documents.filter(
        (d) =>
          (d.title || '').toLowerCase().includes(q) ||
          (d.fileName || '').toLowerCase().includes(q) ||
          (d.type || '').toLowerCase().includes(q)
      )
    : [];

  const hasResults =
    matchedBudgets.length > 0 ||
    matchedDepts.length > 0 ||
    matchedProjects.length > 0 ||
    matchedExpenses.length > 0 ||
    matchedLpos.length > 0 ||
    matchedSuppliers.length > 0 ||
    matchedDocs.length > 0;

  return (
    <div
      className="modal show d-block"
      tabIndex={-1}
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', zIndex: 1060 }}
      onClick={onClose}
    >
      <div className="modal-dialog modal-lg modal-dialog-top mt-5" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content shadow-lg border-0 rounded-3">
          {/* Search Header */}
          <div className="modal-header border-bottom p-3">
            <div className="input-group">
              <span className="input-group-text bg-white border-end-0 fs-5 text-corporate-primary">
                <i className="bi bi-search"></i>
              </span>
              <input
                type="text"
                className="form-control border-start-0 ps-0 fs-6"
                placeholder="Search transactions (EXP/LPO), invoices, POs, departments, suppliers..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
            </div>
            <button type="button" className="btn-close ms-2" onClick={onClose}></button>
          </div>

          {/* Results Body */}
          <div className="modal-body p-3" style={{ maxHeight: '460px', overflowY: 'auto' }}>
            {!q ? (
              <div className="text-center py-4 text-muted fs-7">
                <i className="bi bi-lightbulb fs-2 text-corporate-primary d-block mb-2"></i>
                Type an expense ID, LPO number, invoice number, supplier, or keyword to investigate...
              </div>
            ) : !hasResults ? (
              <div className="text-center py-4 text-muted fs-7">
                <i className="bi bi-question-circle fs-2 text-secondary d-block mb-2"></i>
                No matching records found for "{query}".
              </div>
            ) : (
              <div className="d-flex flex-column gap-3">
                {/* Expenditures */}
                {matchedExpenses.length > 0 && (
                  <div>
                    <h6 className="fw-bold text-uppercase text-muted fs-7 border-bottom pb-1 mb-2">
                      <i className="bi bi-receipt me-1 text-corporate-primary"></i> Expenditures ({matchedExpenses.length})
                    </h6>
                    <div className="list-group list-group-flush">
                      {matchedExpenses.slice(0, 4).map((e) => (
                        <div
                          key={e.id}
                          className="list-group-item list-group-item-action py-2 d-flex align-items-center justify-content-between"
                        >
                          <div>
                            <span className="fw-bold text-danger font-monospace">{e.expenseId}</span> – {e.description}
                            <div className="text-muted fs-7">
                              Supplier: {e.supplierName} | Inv: {e.invoiceNumber} | PO: {e.purchaseOrder}
                            </div>
                          </div>
                          <div className="d-flex align-items-center gap-2">
                            <span className="badge bg-light text-dark border">{Number(e.totalAmount || 0).toLocaleString()} KES</span>
                            {onDrillDown && (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger py-0 px-2 fs-8 fw-semibold"
                                onClick={() => {
                                  onDrillDown({ type: 'transaction', id: e.expenseId, recordType: 'Expenditure' });
                                  onClose();
                                }}
                              >
                                Trace
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* LPOs */}
                {matchedLpos.length > 0 && (
                  <div>
                    <h6 className="fw-bold text-uppercase text-muted fs-7 border-bottom pb-1 mb-2">
                      <i className="bi bi-file-earmark-spreadsheet me-1 text-primary"></i> Local Purchase Orders ({matchedLpos.length})
                    </h6>
                    <div className="list-group list-group-flush">
                      {matchedLpos.slice(0, 4).map((l) => (
                        <div
                          key={l.id}
                          className="list-group-item list-group-item-action py-2 d-flex align-items-center justify-content-between"
                        >
                          <div>
                            <span className="fw-bold text-primary font-monospace">{l.lpoNumber}</span> – {l.description}
                            <div className="text-muted fs-7">Supplier: {l.supplierName} &bull; Dept: {l.departmentName}</div>
                          </div>
                          <div className="d-flex align-items-center gap-2">
                            <span className="badge bg-light text-dark border">{Number(l.totalLpoValue ?? l.totalLpoAmount ?? 0).toLocaleString()} KES</span>
                            {onDrillDown && (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger py-0 px-2 fs-8 fw-semibold"
                                onClick={() => {
                                  onDrillDown({ type: 'transaction', id: l.lpoNumber, recordType: 'LPO' });
                                  onClose();
                                }}
                              >
                                Trace
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Budgets */}
                {matchedBudgets.length > 0 && (
                  <div>
                    <h6 className="fw-bold text-uppercase text-muted fs-7 border-bottom pb-1 mb-2">
                      <i className="bi bi-calculator me-1 text-corporate-primary"></i> Budgets ({matchedBudgets.length})
                    </h6>
                    <div className="list-group list-group-flush">
                      {matchedBudgets.slice(0, 3).map((b) => (
                        <div
                          key={b.id}
                          className="list-group-item list-group-item-action py-2 d-flex align-items-center justify-content-between"
                        >
                          <div>
                            <span className="fw-bold text-dark font-monospace">{b.code}</span> ({b.departmentName})
                            <div className="text-muted fs-7">{b.category}</div>
                          </div>
                          <div className="d-flex align-items-center gap-2">
                            <span className="badge bg-secondary">{Number(b.allocatedAmount || 0).toLocaleString()} KES</span>
                            {onDrillDown && (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary py-0 px-2 fs-8"
                                onClick={() => {
                                  onDrillDown({ type: 'budget_line', id: b.code });
                                  onClose();
                                }}
                              >
                                360 View
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suppliers */}
                {matchedSuppliers.length > 0 && (
                  <div>
                    <h6 className="fw-bold text-uppercase text-muted fs-7 border-bottom pb-1 mb-2">
                      <i className="bi bi-people me-1 text-corporate-primary"></i> Suppliers ({matchedSuppliers.length})
                    </h6>
                    <div className="list-group list-group-flush">
                      {matchedSuppliers.slice(0, 3).map((s) => (
                        <div
                          key={s.id}
                          className="list-group-item list-group-item-action py-2 d-flex align-items-center justify-content-between"
                        >
                          <div>
                            <span className="fw-bold text-dark">{s.name}</span>
                            <div className="text-muted fs-7">Contact: {s.contactPerson} &bull; PIN: {s.pin}</div>
                          </div>
                          {onDrillDown && (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger py-0 px-2 fs-8"
                              onClick={() => {
                                onDrillDown({ type: 'supplier', id: s.id });
                                onClose();
                              }}
                            >
                              Supplier 360
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Departments */}
                {matchedDepts.length > 0 && (
                  <div>
                    <h6 className="fw-bold text-uppercase text-muted fs-7 border-bottom pb-1 mb-2">
                      <i className="bi bi-building me-1 text-corporate-primary"></i> Departments ({matchedDepts.length})
                    </h6>
                    <div className="list-group list-group-flush">
                      {matchedDepts.slice(0, 3).map((d) => (
                        <div
                          key={d.id}
                          className="list-group-item list-group-item-action py-2 d-flex align-items-center justify-content-between"
                        >
                          <div>
                            <span className="fw-bold text-dark">{d.name}</span>
                            <div className="text-muted fs-7">Head: {d.headOfDepartment} &bull; Code: {d.code}</div>
                          </div>
                          {onDrillDown && (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-secondary py-0 px-2 fs-8"
                              onClick={() => {
                                onDrillDown({ type: 'department', id: d.id });
                                onClose();
                              }}
                            >
                              Dept 360
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Projects */}
                {matchedProjects.length > 0 && (
                  <div>
                    <h6 className="fw-bold text-uppercase text-muted fs-7 border-bottom pb-1 mb-2">
                      <i className="bi bi-kanban me-1 text-corporate-primary"></i> Projects ({matchedProjects.length})
                    </h6>
                    <div className="list-group list-group-flush">
                      {matchedProjects.slice(0, 3).map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="list-group-item list-group-item-action py-2 d-flex align-items-center justify-content-between"
                          onClick={() => {
                            onNavigateTab('projects');
                            onClose();
                          }}
                        >
                          <div>
                            <span className="fw-bold text-dark">{p.name}</span>
                            <div className="text-muted fs-7">PM: {p.projectManager} | Dept: {p.departmentName}</div>
                          </div>
                          <span className="badge bg-success">{p.progressPercent || 0}% Done</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Documents */}
                {matchedDocs.length > 0 && (
                  <div>
                    <h6 className="fw-bold text-uppercase text-muted fs-7 border-bottom pb-1 mb-2">
                      <i className="bi bi-file-earmark-text me-1 text-corporate-primary"></i> Documents ({matchedDocs.length})
                    </h6>
                    <div className="list-group list-group-flush">
                      {matchedDocs.slice(0, 4).map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          className="list-group-item list-group-item-action py-2 d-flex align-items-center justify-content-between"
                          onClick={() => {
                            onNavigateTab('documents');
                            onClose();
                          }}
                        >
                          <div>
                            <span className="fw-bold text-dark">{d.title}</span>
                            <div className="text-muted fs-7">{d.fileName} &bull; {d.type}</div>
                          </div>
                          <span className="badge bg-light text-dark border">{d.uploadDate || 'Document'}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="modal-footer py-2 px-3 bg-light d-flex justify-content-between">
            <span className="text-muted fs-7">
              <kbd className="bg-white border text-dark me-1">ESC</kbd> to close &bull; Click <span className="text-danger fw-bold">Trace</span> for instant transaction investigation
            </span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
