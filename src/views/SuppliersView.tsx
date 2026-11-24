import React, { useState } from 'react';
import { DatabaseService } from '../services/db';
import { Supplier, RoleType, SupplierStatus, DrillDownTarget } from '../types';
import { confirmDialog, showToast } from '../services/uiFeedback';

interface SuppliersViewProps {
  role: RoleType;
  onRefresh: () => void;
  onDrillDown?: (target: DrillDownTarget) => void;
}

export const SuppliersView: React.FC<SuppliersViewProps> = ({ role, onRefresh, onDrillDown }) => {
  const sups = DatabaseService.getSuppliers();
  const settings = DatabaseService.getSettings();

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingSup, setEditingSup] = useState<Supplier | null>(null);

  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [address, setAddress] = useState('');
  const [services, setServices] = useState('');
  const [status, setStatus] = useState<SupplierStatus>('Active');

  const filteredSuppliers = sups.filter((s) => {
    const q = search.toLowerCase();
    if (
      search &&
      !(s.name || '').toLowerCase().includes(q) &&
      !(s.pin || '').toLowerCase().includes(q) &&
      !(s.contactPerson || '').toLowerCase().includes(q)
    )
      return false;
    return true;
  });

  const handleOpenCreate = () => {
    setEditingSup(null);
    setName('');
    setContact('');
    setPhone('');
    setEmail('');
    setPin(`P05${Math.floor(100000 + Math.random() * 900000)}Z`);
    setAddress('Nairobi, Kenya');
    setServices('IT Services, Cloud Hosting');
    setStatus('Active');
    setShowModal(true);
  };

  const handleOpenEdit = (s: Supplier) => {
    setEditingSup(s);
    setName(s.name || '');
    setContact(s.contactPerson || '');
    setPhone(s.phone || '');
    setEmail(s.email || '');
    setPin(s.pin || '');
    setAddress(s.address || '');
    setServices(Array.isArray(s.servicesOffered) ? s.servicesOffered.join(', ') : '');
    setStatus(s.status);
    setShowModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    const supToSave: Supplier = {
      id: editingSup ? editingSup.id : 'sup-' + Date.now(),
      name,
      contactPerson: contact,
      phone,
      email,
      pin,
      address,
      servicesOffered: services.split(',').map((s) => s.trim()).filter(Boolean),
      status,
      totalPaid: editingSup ? editingSup.totalPaid : 0,
      rating: 4.8,
    };

    DatabaseService.saveSupplier(supToSave, `${role} User`, role);
    showToast(editingSup ? 'Supplier updated.' : 'Supplier registered.', 'success');
    onRefresh();
    setShowModal(false);
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirmDialog({
      title: 'Remove Vendor',
      message: 'Are you sure you want to remove this vendor from the directory?',
      confirmLabel: 'Remove Vendor',
      variant: 'danger',
    });
    if (confirmed) {
      DatabaseService.deleteSupplier(id, `${role} User`, role);
      showToast('Vendor removed.', 'info');
      onRefresh();
    }
  };

  return (
    <div className="d-flex flex-column gap-4">
      {/* Header & Search Bar */}
      <div className="card card-erp p-3">
        <div className="d-flex flex-column flex-md-row align-items-center justify-content-between gap-2">
          <div className="input-group input-group-sm flex-grow-1" style={{ maxWidth: '380px' }}>
            <span className="input-group-text bg-white">
              <i className="bi bi-search text-muted"></i>
            </span>
            <input
              type="text"
              className="form-control"
              placeholder="Search Vendor Name, KRA PIN, Contact..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <button type="button" onClick={handleOpenCreate} className="btn btn-corporate btn-sm d-flex align-items-center gap-1 ms-auto">
            <i className="bi bi-plus-lg"></i>
            <span>Add Supplier</span>
          </button>
        </div>
      </div>

      {/* Supplier Grid */}
      <div className="row g-3">
        {filteredSuppliers.map((s) => (
          <div key={s.id} className="col-12 col-md-6 col-xl-4">
            <div className="card card-erp p-3 h-100 d-flex flex-column justify-content-between">
              <div>
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <span className={`badge ${s.status === 'Preferred' ? 'bg-success' : s.status === 'Active' ? 'bg-primary' : 'bg-secondary'}`}>
                    {s.status} Vendor
                  </span>
                  <span className="fs-7 text-muted fw-bold">PIN: {s.pin}</span>
                </div>

                <h3 className="h6 fw-bold mb-1">
                  <button
                    type="button"
                    className="btn btn-link p-0 text-decoration-none fw-bold text-dark text-start fs-6"
                    title="Open Supplier 360 Dossier"
                    onClick={() => onDrillDown && onDrillDown({ type: 'supplier', id: s.id })}
                  >
                    {s.name}
                  </button>
                </h3>
                <div className="text-muted fs-7 mb-2">
                  <i className="bi bi-person me-1 text-corporate-primary"></i> {s.contactPerson}
                </div>

                <div className="fs-7 text-muted mb-2">
                  <i className="bi bi-telephone me-1"></i> {s.phone} | <i className="bi bi-envelope me-1"></i> {s.email}
                </div>

                <div className="fs-7 text-muted mb-3">
                  <i className="bi bi-geo-alt me-1"></i> {s.address}
                </div>

                <div className="d-flex flex-wrap gap-1 mb-3">
                  {(Array.isArray(s.servicesOffered) ? s.servicesOffered : []).map((serv, idx) => (
                    <span key={idx} className="badge bg-light text-dark border" style={{ fontSize: '0.68rem' }}>
                      {serv}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <div className="p-2 bg-light rounded text-center mb-3">
                  <small className="text-muted fs-7 d-block">Total Disbursed (FY {settings.financialYear || '2026'})</small>
                  <span className="fw-bold fs-6 text-dark font-monospace">{Number(s.totalPaid || 0).toLocaleString()} {settings.currencySymbol}</span>
                </div>

                <div className="d-flex justify-content-between align-items-center pt-2 border-top">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger py-0.5 px-2"
                    title="View Supplier 360 Dossier & Traced Records"
                    onClick={() => onDrillDown && onDrillDown({ type: 'supplier', id: s.id })}
                  >
                    <i className="bi bi-search me-1"></i> 360 Dossier
                  </button>
                  <div className="d-flex gap-1">
                    <button type="button" className="btn btn-sm btn-outline-secondary py-0.5 px-2" onClick={() => handleOpenEdit(s)}>
                      <i className="bi bi-pencil me-1"></i> Edit
                    </button>
                    <button type="button" className="btn btn-sm btn-outline-danger py-0.5 px-2" onClick={() => handleDelete(s.id)}>
                      <i className="bi bi-trash"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Form */}
      {showModal && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content shadow-lg border-0">
              <div className="modal-header bg-dark text-white py-2.5 px-3">
                <h5 className="modal-title fw-bold fs-6">{editingSup ? 'Edit Vendor Details' : 'Register New Supplier'}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowModal(false)}></button>
              </div>

              <form onSubmit={handleSave}>
                <div className="modal-body p-3">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label fw-semibold fs-7">Supplier Name *</label>
                      <input type="text" className="form-control fs-7" value={name} onChange={(e) => setName(e.target.value)} required />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label fw-semibold fs-7">Contact Person *</label>
                      <input type="text" className="form-control fs-7" value={contact} onChange={(e) => setContact(e.target.value)} required />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label fw-semibold fs-7">Phone Number *</label>
                      <input type="text" className="form-control fs-7" value={phone} onChange={(e) => setPhone(e.target.value)} required />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label fw-semibold fs-7">Email Address *</label>
                      <input type="email" className="form-control fs-7" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label fw-semibold fs-7">KRA Tax PIN *</label>
                      <input type="text" className="form-control fs-7" value={pin} onChange={(e) => setPin(e.target.value)} required />
                    </div>

                    <div className="col-md-8">
                      <label className="form-label fw-semibold fs-7">Physical Address</label>
                      <input type="text" className="form-control fs-7" value={address} onChange={(e) => setAddress(e.target.value)} />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label fw-semibold fs-7">Vendor Status *</label>
                      <select className="form-select fs-7" value={status} onChange={(e) => setStatus(e.target.value as SupplierStatus)}>
                        <option value="Active">Active</option>
                        <option value="Preferred">Preferred</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>

                    <div className="col-12">
                      <label className="form-label fw-semibold fs-7">Services Offered (Comma Separated)</label>
                      <input
                        type="text"
                        className="form-control fs-7"
                        placeholder="e.g. Cloud Hosting, Internet Bandwidth, Hardware Supply"
                        value={services}
                        onChange={(e) => setServices(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="modal-footer py-2 px-3">
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-corporate btn-sm">
                    {editingSup ? 'Save Changes' : 'Register Supplier'}
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
