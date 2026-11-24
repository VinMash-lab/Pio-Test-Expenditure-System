import React, { useState } from 'react';
import { DatabaseService } from '../services/db';
import { RoleType, UserRecord } from '../types';

interface UsersRolesViewProps {
  role: RoleType;
  onRefresh: () => void;
}

export const UsersRolesView: React.FC<UsersRolesViewProps> = ({ role, onRefresh }) => {
  const users = DatabaseService.getUsers();
  const depts = DatabaseService.getDepartments();

  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [userRole, setUserRole] = useState<RoleType>('Budget Officer');
  const [deptId, setDeptId] = useState(depts[0]?.id || 'dept-mcx');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');

  const permissionsMatrix = [
    { module: 'Annual Budget Planning & Revisions', Admin: 'Full Access', Manager: 'Full Access', Officer: 'Create/Edit', Viewer: 'View Only' },
    { module: 'Shared Projects Co-Funding Split', Admin: 'Full Access', Manager: 'Full Access', Officer: 'View & Split', Viewer: 'View Only' },
    { module: 'LPO Procurement & Issuance', Admin: 'Full Access', Manager: 'Approve / Issue', Officer: 'Create / Submit', Viewer: 'View Only' },
    { module: 'Invoice Accounts Payable & 3-Way Match', Admin: 'Full Access', Manager: 'Authorize', Officer: 'Log & Match', Viewer: 'View Only' },
    { module: 'Payment Requests & Settlement', Admin: 'Full Access', Manager: 'Authorize', Officer: 'Submit', Viewer: 'View Only' },
    { module: 'System Settings & Data Purge', Admin: 'Full Access', Manager: 'Restricted', Officer: 'No Access', Viewer: 'No Access' },
  ];

  const handleOpenCreate = () => {
    setEditingUser(null);
    setName('');
    setEmail('');
    setUserRole('Budget Officer');
    setDeptId(depts[0]?.id || 'dept-mcx');
    setStatus('Active');
    setShowModal(true);
  };

  const handleOpenEdit = (u: UserRecord) => {
    setEditingUser(u);
    setName(u.name);
    setEmail(u.email);
    setUserRole(u.role);
    setDeptId(u.departmentId || depts[0]?.id || 'dept-mcx');
    setStatus(u.status);
    setShowModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const deptObj = depts.find((d) => d.id === deptId);

    const userToSave: UserRecord = {
      id: editingUser ? editingUser.id : 'usr-' + Date.now(),
      name,
      email,
      role: userRole,
      departmentId: deptId,
      departmentName: deptObj?.name || 'Marketing & CX',
      status,
      createdAt: editingUser ? editingUser.createdAt : new Date().toISOString(),
      lastLogin: editingUser ? editingUser.lastLogin : undefined,
    };

    DatabaseService.saveUser(userToSave, `${role} User`, role);
    onRefresh();
    setShowModal(false);
  };

  const handleToggleStatus = (u: UserRecord) => {
    const updatedStatus = u.status === 'Active' ? 'Inactive' : 'Active';
    DatabaseService.saveUser({ ...u, status: updatedStatus }, `${role} User`, role);
    onRefresh();
  };

  return (
    <div className="d-flex flex-column gap-4">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 pb-2 border-bottom">
        <div>
          <div className="d-flex align-items-center gap-2">
            <h3 className="fw-bold mb-0 text-dark" style={{ fontFamily: 'Tahoma, sans-serif' }}>
              Users, Access & Role Permissions Matrix
            </h3>
            <span className="badge bg-dark text-white px-2 py-1">Security & RBAC</span>
          </div>
          <p className="text-muted small mb-0 mt-1">
            Configure system operators, assign departmental roles, and enforce Segregation of Duties (SoD).
          </p>
        </div>
        {role === 'Administrator' && (
          <button onClick={handleOpenCreate} className="btn btn-danger btn-sm d-flex align-items-center gap-1 shadow-sm">
            <i className="bi bi-person-plus-fill"></i> Provision User
          </button>
        )}
      </div>

      {/* Users Table */}
      <div className="card card-erp shadow-sm overflow-hidden">
        <div className="card-header bg-white py-3 px-4 d-flex justify-content-between align-items-center">
          <h6 className="mb-0 fw-bold text-dark">Authorized System Users</h6>
          <span className="badge bg-light text-dark border">{users.length} Users</span>
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0 erp-table">
            <thead className="table-light">
              <tr className="small text-uppercase text-muted">
                <th>Name</th>
                <th>Email</th>
                <th>Assigned Role</th>
                <th>Department</th>
                <th>Status</th>
                <th>Last Activity</th>
                <th className="text-center" style={{ width: '100px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="fw-bold text-dark">{u.name}</div>
                  </td>
                  <td className="small text-muted">{u.email}</td>
                  <td>
                    <span
                      className={`badge ${
                        u.role === 'Administrator'
                          ? 'bg-dark text-white'
                          : u.role === 'Marketing & CX Manager'
                          ? 'bg-danger text-white'
                          : u.role === 'Budget Officer'
                          ? 'bg-primary text-white'
                          : 'bg-secondary text-white'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="small">{u.departmentName}</td>
                  <td>
                    <span
                      className={`badge ${
                        u.status === 'Active' ? 'bg-success-subtle text-success border border-success' : 'bg-secondary text-white'
                      }`}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="extra-small text-muted">{u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'Never'}</td>
                  <td className="text-center">
                    {role === 'Administrator' && (
                      <div className="btn-group btn-group-sm">
                        <button
                          onClick={() => handleOpenEdit(u)}
                          className="btn btn-outline-secondary btn-sm p-1"
                          title="Edit User"
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button
                          onClick={() => handleToggleStatus(u)}
                          className="btn btn-outline-warning btn-sm p-1"
                          title={u.status === 'Active' ? 'Deactivate' : 'Activate'}
                        >
                          <i className={`bi ${u.status === 'Active' ? 'bi-person-x' : 'bi-person-check'}`}></i>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role Permission Matrix */}
      <div className="card card-erp shadow-sm overflow-hidden">
        <div className="card-header bg-white py-3 px-4">
          <h6 className="mb-0 fw-bold text-dark">Role-Based Access Control (RBAC) Permissions Matrix</h6>
        </div>
        <div className="table-responsive">
          <table className="table table-bordered align-middle mb-0 text-center">
            <thead className="table-light">
              <tr className="small text-uppercase text-muted">
                <th className="text-start" style={{ width: '35%' }}>Functional Module</th>
                <th>Administrator</th>
                <th>Marketing & CX Manager</th>
                <th>Budget Officer</th>
                <th>Viewer / Auditor</th>
              </tr>
            </thead>
            <tbody>
              {permissionsMatrix.map((p, i) => (
                <tr key={i}>
                  <td className="text-start fw-semibold text-dark">{p.module}</td>
                  <td><span className="badge bg-dark text-white">{p.Admin}</span></td>
                  <td><span className="badge bg-danger text-white">{p.Manager}</span></td>
                  <td><span className="badge bg-primary text-white">{p.Officer}</span></td>
                  <td><span className="badge bg-secondary text-white">{p.Viewer}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0">
              <div className="modal-header bg-danger text-white">
                <h5 className="modal-title fw-bold">
                  {editingUser ? 'Edit User Profile' : 'Provision New System User'}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowModal(false)}></button>
              </div>
              <form onSubmit={handleSave}>
                <div className="modal-body p-4">
                  <div className="row g-3">
                    <div className="col-12">
                      <label className="form-label small fw-semibold">Full Name *</label>
                      <input
                        type="text"
                        className="form-control"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. John Kamau"
                      />
                    </div>

                    <div className="col-12">
                      <label className="form-label small fw-semibold">Corporate Email Address *</label>
                      <input
                        type="email"
                        className="form-control"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. jkamau@pioneerassurance.co.ke"
                      />
                    </div>

                    <div className="col-12">
                      <label className="form-label small fw-semibold">Assigned Role *</label>
                      <select
                        className="form-select"
                        value={userRole}
                        onChange={(e) => setUserRole(e.target.value as RoleType)}
                        required
                      >
                        <option value="Administrator">Administrator (Full Master Access)</option>
                        <option value="Marketing & CX Manager">Marketing & CX Manager (Approver)</option>
                        <option value="Budget Officer">Budget Officer (Requisitioner)</option>
                        <option value="Finance Manager">Finance Manager (Treasury & Payments)</option>
                        <option value="Marketing Director">Marketing Director (Executive Approver)</option>
                        <option value="Campaign Manager">Campaign Manager (Campaign Lead)</option>
                        <option value="Market Research & Insights Lead">Market Research & Insights Lead</option>
                        <option value="Management">Management (Executive Oversight)</option>
                        <option value="Viewer">Viewer (Read-Only Auditor)</option>
                        <option value="Read Only">Read Only (Restricted)</option>
                      </select>
                    </div>

                    <div className="col-12">
                      <label className="form-label small fw-semibold">Department *</label>
                      <select
                        className="form-select"
                        value={deptId}
                        onChange={(e) => setDeptId(e.target.value)}
                        required
                      >
                        {depts.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-12">
                      <label className="form-label small fw-semibold">Account Status</label>
                      <select
                        className="form-select"
                        value={status}
                        onChange={(e) => setStatus(e.target.value as any)}
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive / Suspended</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-danger px-4">
                    {editingUser ? 'Save Changes' : 'Provision User'}
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
