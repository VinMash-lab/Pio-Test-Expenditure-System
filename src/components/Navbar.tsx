import React, { useState, useRef, useEffect } from 'react';
import { RoleType, ERPNotification, SystemSettings } from '../types';
import { DatabaseService } from '../services/db';
import { useAuth } from '../contexts/AuthContext';

interface NavbarProps {
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  currentRole: RoleType;
  onRoleChange: (role: RoleType) => void;
  notifications: ERPNotification[];
  onOpenGlobalSearch: () => void;
  onOpenQuickAction?: () => void;
  settings?: SystemSettings;
  onRefreshData: () => void;
  onOpenGeminiChat?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  darkMode,
  setDarkMode,
  currentRole,
  onRoleChange,
  notifications = [],
  onOpenGlobalSearch,
  onOpenQuickAction,
  settings,
  onRefreshData,
  onOpenGeminiChat,
}) => {
  const activeSettings = settings || DatabaseService.getSettings();
  const { user, isAdmin, isSyncingCloud, signOutUser } = useAuth();
  const [showNotifPopover, setShowNotifPopover] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const roleRef = useRef<HTMLDivElement>(null);
  const unreadCount = (notifications || []).filter((n) => !n.isRead).length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifPopover(false);
      }
      if (roleRef.current && !roleRef.current.contains(event.target as Node)) {
        setShowRoleMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleClearNotifs = () => {
    DatabaseService.clearAllNotifications();
    onRefreshData();
  };

  const [isSyncing, setIsSyncing] = useState(false);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await DatabaseService.syncWithCloud();
      onRefreshData();
    } catch {
      // surfaced via AuthContext cloudError
    } finally {
      setTimeout(() => setIsSyncing(false), 600);
    }
  };

  return (
    <header className="top-navbar d-flex align-items-center justify-content-between px-3 px-md-4">
      {/* Brand & Logo */}
      <div className="d-flex align-items-center gap-3">
        <div className="d-flex align-items-center gap-2">
          <div
            className="d-flex align-items-center justify-content-center text-white fw-bold rounded shadow-sm"
            style={{ width: '36px', height: '36px', backgroundColor: '#FF0000' }}
          >
            <i className="bi bi-briefcase-fill fs-5"></i>
          </div>
          <div className="lh-1 d-none d-sm-block">
            <h1 className="h6 mb-0 fw-bold tracking-tight text-uppercase" style={{ fontSize: '0.95rem' }}>
              {activeSettings.companyName}
            </h1>
            <small className="text-muted" style={{ fontSize: '0.72rem' }}>
              Enterprise ERP Budget Manager ({activeSettings.currencySymbol})
            </small>
          </div>
        </div>
      </div>

      {/* Global Search Bar */}
      <div className="flex-grow-1 mx-3 mx-lg-5" style={{ maxWidth: '480px' }}>
        <button
          type="button"
          onClick={onOpenGlobalSearch}
          className="btn btn-outline-secondary w-full d-flex align-items-center justify-content-between px-3 py-1 text-start"
          style={{
            backgroundColor: darkMode ? '#2B303A' : '#F1F3F5',
            borderColor: darkMode ? '#3A404D' : '#E9ECEF',
            borderRadius: '20px',
            fontSize: '0.85rem',
          }}
        >
          <span className="d-flex align-items-center gap-2 text-muted">
            <i className="bi bi-search text-corporate-primary"></i>
            <span className="d-none d-md-inline">Global Search (Budget Code, Invoice, Project, Dept, Supplier...)</span>
            <span className="d-inline d-md-none">Search...</span>
          </span>
          <kbd className="bg-light text-dark px-1.5 py-0.5 rounded border fs-7 d-none d-lg-inline">Ctrl + K</kbd>
        </button>
      </div>

      {/* Right Controls */}
      <div className="d-flex align-items-center gap-2 gap-md-3">
        {/* Quick Action Button */}
        {onOpenQuickAction && (
          <button
            type="button"
            onClick={onOpenQuickAction}
            className="btn btn-sm btn-corporate d-none d-sm-flex align-items-center gap-1 shadow-sm"
          >
            <i className="bi bi-plus-lg"></i>
            <span>Quick Entry</span>
          </button>
        )}

        {/* Gemini AI Advisor Trigger */}
        {onOpenGeminiChat && (
          <button
            type="button"
            onClick={onOpenGeminiChat}
            className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1.5 px-2.5 py-1 shadow-sm"
            title="Open Gemini AI Financial Advisor"
          >
            <i className="bi bi-robot text-primary"></i>
            <span className="fw-semibold fs-7 d-none d-md-inline">Gemini Advisor</span>
            <span className="badge bg-primary text-white" style={{ fontSize: '0.62rem' }}>AI</span>
          </button>
        )}

        {/* Cloud Sync Status & Sync Button */}
        <button
          type="button"
          onClick={handleManualSync}
          className="btn btn-sm btn-outline-success d-none d-md-flex align-items-center gap-1.5 px-2.5 py-1"
          title="Connected to Firebase Firestore Database. Click to sync."
          disabled={isSyncing || isSyncingCloud}
        >
          <span className="spinner-grow spinner-grow-sm text-success" style={{ width: '8px', height: '8px' }} role="status"></span>
          <i className={`bi bi-cloud-check-fill text-success ${isSyncing || isSyncingCloud ? 'spin' : ''}`}></i>
          <span className="fw-semibold fs-7">{isSyncing || isSyncingCloud ? 'Syncing...' : 'Cloud Synced'}</span>
        </button>

        {/* Currency Badge */}
        <span className="badge bg-secondary-subtle text-secondary border px-2 py-1.5 d-none d-sm-inline" style={{ fontSize: '0.75rem' }}>
          <i className="bi bi-currency-exchange me-1 text-corporate-primary"></i>
          {activeSettings.currencyCode}
        </span>

        {/* Dark Mode Toggle */}
        <button
          type="button"
          onClick={() => setDarkMode(!darkMode)}
          className="btn btn-sm border-0 text-muted fs-5 px-2"
          title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {darkMode ? <i className="bi bi-sun-fill text-warning"></i> : <i className="bi bi-moon-stars-fill text-dark"></i>}
        </button>

        {/* Notifications Dropdown */}
        <div className="position-relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setShowNotifPopover((prev) => !prev)}
            className="btn btn-sm border-0 position-relative text-muted fs-5 px-2"
            title="Notifications"
          >
            <i className="bi bi-bell-fill"></i>
            {unreadCount > 0 && (
              <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger fs-7">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifPopover && (
            <div
              className="position-absolute end-0 mt-2 card shadow-lg p-0 z-3 border-0"
              style={{ width: '340px', maxWidth: '90vw', borderRadius: '8px' }}
            >
              <div className="card-header bg-dark text-white d-flex align-items-center justify-content-between py-2 px-3">
                <span className="fw-bold fs-7">
                  <i className="bi bi-bell me-1 text-corporate-primary"></i> Budget Alerts ({notifications.length})
                </span>
                <button type="button" onClick={handleClearNotifs} className="btn btn-link btn-sm text-white-50 p-0 fs-7">
                  Clear All
                </button>
              </div>
              <div className="card-body p-0" style={{ maxHeight: '320px', overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div className="p-3 text-center text-muted fs-7">No new alerts or warnings</div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-2.5 border-bottom d-flex gap-2 align-items-start ${
                        !n.isRead ? 'bg-light-subtle font-semibold' : ''
                      }`}
                    >
                      <i
                        className={`bi ${
                          n.severity === 'danger'
                            ? 'bi-exclamation-triangle-fill text-danger'
                            : n.severity === 'warning'
                            ? 'bi-exclamation-circle-fill text-warning'
                            : 'bi-info-circle-fill text-primary'
                        } fs-6 mt-0.5`}
                      ></i>
                      <div className="flex-grow-1" style={{ fontSize: '0.78rem' }}>
                        <div className="fw-bold text-dark">{n.title}</div>
                        <div className="text-secondary">{n.message}</div>
                        <small className="text-muted" style={{ fontSize: '0.68rem' }}>
                          {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </small>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Role Switcher Dropdown */}
        <div className="dropdown position-relative" ref={roleRef}>
          <button
            className="btn btn-sm btn-outline-secondary dropdown-toggle d-flex align-items-center gap-1 px-2.5 py-1"
            type="button"
            onClick={() => setShowRoleMenu((prev) => !prev)}
            aria-expanded={showRoleMenu}
            style={{ fontSize: '0.82rem' }}
          >
            <i className="bi bi-person-circle text-corporate-primary"></i>
            <span className="fw-semibold d-none d-md-inline">{currentRole}</span>
          </button>
          {showRoleMenu && (
            <ul className="dropdown-menu dropdown-menu-end show shadow-sm fs-7" style={{ position: 'absolute', right: 0, top: '100%' }}>
              <li>
                <h6 className="dropdown-header text-uppercase fs-7">Select Active User Role</h6>
              </li>
              {(['Administrator', 'Market Research & Insights Lead', 'Marketing Director', 'Finance Manager', 'Campaign Manager', 'Read Only'] as RoleType[]).map((role) => (
                <li key={role}>
                  <button
                    type="button"
                    className={`dropdown-item d-flex align-items-center justify-content-between ${
                      currentRole === role ? 'active bg-danger text-white' : ''
                    }`}
                    onClick={() => {
                      onRoleChange(role);
                      setShowRoleMenu(false);
                    }}
                  >
                    <span>{role}</span>
                    {currentRole === role && <i className="bi bi-check2 me-1"></i>}
                  </button>
                </li>
              ))}
              {user && (
                <>
                  <li><hr className="dropdown-divider" /></li>
                  <li className="px-3 py-1">
                    <div className="fw-semibold text-dark text-truncate" style={{ maxWidth: '210px' }}>
                      {user.displayName || 'Authenticated User'}
                    </div>
                    <div className="text-muted text-truncate" style={{ maxWidth: '210px', fontSize: '0.7rem' }}>
                      {user.email}
                    </div>
                    {isAdmin && (
                      <span className="badge bg-dark text-white mt-1" style={{ fontSize: '0.65rem' }}>
                        Verified Admin
                      </span>
                    )}
                  </li>
                  <li>
                    <button
                      type="button"
                      className="dropdown-item text-danger d-flex align-items-center gap-2"
                      onClick={() => {
                        setShowRoleMenu(false);
                        void signOutUser();
                      }}
                    >
                      <i className="bi bi-box-arrow-right"></i>
                      <span>Sign Out</span>
                    </button>
                  </li>
                </>
              )}
            </ul>
          )}
        </div>
      </div>
    </header>
  );
};
