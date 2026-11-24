import React, { useState } from 'react';
import { DatabaseService } from '../services/db';
import { Department, RoleType } from '../types';
import { confirmDialog, showToast } from '../services/uiFeedback';

interface DepartmentsViewProps {
  role: RoleType;
  onRefresh: () => void;
}

export const DepartmentsView: React.FC<DepartmentsViewProps> = ({ role, onRefresh }) => {
  const depts = DatabaseService.getDepartments();
  const settings = DatabaseService.getSettings();

  const [showModal, setShowModal] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [head, setHead] = useState('');
  const [headcount, setHeadcount] = useState<number>(10);
  const [description, setDescription] = useState('');

  const handleOpenCreate = () => {
    setEditingDept(null);
    setCode('');
    setName('');
    setHead('');
    setHeadcount(10);
    setDescription('');
    setShowModal(true);
  };

  const handleOpenEdit = (d: Department) => {
    setEditingDept(d);
    setCode(d.code);
    setName(d.name);
    setHead(d.headOfDepartment);
    setHeadcount(d.headcount);
    setDescription(d.description);
    setShowModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const deptToSave: Department = {
      id: editingDept ? editingDept.id : 'dept-' + Date.now(),
      code: code || name.substring(0, 3).toUpperCase(),
      name,
      headOfDepartment: head,
      allocatedBudget: editingDept ? editingDept.allocatedBudget : 10000000,
      totalSpent: editingDept ? editingDept.totalSpent : 0,
      headcount: Number(headcount),
      description,
    };

    DatabaseService.saveDepartment(deptToSave, `${role} User`, role);
    showToast(editingDept ? 'Department updated.' : 'Department created.', 'success');
    onRefresh();
    setShowModal(false);
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirmDialog({
      title: 'Delete Department',
      message: 'Are you sure you want to delete this department?',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (confirmed) {
      DatabaseService.deleteDepartment(id, `${role} User`, role);
      showToast('Department deleted.', 'info');
      onRefresh();
    }
  };

  return (
    <div className="d-flex flex-column gap-4">
      {/* Top Header */}
      <div className="d-flex align-items-center justify-content-between">
        <div>
          <h5 className="h6 fw-bold mb-1">Corporate Departments Directory</h5>
          <span className="text-muted fs-7">Managing budget caps, staffing, and departmental expenditures</span>
        </div>
        <button type="button" onClick={handleOpenCreate} className="btn btn-corporate btn-sm d-flex align-items-center gap-1">
          <i className="bi bi-plus-circle-fill"></i>
          <span>Add Department</span>
        </button>
      </div>

      {/* Departments Grid */}
      <div className="row g-3">
        {depts.map((d) => {
          const utilPercent = d.allocatedBudget > 0 ? Math.min(100, (d.totalSpent / d.allocatedBudget) * 100) : 0;
          const remaining = d.allocatedBudget - d.totalSpent;

          return (
            <div key={d.id} className="col-12 col-md-6 col-xl-4">
              <div className="card card-erp p-3 h-100 d-flex flex-column justify-content-between">
                <div>
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <span className="badge bg-dark text-white font-mono px-2 py-1 fs-7">{d.code}</span>
                    <div className="btn-group btn-group-sm">
                      <button
                        type="button"
                        className="btn btn-light text-primary border p-1 px-2"
                        title="Edit"
                        onClick={() => handleOpenEdit(d)}
                      >
                        <i className="bi bi-pencil-fill"></i>
                      </button>
                      <button
                        type="button"
                        className="btn btn-light text-danger border p-1 px-2"
                        title="Delete"
                        onClick={() => handleDelete(d.id)}
                      >
                        <i className="bi bi-trash-fill"></i>
                      </button>
                    </div>
                  </div>

                  <h3 className="h6 fw-bold mb-1 text-dark">{d.name}</h3>
                  <div className="text-muted fs-7 mb-3 d-flex align-items-center gap-2">
                    <span>
                      <i className="bi bi-person-badge me-1 text-corporate-primary"></i> Head: {d.headOfDepartment}
                    </span>
                    <span>•</span>
                    <span>
                      <i className="bi bi-people me-1"></i> {d.headcount} Staff
                    </span>
                  </div>

                  <p className="fs-7 text-secondary mb-3" style={{ minHeight: '40px' }}>
                    {d.description}
                  </p>
                </div>

                <div>
                  {/* Budget Progress Bar */}
                  <div className="mb-2">
                    <div className="d-flex justify-content-between fs-7 mb-1">
                      <span className="fw-semibold text-muted">Budget Utilization</span>
                      <span className={`fw-bold ${utilPercent >= 90 ? 'text-danger' : 'text-dark'}`}>{utilPercent.toFixed(1)}%</span>
                    </div>
                    <div className="progress" style={{ height: '8px' }}>
                      <div
                        className={`progress-bar ${utilPercent >= 90 ? 'bg-danger' : utilPercent >= 75 ? 'bg-warning' : 'bg-success'}`}
                        style={{ width: `${utilPercent}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Financial Metrics */}
                  <div className="row text-center g-1 pt-2 border-top">
                    <div className="col-4">
                      <small className="text-muted fs-7 d-block">Allocated</small>
                      <span className="fw-bold fs-7 text-dark">{Math.round(d.allocatedBudget / 1000000)}M {settings.currencySymbol}</span>
                    </div>
                    <div className="col-4">
                      <small className="text-muted fs-7 d-block">Spent</small>
                      <span className="fw-bold fs-7 text-danger">{Math.round(d.totalSpent / 1000000)}M {settings.currencySymbol}</span>
                    </div>
                    <div className="col-4">
                      <small className="text-muted fs-7 d-block">Balance</small>
                      <span className="fw-bold fs-7 text-success">{Math.round(remaining / 1000000)}M {settings.currencySymbol}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Form */}
      {showModal && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0">
              <div className="modal-header bg-dark text-white py-2.5 px-3">
                <h5 className="modal-title fw-bold fs-6">{editingDept ? 'Edit Department' : 'Add New Department'}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowModal(false)}></button>
              </div>

              <form onSubmit={handleSave}>
                <div className="modal-body p-3">
                  <div className="row g-3">
                    <div className="col-md-4">
                      <label className="form-label fw-semibold fs-7">Code *</label>
                      <input
                        type="text"
                        className="form-control fs-7"
                        placeholder="e.g. ICT"
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        required
                      />
                    </div>

                    <div className="col-md-8">
                      <label className="form-label fw-semibold fs-7">Department Name *</label>
                      <input
                        type="text"
                        className="form-control fs-7"
                        placeholder="e.g. ICT / Marketing / HR"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                      />
                    </div>

                    <div className="col-md-8">
                      <label className="form-label fw-semibold fs-7">Head of Department *</label>
                      <input
                        type="text"
                        className="form-control fs-7"
                        placeholder="e.g. Eng. David Ochieng"
                        value={head}
                        onChange={(e) => setHead(e.target.value)}
                        required
                      />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label fw-semibold fs-7">Headcount *</label>
                      <input
                        type="number"
                        className="form-control fs-7"
                        value={headcount}
                        onChange={(e) => setHeadcount(Number(e.target.value))}
                        required
                      />
                    </div>

                    <div className="col-12">
                      <label className="form-label fw-semibold fs-7">Description</label>
                      <textarea
                        className="form-control fs-7"
                        rows={2}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                      ></textarea>
                    </div>
                  </div>
                </div>

                <div className="modal-footer py-2 px-3">
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-corporate btn-sm">
                    {editingDept ? 'Save Changes' : 'Create Department'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
