import React, { useState } from 'react';
import { DatabaseService } from '../services/db';

export const AuditTrailView: React.FC = () => {
  const trail = DatabaseService.getAuditTrail();
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const filteredTrail = trail.filter((t) => {
    const q = search.toLowerCase();
    if (
      search &&
      !(t.details || '').toLowerCase().includes(q) &&
      !(t.performedBy || '').toLowerCase().includes(q) &&
      !(t.entity || '').toLowerCase().includes(q)
    )
      return false;
    if (actionFilter && t.action !== actionFilter) return false;
    return true;
  });

  return (
    <div className="d-flex flex-column gap-4">
      {/* Search & Filter Header */}
      <div className="card card-erp p-3">
        <div className="row g-2 align-items-center">
          <div className="col-12 col-md-5">
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-white">
                <i className="bi bi-search text-muted"></i>
              </span>
              <input
                type="text"
                className="form-control"
                placeholder="Search audit trail details or user..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="col-6 col-md-3">
            <select className="form-select form-select-sm" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
              <option value="">All Actions</option>
              <option value="CREATE">CREATE</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
              <option value="APPROVE">APPROVE</option>
              <option value="EXCEED_BUDGET_OVERRIDE">EXCEED_BUDGET_OVERRIDE</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="card card-erp p-0 overflow-hidden">
        <div className="card-header bg-dark text-white py-2.5 px-3 d-flex align-items-center justify-content-between">
          <span className="fw-bold fs-7 text-uppercase d-flex align-items-center gap-2">
            <i className="bi bi-shield-check text-corporate-primary"></i> Enterprise Audit Log ({filteredTrail.length} Records)
          </span>
          <span className="badge bg-secondary fs-7">IP Subnet: 192.168.1.0/24</span>
        </div>

        <div className="table-responsive">
          <table className="table table-hover table-erp align-middle mb-0" style={{ fontSize: '0.82rem' }}>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Log Details</th>
                <th>User / Role</th>
                <th>IP Address</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrail.map((log) => (
                <tr key={log.id} className={log.action === 'EXCEED_BUDGET_OVERRIDE' ? 'bg-danger-subtle' : ''}>
                  <td className="text-muted" style={{ fontSize: '0.75rem' }}>
                    {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A'}
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        log.action === 'CREATE'
                          ? 'bg-success'
                          : log.action === 'UPDATE'
                          ? 'bg-primary'
                          : log.action === 'DELETE'
                          ? 'bg-danger'
                          : log.action === 'EXCEED_BUDGET_OVERRIDE'
                          ? 'bg-danger'
                          : 'bg-dark'
                      }`}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td className="fw-semibold">{log.entity}</td>
                  <td className="fw-medium text-dark">{log.details}</td>
                  <td>
                    <div className="fw-bold text-dark">{log.performedBy}</div>
                    <small className="text-muted" style={{ fontSize: '0.72rem' }}>Role: {log.userRole}</small>
                  </td>
                  <td className="font-mono text-muted">{log.ipAddress}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
