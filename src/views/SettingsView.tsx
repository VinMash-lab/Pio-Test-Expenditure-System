import React, { useState } from 'react';
import { DatabaseService } from '../services/db';
import { SystemSettings, RoleType } from '../types';

interface SettingsViewProps {
  role: RoleType;
  onRefresh: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ role, onRefresh }) => {
  const currentSettings = DatabaseService.getSettings();
  const [settings, setSettings] = useState<SystemSettings>(currentSettings);
  const [newCat, setNewCat] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [resetModalStep, setResetModalStep] = useState<0 | 1 | 2>(0);
  const [confirmInput, setConfirmInput] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    DatabaseService.updateSettings(settings, `${role} User`, role);
    onRefresh();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleExecuteReset = () => {
    if (confirmInput.trim() !== 'RESET') return;
    DatabaseService.resetAllData();
    setResetModalStep(0);
    setConfirmInput('');
    setResetSuccess(true);
    onRefresh();
    setTimeout(() => setResetSuccess(false), 4000);
  };

  const handleAddCategory = () => {
    if (!newCat.trim()) return;
    if (settings.expenseCategories.includes(newCat.trim())) return;
    setSettings({
      ...settings,
      expenseCategories: [...settings.expenseCategories, newCat.trim()],
    });
    setNewCat('');
  };

  const handleRemoveCategory = (cat: string) => {
    setSettings({
      ...settings,
      expenseCategories: settings.expenseCategories.filter((c) => c !== cat),
    });
  };

  return (
    <div className="d-flex flex-column gap-4">
      {resetSuccess && (
        <div className="alert alert-warning d-flex align-items-center gap-2 p-3 shadow-sm mb-0">
          <i className="bi bi-trash3-fill fs-5 text-danger"></i>
          <div>
            <strong>System Data Purged:</strong> All budgets, expenditures, projects, suppliers, LPOs, documents, and notifications have been completely cleared. System returned to blank state.
          </div>
        </div>
      )}

      {savedSuccess && (
        <div className="alert alert-success d-flex align-items-center gap-2 p-3 shadow-sm mb-0">
          <i className="bi bi-check-circle-fill fs-5"></i>
          <span>System Settings & Financial Configuration Saved Successfully!</span>
        </div>
      )}

      <form onSubmit={handleSaveSettings}>
        {/* Company Details & Financial Setup */}
        <div className="card card-erp p-4 mb-4">
          <h5 className="h6 fw-bold border-bottom pb-2 mb-3 d-flex align-items-center gap-2">
            <i className="bi bi-building text-corporate-primary"></i> Company Profile & Tax Identification
          </h5>

          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label fw-semibold fs-7">Company Name</label>
              <input
                type="text"
                className="form-control fs-7"
                value={settings.companyName}
                onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                required
              />
            </div>

            <div className="col-md-3">
              <label className="form-label fw-semibold fs-7">Financial Year</label>
              <input
                type="text"
                className="form-control fs-7"
                value={settings.financialYear}
                onChange={(e) => setSettings({ ...settings, financialYear: e.target.value })}
                required
              />
            </div>

            <div className="col-md-3">
              <label className="form-label fw-semibold fs-7">Currency Symbol / Code</label>
              <input
                type="text"
                className="form-control fs-7"
                value={settings.currencySymbol}
                onChange={(e) => setSettings({ ...settings, currencySymbol: e.target.value, currencyCode: e.target.value })}
                required
              />
            </div>

            <div className="col-md-3">
              <label className="form-label fw-semibold fs-7">KRA Tax PIN</label>
              <input
                type="text"
                className="form-control fs-7"
                value={settings.kraPin}
                onChange={(e) => setSettings({ ...settings, kraPin: e.target.value })}
              />
            </div>

            <div className="col-md-3">
              <label className="form-label fw-semibold fs-7">Standard VAT / Tax Rate (%)</label>
              <input
                type="number"
                min="0"
                step="any"
                className="form-control fs-7 font-monospace"
                value={settings.vatRatePercent}
                onChange={(e) => setSettings({ ...settings, vatRatePercent: Number(e.target.value) })}
              />
            </div>

            <div className="col-md-3">
              <label className="form-label fw-semibold fs-7">Phone Contact</label>
              <input
                type="text"
                className="form-control fs-7"
                value={settings.phone}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
              />
            </div>

            <div className="col-md-3">
              <label className="form-label fw-semibold fs-7">Email Contact</label>
              <input
                type="email"
                className="form-control fs-7"
                value={settings.email}
                onChange={(e) => setSettings({ ...settings, email: e.target.value })}
              />
            </div>

            <div className="col-12">
              <label className="form-label fw-semibold fs-7">Physical Office Address</label>
              <input
                type="text"
                className="form-control fs-7"
                value={settings.address}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Approval Levels & Thresholds */}
        <div className="card card-erp p-4 mb-4">
          <h5 className="h6 fw-bold border-bottom pb-2 mb-3 d-flex align-items-center gap-2">
            <i className="bi bi-shield-check text-corporate-primary"></i> Approval Matrix & Budget Alert Thresholds
          </h5>

          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label fw-semibold fs-7">Level 1 Approval Limit ({settings.currencySymbol})</label>
              <input
                type="number"
                min="0"
                step="any"
                className="form-control fs-7"
                value={settings.approvalLevels.level1Limit}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    approvalLevels: { ...settings.approvalLevels, level1Limit: Number(e.target.value) },
                  })
                }
              />
            </div>

            <div className="col-md-4">
              <label className="form-label fw-semibold fs-7">Level 2 Approval Limit ({settings.currencySymbol})</label>
              <input
                type="number"
                min="0"
                step="any"
                className="form-control fs-7"
                value={settings.approvalLevels.level2Limit}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    approvalLevels: { ...settings.approvalLevels, level2Limit: Number(e.target.value) },
                  })
                }
              />
            </div>

            <div className="col-md-4">
              <label className="form-label fw-semibold fs-7">Level 3 Board Limit ({settings.currencySymbol})</label>
              <input
                type="number"
                min="0"
                step="any"
                className="form-control fs-7"
                value={settings.approvalLevels.level3Limit}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    approvalLevels: { ...settings.approvalLevels, level3Limit: Number(e.target.value) },
                  })
                }
              />
            </div>
          </div>
        </div>

        {/* Expense Categories Management */}
        <div className="card card-erp p-4 mb-4">
          <div className="d-flex align-items-center justify-content-between border-bottom pb-2 mb-3">
            <h5 className="h6 fw-bold mb-0 d-flex align-items-center gap-2">
              <i className="bi bi-tags-fill text-corporate-primary"></i> Marketing & CX Expense Categories ({settings.expenseCategories.length})
            </h5>
            <span className="text-muted fs-7">Add, edit, or archive departmental expense heads</span>
          </div>

          <div className="input-group input-group-sm mb-3" style={{ maxWidth: '500px' }}>
            <input
              type="text"
              className="form-control"
              placeholder="e.g., Digital Influencer Marketing"
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
            />
            <button type="button" onClick={handleAddCategory} className="btn btn-corporate">
              <i className="bi bi-plus-lg me-1"></i> Add Category
            </button>
          </div>

          <div className="row g-2">
            {settings.expenseCategories.map((cat) => (
              <div key={cat} className="col-12 col-md-6 col-lg-4">
                <div className="p-2 border rounded bg-light d-flex align-items-center justify-content-between gap-2">
                  <div className="d-flex align-items-center gap-2 overflow-hidden">
                    <i className="bi bi-tag text-corporate-primary"></i>
                    <span className="fs-7 fw-semibold text-dark text-truncate">{cat}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveCategory(cat)}
                    className="btn btn-sm btn-link text-danger p-0 border-0"
                    title="Archive/Remove Category"
                  >
                    <i className="bi bi-trash3-fill"></i>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Data Management Section */}
        <div className="card card-erp border-danger-subtle p-4 mb-4" id="data-management-section">
          <div className="d-flex align-items-center justify-content-between border-bottom pb-2 mb-3">
            <h5 className="h6 fw-bold mb-0 text-danger d-flex align-items-center gap-2">
              <i className="bi bi-database-fill-slash"></i> Data Management & System Reset
            </h5>
            <span className="badge bg-danger-subtle text-danger border border-danger-subtle">Protected Function</span>
          </div>

          <div className="row align-items-center g-3">
            <div className="col-md-8">
              <h6 className="fw-bold fs-7 mb-1 text-dark">Reset All System Data</h6>
              <p className="text-muted fs-7 mb-0">
                Permanently purge all budgets, expenditures, projects, suppliers, LPOs, documents, transactions, and notification records. System configuration and entity definitions will be preserved.
              </p>
            </div>
            <div className="col-md-4 text-md-end">
              <button
                type="button"
                onClick={() => setResetModalStep(1)}
                className="btn btn-outline-danger fw-semibold fs-7"
              >
                <i className="bi bi-trash3 me-1"></i> Reset All Data
              </button>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="text-end">
          <button type="submit" className="btn btn-corporate btn-lg px-4 fs-6 shadow-sm">
            <i className="bi bi-check-lg me-1"></i> Save Configuration
          </button>
        </div>
      </form>

      {/* STEP 1 CONFIRMATION MODAL */}
      {resetModalStep === 1 && (
        <div className="modal show d-block tab-fadeIn" style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1055 }} tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-danger shadow-lg">
              <div className="modal-header bg-danger text-white">
                <h5 className="modal-title fw-bold fs-6 d-flex align-items-center gap-2">
                  <i className="bi bi-exclamation-triangle-fill"></i> Warning – Confirm System Data Purge
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setResetModalStep(0)}></button>
              </div>
              <div className="modal-body p-4">
                <div className="alert alert-danger mb-3">
                  <p className="fw-bold mb-1">⚠️ WARNING</p>
                  <p className="mb-0 fs-7">
                    This action will permanently remove all budgets, expenditures, projects, suppliers, LPOs, documents, transactions, and other system data. This action cannot be undone.
                  </p>
                </div>
                <p className="fs-7 text-secondary">
                  The system will revert to an empty initial state with zero financial figures, zero projects, zero suppliers, and zero transaction logs.
                </p>
              </div>
              <div className="modal-footer bg-light">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setResetModalStep(0)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm fw-bold"
                  onClick={() => {
                    setConfirmInput('');
                    setResetModalStep(2);
                  }}
                >
                  Proceed to Final Confirmation <i className="bi bi-arrow-right ms-1"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2 CONFIRMATION MODAL */}
      {resetModalStep === 2 && (
        <div className="modal show d-block tab-fadeIn" style={{ backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1060 }} tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-danger shadow-lg">
              <div className="modal-header bg-dark text-white border-bottom border-danger">
                <h5 className="modal-title fw-bold fs-6 text-danger d-flex align-items-center gap-2">
                  <i className="bi bi-shield-lock-fill"></i> Final Confirmation Required
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setResetModalStep(0)}></button>
              </div>
              <div className="modal-body p-4">
                <p className="fw-semibold text-dark fs-7 mb-2">
                  To prevent accidental loss of data, please type <span className="bg-light px-2 py-1 border rounded text-danger fw-bold">RESET</span> in the box below to authorize the deletion:
                </p>
                <input
                  type="text"
                  className="form-control form-control-lg border-danger fs-6 fw-bold mb-3"
                  placeholder="Type RESET"
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  autoFocus
                />
                <div className="fs-8 text-muted">
                  Note: Legal entity configurations, user permissions, and company settings will remain intact. All business records will be deleted.
                </div>
              </div>
              <div className="modal-footer bg-light">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setResetModalStep(0);
                    setConfirmInput('');
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm fw-bold"
                  disabled={confirmInput.trim() !== 'RESET'}
                  onClick={handleExecuteReset}
                >
                  <i className="bi bi-trash3-fill me-1"></i> PERMANENTLY RESET ALL DATA
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
