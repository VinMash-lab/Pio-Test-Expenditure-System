import React, { useState, useMemo } from 'react';
import { DatabaseService } from '../services/db';
import { RoleType, DataArchiveItem } from '../types';
import { confirmDialog, showToast } from '../services/uiFeedback';

interface ArchiveViewProps {
  role: RoleType;
  onRefresh: () => void;
}

export const ArchiveView: React.FC<ArchiveViewProps> = ({ role, onRefresh }) => {
  const archives = DatabaseService.getArchives();
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('All');

  const filteredArchives = useMemo(() => {
    return archives.filter((item) => {
      if (selectedType !== 'All' && item.entityType !== selectedType) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !(item.entityId || '').toLowerCase().includes(q) &&
          !(item.description || '').toLowerCase().includes(q) &&
          !(item.deletedBy || '').toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [archives, selectedType, search]);

  const handleRestore = async (item: DataArchiveItem) => {
    const confirmed = await confirmDialog({
      title: 'Restore Archived Record',
      message: `Restore ${item.entityType} (${item.entityId}) back to active system state?`,
      confirmLabel: 'Restore Record',
      variant: 'primary',
    });
    if (confirmed) {
      DatabaseService.restoreArchivedItem(item.id, `${role} User`, role);
      onRefresh();
      showToast(`${item.entityType} ${item.entityId} has been successfully restored.`, 'success');
    }
  };

  const handlePurge = async (id: string) => {
    if (role !== 'Administrator') {
      showToast('Only Administrators can permanently purge records from archive.', 'warning');
      return;
    }
    const confirmed = await confirmDialog({
      title: 'Permanent Deletion',
      message: 'This will permanently purge the archived record and cannot be undone. Are you sure?',
      confirmLabel: 'Permanently Purge',
      variant: 'danger',
    });
    if (confirmed) {
      DatabaseService.permanentlyPurgeArchive(id, `${role} User`, role);
      showToast('Archived record permanently purged.', 'info');
      onRefresh();
    }
  };

  return (
    <div className="d-flex flex-column gap-4">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 pb-2 border-bottom">
        <div>
          <div className="d-flex align-items-center gap-2">
            <h3 className="fw-bold mb-0 text-dark" style={{ fontFamily: 'Tahoma, sans-serif' }}>
              Archive & Data Recovery Centre
            </h3>
            <span className="badge bg-secondary text-white px-2 py-1">Soft-Deleted Storage</span>
          </div>
          <p className="text-muted small mb-0 mt-1">
            Safeguard against accidental loss: restore previously removed budgets, projects, and procurement documents.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card card-erp p-3 shadow-sm">
        <div className="row g-2 align-items-center">
          <div className="col-12 col-md-6">
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-light text-muted border-end-0">
                <i className="bi bi-search"></i>
              </span>
              <input
                type="text"
                className="form-control form-control-sm border-start-0"
                placeholder="Search archived items by code, description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="col-6 col-md-4">
            <select
              className="form-select form-select-sm"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              <option value="All">All Entity Types</option>
              <option value="Budget">Budgets</option>
              <option value="Project">Projects</option>
              <option value="LPO">LPOs</option>
              <option value="Invoice">Invoices</option>
              <option value="Quotation">Quotations</option>
              <option value="PaymentRequest">Payment Requests</option>
              <option value="Expenditure">Expenditures</option>
            </select>
          </div>
          <div className="col-6 col-md-2 text-end">
            <button
              onClick={() => {
                setSearch('');
                setSelectedType('All');
              }}
              className="btn btn-outline-secondary btn-sm w-100"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Archive Table */}
      <div className="card card-erp shadow-sm overflow-hidden">
        <div className="card-header bg-white py-3 px-4 d-flex justify-content-between align-items-center">
          <h6 className="mb-0 fw-bold text-dark">Archived System Records</h6>
          <span className="badge bg-light text-dark border">{filteredArchives.length} Archived Items</span>
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0 erp-table">
            <thead className="table-light">
              <tr className="small text-uppercase text-muted">
                <th>Type</th>
                <th>Identifier</th>
                <th>Description</th>
                <th>Archived By</th>
                <th>Archived Date</th>
                <th className="text-center" style={{ width: '120px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredArchives.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-5 text-muted">
                    <i className="bi bi-archive fs-2 d-block mb-2 text-secondary opacity-50"></i>
                    Archive storage is empty. No deleted records found.
                  </td>
                </tr>
              ) : (
                filteredArchives.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className="badge bg-secondary text-white">{item.entityType}</span>
                    </td>
                    <td className="fw-semibold text-dark">{item.entityId}</td>
                    <td className="small text-muted">{item.description}</td>
                    <td className="small">{item.deletedBy}</td>
                    <td className="small text-muted">{new Date(item.deletedAt).toLocaleString()}</td>
                    <td className="text-center">
                      <div className="btn-group btn-group-sm">
                        <button
                          onClick={() => handleRestore(item)}
                          className="btn btn-outline-success btn-sm p-1"
                          title="Restore Record"
                        >
                          <i className="bi bi-arrow-counterclockwise"></i> Restore
                        </button>
                        {role === 'Administrator' && (
                          <button
                            onClick={() => handlePurge(item.id)}
                            className="btn btn-outline-danger btn-sm p-1"
                            title="Permanently Purge"
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
