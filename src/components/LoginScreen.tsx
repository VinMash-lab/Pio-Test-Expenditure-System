import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const LoginScreen: React.FC = () => {
  const { signInWithGoogle, authError, clearAuthError } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const handleSignIn = async () => {
    setSubmitting(true);
    try {
      await signInWithGoogle();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="min-vh-100 d-flex align-items-center justify-content-center p-4"
      style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #7f1d1d 100%)',
      }}
    >
      <div
        className="card border-0 shadow-lg overflow-hidden"
        style={{ maxWidth: '460px', width: '100%', borderRadius: '16px' }}
      >
        <div
          className="p-4 text-white text-center"
          style={{ background: 'linear-gradient(135deg, #b91c1c 0%, #dc2626 100%)' }}
        >
          <div
            className="mx-auto mb-3 d-flex align-items-center justify-content-center rounded-circle bg-white text-danger shadow-sm"
            style={{ width: '56px', height: '56px' }}
          >
            <i className="bi bi-shield-lock-fill fs-3"></i>
          </div>
          <h4 className="fw-bold mb-1">Corporate Budget Management</h4>
          <p className="mb-0 small text-white text-opacity-75">
            Pioneer Assurance (PACL) &amp; Pioneer General (PGIL)
          </p>
        </div>

        <div className="card-body p-4 p-md-5 bg-white">
          <div className="text-center mb-4">
            <h5 className="fw-bold text-dark mb-2">Enterprise Sign-In</h5>
            <p className="text-muted small mb-0">
              Sign in with your verified Google Workspace account to access departmental budgets, procurement LPOs, and live Firestore sync.
            </p>
          </div>

          {authError && (
            <div className="alert alert-danger py-2 px-3 small d-flex align-items-start justify-content-between gap-2 mb-3">
              <div>
                <i className="bi bi-exclamation-triangle-fill me-2"></i>
                {authError}
              </div>
              <button
                type="button"
                className="btn-close btn-sm"
                aria-label="Close"
                onClick={clearAuthError}
              ></button>
            </div>
          )}

          <button
            type="button"
            onClick={handleSignIn}
            disabled={submitting}
            className="btn btn-dark w-100 py-2.5 d-flex align-items-center justify-content-center gap-2 fw-semibold shadow-sm"
            style={{ borderRadius: '10px' }}
          >
            {submitting ? (
              <>
                <span className="spinner-border spinner-border-sm" role="status"></span>
                <span>Authenticating with Google...</span>
              </>
            ) : (
              <>
                <i className="bi bi-google text-warning"></i>
                <span>Continue with Google</span>
              </>
            )}
          </button>

          <div className="mt-4 pt-3 border-top d-flex flex-column gap-2 text-muted" style={{ fontSize: '0.75rem' }}>
            <div className="d-flex align-items-center gap-2">
              <i className="bi bi-check-circle-fill text-success"></i>
              <span>Protected by Firebase Authentication &amp; Verified Session Rules</span>
            </div>
            <div className="d-flex align-items-center gap-2">
              <i className="bi bi-database-lock text-primary"></i>
              <span>Dual-Entity Ledger Separation (PACL Life &amp; PGIL General)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
