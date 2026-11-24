import React, { useState } from 'react';
import { DatabaseService } from '../services/db';
import { RoleType, Expenditure } from '../types';
import { showToast } from '../services/uiFeedback';

interface QuickActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
  role: RoleType;
  onNavigateTab?: (tab: string) => void;
}

export const QuickActionModal: React.FC<QuickActionModalProps> = ({
  isOpen,
  onClose,
  onRefresh,
  role,
  onNavigateTab,
}) => {

  const depts = DatabaseService.getDepartments();
  const projs = DatabaseService.getProjects();
  const sups = DatabaseService.getSuppliers();
  const settings = DatabaseService.getSettings();

  // Form states
  const [deptId, setDeptId] = useState(depts[0]?.id || 'dept-mcx');
  const [projId, setProjId] = useState('');
  const [supplierId, setSupplierId] = useState(sups[0]?.id || 'sup-mcx-01');
  const [amount, setAmount] = useState<string>('500000');
  const [vatAmount, setVatAmount] = useState<string>(
    String(Number((500000 * ((settings.vatRatePercent ?? 16) / 100)).toFixed(10)))
  );
  const [description, setDescription] = useState('');
  const [invoiceNo, setInvoiceNo] = useState(`INV-${Math.floor(1000 + Math.random() * 9000)}`);
  const [poNo, setPoNo] = useState(DatabaseService.generatePoNumber('MCX'));
  const [category, setCategory] = useState(settings.expenseCategories[0] || 'Marketing Campaigns');

  // Validation warning
  const [validationWarning, setValidationWarning] = useState<string | null>(null);
  const [forceOverride, setForceOverride] = useState(false);

  if (!isOpen) return null;

  const handleSaveExpenditure = (e: React.FormEvent) => {
    e.preventDefault();

    // Perform Budget Validation
    const validation = DatabaseService.validateExpenditureBudget(deptId, projId || undefined, Number(amount));

    if (!validation.isValid && !forceOverride) {
      setValidationWarning(validation.warningMessage || 'Budget limit exceeded!');
      return;
    }

    const selectedDept = depts.find((d) => d.id === deptId);
    const selectedProj = projs.find((p) => p.id === projId);
    const selectedSup = sups.find((s) => s.id === supplierId);

    const baseAmt = Number(amount || 0);
    const vatAmt = Number(vatAmount || 0);
    const totalAmt = Number((baseAmt + vatAmt).toFixed(10));

    const todayStr = new Date().toISOString().split('T')[0];
    const newExp: Expenditure = {
      id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      expenseId: DatabaseService.generateExpenseId(selectedDept?.code || 'MCX', 'PACL'),
      date: todayStr,
      expenseDate: todayStr,
      legalEntity: 'PACL',
      departmentId: deptId,
      departmentName: selectedDept?.name || 'General',
      projectId: projId || undefined,
      projectName: selectedProj?.name || undefined,
      supplierId: supplierId,
      supplierName: selectedSup?.name || 'Vendor',
      category: category,
      description: description || 'Quick expenditure entry',
      invoiceNumber: invoiceNo,
      purchaseOrder: poNo,
      amount: baseAmt,
      vatAmount: vatAmt,
      totalAmount: totalAmt,
      paymentStatus: 'Paid',
      isBudgetExceeded: !validation.isValid,
      requiresAuthorization: !validation.isValid,
      authorizedBy: !validation.isValid ? `${role} Override` : undefined,
      createdBy: `${role} User`,
      createdAt: new Date().toISOString(),
    };

    DatabaseService.saveExpenditure(newExp, `${role} User`, role);
    showToast(`Expenditure ${newExp.expenseId} recorded successfully.`, 'success');
    onRefresh();
    onClose();
  };

  return (
    <div
      className="modal show d-block"
      tabIndex={-1}
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', zIndex: 1055 }}
    >
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content shadow-lg border-0 rounded-3">
          <div className="modal-header bg-dark text-white p-3">
            <h5 className="modal-title fw-bold fs-6 d-flex align-items-center gap-2">
              <i className="bi bi-plus-circle-fill text-corporate-primary"></i> Fast ERP Data Entry Wizard
            </h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>

          <div className="modal-body p-4">
            {/* Direct Workspace Shortcuts */}
            {onNavigateTab && (
              <div className="bg-light border rounded-3 p-2.5 mb-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
                <span className="extra-small fw-bold text-muted text-uppercase">
                  <i className="bi bi-lightning-charge-fill text-danger me-1"></i>Jump Directly To:
                </span>
                <div className="d-flex align-items-center gap-1.5 flex-wrap">
                  {[
                    { tab: 'invoices', label: 'Log Invoice', icon: 'bi-receipt' },
                    { tab: 'lpos', label: 'Create LPO', icon: 'bi-file-earmark-spreadsheet' },
                    { tab: 'budgets', label: 'New Budget Line', icon: 'bi-calculator' },
                    { tab: 'projects', label: 'Create Project', icon: 'bi-kanban' },
                    { tab: 'documents', label: 'Upload Document', icon: 'bi-folder-plus' },
                  ].map((item) => (
                    <button
                      key={item.tab}
                      type="button"
                      className="btn btn-outline-dark bg-white btn-sm py-1 px-2 d-flex align-items-center gap-1"
                      style={{ fontSize: '0.74rem' }}
                      onClick={() => {
                        onClose();
                        onNavigateTab(item.tab);
                      }}
                    >
                      <i className={`bi ${item.icon} text-corporate-primary`}></i>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSaveExpenditure}>
                {validationWarning && (
                  <div className="alert alert-danger d-flex flex-column gap-2 p-3 mb-3" role="alert">
                    <div className="d-flex align-items-center gap-2 fw-bold">
                      <i className="bi bi-exclamation-triangle-fill fs-5"></i>
                      <span>Budget Validation Alert</span>
                    </div>
                    <div className="fs-7">{validationWarning}</div>
                    <div className="form-check mt-1">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="checkForce"
                        checked={forceOverride}
                        onChange={(e) => setForceOverride(e.target.checked)}
                      />
                      <label className="form-check-label fw-bold text-dark fs-7" htmlFor="checkForce">
                        I am authorized to bypass and log an Audit Trail Override.
                      </label>
                    </div>
                  </div>
                )}

                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label fw-semibold fs-7">Department *</label>
                    <select className="form-select fs-7" value={deptId} onChange={(e) => setDeptId(e.target.value)} required>
                      {depts.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-md-6">
                    <label className="form-label fw-semibold fs-7">Project (Optional)</label>
                    <select className="form-select fs-7" value={projId} onChange={(e) => setProjId(e.target.value)}>
                      <option value="">-- None (Department Wide) --</option>
                      {projs.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-md-6">
                    <label className="form-label fw-semibold fs-7">Supplier *</label>
                    <select className="form-select fs-7" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required>
                      {sups.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-md-6">
                    <label className="form-label fw-semibold fs-7">Expense Category *</label>
                    <select className="form-select fs-7" value={category} onChange={(e) => setCategory(e.target.value)}>
                      {settings.expenseCategories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-md-4">
                    <label className="form-label fw-semibold fs-7">Base Amount (KES) *</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      className="form-control fs-7 font-monospace"
                      value={amount}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setAmount(raw);
                        const rate = (settings.vatRatePercent ?? 16) / 100;
                        setVatAmount(String(Number((Number(raw || 0) * rate).toFixed(10))));
                      }}
                      required
                    />
                  </div>

                  <div className="col-md-4">
                    <label className="form-label fw-semibold fs-7">
                      VAT / Tax ({settings.vatRatePercent ?? 16}% – Exact) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      className="form-control fs-7 font-monospace"
                      value={vatAmount}
                      onChange={(e) => setVatAmount(e.target.value)}
                      required
                    />
                  </div>

                  <div className="col-md-4">
                    <label className="form-label fw-semibold fs-7">Total Amount (KES)</label>
                    <div className="form-control fs-7 bg-light fw-bold text-dark font-monospace">
                      {Number((Number(amount || 0) + Number(vatAmount || 0)).toFixed(10)).toLocaleString(undefined, {
                        maximumFractionDigits: 10,
                      })}
                    </div>
                  </div>

                  <div className="col-md-6">
                    <label className="form-label fw-semibold fs-7">Invoice Number</label>
                    <input
                      type="text"
                      className="form-control fs-7"
                      value={invoiceNo}
                      onChange={(e) => setInvoiceNo(e.target.value)}
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label fw-semibold fs-7">PO Number</label>
                    <input
                      type="text"
                      className="form-control fs-7"
                      value={poNo}
                      onChange={(e) => setPoNo(e.target.value)}
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label fw-semibold fs-7">Description</label>
                    <textarea
                      className="form-control fs-7"
                      rows={2}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="e.g. Cloud software license renewal for Q3"
                    ></textarea>
                  </div>
                </div>

                <div className="modal-footer px-0 pb-0 mt-4 border-top pt-3">
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClose}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-corporate btn-sm d-flex align-items-center gap-1">
                    <i className="bi bi-check-lg"></i>
                    Save Expenditure
                  </button>
                </div>
              </form>
          </div>
        </div>
      </div>
    </div>
  );
};
