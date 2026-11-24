import React, { useEffect, useState } from 'react';
import {
  ConfirmRequest,
  subscribeToConfirms,
  subscribeToToasts,
  ToastPayload,
} from '../services/uiFeedback';

export const GlobalFeedbackHost: React.FC = () => {
  const [toasts, setToasts] = useState<ToastPayload[]>([]);
  const [confirmQueue, setConfirmQueue] = useState<ConfirmRequest[]>([]);

  useEffect(() => {
    const unsubToast = subscribeToToasts((toast) => {
      setToasts((prev) => [...prev, toast]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 4500);
    });

    const unsubConfirm = subscribeToConfirms((req) => {
      setConfirmQueue((prev) => [...prev, req]);
    });

    return () => {
      unsubToast();
      unsubConfirm();
    };
  }, []);

  const activeConfirm = confirmQueue[0] || null;

  const handleResolveConfirm = (accepted: boolean) => {
    if (!activeConfirm) return;
    const target = activeConfirm;
    setConfirmQueue((prev) => prev.slice(1));
    target.resolve(accepted);
  };

  useEffect(() => {
    if (!activeConfirm) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleResolveConfirm(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeConfirm]);

  const variantClass = (v: ToastPayload['variant']) => {
    switch (v) {
      case 'success':
        return 'bg-success text-white';
      case 'danger':
        return 'bg-danger text-white';
      case 'warning':
        return 'bg-warning text-dark';
      default:
        return 'bg-primary text-white';
    }
  };

  const variantIcon = (v: ToastPayload['variant']) => {
    switch (v) {
      case 'success':
        return 'bi-check-circle-fill';
      case 'danger':
        return 'bi-exclamation-octagon-fill';
      case 'warning':
        return 'bi-exclamation-triangle-fill';
      default:
        return 'bi-info-circle-fill';
    }
  };

  return (
    <>
      {/* Fixed Top-Right Toast Stack */}
      <div
        className="position-fixed top-0 end-0 p-3 d-flex flex-column gap-2"
        style={{ zIndex: 1090, maxWidth: '380px', pointerEvents: 'none' }}
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`shadow-lg rounded-3 px-3 py-2 d-flex align-items-start gap-2 ${variantClass(t.variant)}`}
            style={{ pointerEvents: 'auto' }}
            role="alert"
          >
            <i className={`bi ${variantIcon(t.variant)} mt-1 flex-shrink-0`} />
            <div className="small fw-medium flex-grow-1" style={{ whiteSpace: 'pre-line' }}>
              {t.message}
            </div>
            <button
              type="button"
              className={`btn-close btn-close-sm ${t.variant === 'warning' ? '' : 'btn-close-white'} ms-1 flex-shrink-0`}
              aria-label="Close"
              onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
            />
          </div>
        ))}
      </div>

      {/* Confirmation Modal */}
      {activeConfirm && (
        <div
          className="modal d-block"
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.55)', zIndex: 1085 }}
          onClick={() => handleResolveConfirm(false)}
        >
          <div
            className="modal-dialog modal-dialog-centered"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
              <div className="modal-header border-bottom-0 pb-1">
                <h6 className="modal-title fw-bold d-flex align-items-center gap-2 mb-0">
                  <i
                    className={`bi ${
                      activeConfirm.variant === 'danger'
                        ? 'bi-exclamation-triangle-fill text-danger'
                        : activeConfirm.variant === 'warning'
                        ? 'bi-exclamation-circle-fill text-warning'
                        : 'bi-question-circle-fill text-primary'
                    }`}
                  />
                  <span>{activeConfirm.title}</span>
                </h6>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => handleResolveConfirm(false)}
                />
              </div>
              <div className="modal-body pt-2 pb-3 text-secondary small" style={{ whiteSpace: 'pre-line' }}>
                {activeConfirm.message}
              </div>
              <div className="modal-footer border-top-0 pt-0 gap-2">
                <button
                  type="button"
                  className="btn btn-light btn-sm px-3 fw-semibold"
                  onClick={() => handleResolveConfirm(false)}
                >
                  {activeConfirm.cancelLabel || 'Cancel'}
                </button>
                <button
                  type="button"
                  className={`btn btn-sm px-3 fw-semibold btn-${activeConfirm.variant || 'danger'}`}
                  onClick={() => handleResolveConfirm(true)}
                  autoFocus
                >
                  {activeConfirm.confirmLabel || 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
