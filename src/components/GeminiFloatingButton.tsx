import React from 'react';

interface GeminiFloatingButtonProps {
  onClick: () => void;
  isOpen: boolean;
}

export const GeminiFloatingButton: React.FC<GeminiFloatingButtonProps> = ({ onClick, isOpen }) => {
  if (isOpen) return null;

  return (
    <div
      className="position-fixed"
      style={{
        zIndex: 1050,
        bottom: '24px',
        right: '24px',
      }}
    >
      <button
        type="button"
        className="btn btn-dark shadow-lg d-flex align-items-center gap-2 px-3 py-2 border-0"
        style={{
          borderRadius: '30px',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)',
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.35)',
          transition: 'all 0.2s ease-in-out',
        }}
        onClick={onClick}
        title="Open Gemini AI Financial Advisor"
      >
        <div
          className="d-flex align-items-center justify-content-center rounded-circle bg-primary text-white"
          style={{ width: '28px', height: '28px' }}
        >
          <i className="bi bi-robot fs-6"></i>
        </div>
        <div className="text-start">
          <div className="fw-bold text-white lh-1" style={{ fontSize: '0.84rem' }}>
            Gemini AI Advisor
          </div>
          <div className="text-info lh-1 mt-1" style={{ fontSize: '0.68rem' }}>
            Context-Aware Assistant
          </div>
        </div>
        <span className="badge bg-primary ms-1" style={{ fontSize: '0.65rem' }}>
          3.8 Flash
        </span>
      </button>
    </div>
  );
};
